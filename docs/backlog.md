# Backlog

Everything **planned** or **in progress**. Schema in `AGENTS.md` §4.9.1 and `docs/templates/backlog-item.md`. When an item completes, **move** (don't duplicate) it into `docs/done.md`.

> S-009 (`sdk-upgrade-and-on-device-acceptance-v2`) closed 2026-05-09: **BLG-0016 + BLG-0020 + BLG-0021 all done** — the three-sprint Expo SDK 51 → 54 upgrade landed. ADR-0013 §3 pre-flight checklist executed: Step 3 TLS smoke test failed even on Node v22.22.0; Step 3a (Windows CA bundle export to `~/ca-bundle.pem` + `NODE_EXTRA_CA_CERTS`) passed the retry on the first try. SDK 54 install ran cleanly, `expo-doctor` reports 17/17 checks passed, `make check` green: 143 backend + 203 mobile = 346 tests across 21+ suites. ADR-0012 §1 (EAS dev client rejection) remains in force — Option A was sufficient. Both ADR-0012 §3 deviations (`@react-native-community/netinfo`, `typescript`) closed. The §2.8 MVP bullets 4 + 9 are now reachable on stock Expo Go via `S-009-UREV-0001`. See `docs/done.md` Sprint S-009 entry.

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
  Approach: Run `.agents/skills/refresh-fixtures.md` once consenting users are recruited. Captured-and-committed in a future implementation sprint.
  Size: M
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [.agents/skills/refresh-fixtures.md, docs/adr/S-001-ADR-0001-Parser-interface.md]

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
  - The canary `raw.html` is published in the repo with consent, and the comparison is structural (selectors return non-empty), not byte-equal — upstream HTML can re-flow without breaking the parser.
  Design: N/A.
  Approach: Build on top of `.github/workflows/ci.yml` shipped in S-002 (BLG-0008). Codified follow-up of ADR-0001.
  Size: S
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [docs/adr/S-001-ADR-0001-Parser-interface.md, .agents/skills/refresh-fixtures.md, .github/workflows/ci.yml]

- ID: BLG-0011
  Title: Profile screen language switch (Greek / English)
  Status: planned
  Ready: no (out of MVP scope per `AGENTS.md` §2.9 unless user-test reveals it's blocking)
  Owner: mobile-builder
  Type: product
  Outcome: A user can switch the app's display language between Greek and English from the Profile screen, overriding the device-locale default established by ADR-0003 §5.
  Acceptance:
  - Profile screen lists "Γλώσσα / Language" with two options.
  - Choice persists across app restarts (stored in AsyncStorage under `wym.prefs.language`).
  - Choice overrides the locale-detector default in `mobile/src/lib/locale.ts`.
  - All `scanner.*`, `home.*`, `login.*`, `insights.*`, `offline.*`, `profile.*`, `tag.*` strings re-render immediately on switch (no app reload).
  - `agent-safety-officer` review: stored language is **not** PII; AsyncStorage write is acceptable without encryption (no override of ADR-0006 §5 sanitizer rules — preferences are in a separate namespace `wym.prefs.*`).
  Design: TBD if the item activates.
  Approach: Built on top of `mobile/src/i18n/`. Captured as a follow-up of ADR-0003.
  Size: S
  Impact-notes: { localization: yes }
  Links: [docs/adr/S-001-ADR-0003-Scanner-ux-flow.md]

- ID: BLG-0014
  Title: Re-evaluate `react-native-chart-kit` post-MVP per ADR-0007 §8
  Status: planned
  Ready: no (post-MVP — only blocking if a security advisory drops or it doesn't survive the SDK 54 upgrade)
  Owner: mobile-builder (with agent-safety-officer + product-designer)
  Type: engineering
  Outcome: Either `react-native-chart-kit` is confirmed as the long-term chart library, replaced with a better-maintained alternative (`victory-native`, `react-native-svg-charts`, custom SVG via `react-native-svg`), or removed in favor of plain table-based renders if charts add little.
  Acceptance:
  - Comparison ADR (or short decision note) listing maintenance cadence, bundle-size delta, accessibility coverage, and security posture for the candidates.
  - If a swap is proposed, ADR-0007 §2 / ADR-0012 §3 are amended via the standard ADR superseding flow.
  - `make check` green after the change.
  - `agent-safety-officer` co-sign on any new dep.
  Design: N/A.
  Approach: Cross-referenced with **ADR-0012 §6**: chart-kit is expected to survive the SDK 54 upgrade in S-006; if it does not, BLG-0014 collapses into the same S-006 PR and is closed there. Otherwise this BLG stays passive until a real reason to swap surfaces.
  Size: S (research) → M (if a swap lands)
  Impact-notes: { external-surface: yes if a new dep is proposed }
  Links: [docs/adr/S-003-ADR-0007-Expo-runtime-tree.md, docs/adr/S-005-ADR-0012-Expo-sdk-upgrade.md]

- ID: BLG-0015
  Title: Live integration test for the insights RPCs (slow-marked)
  Status: planned
  Ready: no (waits on Supabase test project provisioning)
  Owner: backend-builder + devops-engineer
  Type: engineering
  Outcome: A `slow`-marked pytest hits a real Supabase test project's `insights_summary_for_user` and `insights_top_products_for_user` RPCs and asserts the same response shape as the contract tests. Closes the loop on ADR-0005 §8 ("the SQL RPC must be tested against real Postgres at least once"). Same shape as the optional `slow` test for `GET /export/business-expenses` per ADR-0009 §7.
  Acceptance:
  - `backend/tests/insights/test_supabase_rpc.py` (or similar) with `@pytest.mark.slow` and explicit env-var gating (`SUPABASE_TEST_URL`, `SUPABASE_TEST_SERVICE_KEY`).
  - The test seeds at most a handful of receipts into a `test_*` schema, runs both RPCs, asserts shape + decimal-as-string formatting, and tears down.
  - `make check` keeps the slow tests off by default (`-m "not slow"`); a separate `make test-slow` (or env flag) runs them.
  - `devops-engineer` documents the Supabase test-project provisioning runbook under `docs/runbooks/`.
  - No real user data ever touches the test project.
  Design: N/A.
  Approach: Wait for the Supabase test project to be created. Likely lands in S-006 implementation if the project is up by then; otherwise carries forward.
  Size: S
  Impact-notes: { external-surface: yes (Supabase test project — the host is already on the allowlist) }
  Links: [docs/adr/S-003-ADR-0005-Insights-computation.md, docs/adr/S-005-ADR-0009-Pdf-export-pipeline.md, db/migrations/0003_insights_rpc.sql]

<!-- BLG-0017, BLG-0018, BLG-0019 shipped in S-006 — see `docs/done.md` Sprint S-006 entry. -->
<!-- BLG-0020, BLG-0021 shipped at the contract level in S-007 and at the on-device-resolution level in S-009 — see `docs/done.md`. -->
<!-- BLG-0022 shipped in S-008 — see `docs/done.md` Sprint S-008 entry. ADR-0013 accepted. -->
<!-- BLG-0016 shipped in S-009 — see `docs/done.md` Sprint S-009 entry. The full Expo SDK 51 → 54 upgrade landed per ADR-0013 §3. -->

- ID: BLG-0023
  Title: Verify Supabase asymmetric JWT signing keys (ES256 / JWKS) on the backend
  Status: drift
  Ready: no (discovery-sprint decision per `AGENTS.md` §4.1.1 + §4.11)
  Owner: architect (with security-privacy-officer + agent-safety-officer + engineering-manager + backend-builder)
  Type: security
  Outcome: The backend continues to authenticate users after Supabase rotates a project to the new **JWT Signing Keys** system (ECC P-256 / ES256, RSA / RS256). Today the hand-rolled HS256-only verifier in `backend/app/auth.py` rejects every ES256 token with `jwt_malformed: unsupported alg: 'ES256'` → `POST /receipts/parse` returns 401 → the mobile scanner promotes that to a hard sign-out, breaking §2.8 MVP bullets 4 and 6–9. Discovered live on 2026-05-12 against the project whose legacy HS256 key was auto-rotated by Supabase 6 days earlier; mitigated short-term by reverting the project to a Legacy-HS256 signing key via "Create Standby Key" + promote (Option A). This BLG is the long-term, platform-aligned fix (Option B).
  Acceptance:
  - ADR under `docs/adr/S-010-ADR-<NNNN>-Asymmetric-jwt-verification.md` records the multi-round debate per §4.4 with positions from architect, security-privacy-officer, agent-safety-officer, engineering-manager, backend-builder; ADR-0002 is amended (or superseded) accordingly.
  - `backend/app/auth.py` accepts both HS256 (legacy, kept for the rollback window) and ES256 + RS256 (asymmetric). Key material for asymmetric verification is sourced from Supabase's JWKS endpoint at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, cached in-process with a TTL (≤ 24h) and re-fetched on `kid` miss.
  - A new outbound host (the Supabase JWKS endpoint — same hostname as `SUPABASE_URL`, so no *new* hostname surface; documented in `.agents/context/outbound-allowlist.md`).
  - New runtime dependency `cryptography` (or stdlib-friendly equivalent) added per §3.2 supply-chain discipline: pinned exact version, lockfile-committed, `agent-safety-officer` + `engineering-manager` co-sign in the ADR.
  - Verifier still refuses `alg=none`, refuses unknown `alg` values, refuses tokens whose `kid` is absent or unknown, and refuses tokens whose `aud` ≠ `authenticated`. The four `JwtError` subclasses keep their existing taxonomy.
  - Unit tests covering: HS256-ok, HS256-bad-secret, ES256-ok against a JWKS fixture, ES256-bad-signature, ES256-unknown-kid, RS256-ok, RS256-bad-signature, JWKS-fetch-failure (returns 401 with a stable error code — no silent allow), `alg=none` rejection, `aud` mismatch, expired token. ≥ 95% line coverage on `app/auth.py`.
  - `make check` green; no regression in the 143-test backend suite.
  - Diagnostic log line from BLG-0025 still surfaces `code` + `alg` + `kid` for every rejection (formalized + tested).
  - Mobile DES update: the scanner soft-auth-error path from BLG-0024 lands together so a transient JWKS-cache miss can't sign the user out.
  - `security-privacy-officer` confirms the JWKS fetch doesn't leak any session-bound identifier and is cached with reasonable TTL + jitter.
  Design: Authored as part of the ADR. No mobile UX change required; this is a backend correctness change.
  Approach: Discovery sprint S-010 produces the ADR + a Ready-grade design note. Implementation sprint (S-011 likely) lands the code, deps, tests, and the doc updates. Until then, Option A (Legacy-HS256 signing key on the Supabase project side) is the production mitigation, documented in `docs/runbooks/`.
  Size: M (discovery) → M (implementation)
  Impact-notes: { external-surface: Supabase JWKS endpoint at the same host as SUPABASE_URL — no *new* hostname; rls: no change; localization: no; country-code: no }
  Links: [docs/adr/S-001-ADR-0002-Auth-and-parse-endpoint.md, backend/app/auth.py, backend/app/routes/receipts.py]

- ID: BLG-0024
  Title: Soft auth-error handling on the scanner — silent refresh + retry before sign-out
  Status: drift
  Ready: no (couples to BLG-0023; landed together or right after)
  Owner: mobile-builder (with security-privacy-officer + product-designer)
  Type: product
  Outcome: A transient 401 from `POST /receipts/parse` no longer hard-signs-out the user. Today `mobile/src/screens/ScannerScreen.tsx` routes `SUBMIT_401` → `auth_error` state → `props.onAuthError()` → `App.tsx#handleAuthError` → `setAppState("unauthenticated")`. That's the right reaction when the Supabase session is genuinely invalid, but it's an over-reaction when the cause is a backend misconfig (BLG-0023) or a JWKS-cache miss. After this change, the first 401 triggers a silent `supabase.auth.refreshSession()` and a single retry of the parse; only a *second* consecutive 401 sign-outs the user.
  Acceptance:
  - DES artifact under `docs/sprints/S-010-discovery-.../S-010-DES-<NNNN>-Soft-auth-error.md` covering: state-machine deltas (add `auth_error_recoverable` + `auth_error_terminal`), `tag`/`tag panel`/`profile`/`receipt detail` parity (every backend call needs the same retry), and the failure-mode visible to the user (a one-shot toast on the recoverable case).
  - `scannerReducer` gets two new states + actions; pure-TS reducer tests cover both branches.
  - `App.tsx` adds a `refreshSession()` adapter passed into each screen — no screen directly imports `@supabase/supabase-js` for refresh.
  - No token, refresh token, or phone number ever logged (`agent-runtime-security.md` §3 + ADR-0004 §5).
  - `security-privacy-officer` co-sign: the retry doesn't open a replay-attack vector (single retry per state transition, abort on user-cancel, abort on tab-change).
  - `make check` green; `tag.state` / `profile.state` reducer suites updated; `ScannerScreen` render smoke test still passes.
  - i18n: one new copy key per locale (`scanner.error.auth.refreshing`).
  Design: Authored as part of S-010 discovery.
  Approach: Pure mobile-side change; no backend contract change. Lands in the same implementation sprint as BLG-0023 so the end-to-end on-device acceptance from S-009 stays green.
  Size: S
  Impact-notes: { external-surface: no (still hits the existing backend + Supabase); rls: no; localization: yes (one new string per locale) }
  Links: [mobile/src/screens/ScannerScreen.tsx, mobile/src/screens/scanner/state.ts, App.tsx, docs/adr/S-001-ADR-0004-Auth-otp.md]

- ID: BLG-0026
  Title: Receipt-format scope expansion — AADE tameiakí signature URLs, Epsilon Net provider URLs, and non-URL QR codes (S-010 discovery theme)
  Status: drift
  Ready: no (S-010 discovery — `AGENTS.md` §4.1.1)
  Owner: orchestrator (chair) — product-owner + product-manager + architect + parser-specialist + data-architect + security-privacy-officer + agent-safety-officer + localization-specialist
  Type: product
  Outcome: A clear, ADR-recorded decision on what counts as a "Greek receipt" for this app, based on the **real receipt diversity Greek consumers carry** (not the synthetic "Entersoft or SoftOne via e-invoicing.gr" scope inherited into §2.8 from S-001 / S-002). Discovered on 2026-05-12 during the first real-device acceptance run after the SDK 54 unblock (S-009): of the receipts the test user scanned, **0 were `e-invoicing.gr` viewer URLs**. Three distinct QR families appeared, none currently supported by `mobile/src/parsers/gr.ts` or `backend/app/parsers/gr/`:
    - **Family A — AADE tameiakí signature URL**: `https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=<hex>` (the official AADE "Σύστημα Σήμανσης" per-receipt signature endpoint, printed by every certified Greek cash register). 8 receipts, most common.
    - **Family B — Epsilon Net fiscal-doc viewer**: `https://epsilondigital-3rdpartc.epsilonnet.gr/fd/<hash>:<n>` (Epsilon Net is a Greek tax-tech provider on the same tier as Entersoft / SoftOne but hosts the viewer on their own domain). 1 receipt.
    - **Family C — non-URL hex code**: e.g. `45C07BD642067E5` (15 hex chars, possibly a MARK / fiscal signature / verification code; thermal printer may emit the code without a viewer URL). 5 scans of the same physical receipt — needs identification.
  Acceptance:
  - ADR under `docs/adr/S-010-ADR-<NNNN>-Receipt-format-scope.md` records the multi-round debate per §4.4 and decides, **for each family A / B / C**: (1) is it in scope for the MVP §2.8 bullet 3, (2) does the chosen integration path (HTML scrape vs myDATA vs ignore) preserve §2.2 SKU-level data, (3) does it require user TIN credentials (new auth surface) or just a QR scan, (4) does it require an additional outbound host (allowlist update by `agent-safety-officer`).
  - §2.8 MVP definition-of-done is amended (or explicitly held) based on the decision. §2.9 out-of-scope list is refreshed accordingly.
  - §5.9 country-agnostic plan is re-examined: each family is a *Greek* adapter (still `country_code='GR'`), so §5.9's "Greek e-invoicing.gr parser is one implementation" sentence is **already correct in shape** but needs to be plural in fact — `backend/app/parsers/gr/` becomes a registry of adapters per QR family, not one adapter.
  - Per-family Ready BLGs emerge from the sprint (e.g. BLG-0027 AADE adapter, BLG-0028 Epsilon Net adapter, BLG-0029 non-URL-code identification + adapter). Each Ready BLG carries: outcome, acceptance criteria QA can turn into tests, fixture acquisition plan with consent (§5.8.1), localization impact, RLS impact (none — same `(user_id, mark)` upsert), and the country-agnostic-schema impact (likely none — `country_code='GR'` for all three; the diversity is below the schema line).
  - **Critical product question answered in the ADR**: does scanning an AADE `q1.php?SIG=...` URL actually deliver §2.2 SKU-level data? If not (the verification page typically returns merchant + date + signature + totals only), the ADR must state explicitly whether the MVP value proposition holds for AADE-only receipts, and what the alternative integration path looks like (myDATA B2C with user TIN — new auth flow; or merchant-portal scrape — fragmented per merchant; or accept reduced data for these receipts and surface "limited info" in the UI).
  - Auth-fix verification: while we're scoping S-010, confirm in a short DES note whether Option A (the live HS256-rollback executed in this debugging session) is sufficient or whether BLG-0023 needs to land first. Easiest path: one e-invoicing.gr round-trip from a curl test or the `gr-001-supermarket` synthetic URL against the running backend.
  - No production code is shipped in S-010 (§4.1.1 — discovery sprints don't ship). Spikes under `docs/spikes/` are allowed for HTML-shape investigation against AADE / Epsilon Net pages.
  - Sprint bundle complete per §4.1.5: PLN, LOG, REV, UREV.
  Design: A new DES per family if user-facing UX changes (e.g. AADE "limited info" banner).
  Approach: Cross-reference ADR-0001 (pluggable parser interface — its premise is exactly this kind of expansion). Likely the parser-registry abstraction already extends cleanly to per-family adapters within `gr/`; the work is product scope + fixture acquisition + HTML-shape investigation, not architecture rework. Acquisition is the gating risk: AADE and Epsilon Net responses must be captured with consent under §5.8.1, never sent to an LLM/MCP.
  Size: M (discovery) → unknown per family (sized at sprint close)
  Impact-notes: { external-surface: NEW outbound hosts `www1.aade.gr` (Family A) and `epsilondigital-3rdpartc.epsilonnet.gr` (Family B) — both REQUIRE allowlist update by `agent-safety-officer` before any spike fetches; rls: no change; localization: yes (per-family error copy + possibly "limited info" UX copy); country-code: still `GR` for all three }
  Links: [docs/adr/S-001-ADR-0001-Parser-interface.md, docs/adr/S-001-ADR-0002-Auth-and-parse-endpoint.md, mobile/src/parsers/gr.ts, backend/app/parsers/gr/, AGENTS.md §2.8, AGENTS.md §5.9]

- ID: BLG-0025
  Title: Formalize the JWT-rejection diagnostic log line on `backend/app/routes/receipts.py`
  Status: drift
  Ready: no (in-session ad-hoc fix landed 2026-05-12; this BLG retro-tests it and locks the contract)
  Owner: backend-builder (with agent-safety-officer + qa)
  Type: engineering
  Outcome: The diagnostic log line added live on 2026-05-12 to `jwt_exception_handler` — which surfaces the `JwtError` code + the JWT *header* metadata (`alg`, `typ`, truncated `kid`) on every 401 from the auth gate — gets a regression test, a comment crediting the BLG-0023 incident, and a sentence in `.agents/rules/agent-runtime-security.md` (or ADR-0002 §6 amendment) documenting why these *header* fields are PII-safe (they are public metadata, never the token / payload / signature). Caught the live ES256 misconfig in <2 minutes; should stay.
  Acceptance:
  - `backend/tests/test_receipts_parse.py` (or a new sibling test file) asserts the log line is emitted exactly once on each `JwtError` subclass with the correct `code=` field; uses `caplog` and verifies the *header_alg*, *header_typ*, *header_kid* values are present.
  - A test asserts the **token**, **payload**, **signature**, and `Authorization` header value itself are NOT in any log record (regex-scan of the captured log records).
  - `kid` is truncated to `first 6 chars + "…"` (already implemented); the test pins this exact format.
  - `agent-safety-officer` review + sign-off recorded in the sprint LOG: "header-only fields confirmed as non-sensitive metadata".
  - ADR-0002 §6 amended with a one-paragraph note acknowledging that JWT *headers* are loggable (they are public, by JWT spec), while payloads and signatures remain forbidden.
  - `make check` green; no contract change to the 401 response envelope.
  Design: N/A.
  Approach: ~30-min test addition; no logic change beyond a comment + the ADR §6 amendment.
  Size: XS
  Impact-notes: { external-surface: no; rls: no; localization: no }
  Links: [backend/app/routes/receipts.py, backend/app/auth.py, docs/adr/S-001-ADR-0002-Auth-and-parse-endpoint.md]
