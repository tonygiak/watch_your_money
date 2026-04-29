# Backlog

Everything **planned** or **in progress**. Schema in `AGENTS.md` §4.9.1 and `docs/templates/backlog-item.md`. When an item completes, **move** (don't duplicate) it into `docs/done.md`.

> Discovery sprint S-001 (`receipt-parser-contract`) closed accepting ADR-0001, ADR-0002, ADR-0003, and DES-0001. Items below now reflect that. **Ready: yes** marks items that meet the Definition of Ready (`AGENTS.md` §4.1.3) and can be pulled by the next implementation sprint. **Ready: no** items still need an upstream ADR before they can be pulled.

---

- ID: BLG-0001
  Title: Implement the parser interface, full GR adapter, and `ParsedReceipt` per ADR-0001
  Status: planned
  Ready: yes
  Owner: parser-specialist
  Type: parser
  Outcome: Every field listed in `AGENTS.md` §5.3.3 is extracted by the GR adapter and surfaced through the country-agnostic `ParsedReceipt` model, with the `ParserError` taxonomy from ADR-0001 in place.
  Acceptance:
  - `BaseReceiptParser` exposes `country_code`, `can_parse(qr_url)`, `parse(qr_url)`, `parse_html(html)` (network-free path required).
  - `ParsedReceipt` and `ParsedReceiptItem` cover every §5.3.3 field; money fields default to `Decimal("0")`, never `None`; `vat_rate` stored as percent number.
  - `GrEinvoicingParser.parse_html` extracts: merchant (name, ΑΦΜ, address, ΔΟΥ), receipt metadata (document number, issue date, MARK, UID, authentication code, transmission timestamp, provider), all line items (EAN, description, unit, quantity, unit_price, pre_discount_value, discount, vat_rate, total_value), and totals (subtotal, discount, surcharge, total, net_value, vat_total, payment_method).
  - `ParserError` subclasses `UnsupportedQrUrl`, `ParserFetchError`, `ParserUpstreamError(status_code)`, `ParserDriftError`, `EmptyReceiptError` exist with the `code` mapping in ADR-0001.
  - The bootstrap "merchant header not found" / "no line items parsed" raises map to `ParserDriftError` / `EmptyReceiptError`.
  - Parser tests run against the BLG-0004 fixtures (network-free, via `parse_html`) at 100% accuracy.
  Design: N/A (non-UI item).
  Approach: Extend `backend/app/parsers/gr/parser.py`. Lift the `_to_decimal` helper if needed. Tests live under `backend/tests/parsers/test_gr.py`. Codified by ADR-0001.
  Size: M
  Impact-notes: { country-code: yes, external-surface: e-invoicing.gr (already on allowlist) }
  Links: [docs/adr/S-001-ADR-0001-Parser-interface.md]

- ID: BLG-0002
  Title: Ship `POST /receipts/parse` end-to-end per ADR-0002
  Status: planned
  Ready: yes
  Owner: backend-builder
  Type: engineering
  Outcome: A Greek QR URL POSTed by an authenticated mobile client results in a stored receipt under that user's RLS scope, with `MARK`-based idempotency and the response envelope from ADR-0002.
  Acceptance:
  - `POST /receipts/parse` requires a Bearer JWT; missing / invalid → 401 `unauthenticated`.
  - Body shape `{ "qr_url": string }`. `user_id` is taken from the verified `sub` claim, never the body.
  - JWT verification is in-process using `SUPABASE_JWT_SECRET` (no Supabase round-trip).
  - 201 + `Location: /receipts/{id}` for new rows; 200 + `Location: /receipts/{id}` + `is_duplicate=true` on `(user_id, mark)` re-scan.
  - User-set fields (`is_business_expense`, `business_category`, `notes`) NEVER overwritten on idempotent re-scan.
  - Backend uses `SUPABASE_SERVICE_KEY` to write after JWT verification.
  - `ParserError` subclasses map to HTTP statuses: `UnsupportedQrUrl`/`EmptyReceiptError` → 422, `ParserFetchError`/`ParserUpstreamError` → 502, `ParserDriftError` → 503 (and structured WARN log `drift_detected`).
  - All errors return RFC-7807-style `{ type, title, status, detail, trace_id }`.
  - `qr_url` and `raw_html` are NEVER logged in plaintext; only host (`e-invoicing.gr`) + `trace_id`.
  - `backend/.env.sample` updated to declare `SUPABASE_JWT_SECRET`.
  - Contract tests assert (a) missing Bearer = 401, (b) valid Bearer + valid Greek QR = 201 + body, (c) re-scan = 200 + `is_duplicate=true` + same `id`, (d) non-Greek host = 422 `unsupported_url`.
  Design: N/A (API-only).
  Approach: FastAPI dependency for JWT verification; service-key Supabase client in `backend/app/services/supabase_client.py`; new router under `backend/app/routers/receipts.py`; storage layer under `backend/app/storage/receipts.py`. Codified by ADR-0002.
  Size: L
  Impact-notes: { rls: yes, country-code: yes, external-surface: none new (Supabase + e-invoicing.gr already on allowlist) }
  Links: [docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md, docs/adr/S-001-ADR-0001-Parser-interface.md]

- ID: BLG-0003
  Title: Implement the Scanner screen per DES-0001 and ADR-0003
  Status: planned
  Ready: yes
  Owner: mobile-builder
  Type: product
  Outcome: A first-time-correct scanning experience for Greek consumers: tap FAB → scan → see the parsed receipt in ≤ 5 seconds (§2.5 quality bar), with every error path graceful and Greek-first.
  Acceptance:
  - State machine implemented as `useReducer` covering every state in DES-0001.
  - Uses `expo-camera` (no separate `expo-barcode-scanner` dependency).
  - Pre-prompt modal before OS permission; handles `granted`, `denied`, `blocked` with `Linking.openSettings()` for `blocked`.
  - On-device domain validation (regex `https://e-invoicing.gr/edocuments/ViewInvoice/-1/[0-9a-fA-F-]+_[A-Za-z0-9]+$`) BEFORE the network call.
  - Submit uses `AbortController`, 10s timeout, retry on network/drift.
  - `is_duplicate=true` is treated as a success and shows duplicate copy.
  - 401 routes to Login.
  - All Greek + English strings under `mobile/src/i18n/strings.ts` `scanner.*`.
  - Default language order: device `el-*` → Greek; device `en-*` → English; everything else → Greek.
  - Touch targets ≥ 44 dp; contrast ≥ 4.5:1 / 3:1; screen-reader labels.
  - Telemetry events from DES-0001 emitted (counts only, no PII).
  - Unit tests cover every reducer transition.
  Design: docs/sprints/S-001-discovery-receipt-parser-contract/S-001-DES-0001-Scanner-ux.md
  Approach: New screen `mobile/src/screens/ScannerScreen.tsx` + reducer in `mobile/src/screens/scanner/state.ts`. Shared regex with backend in `mobile/src/parsers/gr.ts`. Codified by ADR-0003.
  Size: L
  Impact-notes: { localization: yes, external-surface: none (calls our backend only) }
  Links: [docs/adr/S-001-ADR-0003-Scanner-ux-flow.md, docs/sprints/S-001-discovery-receipt-parser-contract/S-001-DES-0001-Scanner-ux.md, docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md]

- ID: BLG-0004
  Title: Acquire and curate the first 5 real-receipt fixtures
  Status: planned
  Ready: yes
  Owner: parser-specialist
  Type: parser
  Outcome: A baseline fixture set so the GR parser can be verified end-to-end at 100% accuracy without ever touching the network in tests.
  Acceptance:
  - 5 triplets under `backend/tests/fixtures/receipts/gr/<id>/` per `.agents/skills/refresh-fixtures.md`. Suggested `<id>`s: `gr-001-supermarket`, `gr-002-pharmacy`, `gr-003-fuel`, `gr-004-restaurant`, `gr-005-bookstore` (any 5 covering ≥ 3 distinct merchant verticals).
  - Each fixture has `raw.html` (UTF-8, byte-exact), `expected.json` (every §5.3.3 field, hand-validated against the printed receipt), and `provenance.md` with merchant, capture date, **explicit consent** statement, and redactions list.
  - `security-privacy-officer` co-sign recorded in each `provenance.md`.
  - `backend/tests/parsers/test_gr.py` walks the fixtures via `parse_html` (no network) at 100% accuracy.
  - `make check` runs the new tests and stays green.
  - No fixture is ever sent to an LLM, MCP server, or external service (`agent-runtime-security.md` §8).
  Design: N/A.
  Approach: Recruit 5 receipt holders OR collect public test receipts. Run `.agents/skills/refresh-fixtures.md`. Captured-and-committed in S-002 alongside BLG-0001 to give the GR parser a green proof.
  Size: M
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [.agents/skills/refresh-fixtures.md, docs/adr/S-001-ADR-0001-Parser-interface.md]

- ID: BLG-0005
  Title: Phone-OTP authentication ADR
  Status: planned
  Ready: no (needs ADR-0005 from S-003 discovery)
  Owner: security-privacy-officer
  Type: security
  Outcome: A specific provider, flow, and rate-limit story for phone OTP login.
  Acceptance:
  - ADR-0005 records: provider choice (default Supabase native phone OTP), fallback path, rate limits (per phone, per IP), GDPR posture, attack model (SIM swap, brute force, rate-limit bypass), session and refresh-token lifetime.
  - Co-signed by `data-architect` (RLS shape) and `agent-safety-officer` (any external SMS surface beyond Supabase needs allowlist update).
  - Implementation acceptance bullets are added once ADR-0005 lands.
  Design: TBD in S-003.
  Approach: Discovery debate in S-003. Bare-minimum spec already exists in `AGENTS.md` §5.3.1 / §5.5.2.
  Size: S (decision); follow-up implementation will be split into a separate item.
  Impact-notes: { rls: yes, external-surface: maybe (depends on provider) }
  Links: []

- ID: BLG-0006
  Title: Insights computation strategy ADR (views vs in-process)
  Status: planned
  Ready: no (needs ADR-0006 from S-003 discovery)
  Owner: architect
  Type: engineering
  Outcome: Decide where week / month / year aggregations live so we hit the §2.5 5-second target without coupling logic to the data layer.
  Acceptance:
  - ADR-0006 with rounds, decision, dissent.
  - Includes a sketch of the SQL or Python path, including how `is_business_expense` filtering interacts.
  - Clarifies how `category` is derived (heuristic on description / EAN, or explicit user tag) — affects insights granularity.
  Design: TBD.
  Approach: Discovery debate in S-003.
  Size: S
  Impact-notes: {}
  Links: []

- ID: BLG-0007
  Title: Offline cache strategy ADR (sqlite vs AsyncStorage vs in-memory)
  Status: planned
  Ready: no (needs ADR-0007 from S-003 discovery)
  Owner: mobile-builder
  Type: engineering
  Outcome: Receipts viewable offline once they have been seen at least once; aligns with the §2.5 "fast" quality bar and graceful degraded-network UX from DES-0001.
  Acceptance:
  - ADR-0007 with rounds, decision, dissent.
  - Storage size cap, eviction policy (LRU? FIFO?), and sync semantics specified.
  - Encryption-at-rest decision recorded (financial data on a mobile device).
  Design: TBD.
  Approach: Discovery debate in S-003.
  Size: S
  Impact-notes: {}
  Links: []

- ID: BLG-0008
  Title: Stand up CI to run `make check` on every push and PR
  Status: planned
  Ready: yes
  Owner: devops-engineer
  Type: engineering
  Outcome: `make check` is enforced automatically, not only locally — so a regression cannot land silently.
  Acceptance:
  - `.github/workflows/ci.yml` runs on `push` and `pull_request` against the default branch.
  - Caches pip (`~/.cache/pip` keyed on `requirements.txt`) and npm (`~/.npm` keyed on `mobile/package-lock.json`).
  - Sets `PYTHONUTF8=1` and `PIP_PROGRESS_BAR=off` (the bootstrap learning) for backend steps.
  - Runs `make check` and fails the job on any red gate.
  - Posts a clear failure summary (which step: lint / typecheck / test / parser fixtures).
  - Co-signed by `engineering-manager`.
  - No new external surface (GitHub Actions runs on `github.com` which is already implicit; package registries already allowlisted).
  Design: N/A.
  Approach: Standard GitHub Actions matrix (Python 3.11, Node 20). Branch protection wiring is a follow-up.
  Size: S
  Impact-notes: { external-surface: github.com (already implicit), package registries (already allowlisted) }
  Links: []

- ID: BLG-0009
  Title: CI hook for upstream HTML drift detection
  Status: planned
  Ready: no (delivery item; depends on BLG-0008 + BLG-0001 + BLG-0004)
  Owner: parser-specialist
  Type: parser
  Outcome: A scheduled CI job that re-fetches a small canary set against `e-invoicing.gr` (with consent) and fails loudly when the HTML structure changes — so we don't ship a silently broken parser.
  Acceptance:
  - Scheduled GitHub Actions workflow (`.github/workflows/parser-drift.yml`) runs daily.
  - Uses ONLY a public canary fixture or a deliberately-consented set; never user data.
  - Fails the job (and opens a `drift` BLG via gh-cli or notification) when `parse_html` raises `ParserDriftError` against the canary HTML re-fetched from upstream.
  - `agent-safety-officer` co-sign recorded once the canary set is defined.
  Design: N/A.
  Approach: Build on top of BLG-0008. Codified follow-up of ADR-0001.
  Size: S
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [docs/adr/S-001-ADR-0001-Parser-interface.md, .agents/skills/refresh-fixtures.md]

- ID: BLG-0010
  Title: Reconcile `AGENTS.md` §5.3.2 wording with ADR-0002
  Status: planned
  Ready: no (low-risk doc edit; can be batched with another agentic-system change)
  Owner: agents-doctor
  Type: agentic
  Outcome: AGENTS.md §5.3.2 reflects the ADR-0002 contract (no client-supplied `user_id`), so future agents reading only AGENTS.md don't propose the breached body shape.
  Acceptance:
  - `AGENTS.md` §5.3.2 lists the body as `{ "qr_url": string }` and refers explicitly to ADR-0002.
  - `orchestrator` co-sign recorded in the sprint LOG (per §4.11).
  - No regression on §3.2.1 immutable easter egg or any other §3.2.1 line.
  Design: N/A.
  Approach: Single small edit in S-003 (or earlier if scoped to a small admin sprint).
  Size: XS
  Impact-notes: {}
  Links: [docs/adr/S-001-ADR-0002-Receipts-parse-endpoint.md]

- ID: BLG-0011
  Title: Profile screen language switch (Greek / English)
  Status: planned
  Ready: no (out of MVP scope per §2.9 unless user-test reveals it's blocking)
  Owner: mobile-builder
  Type: product
  Outcome: A user can switch the app's display language between Greek and English from the Profile screen, overriding the device-locale default.
  Acceptance:
  - Profile screen lists "Γλώσσα / Language" with two options.
  - Choice persists across app restarts.
  - All `scanner.*`, `home.*`, etc. strings re-render immediately on switch.
  Design: TBD if the item activates.
  Approach: Built on top of `mobile/src/i18n/`. Captured as a follow-up of ADR-0003.
  Size: S
  Impact-notes: { localization: yes }
  Links: [docs/adr/S-001-ADR-0003-Scanner-ux-flow.md]
