# Backlog

Everything **planned** or **in progress**. Schema in `AGENTS.md` §4.9.1 and `docs/templates/backlog-item.md`. When an item completes, **move** (don't duplicate) it into `docs/done.md`.

> S-002 (`scan-and-store`) closed: BLG-0001, BLG-0002, BLG-0003 (testable parts), BLG-0008 moved to `docs/done.md`. BLG-0004 stays open with one synthetic fixture shipped (the 4 real-receipt triplets are still pending consenting users). New drift item BLG-0012 captures the runtime Expo install split off from BLG-0003.

---

- ID: BLG-0004
  Title: Acquire and curate 4 more **real** GR receipt fixtures
  Status: in-progress
  Ready: no (waits on consenting receipt holders)
  Owner: parser-specialist
  Type: parser
  Outcome: A baseline real-receipt fixture set so the GR parser is verified against actual `e-invoicing.gr` HTML — not just a synthetic shape — at 100% accuracy without ever touching the network in tests.
  Acceptance:
  - 4 additional triplets under `backend/tests/fixtures/receipts/gr/<id>/` covering ≥ 3 distinct merchant verticals (e.g. `gr-002-pharmacy`, `gr-003-fuel`, `gr-004-restaurant`, `gr-005-bookstore`). The synthetic `gr-001-supermarket` shipped in S-002 stays as a baseline shape fixture.
  - Each fixture has `raw.html` (UTF-8, byte-exact), `expected.json` (every §5.3.3 field, hand-validated against the printed receipt), and `provenance.md` with **explicit consent** statement and redactions list.
  - `security-privacy-officer` co-sign recorded in each `provenance.md`.
  - `backend/tests/parsers/test_gr_fixtures.py` walks every fixture via `parse_html` (no network) at 100% accuracy.
  - `make check` runs the new tests and stays green.
  - No fixture is ever sent to an LLM, MCP server, or external service (`agent-runtime-security.md` §8).
  Design: N/A.
  Approach: Run `.agents/skills/refresh-fixtures.md` once consenting users are recruited. Captured-and-committed in a future implementation sprint (S-004 or later).
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

- ID: BLG-0009
  Title: CI hook for upstream HTML drift detection
  Status: planned
  Ready: no (delivery item; depends on BLG-0008 done + BLG-0004 having ≥ 1 real-receipt canary)
  Owner: parser-specialist
  Type: parser
  Outcome: A scheduled CI job that re-fetches a small canary set against `e-invoicing.gr` (with consent) and fails loudly when the HTML structure changes — so we don't ship a silently broken parser.
  Acceptance:
  - Scheduled GitHub Actions workflow (`.github/workflows/parser-drift.yml`) runs daily.
  - Uses ONLY a public canary fixture or a deliberately-consented set; never user data.
  - Fails the job (and opens a `drift` BLG via gh-cli or notification) when `parse_html` raises `ParserDriftError` against the canary HTML re-fetched from upstream.
  - `agent-safety-officer` co-sign recorded once the canary set is defined.
  Design: N/A.
  Approach: Build on top of `.github/workflows/ci.yml` shipped in S-002 (BLG-0008). Codified follow-up of ADR-0001.
  Size: S
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [docs/adr/S-001-ADR-0001-Parser-interface.md, .agents/skills/refresh-fixtures.md, .github/workflows/ci.yml]

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

- ID: BLG-0012
  Title: Install Expo + react-native runtime deps and wire `ScannerScreen.tsx` into the gate
  Status: planned
  Ready: no (drift from S-002 — needs an ADR co-signed by `agent-safety-officer` + `engineering-manager` per §4.11 before the Expo dep tree lands)
  Owner: mobile-builder
  Type: engineering
  Outcome: The hand-written `ScannerScreen.tsx` (already in `mobile/src/screens/`) and `mobile/src/api/receipts.ts` are runnable on a real device through Expo, and both files are typechecked + tested as part of `make check`.
  Acceptance:
  - ADR-0008 (or its successor) accepted: Expo SDK version, Camera plugin choice, RN version, locked transitive surface, supply-chain review by `agent-safety-officer`, gate impact reviewed by `engineering-manager`.
  - `mobile/package.json` declares pinned versions of: `expo`, `expo-camera`, `expo-localization` (or equivalent), `react`, `react-native`, `@supabase/supabase-js`, plus react-renderer test setup (e.g. `@testing-library/react-native` + `jest-expo`).
  - `mobile/tsconfig.json` re-includes `src/screens/**/*.tsx` and `src/api/**/*` in the gate.
  - `mobile/jest.config.js` updated to support RN component tests (renderer wiring).
  - At least one render test for `ScannerScreen` covering: pre-prompt → permission grant → scanning → submit success/duplicate → ReceiptDetail navigation.
  - `make check` stays green.
  - Outbound allowlist updated if any new host is required.
  - The handoff plan in `mobile/src/screens/ScannerScreen.tsx` and `mobile/src/api/receipts.ts` becomes obsolete and is removed.
  Design: N/A (the screen design is DES-0001; this item is the runtime wiring).
  Approach: Discovery sprint produces the ADR; a follow-up implementation sprint executes the install + wiring. Until then, the testable parts (reducer, validator, i18n, locale, format) carry the contract.
  Size: M
  Impact-notes: { external-surface: yes (Expo + RN package surface — needs `agent-safety-officer` review per `agent-runtime-security.md` §4) }
  Links: [docs/adr/S-001-ADR-0003-Scanner-ux-flow.md, docs/sprints/S-001-discovery-receipt-parser-contract/S-001-DES-0001-Scanner-ux.md, mobile/src/screens/ScannerScreen.tsx, mobile/src/api/receipts.ts, .agents/context/outbound-allowlist.md]
