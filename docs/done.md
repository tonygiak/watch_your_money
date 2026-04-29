# Done

Append-only ledger of everything **completed**, grouped by sprint, newest on top. When an item completes, **move** it from `docs/backlog.md` here.

---

## Sprint S-002 — Scan-and-store (closed 2026-04-30)

> First user-visible behavior in the app: a Greek QR scanned through the mobile reducer + validator → POSTed to `/receipts/parse` → stored under the user's RLS scope, with idempotent re-scans returning the same row. Five Ready items pulled from S-001; four closed cleanly, BLG-0004 advanced (1 synthetic fixture shipped to unblock BLG-0001), and one drift item (BLG-0012) opened for the Expo runtime install split off from BLG-0003.

- **BLG-0001 — Parser interface, full GR adapter, `ParsedReceipt` per ADR-0001.** `BaseReceiptParser` extended with `parse_html` (network-free path required by ADR-0001 §1). `ParsedReceipt` extracts every `AGENTS.md` §5.3.3 field via a label-driven scan that's resilient to table-class variations on real `e-invoicing.gr` HTML. The `ParserError` taxonomy (`UnsupportedQrUrl`, `ParserFetchError`, `ParserUpstreamError(status_code)`, `ParserDriftError`, `EmptyReceiptError`) is now enforced everywhere — registry, URL helpers, and the GR adapter all raise the specific subclass. ΔΟΥ is concatenated into `merchant_address` (DB schema lacks a dedicated field; documented as such). Files: `backend/app/parsers/base.py`, `backend/app/parsers/registry.py`, `backend/app/parsers/gr/{parser,url}.py`, `backend/tests/parsers/{test_gr_parser,test_gr_fixtures,test_gr_url,test_registry}.py`. Sign-offs: `parser-specialist`, `architect`, `data-architect`, `qa`.
- **BLG-0002 — `POST /receipts/parse` end-to-end per ADR-0002.** Bearer JWT verified in-process with **stdlib only** (`hmac` + `hashlib` + `base64` + `json` + `time`) — no new runtime dependency, audit surface ~150 lines (`backend/app/auth.py`). Body shape `{ "qr_url": string }` with `extra="forbid"` so a client-supplied `user_id` is a 400 (ADR-0002 §2). RFC-7807 problem-detail envelope at `backend/app/errors.py`. Storage layer with both an `InMemoryReceiptStorage` (tests + local dev) and a `SupabaseReceiptStorage` (production wiring) at `backend/app/storage/receipts.py`. Idempotency via `(user_id, mark)` — re-scans return 200 + `is_duplicate=true` + same id, never overwriting `is_business_expense` / `business_category` / `notes` / `raw_html`. Drift logging is host + trace_id only; the parser exception message NEVER reaches the response body. Contract tests at `backend/tests/routes/test_receipts.py` cover every BLG-0002 acceptance bullet (a–g) plus the explicit "extra `user_id` field is rejected" test. `backend/.env.sample` declares `SUPABASE_JWT_SECRET`. Sign-offs: `architect`, `engineering-manager` (API contract), `data-architect`, `security-privacy-officer` (auth + RLS), `qa` (contract tests).
- **BLG-0003 — Scanner reducer + i18n + GR validator + locale detection per ADR-0003 / DES-0001.** Pure-TS reducer at `mobile/src/screens/scanner/state.ts` covering every state in DES-0001 (idle, permission_check, permission_denied, permission_blocked, scanning, validating_url, unsupported_qr, submitting, success_new, success_duplicate, auth_error, parse_error_user, network_error, parser_drift, generic_error, camera_error). Telemetry helper `telemetryEventFor(prev, next)` emits the DES-0001 events (counts only, no PII). Shared GR validator regex at `mobile/src/parsers/gr.ts` mirrored from `backend/app/parsers/gr/url.py` (defense in depth). Full Greek-first i18n table at `mobile/src/i18n/strings.ts` covering `scanner.*`, `home.*`, `common.*`, `errors.*`. Greek-first locale detector at `mobile/src/lib/locale.ts` per ADR-0003 §5 (device `el-*` → Greek, `en-*` → English, anything else → Greek). 35 mobile tests added (reducer / validator / locale / i18n) — every DES-0001 transition has at least one test. The `ScannerScreen.tsx` itself is shipped as production-ready code wiring `expo-camera` + `useReducer` + `Linking.openSettings()` + `AbortController`, but kept out of the typecheck / test gate until BLG-0012 lands the Expo runtime tree under `agent-safety-officer` + `engineering-manager` co-sign. Sign-offs: `mobile-builder`, `localization-specialist` (Greek strings), `product-designer` (state machine), `security-privacy-officer` (no PII in telemetry), `qa` (every transition tested).
- **BLG-0008 — GitHub Actions CI for `make check`.** `.github/workflows/ci.yml` runs `make check` on `push` and `pull_request` against any branch. Pinned: Python 3.11, Node 20, Ubuntu latest. Caches pip on `requirements-dev.txt` and npm on `mobile/package-lock.json`. Sets `PYTHONUTF8=1` + `PIP_PROGRESS_BAR=off` (the bootstrap learning from S-000). Posts a clear failure summary per gate. No new external surface beyond the already-implicit `github.com` / `pypi.org` / `registry.npmjs.org`. Sign-offs: `devops-engineer`, `engineering-manager`, `agent-safety-officer` (allowlist unchanged).

`make check` at sprint close: backend (ruff, mypy, pytest 38) + mobile (lint, tsc, jest 52) — **green**.

Sign-offs (sprint review per §4.11): `architect` + `engineering-manager` (API contract), `data-architect` + `security-privacy-officer` (auth + RLS interaction), `parser-specialist` + `qa` (parser + fixture-driven tests), `product-designer` + `localization-specialist` (scanner UX testable parts), `agent-safety-officer` (no new external surface this sprint; BLG-0012 picks up the Expo install with its own review), `orchestrator` (sprint review).

Plus partial completion (kept open in `docs/backlog.md`):

- **BLG-0004 (advanced, not closed)** — first **synthetic** fixture triplet (`backend/tests/fixtures/receipts/gr/gr-001-supermarket/`) covering every §5.3.3 field (3 line items / 2 VAT rates / discount / hand-validated totals). Co-signed by `security-privacy-officer` (synthetic, no PII concerns). Acquisition of 4 real-receipt triplets with explicit consent stays open until consenting users are recruited.

New items added this sprint (still in backlog):

- **BLG-0012** — Install Expo + react-native runtime deps and wire `ScannerScreen.tsx` into the gate (drift from this sprint's BLG-0003 split).

---

## Sprint S-000 — Bootstrap (closed YYYY-MM-DD)

> The bootstrap sprint did not pull from `docs/backlog.md` (the backlog did not exist yet). The work below is recorded directly here as the realized scope of `AGENTS.md` §6.

- **Repository scaffold** — `backend/`, `mobile/`, `db/`, `docs/`, `.agents/`, `.cursor/rules/` created with the structures defined in `AGENTS.md` §3.4 and §8.
- **Agentic system docs** — full `.agents/agents/`, `.agents/skills/`, `.agents/rules/`, `.agents/context/` populated per `AGENTS.md` §3.4.
- **Cursor rules** — `.cursor/rules/rules-always.mdc` plus per-agent and per-skill MDC files referencing `.agents/` content.
- **Backend** — minimal FastAPI app with `/health`, the abstract `BaseReceiptParser` interface, the GR adapter stub built on the §5.3.4 reference parser, and a passing pytest suite.
- **Mobile** — minimal Expo app shell with placeholder Home screen, i18n + format helpers, and a passing jest suite.
- **Database** — `db/migrations/0001_init.sql` creating `users`, `receipts`, `receipt_items` with `country_code` and full RLS policies under `db/policies/`.
- **Quality gate** — top-level `Makefile` with `install`, `run-backend`, `run-mobile`, `test`, `lint`, `typecheck`, `build`, `check`, `ci`. `make check` is green at sprint close.
- **Sprint artifacts** — `S-000-PLN-0001`, `S-000-LOG-0001`, `S-000-REV-0001`, `S-000-UREV-0001` under `docs/sprints/S-000-bootstrap-repository-scaffold/`.
- **AGENTS.md §2.7** — sprint snapshot updated to reflect bootstrap completion and queued discovery sprint.

Sign-offs: `agents-doctor` (structural), `architect` (technical), `engineering-manager` (quality gate), `agent-safety-officer` (no new external surface; allowlist established), `orchestrator` (sprint review).
