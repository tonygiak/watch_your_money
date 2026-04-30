# Insights computation strategy (where week / month / year aggregations live)

Status: accepted
Date: 2026-04-30
Chair: orchestrator
Participants: architect, data-architect, engineering-manager, backend-builder, mobile-builder, qa, parser-specialist, localization-specialist
Co-signs required: data-architect + architect (engineering decision crossing schema + endpoint boundaries — `AGENTS.md` §4.11).

## Context

`AGENTS.md` §5.3.2 mandates two insight endpoints:

- **GET `/insights/summary`** — `period` (week / month / year) → totals, by category, by merchant, vs previous period.
- **GET `/insights/products`** — `period` → most-purchased products with frequency, total spend, average price.

§2.5 sets the quality bar: **receipt visible within 5 s of scan**. §5.5.2 makes Insights one of the four screens. §5.4.2/§5.4.3 already carry the receipt-level + line-item data needed to compute every requested aggregate.

Two open questions remain:

1. **Where do the aggregations live?** SQL (Postgres views or materialized views), in-process Python (read raw rows, aggregate in FastAPI), or hybrid.
2. **How is `category` derived?** §5.5.2 says "spending by category"; the schema has `receipt_items.inferred_category` (nullable) and `receipts.business_category` (nullable). Neither is populated today — we have to decide what `category` means at query time and how the UI displays it.

Constraints in scope:

- `AGENTS.md` §2.4 — country-agnostic schema; `country_code` already on `receipts`.
- `AGENTS.md` §2.4 — no third-party paid services beyond the allowlist (so no managed analytics service).
- `AGENTS.md` §3.2.1 — secrets only via env; `SUPABASE_SERVICE_KEY` already in scope.
- `AGENTS.md` §5.4.5 — RLS on every read; the backend uses the service-key client and stamps `user_id = sub`.
- ADR-0002 — endpoints take Bearer JWT; the verified `sub` is the canonical user filter.
- ADR-0001 — VAT rate stored as percent number (`24.00`).

## Rounds

### Round 1

- **architect**: I propose **parameterized SQL inside the FastAPI layer, no DB views in the MVP**. Reasoning: (a) views couple aggregation logic to schema, slowing future migrations; (b) Python aggregation against SUM-over-N-thousand-rows-per-user is acceptable but wastes bandwidth pulling every row to the app server; (c) parameterized SQL gets us the speed of Postgres aggregation **and** keeps the logic in the same Python module that owns the endpoint, so it's testable, reviewable in PRs, and trivially relocatable to materialized views later if scale demands. The endpoint runs the SQL via the Supabase service-key client (or a direct asyncpg connection), still filters by `user_id = sub` in the WHERE clause (defense in depth on top of RLS).
- **data-architect**: I agree on parameterized SQL inside FastAPI. Two schema concerns: (1) we need an index on `receipts (user_id, issue_date)` — already in §5.4.4. Good. (2) the `vs previous period` math needs a window per period; on a week query, we need *this week* and *the previous week of the same length*; same logic for month/year. I want the period boundaries computed in Python (Europe/Athens timezone), passed as `from_date` / `to_date` / `prev_from_date` / `prev_to_date` parameters, then the SQL just does `SUM(...) FILTER (WHERE issue_date BETWEEN ...)` for both windows in a single query. Two roundtrips become one.
- **engineering-manager**: SQL-in-Python is fine. **Concern**: hand-rolled SQL is fragile if it grows. Cap the SQL footprint per endpoint at ~50 lines and test it via fixtures + a tiny in-process Postgres (e.g. an embedded Supabase test container — not in scope for this ADR but flagged). For MVP, integration tests against an `InMemoryReceiptStorage` that mimics the SQL semantics give us 80% coverage; the remaining 20% is an explicit "tested live in S-004" acceptance bullet.
- **backend-builder**: Implementation note: today's storage layer is split between `InMemoryReceiptStorage` and `SupabaseReceiptStorage`. The Insights path should follow the same pattern: an `InsightsRepository` interface with two implementations. The in-memory one computes by iterating Python; the Supabase one issues a single SQL query. Endpoint code calls the interface — same pattern as ADR-0001's `BaseReceiptParser`. Concern: the Supabase Python SDK does not expose raw parameterized SQL well; we either use the `rpc` call to a stored function (which would push logic back into the DB and contradict the "no views in MVP" stance) or we add `psycopg`/`asyncpg` as a runtime dep for direct Postgres connections.
- **mobile-builder**: Endpoint shape preference: `GET /insights/summary?period=month&anchor=2026-04-30` returns a single JSON with `current`, `previous`, `by_category`, `by_merchant`, and `top_products` already split. Avoids two endpoint round-trips on the Insights screen. Numbers come back as strings of the form `"42.00"` (decimal-as-string per ADR-0001 currency-handling discussion) so the mobile client formats them consistently with `mobile/src/lib/format.ts`.
- **qa**: Test strategy: (1) period-boundary helper unit tests (Athens TZ, week starts Monday, month rolls correctly into previous-month-of-31-days, year handles leap years); (2) `InsightsRepository` in-memory tests for every aggregate (totals, by category, by merchant, top products, vs previous); (3) endpoint contract tests for the two URLs with mocked repository. **Insist** that period boundaries are computed once, at the API layer, in Athens TZ (not UTC) — Greek users count their "April spend" in Greek calendar months.
- **parser-specialist**: Aside on `category`: the parser today writes `receipts.business_category` (nullable, from BLG-0002 user-tagged after scan) and `receipt_items.inferred_category` (nullable, never populated). For MVP, "by category" should mean **`receipts.business_category` for tagged receipts + an `Untagged` bucket for the rest**. Inferred category from EAN / description is a separate ML / heuristic story that doesn't belong in this ADR.
- **localization-specialist**: Localize bucket names (`Untagged` → `Χωρίς κατηγορία`; period labels `Εβδομάδα` / `Μήνας` / `Έτος`). All `insights.*` strings under `mobile/src/i18n/strings.ts`. Numbers: `X,XX €` per existing format helper. Dates: `DD-MM-YYYY` per ADR-0001 sibling rule.

### Round 2

- **architect** (responding to backend-builder on the SDK gap): I am NOT happy adding `psycopg` / `asyncpg` as a runtime dep. **Resolution**: use the Supabase REST endpoint `from('receipts').select('...')` with `.eq('user_id', sub)` for the **simple** parts (current totals, top merchants), and define the *more complex* "vs previous period" + "by category" as **PostgREST RPC calls to small SQL functions** (created via migration in S-004). RPC functions are NOT general "views" — they're scoped SQL helpers, owned by `data-architect`, named after the endpoint they serve. This keeps the dep tree at `supabase` only (no new psycopg/asyncpg) and pushes only the math into SQL. The aggregation **shape** stays in the FastAPI layer (which RPC to call, how to combine results into the response).
- **data-architect** (responding): Agree on RPC functions for the math. They live in `db/migrations/000N_insights_rpc.sql`. RLS-friendly: each RPC takes `user_uuid uuid` as a parameter and the function body filters `WHERE user_id = user_uuid`; the backend always passes the verified `sub`. We do **not** rely on `auth.uid()` inside the RPC because the backend service-key client doesn't carry an auth.uid; we pass it explicitly, which is identical to the ADR-0002 pattern for inserts.
- **engineering-manager** (responding): RPC + service-key call is fine. I want the SQL function bodies to be ≤ 30 lines each and ship with `EXPLAIN`-backed perf notes in their migration. That's a runbook detail, not an ADR detail.
- **backend-builder** (responding to architect): RPC works. Storage layer becomes `InsightsRepository` with `InMemoryInsightsRepository` (Python aggregation over the same in-memory list ADR-0002 already uses for tests) + `SupabaseInsightsRepository` (calls `supabase.rpc('insights_summary_for_user', {...})`). Endpoint stays storage-agnostic.
- **mobile-builder** (responding): Single combined `/insights/summary` response works. For Insights products, separate endpoint as §5.3.2 says — top-products may have a different cache/refresh story.
- **qa** (responding): RPC vs view distinction is captured. Tests: I'll add a contract test that passes a mock `InsightsRepository` and asserts JSON shape matches the documented schema below.
- **parser-specialist** (responding): No new concerns.
- **localization-specialist** (responding): Confirming the bucket / period strings will be added in DES-0003.

### Round 3

- **architect**: No new concerns.
- **data-architect**: No new concerns.
- **engineering-manager**: No new concerns.
- **backend-builder**: No new concerns.

No new concerns surfaced after Round 3. Closing.

## Decision

### 1. Where the aggregations live

- **Aggregation math runs in Postgres** via small **PostgREST RPC functions**, one per analytics shape. RPCs live in `db/migrations/<timestamp>_insights_rpc.sql` and are owned by `data-architect`.
- **No DB views** in the MVP. RPC functions are named `insights_summary_for_user(user_uuid uuid, from_date date, to_date date, prev_from_date date, prev_to_date date)` and `insights_top_products_for_user(user_uuid uuid, from_date date, to_date date, limit_n int)`.
- **Endpoint orchestration runs in FastAPI**: routes compute Athens-TZ period boundaries, call the right RPC, and shape the response.
- Storage layer mirrors ADR-0001 / ADR-0002 pattern: `InsightsRepository` interface with `InMemoryInsightsRepository` (tests + local dev) and `SupabaseInsightsRepository` (production).

### 2. RPC vs RLS

- Each RPC takes `user_uuid uuid` as a parameter; the function body filters `WHERE user_id = user_uuid`.
- The backend uses the **service-key** Supabase client (`SUPABASE_SERVICE_KEY`), already in scope per ADR-0002. The service-key bypasses RLS, so the explicit `WHERE user_id = user_uuid` is the security boundary.
- `user_uuid` is **always** the verified `sub` claim from the Bearer JWT — never a request parameter. Same rule as ADR-0002.
- RLS policies on `receipts` / `receipt_items` are unchanged. The mobile client never reads receipts via RPC; it reads them via the anon-key client + RLS, per ADR-0002 §5.

### 3. Period boundaries

- All period math is computed in **Europe/Athens** (`zoneinfo.ZoneInfo("Europe/Athens")`):
  - `period=week` → Monday 00:00 Athens to Sunday 23:59:59.999999 Athens, plus the previous Monday-Sunday window.
  - `period=month` → first day 00:00 Athens to last day 23:59:59.999999 Athens, plus the previous calendar month.
  - `period=year` → 1 Jan 00:00 to 31 Dec 23:59:59.999999, plus the previous calendar year.
- An optional `anchor` query parameter (ISO date) lets the client request a non-current period (defaults to today).
- Boundaries are converted to UTC instants only at the SQL boundary; the date columns (`receipts.issue_date date`) are matched against UTC date ranges with `>=` / `<` semantics.

### 4. Endpoint contracts

#### `GET /insights/summary?period={week|month|year}&anchor={YYYY-MM-DD}`

```json
{
  "period": "month",
  "anchor": "2026-04-30",
  "current": {
    "from_date": "2026-04-01",
    "to_date": "2026-04-30",
    "total": "412.50",
    "vat_total": "79.20",
    "receipt_count": 11
  },
  "previous": {
    "from_date": "2026-03-01",
    "to_date": "2026-03-31",
    "total": "503.10",
    "vat_total": "96.60",
    "receipt_count": 14
  },
  "by_category": [
    { "category": "groceries", "total": "210.30", "receipt_count": 6 },
    { "category": "untagged",  "total": "202.20", "receipt_count": 5 }
  ],
  "by_merchant": [
    { "merchant_name": "ALPHA SUPER MARKET", "total": "180.40", "receipt_count": 4 },
    { "merchant_name": "FARMACY KENTRO",     "total": "62.80",  "receipt_count": 2 }
  ]
}
```

#### `GET /insights/products?period={week|month|year}&anchor={YYYY-MM-DD}&limit={int<=50,default=10}`

```json
{
  "period": "month",
  "anchor": "2026-04-30",
  "from_date": "2026-04-01",
  "to_date":   "2026-04-30",
  "products": [
    {
      "ean": "5201360123456",
      "description": "ΓΑΛΑ ΦΡΕΣΚΟ 1L",
      "frequency": 8,
      "total_spend": "23.20",
      "average_unit_price": "1.45"
    }
  ]
}
```

### 5. Currency, dates, decimals

- All money fields are returned as **strings** of the form `"42.00"` (decimal-as-string), matching the parser-side decision in ADR-0001. Mobile formats via `mobile/src/lib/format.ts` (`X,XX €`, comma decimal).
- All date fields are ISO `YYYY-MM-DD`; the mobile formatter renders them as `DD-MM-YYYY`.
- `vat_total` is the sum of `receipt_items.total_value * vat_rate / (100 + vat_rate)` per receipt over the window (re-uses the parser-side `vat_rate` percent number from ADR-0001).

### 6. Category for MVP

- `category` = `receipts.business_category` if non-null, otherwise the literal string `"untagged"`.
- The mobile client localizes the literal `"untagged"` to `"Χωρίς κατηγορία"` (Greek) / `"Untagged"` (English).
- Inferred category from EAN / description is **out of scope** for MVP. A future BLG can add it; the schema already carries `receipt_items.inferred_category` for that day.

### 7. Authorization

- Both endpoints require a Bearer JWT (ADR-0002).
- `user_id` is the verified `sub`. **Not** a query parameter (the literal `AGENTS.md` §5.3.2 wording mentions `user_id` as a query — superseded here by the same §4.4 tie-breaker that applied in ADR-0002; recorded in this ADR's *Consequences*).
- Errors follow the ADR-0002 RFC-7807 envelope.

### 8. Test strategy (BLG-0006 acceptance)

- Unit: Athens-TZ period-boundary helper (week / month / year, leap years, DST boundaries).
- Repository: `InMemoryInsightsRepository` against curated synthetic receipts asserts every aggregate.
- Contract: route-level tests for both endpoints, mock repository, assert exact JSON shape.
- Live: one integration test marked `slow` that runs the SQL RPC against a local Postgres or Supabase test project in S-004 implementation.

## Dissent

None recorded. All participants converged in Round 3.

## Consequences

**Positive:**

- BLG-0006 is **Ready**: S-004 implements two endpoints, two RPC migrations, one `InsightsRepository` (in-memory + Supabase), the period-boundary helper, and the Insights screen against DES-0003.
- No new runtime dependency. `supabase`, `fastapi`, `pydantic` cover everything.
- Aggregation math is centralized at the SQL layer (fast) but NOT promoted to schema-coupled views (relocatable).
- Country-agnostic: the RPC functions take `user_uuid` only — no GR-specific assumptions, future EU adapters slot in.

**Negative:**

- `AGENTS.md` §5.3.2 lists `user_id` as a query parameter on the insights endpoints. **This ADR supersedes that literal wording** under the §4.4 tie-breaker — same precedent as ADR-0002. BLG-0010 (already in flight in this sprint) extends to cover the insights endpoints in the same edit.
- RPC migrations need careful review for SQL-injection-shape mistakes. Mitigated by parameterized RPC signatures (Postgres functions with typed args).

**Follow-ups (added to backlog):**

- BLG-0006 acceptance bullets folded into the backlog item (this sprint).
- BLG-0010's scope extended: §5.3.2 reconciliation also drops `user_id` from the insights endpoints' query params.
- Future BLG (out of scope here): inferred-category for `receipt_items.inferred_category` (heuristic / ML).
