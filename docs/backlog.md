# Backlog

Everything **planned** or **in progress**. Schema in `AGENTS.md` §4.9.1 and `docs/templates/backlog-item.md`. When an item completes, **move** (don't duplicate) it into `docs/done.md`.

> S-010 (`receipt-format-scope-and-auth-modernization`) closed 2026-05-12: **discovery sprint, three ADRs accepted (ADR-0014 / ADR-0015 / ADR-0016) + DES-0006**. Resolves both drift findings from the 2026-05-12 live on-device run. BLG-0026 (umbrella) moves to done. BLG-0023 / BLG-0024 / BLG-0025 lift from `drift` to **Ready**. Five new Ready / planned BLGs spawned (BLG-0027 AADE adapter, BLG-0028 Epsilon Net adapter, BLG-0029 Family C identification, BLG-0030 AADE HTML-shape spike, BLG-0032 mobile QR-validator mirror). Post-MVP follow-ups added (BLG-0033 cross-source dedup, BLG-0034 HS256 retirement). Two new outbound hosts on the allowlist (`www1.aade.gr`, `epsilondigital-3rdpartc.epsilonnet.gr`) scoped to parser + spike fetches per §5.8.1. `make check` unchanged from S-009 close (346 tests). See `docs/done.md` Sprint S-010 entry.
>
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
  Status: planned
  Ready: yes (ADR-0015 accepted in S-010 — implementation contract locked)
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
  Status: planned
  Ready: yes (ADR-0015 accepted in S-010; couples to BLG-0023, lands together or right after)
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

<!-- BLG-0026 shipped in S-010 — see `docs/done.md` Sprint S-010 entry. ADR-0014 produced. Spawned BLG-0027 + BLG-0028 + BLG-0029 + BLG-0030 + BLG-0032 + BLG-0033. -->

- ID: BLG-0027
  Title: AADE tameiakí signature URL adapter (Family A) — `backend/app/parsers/gr/aade/`
  Status: planned
  Ready: yes (gated on BLG-0030 outcome — if SKU-level reachable, full-SKU adapter; if only merchant + total + date, limited-info adapter)
  Owner: parser-specialist (with security-privacy-officer + product-designer + localization-specialist)
  Type: parser
  Outcome: Users can scan the AADE "Σύστημα Σήμανσης" per-receipt signature URL (`https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=<hex>`) and see the receipt — with SKU-level data if AADE's response carries it, or with merchant + total + date + a clearly-worded "Less detail" banner if it doesn't. §2.8 bullet 3 (amended in ADR-0014 §6) is met for the dominant Greek consumer-receipt format.
  Acceptance:
  - `backend/app/parsers/gr/aade/parser.py` implements `GrAadeTameiakiParser(BaseReceiptParser)` per ADR-0001 §1: `country_code="GR"`, `can_parse(url)` matches `https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=<hex>$`, `parse(url)` fetches + parses, `parse_html(html)` is the pure-bytes path.
  - **AADE ToS / robots.txt review documented in this BLG's PR** (per ADR-0014 §4 security-privacy-officer precondition). If AADE forbids automated fetches: narrow this BLG to "parse the QR string in-app only; store the SIG hex as `mark`; `is_limited_info=true` always; merchant remains `'Άγνωστος έμπορος'` until a future feature lets the user attach a name."
  - **Polite-fetch contract** (if production fetches are allowed): max 1 req/s per user, no parallelism per session, `User-Agent: WatchYourMoney/<version> (+contact-url)`, 10s timeout matching the e-invoicing.gr adapter.
  - Schema migration `db/migrations/00NN_receipts_is_limited_info.sql` adds `is_limited_info boolean not null default false` per ADR-0014 §2. RLS untouched.
  - `_to_response` in `backend/app/routes/receipts.py` extends `ReceiptResponse` with `is_limited_info: bool`.
  - Mobile DES (BLG-0027-DES) covers the receipt-detail screen variant when `is_limited_info=true`: line-items section replaced with an informational card carrying `receipt.limited_info.banner` + `receipt.limited_info.tooltip` per ADR-0014 §5. List screen and Insights unchanged.
  - Greek + English strings shipped: `receipt.limited_info.banner` + `receipt.limited_info.tooltip` per ADR-0014 §5.
  - Parser registry `_REGISTERED` in `backend/app/parsers/registry.py` grows by one entry.
  - `(user_id, mark)` uniqueness preserved — AADE's SIG hex serves as `mark`.
  - Fixture triplet committed under `backend/tests/fixtures/receipts/gr-aade-001/` (consented per §5.8.1; provenance.md includes ToS-review summary).
  - Parser tests cover: full-SKU response (if BLG-0030 confirms reachable), limited-info response (`items=[]`, `is_limited_info=true` does NOT raise `EmptyReceiptError`), drift detection.
  - `agent-safety-officer` + `security-privacy-officer` co-sign in the PR per §4.11.
  - `make check` green.
  Design: BLG-0027-DES under `docs/sprints/S-011-.../` once S-011 opens.
  Approach: Land after BLG-0030 spike. Effort: M (parser + DES + UI variant + migration + Greek strings + tests).
  Size: M
  Impact-notes: { external-surface: `www1.aade.gr` (allowlisted in S-010); rls: no; localization: yes (banner + tooltip); country-code: GR; schema-change: yes (`is_limited_info` column) }
  Links: [docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md, BLG-0030]

- ID: BLG-0028
  Title: Epsilon Net adapter (Family B) — `backend/app/parsers/gr/epsilon/`
  Status: planned
  Ready: yes (gated on consented Epsilon Net fixture)
  Owner: parser-specialist (with agent-safety-officer)
  Type: parser
  Outcome: Users can scan an Epsilon Net fiscal-doc QR (`https://epsilondigital-3rdpartc.epsilonnet.gr/fd/<hash>:<n>`) and see the full SKU-level receipt — same tier of completeness as Entersoft / SoftOne via `e-invoicing.gr` today.
  Acceptance:
  - `backend/app/parsers/gr/epsilon/parser.py` implements `GrEpsilonNetParser(BaseReceiptParser)` per ADR-0001 §1. `can_parse` matches the Epsilon URL shape; `parse` validates the origin before the HTTP call (per ADR-0001 §1); `parse_html` is pure-bytes.
  - Polite-fetch contract: same defaults as BLG-0027 (1 req/s, identifying `User-Agent`, 10s timeout).
  - Parser extracts every §5.3.3 field expected from a full-SKU viewer (merchant + AFM + address + ΔΟΥ + document number + MARK + UID + authentication code + issue date + transmission timestamp + payment method + provider + all line items + all totals). `is_limited_info=false`.
  - Fixture triplet committed under `backend/tests/fixtures/receipts/gr-epsilon-001/` (consented per §5.8.1).
  - Parser tests cover: success case, drift, empty receipt.
  - `(user_id, mark)` uniqueness preserved — Epsilon's `<hash>:<n>` URL tail serves as `mark`.
  - Parser registry `_REGISTERED` grows by one entry.
  - `agent-safety-officer` co-sign on the polite-fetch contract.
  - `make check` green.
  Design: N/A (same UX path as the existing GR adapter).
  Approach: Inline micro-spike (since the file count is small, the spike + adapter ship in one PR). Effort: M.
  Size: M
  Impact-notes: { external-surface: `epsilondigital-3rdpartc.epsilonnet.gr` (allowlisted in S-010); rls: no; localization: no (existing strings); country-code: GR }
  Links: [docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md]

- ID: BLG-0029
  Title: Family C identification spike — what system emits a 15-hex-char QR with no URL prefix?
  Status: planned
  Ready: no (gated on project-owner photo of the printed receipt + system name)
  Owner: parser-specialist (with product-owner)
  Type: parser
  Outcome: We know what fiscal / verification system emits 15-hex-char codes like `45C07BD642067E5` so we can decide whether to ship an adapter for them (or to formally classify them out of MVP scope under §2.9).
  Acceptance:
  - Spike artifact under `docs/spikes/gr-family-c-identification/` with: project-owner-provided photo of the printed receipt (consented per §5.8.1), photo of the QR area, photo of the printed text near the QR, identification of the printing system / cash register manufacturer, and a one-paragraph product recommendation: ship adapter / defer / explicit out-of-scope.
  - If "ship adapter": opens a new Ready BLG (e.g. BLG-0035) per the adapter pattern.
  - If "defer" or "out-of-scope": `AGENTS.md` §2.9 amended; this BLG closes.
  Design: N/A.
  Approach: Ask project owner first; then ~1h identification work.
  Size: XS
  Impact-notes: { external-surface: unknown until identified; rls: no; localization: TBD; country-code: presumed GR }
  Links: [docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md]

- ID: BLG-0030
  Title: AADE HTML-shape spike — determine SKU-level data ceiling on `q1.php?SIG=<hex>`
  Status: planned
  Ready: yes (gated on one consented AADE receipt under §5.8.1)
  Owner: parser-specialist (with security-privacy-officer + agent-safety-officer)
  Type: parser
  Outcome: We know whether `www1.aade.gr/tameiakes/myweb/q1.php?SIG=...` returns SKU-level data (line items) or only merchant + AFM + total + date + signature. The spike's outcome decides whether BLG-0027 ships a full-SKU adapter or a limited-info adapter.
  Acceptance:
  - Spike artifact under `docs/spikes/gr-aade-html-shape/` with: one consented AADE receipt's `raw.html` (per §5.8.1; provenance.md records consent + redactions), a documented field map showing which §5.3.3 fields are present in the response and which are absent, a documented decision "AADE adapter is full-SKU" or "AADE adapter is limited-info" with reasoning.
  - **AADE ToS / robots.txt review attached** (per ADR-0014 §4): if AADE forbids automated fetches, BLG-0027 narrows to "parse-the-QR-string-only mode."
  - No fetch happens until §5.8.1 consent is recorded.
  - Resulting recommendation is the input to BLG-0027 acceptance.
  Design: N/A.
  Approach: One consented fetch + manual HTML inspection.
  Size: XS-S
  Impact-notes: { external-surface: `www1.aade.gr` (allowlisted in S-010 — first actual fetch happens in this BLG under §5.8.1 consent); rls: no; localization: no; country-code: GR }
  Links: [docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md, BLG-0027]

- ID: BLG-0032
  Title: Mobile `validateGrQrCode` — discriminated-union mirror for the three GR QR families
  Status: planned
  Ready: yes (couples to BLG-0027 + BLG-0028)
  Owner: mobile-builder (with parser-specialist)
  Type: product
  Outcome: The on-device QR validator (`mobile/src/parsers/gr.ts`) recognizes all three GR families with a discriminated-union return type so the scanner knows whether to send the value as-is (Family A / B URLs) or as a freeform code (Family C, when it arrives). Defense-in-depth mirror per ADR-0003 §3.
  Acceptance:
  - `mobile/src/parsers/gr.ts` exposes `validateGrQrCode(input: string) => { ok: true; family: "einvoicing" | "aade" | "epsilon" | "unknown_code"; ... } | { ok: false; reason: ... }`. Existing `validateGrQrUrl` stays as a delegate for backwards compatibility.
  - Regex patterns mirror the backend `can_parse` shape exactly for each family — same defense-in-depth contract as ADR-0003 §3.
  - Reducer tests cover every discriminator branch including Family C (unknown_code) once BLG-0029 identifies it.
  - `mobile/src/screens/ScannerScreen.tsx` consumes the discriminator and shapes the API call accordingly (URL string for A / B, opaque code for C if shipped).
  - Greek `scanner.*` strings unchanged (the "supported QR families" wording is implicit in the on-device validator behavior).
  - `make check` green.
  Design: N/A (pure on-device validation logic mirroring backend `can_parse`).
  Approach: Ships in S-011 with BLG-0027 + BLG-0028.
  Size: S
  Impact-notes: { external-surface: no; rls: no; localization: no; country-code: GR }
  Links: [docs/adr/S-001-ADR-0003-Scanner-ux-flow.md, docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md, mobile/src/parsers/gr.ts]

- ID: BLG-0033
  Title: Detect probable duplicates across QR sources for the same physical purchase
  Status: planned
  Ready: no (post-MVP — added to `AGENTS.md` §2.9 by ADR-0014)
  Owner: product-manager (with parser-specialist)
  Type: product
  Outcome: If a user scans two different QRs from the same physical purchase (e.g. the AADE signature URL + the merchant-provider URL — both printed on the same receipt), the app offers to merge them rather than storing them as two separate receipts.
  Acceptance:
  - Algorithm: `(merchant_afm, issue_date, total, payment_method)` triplet within a small tolerance suggests a probable duplicate.
  - UX: prompt "Looks like the same receipt — merge?" with confirm / decline.
  - Telemetry: counts only.
  Design: TBD if the item activates.
  Approach: Post-MVP feature; sized when activated.
  Size: M
  Impact-notes: { external-surface: no; rls: no; localization: yes }
  Links: [docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md, AGENTS.md §2.9]

- ID: BLG-0034
  Title: Retire HS256 transitional support in the JWT verifier
  Status: planned
  Ready: no (opens after BLG-0023 ships and the production project runs on JWT Signing Keys for one release cycle)
  Owner: architect (with security-privacy-officer + backend-builder)
  Type: security
  Outcome: The HS256 path in `backend/app/auth.py` is removed; `SUPABASE_JWT_LEGACY_HS256_SECRET` is no longer read; the deprecated `SUPABASE_JWT_SECRET` alias is removed. The auth gate is asymmetric-only against Supabase's JWT Signing Keys.
  Acceptance:
  - HS256 branch removed from the verifier; algorithm allowlist becomes `{ES256, RS256}`.
  - Tests covering HS256 removed or retargeted to assert HS256 rejection.
  - Env vars dropped from `backend/.env.example`.
  - Runbook entry "rollback to HS256-only" removed (cannot be reversed without re-enabling HS256).
  - `make check` green.
  Design: N/A.
  Approach: Open after BLG-0023 has run in production for one release cycle without incident.
  Size: XS
  Impact-notes: { external-surface: no; rls: no; localization: no }
  Links: [docs/adr/S-010-ADR-0015-Asymmetric-jwt-verification.md, BLG-0023]

- ID: BLG-0025
  Title: Formalize the JWT-rejection diagnostic log line + ADR-0002 §6 amendment
  Status: planned
  Ready: yes (ADR-0016 accepted in S-010; co-located with BLG-0023 in the same S-011 PR)
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
