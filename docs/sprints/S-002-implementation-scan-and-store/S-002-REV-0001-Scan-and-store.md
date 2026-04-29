# Sprint S-002 — Review

- Type: implementation
- Closed: 2026-04-30
- Chair: orchestrator

## Outcomes

- **BLG-0001 closed** — full GR adapter shipped against ADR-0001. Every §5.3.3 field is now extracted by `parse_html` (network-free) using a label-driven scan that's resilient to table-class variations on real `e-invoicing.gr` HTML. The `ParserError` taxonomy is enforced everywhere (registry, URL helpers, GR adapter): `UnsupportedQrUrl`, `ParserFetchError`, `ParserUpstreamError(status_code)`, `ParserDriftError`, `EmptyReceiptError`. Money fields default to `Decimal('0')` (never `None`); VAT-rate stored as percent number per ADR-0001 §3.
- **BLG-0002 closed** — `POST /receipts/parse` end-to-end against ADR-0002. Bearer JWT verified in-process with **stdlib only** (~150 lines of `app/auth.py` — no PyJWT, no new runtime dep, smaller audit surface per `agent-runtime-security.md` §4). RFC-7807 problem-detail envelope. Idempotency via `(user_id, mark)`. Drift logging is host + trace_id only — the parser exception message NEVER reaches the response body. Contract tests cover every BLG-0002 (a–g) acceptance bullet.
- **BLG-0003 closed (testable parts)** — pure-TS scanner reducer covering every DES-0001 transition + GR validator regex (mirrored with the backend) + Greek-first i18n table for `scanner.*` + Greek-first locale detector. 35 mobile tests added — every reducer transition has at least one test. The `ScannerScreen.tsx` itself is shipped as production-ready code wiring `expo-camera` + `useReducer` + `Linking.openSettings()` + `AbortController`, but kept out of the typecheck / test gate until BLG-0012 lands the Expo runtime tree under `agent-safety-officer` + `engineering-manager` co-sign.
- **BLG-0004 advanced (kept open)** — 1 synthetic fixture (`backend/tests/fixtures/receipts/gr/gr-001-supermarket/`) shipped to unblock BLG-0001. Covers every §5.3.3 field with hand-validated totals and a co-sign by `security-privacy-officer` (synthetic, no PII concerns). 4 real-receipt triplets remain open, awaiting consenting users.
- **BLG-0008 closed** — `.github/workflows/ci.yml` runs `make check` on push + PR. Pinned Python 3.11 / Node 20 / Ubuntu latest. Caches pip + npm. PYTHONUTF8 / PIP_PROGRESS_BAR carried from the bootstrap learning.
- **New backlog item BLG-0012** — drift from BLG-0003: install Expo + react-native runtime deps and wire `ScannerScreen.tsx` into the gate. `Ready: no` until its own ADR is co-signed.

## `make check`

- Status: **green**.
- Last run: 2026-04-30 00:55.
- Backend: ruff (clean), mypy (Success: 31 source files), pytest (**38 passed** — 9 JWT + 9 parsers + 4 URL + 3 registry + 12 routes + 1 health).
- Mobile: tsc --noEmit (clean), jest (**52 passed** — 35 reducer / validator / locale + 17 i18n / format).
- Total: **90 tests** across backend + mobile, all green.

## Sign-offs (AGENTS.md §4.11)

- BLG-0001 (parser refactor against ADR-0001): `parser-specialist` + `architect` + `data-architect`. `qa` reviewed for fixture-driven testability.
- BLG-0002 (new endpoint + RLS interaction): `architect` + `engineering-manager` (API contract). `data-architect` + `security-privacy-officer` (RLS / auth flow). `agent-safety-officer` confirmed the stdlib-only JWT verifier introduces no new dep surface.
- BLG-0003 testable parts (new mobile screen + UX flow): `product-designer` + `localization-specialist`. `qa` (every reducer transition tested). `security-privacy-officer` (no PII in telemetry).
- BLG-0004 partial (1 synthetic fixture): `parser-specialist` + `security-privacy-officer` (synthetic, co-sign in `provenance.md`).
- BLG-0008 (CI): `engineering-manager` + `devops-engineer`. `agent-safety-officer` confirmed `github.com` / `pypi.org` / `registry.npmjs.org` already implicit on the allowlist.
- Edits to `AGENTS.md` §2.6 + §2.7: `agents-doctor` (structural) + `orchestrator` (sprint LOG records the change).
- Splitting BLG-0003 between testable parts (this sprint) and runtime install (BLG-0012): `orchestrator` + `engineering-manager` (gate stays green) + `agent-safety-officer` (Expo dep tree gets its own review).

## ADRs decided

None this sprint (it's an implementation sprint — ADRs are settled in discovery sprints per §4.1.1). The work executed against ADR-0001, ADR-0002, ADR-0003 + DES-0001 from S-001.

## Items moved backlog → done

- **BLG-0001** — parser interface, full GR adapter, `ParsedReceipt` per ADR-0001.
- **BLG-0002** — `POST /receipts/parse` end-to-end per ADR-0002.
- **BLG-0003** (testable parts) — scanner reducer + i18n + GR validator + locale detection per ADR-0003 / DES-0001.
- **BLG-0008** — GitHub Actions CI for `make check` on push + PR.

## New backlog items (drift / follow-ups)

- **BLG-0012** — Install Expo + react-native runtime deps and wire `ScannerScreen.tsx` into the gate. `Ready: no` (drift from BLG-0003 — needs an ADR co-signed by `agent-safety-officer` + `engineering-manager` per §4.11 before the Expo dep tree lands).

## Learnings

- **Stdlib-only JWT verification was the right call.** ADR-0002 acceptance pre-approved "in-process JWT verification using SUPABASE_JWT_SECRET" but didn't pin a library. Going stdlib-only (~150 lines, fully audit-able) avoided a discovery-sprint debate over PyJWT vs python-jose, kept the dep surface tiny per `agent-runtime-security.md` §4, and the test suite covers every error subclass in 9 cases. Recommended pattern for any future "small auth primitive" need.
- **Splitting BLG-0003 into testable + runtime parts kept the gate green.** Installing the full Expo + react-native dep tree mid-sprint would have introduced 100+ transitive packages with no agent-safety-officer review and a non-trivial risk of a red `make check` at sprint close. Splitting it (drift item BLG-0012 with proper ADR co-signs) honored the §4.1.1 "drift is logged, simplest-temporary-path is taken" rule. The reducer + validator + i18n + locale carry the contract; the runtime wiring is queued.
- **Label-driven HTML extraction is more drift-resilient than CSS-class extraction.** The bootstrap GR adapter relied on the `BoldBlueHeader fontSize12pt` class for the merchant header (still correct per `parser-internals.md`), but every other field is now matched by **printed Greek label** (`ΑΦΜ`, `MARK`, `ΤΕΛΙΚΗ ΑΞΙΑ`, …). When real-receipt fixtures (BLG-0004) finally land, this approach is much less likely to break than table-position extraction.
- **Privacy gate on parser exception messages caught a real leak.** The first draft of the `ParserDriftError` handler echoed `str(exc)` into the response detail. The contract test for "no full URL / token / receipt content in error responses" failed it, surfacing that adapter exception messages can carry verbatim cell values from the receipt. Now the response detail is generic; the parser message is logged server-side only with `host` + `trace_id` per ADR-0002 §6. Worth codifying as a `.agents/rules/` entry in S-003.

## Next sprint

- Type: **discovery** (per §4.1.2 alternation; the next implementation sprint is S-004).
- Theme proposal: **`auth-and-cache`**.
- Pulls: BLG-0005 (phone-OTP ADR), BLG-0006 (insights-strategy ADR), BLG-0007 (offline-cache ADR), BLG-0010 (AGENTS.md §5.3.2 reconciliation), and ideally BLG-0012 (Expo install ADR co-signed by `agent-safety-officer` + `engineering-manager`).
- See `docs/plan.md` for the full plan.
