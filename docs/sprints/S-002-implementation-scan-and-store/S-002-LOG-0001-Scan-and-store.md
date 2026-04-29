# Sprint S-002 — Log

Audit-trail entries per `AGENTS.md` §4.9.3. Every step records outbound hosts, MCP tools, dependencies, and approvals (even when empty).

## 2026-04-29 23:30 — Sprint kickoff

- Agent: orchestrator (with go)
- Action: Opened S-002 (implementation, theme `scan-and-store`). Reviewed Ready items BLG-0001..0004, BLG-0008. Drafted PLN.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: `docs/sprints/S-002-implementation-scan-and-store/S-002-PLN-0001-Scan-and-store.md`.

## 2026-04-29 23:35 — BLG-0001 — Parser contract refactor

- Agent: parser-specialist
- Action: Extended `app/parsers/base.py` with the `ParserError` taxonomy from ADR-0001 (`UnsupportedQrUrl`, `ParserFetchError`, `ParserUpstreamError(status_code)`, `ParserDriftError`, `EmptyReceiptError`). Added `parse_html` as an abstract method. Added `BaseReceiptParser.country_code` as an instance property contract.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: parser-specialist + architect on the contract change (already pre-approved by ADR-0001).
- Outcome: `backend/app/parsers/base.py` updated. Bootstrap GR adapter still passes the existing tests.

## 2026-04-29 23:40 — BLG-0001 — GR adapter full §5.3.3 extraction

- Agent: parser-specialist
- Action: Replaced the bootstrap merchant-only extraction with a label-driven extractor that captures every §5.3.3 field: merchant name (BoldBlueHeader), ΑΦΜ, address + ΔΟΥ (concatenated into `merchant_address`), document number, issue date (DD/MM/YYYY), MARK, UID, authentication code, transmission timestamp (DD/MM/YYYY HH:MM:SS), provider, all line items, and totals (subtotal / discount / surcharge / total / net_value / vat_total / payment_method). Drift cases now raise `ParserDriftError`; empty line-items raises `EmptyReceiptError`. URL helpers raise `UnsupportedQrUrl`. Registry raises `UnsupportedQrUrl`.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: parser-specialist (per ADR-0001).
- Outcome: `backend/app/parsers/gr/parser.py`, `backend/app/parsers/gr/url.py`, `backend/app/parsers/registry.py` updated.

## 2026-04-29 23:45 — BLG-0004 — First synthetic fixture

- Agent: parser-specialist (with security-privacy-officer for the synthetic-vs-real distinction)
- Action: Created `backend/tests/fixtures/receipts/gr/gr-001-supermarket/` triplet — `raw.html` (UTF-8 byte-exact, every §5.3.3 field), `expected.json` (hand-validated ground truth), `provenance.md` (clearly labeled **synthetic**, no PII, consent N/A). The fixture exercises 3 line items across 2 VAT rates (13% and 24%), discount, and total math that round-trips. The 4 remaining triplets in BLG-0004 stay open for real-receipt acquisition with explicit consent.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: security-privacy-officer (synthetic fixture, no PII concerns to review; co-sign recorded in `provenance.md`).
- Outcome: `backend/tests/fixtures/receipts/gr/gr-001-supermarket/{raw.html,expected.json,provenance.md}`.

## 2026-04-29 23:50 — BLG-0001/BLG-0004 — Fixture-driven parser tests

- Agent: parser-specialist + qa
- Action: Replaced the in-line synthetic HTML in `test_gr_parser.py` with a fixture-walking test. Added `test_gr_fixtures.py` that loads every `gr/*/raw.html` + `expected.json` triplet via `parse_html` (no network) and asserts every §5.3.3 field. Added tests for each `ParserError` subclass.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: qa (testability sign-off per ADR-0001).
- Outcome: `backend/tests/parsers/test_gr_parser.py`, `backend/tests/parsers/test_gr_fixtures.py`.

## 2026-04-29 23:55 — BLG-0002 — Hand-rolled JWT verifier (no new runtime dep)

- Agent: backend-builder + security-privacy-officer
- Action: Implemented `app/auth.py` with HS256 JWT verification using only stdlib (`hmac`, `hashlib`, `base64`, `json`, `time`). No PyJWT or other new dep — keeps the audit surface tiny per `agent-runtime-security.md` §4. Verifies signature, `exp`, `iat`, and `aud=authenticated` (Supabase default). Raises `JwtError` subclasses (`JwtExpiredError`, `JwtSignatureError`, `JwtMalformedError`).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none (stdlib only — explicit decision to avoid a runtime dep)
- Sensitive approvals: security-privacy-officer (auth flow change per §4.11). engineering-manager on stdlib-only choice.
- Outcome: `backend/app/auth.py`, `backend/tests/auth/test_jwt.py`.

## 2026-04-30 00:00 — BLG-0002 — Problem-detail error envelope

- Agent: backend-builder
- Action: Added `app/errors.py` exposing `problem_detail(...)` and `ProblemDetailResponse` per ADR-0002 §4 (RFC-7807-style: `type`, `title`, `status`, `detail`, `trace_id`). Wired exception handlers in `app/main.py` so `ParserError` subclasses, `JwtError` subclasses, and validation errors all map to the right status + envelope without leaking PII.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: architect + engineering-manager (API contract sign-off per §4.11, already pre-approved by ADR-0002).
- Outcome: `backend/app/errors.py`, `backend/app/main.py`.

## 2026-04-30 00:05 — BLG-0002 — Storage layer + idempotency

- Agent: backend-builder + data-architect
- Action: Added `app/storage/receipts.py` with a typed `ReceiptStorage` protocol and a Supabase-backed implementation. `upsert_receipt` writes the receipt + items in a single logical operation, returns the existing row on `(user_id, mark)` conflict (idempotency via the existing `receipts_mark_per_user_unique` constraint from `db/migrations/0001_init.sql`), and never overwrites user-set fields (`is_business_expense`, `business_category`, `notes`, `raw_html`).
- Outbound hosts contacted: none (storage layer is decoupled from real Supabase in tests)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: data-architect (RLS interaction; backend uses service-key client only after JWT verification per ADR-0002 §1, §5).
- Outcome: `backend/app/storage/__init__.py`, `backend/app/storage/receipts.py`.

## 2026-04-30 00:10 — BLG-0002 — Receipts router + contract tests

- Agent: backend-builder + qa
- Action: Added `app/routes/receipts.py` exposing `POST /receipts/parse`. Added structured drift logging (level WARN, no raw HTML, no QR URL — only host + trace_id, per ADR-0002 §6). Wired the router in `app/main.py`. Added `backend/.env.sample` entry for `SUPABASE_JWT_SECRET`. Added contract tests in `backend/tests/routes/test_receipts.py` covering: (a) missing Bearer → 401, (b) invalid Bearer → 401, (c) valid Bearer + valid GR QR → 201 + body + `Location`, (d) re-scan → 200 + `is_duplicate=true` + same `id`, (e) non-GR QR → 422 with `type: "unsupported_url"`, (f) parser drift → 503 with `type: "parser_drift"`, (g) `qr_url` and `raw_html` are NEVER returned in error responses.
- Outbound hosts contacted: none (TestClient + fakes)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: architect + engineering-manager (API contract per §4.11, pre-approved by ADR-0002). qa (contract tests cover BLG-0002 acceptance bullets).
- Outcome: `backend/app/routes/receipts.py`, `backend/app/main.py`, `backend/.env.sample`, `backend/app/config.py`, `backend/tests/routes/test_receipts.py`.

## 2026-04-30 00:20 — BLG-0003 — Scanner reducer + i18n + GR validator

- Agent: mobile-builder + localization-specialist
- Action: Added `mobile/src/screens/scanner/state.ts` (pure-TS reducer covering every state in DES-0001), `mobile/src/parsers/gr.ts` (shared GR validator with the regex `https://e-invoicing.gr/edocuments/ViewInvoice/-1/[0-9a-fA-F-]+_[A-Za-z0-9]+$` mirrored from `backend/app/parsers/gr/url.py`), `mobile/src/i18n/strings.ts` (full Greek-first string table for `scanner.*`, `home.*`, `common.*`, `errors.*`), and `mobile/src/lib/locale.ts` (Greek-first locale detection per ADR-0003 §5). Updated `mobile/src/lib/i18n.ts` to import from `i18n/strings.ts`. Updated `mobile/tsconfig.json` to include the new pure-TS modules and the test files.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none (the runtime Expo deps are split off as BLG-0012)
- Sensitive approvals: localization-specialist (Greek-first strings per ADR-0003), product-designer (state machine matches DES-0001), security-privacy-officer (no PII in telemetry events).
- Outcome: `mobile/src/screens/scanner/state.ts`, `mobile/src/parsers/gr.ts`, `mobile/src/i18n/strings.ts`, `mobile/src/lib/i18n.ts`, `mobile/src/lib/locale.ts`, `mobile/tsconfig.json`.

## 2026-04-30 00:30 — BLG-0003 — Scanner reducer / GR validator / locale tests

- Agent: qa + mobile-builder
- Action: Added `mobile/__tests__/screens/scanner/state.test.ts` (every reducer transition from DES-0001), `mobile/__tests__/parsers/gr.test.ts` (validator accepts only `https://e-invoicing.gr/...`), `mobile/__tests__/lib/locale.test.ts` (Greek-first default; `el-*` → Greek, `en-*` → English, everything else → Greek per ADR-0003).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: qa (every DES-0001 transition has at least one test).
- Outcome: tests added under `mobile/__tests__/`.

## 2026-04-30 00:35 — BLG-0003 — ScannerScreen.tsx scaffolded (excluded from gate until BLG-0012)

- Agent: mobile-builder
- Action: Wrote `mobile/src/screens/ScannerScreen.tsx` that wires `expo-camera`, `useReducer(scannerReducer)`, `validateGrQrUrl`, `Linking.openSettings()`, and `AbortController` per ADR-0003. Kept it excluded from `tsconfig.json` `include` (same pattern as `HomeScreen.tsx`) so the gate stays green without the Expo runtime tree. Becomes runnable as soon as BLG-0012 lands the runtime deps with `agent-safety-officer` + `engineering-manager` co-sign per §4.11.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none (BLG-0012 will install the Expo tree under its own ADR review)
- Sensitive approvals: orchestrator (scope split decision recorded here and in PLN); engineering-manager (gate stays green).
- Outcome: `mobile/src/screens/ScannerScreen.tsx`, `mobile/src/api/receipts.ts` (also excluded until BLG-0012).

## 2026-04-30 00:45 — BLG-0008 — GitHub Actions CI

- Agent: devops-engineer + engineering-manager
- Action: Added `.github/workflows/ci.yml` running `make check` on `push` and `pull_request` against the default branch. Caches pip on `requirements-dev.txt` and npm on `mobile/package-lock.json`. Sets `PYTHONUTF8=1` and `PIP_PROGRESS_BAR=off` (the bootstrap learning from S-000). Posts a clear failure summary per gate. Pinned: Python 3.11, Node 20, Ubuntu latest.
- Outbound hosts contacted: github.com (already implicit per `outbound-allowlist.md`)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: engineering-manager (CI gate). agent-safety-officer (no new outbound surface — `github.com`, `pypi.org`, `registry.npmjs.org` already implicit / on the allowlist).
- Outcome: `.github/workflows/ci.yml`.

## 2026-04-30 00:55 — Quality gate — `make check`

- Agent: qa + engineering-manager
- Action: Ran `make check`. All gates green: backend ruff, mypy, pytest (parser fixtures + JWT + routes + health). Mobile tsc --noEmit + jest (reducer + validator + locale + format + i18n).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: engineering-manager (gate green at sprint close per `quality-gate.md` and §4.7).
- Outcome: see REV — sprint closes green.

## 2026-04-30 01:00 — Backlog → done + plan + AGENTS.md updates

- Agent: product-manager + agents-doctor + orchestrator
- Action: Moved BLG-0001, BLG-0002, BLG-0003 (testable parts), BLG-0008 from `docs/backlog.md` to `docs/done.md`. Kept BLG-0004 open with a note that 1 synthetic fixture was shipped to unblock BLG-0001; the 4 real-receipt triplets remain. Added BLG-0012 (drift) for "Install Expo + react-native runtime deps and wire ScannerScreen.tsx into typecheck/tests" — `Ready: no` pending its own ADR co-signed by `agent-safety-officer` + `engineering-manager`. Updated `docs/plan.md` to point at S-003 discovery. Updated `AGENTS.md` §2.6 with the first user-visible behavior (POST /receipts/parse end-to-end + scanner reducer ready) and §2.7 with the new sprint snapshot.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: orchestrator (sprint review), agents-doctor (AGENTS.md edits per §4.11 — structural changes co-signed in this LOG entry).
- Outcome: `docs/backlog.md`, `docs/done.md`, `docs/plan.md`, `AGENTS.md`.

## 2026-04-30 01:05 — Sprint review + handoff

- Agent: orchestrator + go
- Action: Wrote REV + UREV. Picked next sprint type = discovery (per `AGENTS.md` §4.1.2 alternation; S-003 settles BLG-0005..0007, BLG-0010, BLG-0012).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: §4.11 sign-offs collected — architect + engineering-manager (API contract), data-architect + security-privacy-officer (auth + RLS), parser-specialist + qa (parser + fixture), product-designer + localization-specialist (scanner UX testable parts), agent-safety-officer (no new external surface this sprint; BLG-0012 will pick up the Expo install with its own review).
- Outcome: sprint S-002 closed green.
