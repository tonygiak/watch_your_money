# PDF export pipeline (`reportlab` vs `weasyprint` vs server-side `puppeteer`)

Status: accepted
Date: 2026-05-07
Chair: orchestrator
Participants: architect, backend-builder, agent-safety-officer, engineering-manager, security-privacy-officer, product-designer, localization-specialist, devops-engineer
Co-signs required: agent-safety-officer + engineering-manager (new runtime dependency — `AGENTS.md` §4.11), architect (engineering decision), security-privacy-officer (user-data flow — financial PII in the generated artifact).

## Context

`AGENTS.md` §2.8 bullet 9 closes the MVP: *"A user can export tagged business expenses as a PDF for their accountant."* §5.3.2 declares the endpoint: `GET /export/business-expenses?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD` returns a PDF.

The decision is which **PDF generation stack** lives in the FastAPI service. Three real candidates:

1. **`reportlab`** — pure-Python PDF library. Mature, BSD-style licensed. No system deps. Renders programmatically from Python (no HTML / CSS layer).
2. **`weasyprint`** — Python wrapper on top of GTK / Cairo / Pango / Fontconfig. Renders HTML + CSS to PDF. Strong typography but heavyweight system-lib chain.
3. **Server-side `puppeteer` / `playwright`** — Node + headless Chromium. Renders HTML to PDF via a real browser engine. Best fidelity for arbitrary CSS but adds a Chromium binary download (~170 MB) at install time and a new outbound host.

Constraints in scope:

- `AGENTS.md` §2.4 — no third-party paid services beyond Supabase + Railway / Render + `e-invoicing.gr`. All three candidates are open-source — none violates §2.4 directly, but `puppeteer`'s Chromium download from `storage.googleapis.com` would require an allowlist update.
- `AGENTS.md` §3.2.1 — supply-chain discipline; pinned versions; `agent-safety-officer` + `engineering-manager` review for runtime deps.
- `AGENTS.md` §3.2.1 — outbound surface; no new host without an ADR + allowlist update.
- `AGENTS.md` §5.3.2 — `GET /export/business-expenses` endpoint shape.
- `AGENTS.md` §5.4.4 — index `receipts (user_id, is_business_expense)` exists, supports the export query.
- ADR-0002 — Bearer JWT, verified `sub` is the canonical user filter, no client-supplied identity.
- ADR-0008 — `business_category` is the user-typed string for tagged receipts; export rows show it as-is.
- `AGENTS.md` §5.5.3 — Greek-first UX, `X,XX €`, `DD-MM-YYYY`, full UTF-8 / Greek glyph correctness.

The PDF is generated for an accountant's review. The accountant will read totals, dates, ΑΦΜ values, line items, payment methods, the user's category labels, and any notes the user wrote. The output must be **printable** and **legible**. It does **not** need bleeding-edge CSS — it is a tabular report.

## Rounds

### Round 1

- **architect**: I propose **`reportlab`**. Reasoning: (a) zero system deps means zero Dockerfile or buildpack work on Railway / Render — the existing `pip install -r requirements.txt` covers it; (b) zero new outbound host — PyPI is already on the allowlist; (c) the deliverable is a tabular report, which is `reportlab`'s sweet spot (`Table` + `Paragraph` primitives compose accountant-friendly output); (d) BSD-style license is clean for redistribution; (e) `reportlab` ships `DejaVuSans` and friends — full Greek glyph coverage out of the box. The "we don't get HTML / CSS" argument is real, but for a tabular report it's a non-issue; the layout is deterministic.
- **backend-builder**: Implementation note: `reportlab.platypus.Table` + `reportlab.platypus.Paragraph` + `SimpleDocTemplate(BytesIO())` gives us a PDF in memory. We stream it back via `fastapi.responses.StreamingResponse(..., media_type='application/pdf')`. The full pipeline is ~150 lines of Python; the rest is the data-layer query (which we already have a pattern for via `InsightsRepository` in ADR-0005). No new repository interface — a thin `BusinessExpensesQuery` helper is enough.
- **agent-safety-officer**: I'll run `review-external-surface.md` against all three. Up-front concerns: `reportlab` is the safest (single PyPI package, well-maintained, no native binaries, no network calls); `weasyprint` brings GTK / Cairo / Pango / Fontconfig system libs which on Railway / Render means a custom Dockerfile and a meaningfully larger SBOM; `puppeteer` adds `storage.googleapis.com` to the outbound allowlist (Chromium binary download at install time) plus a Chromium binary at runtime, both of which I'd need to debate as a separate allowlist ADR. **Strong preference for `reportlab` purely on supply-chain footprint.**
- **engineering-manager**: Agree on supply-chain reasoning. **Engineering concern**: the team has shipped Python with `requests`, `beautifulsoup4`, `supabase`, `pydantic`, `fastapi` so far. Adding `reportlab` is in-character (another mature PyPI package). Adding `weasyprint` means we now operate a Linux distro's worth of system packages from a Dockerfile we don't have. Ship time impact: `reportlab` is a half-day; `weasyprint` is at least a 2-3 day Dockerfile + buildpack debug session.
- **security-privacy-officer**: Whichever stack we pick, the **data-flow rule** is the same: the PDF carries user financial PII (merchant ΑΦΜ, dates, totals, line items, the user's category labels, the user's notes). Hard contract for this ADR: (a) PDF is generated **on-the-fly** per request; (b) **never** written to disk on the server; (c) **never** logged; (d) **never** transmitted anywhere except the response stream back to the requesting authenticated client. If the implementation ever needs to cache a generated PDF, that requires its own ADR (we'd be storing financial PII server-side, which would be a new data flow).
- **product-designer**: For accountants, the visual bar is "boring and legible". A clean header with the user's ΑΦΜ + date range + "Επαγγελματικά έξοδα" title, a totals block, then a table per receipt (date, merchant, ΑΦΜ, total, VAT, category) with line-item subrows. No color, no logo. `reportlab.platypus` covers this trivially.
- **localization-specialist**: Critical concern across all three: **Greek glyph coverage**. `reportlab` ships `DejaVuSans` (full Greek + Latin). `weasyprint` would inherit whatever fonts are in the system fontconfig — on Railway / Render's base image, that's usually **incomplete** (Greek glyphs may render as `□` boxes), so we'd need to add a Greek font to the Docker image. `puppeteer`'s Chromium uses its own font stack, also potentially incomplete; we'd need to install Greek fonts in the headless-Chrome environment. **`reportlab` wins this dimension by a wide margin.**
- **devops-engineer**: From a deploy POV: `reportlab` = `pip install`, no infra change. `weasyprint` = a Dockerfile + a system-lib SBOM + a CI step that builds + tests the image; we currently deploy via the Railway / Render Python builder — moving to a Dockerfile is a meaningful operational shift. `puppeteer` = even worse — Chromium binary, sandbox config, headless flags. **Strong preference for `reportlab`.**

### Round 2

- **agent-safety-officer** (responding, after running `review-external-surface.md`):

  > **Reviewed by `agent-safety-officer` on 2026-05-07.**
  > Surfaces evaluated: `reportlab`, `weasyprint`, server-side `puppeteer`.
  >
  > **`reportlab==4.2.5`** — Necessity: yes. Pinning: exact. Side-effects: none at install time; runtime side-effects = none beyond writing to the streamed response. Secrets: none introduced. Data flow: user financial PII goes in, PDF stream goes out — both already in scope per `AGENTS.md` §5.3.2. **Verdict: approved.** Conditions: pin must be exact (no carets) per `AGENTS.md` §3.2.1.
  >
  > **`weasyprint==62.3`** + Cairo / Pango / GTK / Fontconfig system libs — Necessity: yes if and only if HTML / CSS authoring is the chosen rendering path. Pinning: exact. Side-effects: install-time = pulls Cairo / Pango / GTK; runtime = those system libs are loaded into the FastAPI process. Secrets: none. Data flow: same as `reportlab`. **Verdict: approved with conditions** — (a) Dockerfile lands and is reviewed; (b) system-lib SBOM committed; (c) Greek font installed explicitly (DejaVuSans-Greek or similar) in the image; (d) CI builds the image. None of those are blockers, but they raise the operational cost meaningfully.
  >
  > **server-side `puppeteer`** — Necessity: only if HTML / CSS is required AND `weasyprint` is insufficient. Pinning: pinned but Chromium binary download from `storage.googleapis.com` adds **a new outbound host** at install time. Side-effects: Chromium runtime, sandbox, headless flags. Secrets: none. Data flow: same as the others. **Verdict: blocked at this stage.** Adding a new outbound host without a separate ADR + `architect` co-sign + allowlist update would violate `AGENTS.md` §3.2.1. If the team picks this path, ADR-0009 is paused, a separate ADR opens to debate the allowlist update, and only then `puppeteer` is decided.
  >
  > **Outbound allowlist impact:** none for `reportlab` (PyPI already on the allowlist). None for `weasyprint` (PyPI already on the allowlist). **Yes** for `puppeteer` (`storage.googleapis.com` install-time download + sometimes runtime updates).

- **architect** (responding): Strong supply-chain signal. Sticking with `reportlab` proposal.
- **backend-builder** (responding): Implementation footprint estimate confirmed at ~150 lines. Including a contract test that asserts (a) PDF magic bytes (`%PDF-`), (b) Greek glyphs present in the page text stream, (c) totals match a curated fixture set of tagged receipts, (d) date range bounds inclusive on both ends.
- **engineering-manager** (responding): Co-sign granted on `reportlab` + the conditions in `agent-safety-officer`'s verdict (exact pin, no carets).
- **devops-engineer** (responding): No deploy change needed. Existing Railway / Render Python builder picks up the new dep on the next push.
- **security-privacy-officer** (responding): Contract from Round 1 still applies: on-the-fly, streamed, never persisted, never logged. Co-sign granted.
- **product-designer** (responding): I'll spec the PDF layout in DES-0004 §6 (Profile screen export action) — the export button opens a date-range picker, then taps "Δημιουργία PDF" / "Generate PDF", and the device's share sheet hands the streamed PDF off to the user's email / drive. No PDF "preview" inside the app for MVP.
- **localization-specialist** (responding): `DejaVuSans` glyph check verified on a sample text including `Πλατεία Συντάγματος`, `αποδείξεις`, `ΦΠΑ 24%` — round-trips cleanly.

### Round 3

- **architect**: No new concerns.
- **backend-builder**: No new concerns.
- **agent-safety-officer**: No new concerns. Verdict locked.
- **engineering-manager**: No new concerns.
- **security-privacy-officer**: No new concerns.
- **devops-engineer**: No new concerns.

No new concerns surfaced after Round 3. Closing.

## Decision

### 1. Library

- **`reportlab==4.2.5`** is added to `backend/requirements.txt`. Pinned exact (no caret).
- **`weasyprint`** is rejected for MVP. Operational cost (Dockerfile + system-lib SBOM + Greek font install + CI image build) is too high for a tabular report.
- **Server-side `puppeteer` / `playwright`** is rejected for MVP. It would require adding `storage.googleapis.com` to the outbound allowlist and would carry a Chromium binary at runtime — a substantially larger attack surface for a feature that does not need it.

### 2. Endpoint contract

`GET /export/business-expenses?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`

- Bearer JWT required (ADR-0002). `user_id` is **always** the verified `sub`, never a query parameter (extends ADR-0002 / ADR-0005 — same precedent).
- Query rules:
  - `from_date`, `to_date` — required, ISO-8601 date strings (`YYYY-MM-DD`).
  - `to_date >= from_date` — else 422.
  - Range cap **`to_date - from_date <= 366 days`** to bound memory + render time. Larger ranges → 422 with a Greek + English message.
- Response on success:
  - HTTP 200.
  - `Content-Type: application/pdf`.
  - `Content-Disposition: attachment; filename="business-expenses-<from>-<to>.pdf"`.
  - Body: `StreamingResponse` of the in-memory PDF buffer.
- Errors follow the ADR-0002 RFC-7807 envelope (`Content-Type: application/problem+json`):
  - 401 — missing / invalid JWT.
  - 422 — query validation failures.
  - 500 — internal generation failure (the parser exception message **never** reaches the body, per ADR-0002 §3 precedent).

### 3. Data flow

- The PDF is **generated on the fly** per request.
- The PDF is **never written to disk** on the server. The buffer lives in memory only for the duration of the response stream.
- The PDF is **never logged**. The success log line records only `user_id` (the `sub`), the `from_date` / `to_date`, the result `count` of included receipts, and a `bytes_generated` counter — never the receipt contents, merchant ΑΦΜ values, totals, category text, or notes.
- The PDF is **never transmitted anywhere** except the response stream back to the authenticated requesting client.
- Empty result sets (no tagged receipts in the range) **still return a valid PDF** with a "Δεν υπάρχουν επαγγελματικά έξοδα στην περίοδο" / "No business expenses in this period" page (HTTP 200, ~3 KB document). This matches the §2.5 "fast" bar — the user sees a clear answer without an error.

### 4. Query layer

- A new helper `backend/app/exports/business_expenses.py::query_tagged_receipts(user_uuid: UUID, from_date: date, to_date: date) -> list[ReceiptForExport]`.
- `ReceiptForExport` is a Pydantic model containing only the fields the PDF needs: `merchant_name`, `merchant_afm`, `issue_date`, `total`, `vat_total`, `business_category`, `notes`, plus the line-item rows when expanded.
- The query filters: `WHERE user_id = user_uuid AND is_business_expense = true AND issue_date BETWEEN from_date AND to_date` — uses the existing index `receipts (user_id, is_business_expense)` from `0001_init.sql`.
- The `notes` column **must** be sanitized on read for control characters (NULL bytes, newlines beyond `\n`, RTL marks) before being passed to `reportlab.platypus.Paragraph` — defense against PDF-injection-style nasties via free-text `notes`.

### 5. PDF layout (anchored to DES-0004 §6)

- Cover block: title "Επαγγελματικά Έξοδα" / "Business Expenses", user ΑΦΜ (from `users.afm`), date range, generation timestamp.
- Totals block: total spend, total VAT, count of receipts.
- Per-receipt rows: date, merchant name, merchant ΑΦΜ, total, VAT, category, notes (truncated to ~120 chars per row with ellipsis if longer).
- Footer on every page: page number, generation timestamp, "Παράγεται από Watch Your Money" / "Generated by Watch Your Money".
- Font: `DejaVuSans` (regular + bold) — bundled with `reportlab`. Full Greek glyph coverage verified in Round 2.
- Page size: A4 (Greek standard for accountant-bound documents). Margins 2 cm.
- No color, no logo for MVP. Future BLG can theme it; MVP optimizes for "boring and legible".

### 6. Currency / dates / decimals

- Currency: `X,XX €` (Greek convention) — re-uses the same formatting pattern as `mobile/src/lib/format.ts`. A small Python helper `backend/app/lib/format.py` is added (or the formatting is inlined; either is fine — implementation choice in BLG-0019).
- Dates: `DD-MM-YYYY` — Greek convention.
- Decimal separator: comma.

### 7. Test strategy (folded into BLG-0019 acceptance)

- Unit: `query_tagged_receipts` against `InMemoryReceiptStorage` returns only tagged receipts in the range; 0-result case; multi-user isolation (defense in depth on top of RLS).
- Unit: PDF generator on a curated set of tagged receipts → assert (a) `%PDF-` magic bytes, (b) document parses, (c) total spend and total VAT lines match expected values, (d) Greek glyphs appear in the text stream (extract via `pdfplumber` or equivalent in the test env — flagged as a `dev-only` dep), (e) `notes` longer than 120 chars are truncated with ellipsis.
- Contract: `GET /export/business-expenses` returns 200 + `application/pdf` for valid input; 401 for no JWT; 422 for invalid date range; 422 for `to_date - from_date > 366 days`; 200 + small PDF for an empty range.
- Live: a single integration test marked `slow` (per ADR-0005 §8 precedent) that runs the endpoint end-to-end against a Supabase test project — gated on BLG-0015 follow-through.

### 8. Authorization summary

- Bearer JWT from ADR-0002. Verified `sub` is the canonical user.
- The literal `AGENTS.md` §5.3.2 query parameters are: `from_date`, `to_date`. **No `user_id` query parameter** (the same §4.4 tie-breaker that applied to ADR-0002 / ADR-0005 — extended here without a fresh BLG-0010-style admin edit since `AGENTS.md` §5.3.2 already lists only `from_date`, `to_date` for this endpoint).

## Dissent

None recorded. All participants converged in Round 3.

## Consequences

**Positive:**

- BLG-0019 is **Ready** with a clean acceptance set: one PyPI dep (`reportlab==4.2.5`), one endpoint, one query helper, one PDF layout per DES-0004 §6.
- No Dockerfile change. No buildpack change. No outbound allowlist change. Existing Railway / Render Python builder ships the new dep on the next push.
- Greek glyph coverage is solved for free via `reportlab`'s bundled `DejaVuSans`.

**Negative:**

- `reportlab`'s API is programmatic (no HTML / CSS). If a future redesign wants rich CSS-styled exports, we revisit this ADR (and likely move to `weasyprint` with the conditions captured here).
- `notes` truncation at ~120 chars is a layout compromise. Mitigated by the 500-char cap in ADR-0008 §2 — even at the cap, two-line truncation in the PDF reads cleanly.

**Follow-ups (added to backlog):**

- BLG-0019 acceptance bullets folded into the backlog item (this sprint).
- Future BLG (out of scope here): per-merchant-grouped export view if accountants ask for it.
- Future BLG (out of scope here): branded / themed PDF (color, logo) — only if user demand surfaces.
- No outbound allowlist update.
- No Dockerfile.
