# Tag-as-business UX (inline action vs Profile-level period import)

Status: accepted
Date: 2026-05-07
Chair: orchestrator
Participants: product-owner, product-manager, product-designer, mobile-builder, backend-builder, architect, engineering-manager, localization-specialist, qa, data-architect, security-privacy-officer
Co-signs required: product-designer + localization-specialist (new mobile UX flow), architect + engineering-manager (API contract — `AGENTS.md` §4.11), security-privacy-officer (user-data flow change — `AGENTS.md` §4.11).

## Context

`AGENTS.md` §2.8 bullets 8 + 9 close out the MVP: *"A user can tag a receipt as a business expense. A user can export tagged business expenses as a PDF for their accountant."* §5.3.2 already declares the endpoint shape: `POST /receipts/{receipt_id}/tag` with body `{ "is_business": boolean, "category": string, "notes": string }`.

What §5.3.2 does **not** decide is *where in the app* the tag happens. There are three realistic shapes:

1. **Inline tag-on-detail.** A toggle / button on the Receipt detail screen flips the receipt between untagged and tagged in one tap, with a category text input and notes field appearing inline.
2. **Profile-level period import.** A "Tag all receipts in this period as business" action on the Profile screen, possibly with a per-merchant filter. Optimized for freelancers who scan everything throughout the month and tag in bulk at the end.
3. **Both** — inline as the primary path, period-import as a power-user accelerator.

`AGENTS.md` §5.5.2 references "Tag as business expense" as an action on the **Receipt detail** screen (it is not mentioned in the Profile description), but the §5.5.2 wording is illustrative ("Actions: Tag as business expense, Delete, Share."), not normative — DES-0004 is the design artifact that locks the Profile screen.

The schema already supports any of the three shapes: `receipts.is_business_expense`, `receipts.business_category`, `receipts.notes` are all in `db/migrations/0001_init.sql`. `AGENTS.md` §5.4.4 ships the index `receipts (user_id, is_business_expense)` exactly to make export queries fast.

Constraints in scope:

- `AGENTS.md` §2.4 — country-agnostic schema (no GR-specific behavior in tag logic).
- `AGENTS.md` §3.2.1 — no PII in telemetry.
- `AGENTS.md` §5.4.5 — RLS on every read / write.
- ADR-0002 — Bearer JWT, verified `sub` is the canonical user filter, no client-supplied identity.
- ADR-0005 §6 — `category` is the column populated here (the user-tagged side); `inferred_category` (deferred per ADR-0010) is the future automated side.

## Rounds

### Round 1

- **product-owner**: I want bullet 8 of §2.8 to feel **one-tap, in-context**. The user just looked at a receipt — they know if it was a business expense or not. Forcing them to leave Receipt detail, navigate to Profile, pick a date range, and bulk-tag is bad UX for the 80% case (most freelancers tag receipts as they scan, not at month-end). Position: **inline tag-on-detail is the MVP critical path**. Bulk tag-from-Profile is a power-user feature; ship it later if real users ask for it.
- **product-manager**: Agree with `product-owner`. I'd add: shipping both at once dilutes the design and forces two implementation surfaces in one sprint. MVP scope is "the user can tag a receipt"; the Profile-level period import is a feature that wants its own design (filter, multi-select, category propagation) and would push S-006 over its size budget.
- **product-designer**: Inline tag-on-detail can be a single primary action button that opens a small inline panel (category text + notes + Save / Cancel). I'll spec the state machine (untagged → editing → saving → tagged → editing) in DES-0005. **Concern**: should the toggle live in the Receipt detail header or footer? Header keeps it visible above the fold; footer keeps the line-item table the focal element. I lean header, but want a Round-2 sanity check.
- **mobile-builder**: Inline is also the cheapest implementation: one new screen-local reducer in `mobile/src/screens/receipt/state.ts` (DES-0005), one new API helper in `mobile/src/api/receipts.ts` (`tagReceipt({ receiptId, isBusiness, category, notes })`), one POST. The Profile-level period import would need a multi-select grid with date filtering — basically a second Insights-shaped screen.
- **backend-builder**: Endpoint shape per §5.3.2 is `POST /receipts/{receipt_id}/tag` with body `{ is_business, category, notes }`. **Two design questions**: (a) what does `is_business=false` mean — does it null out `category` and `notes`, or leave them as historical record? (b) idempotency — re-POSTing the same body should be a no-op (200, not 201). Both are testable; my preference: **untagging clears `business_category` and `notes`** (history isn't needed for MVP — the user's intent is "this isn't a business expense", treat it like the row was never tagged). Idempotency: 200 always (it's an update, not a create); 201 is for new resources.
- **architect**: Endpoint as POST is fine; `AGENTS.md` §5.3.2 says POST. Semantically it's closer to PUT (idempotent state update), but the spec is normative — POST it is. The Bearer JWT + `sub`-as-user-id rule from ADR-0002 / ADR-0005 extends to this endpoint trivially. RLS: the existing receipt-level RLS policy already restricts writes to `auth.uid() = user_id`; the backend (which uses the service-key client) **must** still filter by `user_id = sub` in the WHERE clause (defense in depth, identical pattern to ADR-0005). Concern: do we want a server-side `category` allow-list for MVP? Otherwise a user can write any string ("blah") and the by-category rollup in `/insights/summary` will reflect that.
- **engineering-manager**: Server-side allow-list adds a config layer we don't have yet. **Counter-proposal**: `category` is **free-text** for MVP (cheap, no migration needed, the user's own words map best to their accounting), but the field is **trimmed, lowercased, and length-capped at 64 chars** server-side. The `/insights/summary` `by_category` rollup already groups by `business_category` value (ADR-0005 §6); if a user types "Groceries" once and "groceries" once, lowercasing makes them collapse correctly.
- **data-architect**: No schema migration needed: `receipts.is_business_expense BOOLEAN NOT NULL DEFAULT FALSE`, `receipts.business_category TEXT NULL`, `receipts.notes TEXT NULL` are already in `0001_init.sql`. No new index needed: the existing `receipts (user_id, is_business_expense)` index supports the export query in ADR-0009. **Concern**: should we add a `tagged_at TIMESTAMPTZ` column for "when was this tagged"? It's nice to have but not needed for MVP — `created_at` doesn't cover it (that's when the receipt landed) and we'd want it for any future per-period tagging UI. Would prefer to skip it for MVP.
- **localization-specialist**: Greek copy needed: `tag.title`, `tag.cta_tag`, `tag.cta_untag`, `tag.category.label`, `tag.category.placeholder`, `tag.notes.label`, `tag.notes.placeholder`, `tag.save`, `tag.cancel`, `tag.toast.tagged`, `tag.toast.untagged`, `tag.toast.error`. `business_category` is the user's free-text Greek; we display it as-is but compare lowercased per `engineering-manager`'s rule. UTF-8 round-trip already verified for Greek strings in S-002 / S-004; no new locale work.
- **qa**: Acceptance bullets I'll need: (a) tag on a receipt → screen shows the tagged state, the Insights `by_category` for the period now reflects the new category; (b) untag → category and notes cleared, Insights `by_category` rolls receipt back into "untagged"; (c) re-tag with same body → 200, no-op (`updated_at`-style telemetry only); (d) different user can't tag another user's receipt (RLS + WHERE-guard); (e) malformed body (missing `is_business`, non-string `category`, etc.) → 422; (f) too-long category (> 64 chars) → 422 with a clear Greek error; (g) telemetry logs only counts (`tag.applied`, `tag.removed`), never the category text or notes.
- **security-privacy-officer**: Two notes: (1) `notes` is free-text — users will type sensitive info there ("client meeting at X with Y about Z"). It must never appear in any log, telemetry, or error message — only in the receipt detail and the export PDF. The error envelope from ADR-0002 already excludes request bodies; same applies here. (2) The Greek tax-office posture: `business_category` is metadata the *user* chose, not a tax classification — accountants will re-categorize for their own purposes. We do not claim the field is a Greek tax category and the UI must not imply it is.

### Round 2

- **product-designer** (responding to own concern): On the toggle placement — sticking with **header** (right after the merchant name and before the line items). Rationale: the user's eye lands on the merchant first; the tag decision usually follows directly from "who is this from". The footer keeps line-items the focal element when *reading* the receipt; the tag panel opens below the toggle (in-place) so the line items remain visible. Locked in DES-0005 §3.1.
- **product-owner** (responding): Lock it. MVP path is the inline tag-on-detail.
- **product-manager** (responding): Profile-level period import becomes a backlog item, **not Ready**, captured at the bottom of the ADR.
- **architect** (responding to data-architect): No `tagged_at` for MVP — agree. If a future per-period UI needs it, we add the column at that time without breaking anything.
- **engineering-manager** (responding to architect): Free-text + 64-char cap + lowercased comparison stands.
- **backend-builder** (responding): Lock the response shape. On success, return the full updated receipt (the same shape as `GET /receipts/{id}` — keeps the mobile client's local state simple and avoids a second round-trip after tagging). HTTP 200 always; 201 only for create endpoints.
- **mobile-builder** (responding): Inline state machine in DES-0005. The optimistic-UI pattern (flip toggle locally, POST, revert on failure) keeps the screen feel snappy.
- **localization-specialist** (responding): All `tag.*` Greek strings will land in `mobile/src/i18n/strings.ts` against DES-0005 §5.
- **qa** (responding): Acceptance bullets above are sufficient. I'll convert them into BLG-0018 acceptance items.
- **security-privacy-officer** (responding): Both notes (1) + (2) are now in the §Decision below; co-sign granted.
- **data-architect** (responding): No migration needed. Confirmed.

### Round 3

- **product-owner**: No new concerns.
- **architect**: No new concerns.
- **backend-builder**: No new concerns.
- **mobile-builder**: No new concerns.
- **engineering-manager**: No new concerns.
- **product-designer**: No new concerns.
- **security-privacy-officer**: No new concerns.

No new concerns surfaced after Round 3. Closing.

## Decision

### 1. Primary path: inline tag-on-detail

- **The Receipt detail screen is the only place a user tags / untags a receipt for MVP.** Profile-level period import is **not** in MVP scope. It is captured as a future BLG (`Profile-level period import for tagging`).
- The tag UI lives in the Receipt detail **header**, immediately under the merchant name and above the line-items table. Layout details in DES-0005 §3.

### 2. Endpoint contract

`POST /receipts/{receipt_id}/tag`

- Bearer JWT required (ADR-0002).
- `user_id` is **always** the verified `sub`; never accepted from the client.
- The backend filters writes by `user_id = sub AND id = receipt_id` (defense in depth on top of RLS).
- Request body (Pydantic `extra="forbid"`):

```json
{
  "is_business": true,
  "category": "groceries",
  "notes": "client lunch at X"
}
```

Field rules:

- `is_business` — required, boolean.
- `category` — string, **trimmed**, **lowercased server-side**, length-capped **1..64 chars after trim**. When `is_business=true` and `category` is omitted or empty after trim → 422. When `is_business=false` → ignored, server clears the column.
- `notes` — string, **trimmed**, length-capped **0..500 chars**. Optional. When `is_business=false` → ignored, server clears the column.

Behavior:

- `is_business=true` → server sets `is_business_expense=true`, `business_category=<lowercased trimmed value>`, `notes=<trimmed value or null>`.
- `is_business=false` → server sets `is_business_expense=false`, `business_category=null`, `notes=null` (untagging clears history; this is MVP — no audit trail of past tags).
- Idempotent — re-POSTing the same body is a 200 no-op.

Response:

- HTTP 200 on success, body = the full updated receipt (same shape as `GET /receipts/{id}`).
- HTTP 401 on missing / invalid JWT.
- HTTP 404 on `receipt_id` not owned by `sub` (does not leak existence — see `security-privacy-officer` note below).
- HTTP 422 on body validation failures with the RFC-7807 envelope from ADR-0002.

### 3. Authorization & RLS

- The endpoint uses the service-key Supabase client (the same pattern as ADR-0002 inserts and ADR-0005 RPCs).
- Defense in depth: every write filters by `user_id = sub`. RLS policies on `receipts` are unchanged.
- The endpoint **never** reveals whether a `receipt_id` exists for a different user — a 404 is returned for both "no such receipt" and "receipt belongs to another user". This prevents enumeration of other users' receipt UUIDs.

### 4. Telemetry

Counts only, no PII:

- `tag.applied` — fired when `is_business=true` succeeds.
- `tag.removed` — fired when `is_business=false` succeeds.
- `tag.failed.network` / `tag.failed.auth` / `tag.failed.validation` — failure paths.

The `category` text and `notes` text are **never** logged or attached to telemetry events.

### 5. Insights interaction

- The `/insights/summary` `by_category` rollup (ADR-0005 §6) already groups by `business_category` value. With `category` now lowercased server-side, two-user inputs like `"Groceries"` and `"groceries"` collapse to a single bucket. ADR-0005 §6 is unchanged in spirit; the lowercased-server-side rule is reflected in BLG-0018's acceptance.

### 6. UX rules (locked into DES-0005)

- Tag toggle in Receipt detail header, above the line-items table.
- Inline panel (does not navigate away) for category + notes input.
- Optimistic UI: flip toggle locally, POST, revert on network / auth / validation failure with a Greek toast.
- Greek-first copy under `tag.*` namespace.
- Accessibility: `accessibilityRole="switch"` for the tag toggle; `accessibilityState={{ checked: isTagged }}`; touch target ≥ 44×44 dp.
- The UI must not imply `business_category` is a Greek tax-office classification — the field label is `Κατηγορία` ("Category"), not `Φορολογική κατηγορία` ("Tax category").

## Dissent

None recorded. All participants converged in Round 3.

## Consequences

**Positive:**

- BLG-0018 is **Ready** with crisp acceptance: one endpoint, one screen-level UX, no schema migration, no new outbound surface.
- Inline tag-on-detail is the cheapest implementation path that hits the §2.8 MVP bullet 8 — minimal surface for S-006.
- Free-text `category` + lowercased server-side keeps the `/insights/summary` `by_category` rollup (ADR-0005 §6) coherent without forcing a config layer.

**Negative:**

- Tag-once vs tag-many: a freelancer with 50 untagged receipts at month-end has to tap-and-tag 50 times. Mitigated by the future Profile-level period import BLG.
- Untagging clears `business_category` and `notes` — no history of past tags. Acceptable for MVP; if accountant workflows need history, a future ADR adds an audit table.
- `category` is free-text, so the by-category rollup quality depends on the user's discipline. Mitigated by lowercased server-side comparison and (post-MVP) the inferred-category heuristic per ADR-0010 if it ever activates.

**Follow-ups (added to backlog):**

- BLG-0018 acceptance bullets folded into the backlog item (this sprint).
- Future BLG: **Profile-level period import for tagging** — multi-select grid, date filter, per-merchant filter, batch tag with shared category. Out of MVP. Owner: `product-designer` + `mobile-builder` + `backend-builder`. Captured in `docs/backlog.md` as `BLG-0020` only if and when the user surfaces demand. (Not opened in S-005 — explicit decision to keep the backlog lean.)
