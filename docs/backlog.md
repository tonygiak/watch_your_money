# Backlog

Everything **planned** or **in progress**. Schema in `AGENTS.md` §4.9.1 and `docs/templates/backlog-item.md`. When an item completes, **move** (don't duplicate) it into `docs/done.md`.

> S-008 (`sdk-upgrade-path-forward`) closed 2026-05-08: **BLG-0022** (discovery sprint) done — ADR-0013 accepted. The three-sprint `UNABLE_TO_VERIFY_LEAF_SIGNATURE` blocker was diagnosed as a Node.js CA bundle staleness issue (Node.js bundles its own Mozilla CA store; if `registry.npmjs.org` rotated to a newer root CA after the installed Node.js version was released, validation fails). **BLG-0016 is now "Ready, executable per ADR-0013 §3"**: pre-flight checklist (update Node.js to v22 LTS / export Windows CA bundle via `NODE_EXTRA_CA_CERTS`) runs before `npx expo install --fix` in S-009. ADR-0012 §1 (EAS dev client rejection) remains in force unless S-009 exhausts the pre-flight checklist. `make check` unchanged: 346 tests. See `docs/done.md` Sprint S-008 entry.

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

- ID: BLG-0016
  Title: Upgrade Expo SDK 51 → 54 (Expo Go compatibility + compat-matrix alignment)
  Status: planned
  Ready: yes — **executable per ADR-0013 §3 pre-flight checklist** (S-008 resolved the three-sprint `UNABLE_TO_VERIFY_LEAF_SIGNATURE` blocker: root cause is Node.js CA bundle staleness; fix is Node.js v22 LTS update and/or `NODE_EXTRA_CA_CERTS` Windows CA export — both approaches keep `strict-ssl` fully enabled). Pre-flight checklist must run before `npx expo install --fix`. If checklist is fully exhausted without success, open BLG-0023 for S-010 EAS dev client discovery. Acceptance bullet 5 (encryption-stack round-trip test, forward-only variant) shipped in S-007. Anchored to ADR-0012 + ADR-0013.
  Owner: mobile-builder (with architect, engineering-manager, agent-safety-officer, security-privacy-officer)
  Type: engineering
  Outcome: A real Greek consumer can run the Watch-Your-Money app on stock Expo Go (iOS or Android, latest store version) end-to-end. `expo-doctor` reports a clean compat matrix (no version-drift warnings). The encryption stack from ADR-0006 (`@noble/ciphers`, `expo-secure-store`, `expo-crypto`) survives byte-identically. The two existing in-tree compat-matrix warnings (`@react-native-community/netinfo`, `typescript`) are explicitly resolved against the SDK 54 matrix.
  Acceptance:
  - Single S-007 PR contains: `mobile/package.json` (SDK 54 tree, exact versions, no carets), regenerated `mobile/package-lock.json`, any required `mobile/babel.config.js` / `mobile/jest.config.js` / `mobile/tsconfig.json` updates, `eas.json` profile bumps to SDK 54.
  - `expo-doctor` runs clean — zero compat-matrix warnings.
  - Both in-tree compat-matrix deviations re-aligned: `@react-native-community/netinfo` → SDK-54-expected version (no deviation recorded); `typescript` → SDK-54-expected version (no deviation recorded). Per ADR-0012 §3 the deliberate-deviation option was rejected absent a fresh reason.
  - **Encryption-stack round-trip test**: per S-005 plan "Open questions" §5, the **forward-only** variant is acceptable — encrypt + decrypt under SDK 54 with a known plaintext, asserting the AES-256-GCM round-trip is unbroken. If this fails, the upgrade is **blocked** pending an ADR-0006 amendment.
  - `react-native-chart-kit` survives the upgrade. If it doesn't, BLG-0014 collapses into this PR with the swap (likely `victory-native@~37.x` or `react-native-svg-charts`) co-signed by `mobile-builder` + `agent-safety-officer` + `engineering-manager` + `product-designer`.
  - All 340 existing tests (post-S-006 baseline — 143 backend + 197 mobile) pass under the new `jest-expo@~54` preset before any new test is added (the two-project Jest layout from BLG-0012 stays).
  - `expo start` no longer prints the "packages should be updated for best compatibility" block.
  - `eas.json` `development` and `preview` profiles bumped to SDK 54.
  - **Runtime acceptance** (folded into `S-007-UREV-0001`): a real Greek consumer with stock Expo Go (iOS or Android, latest store version) can run **two** acceptance scripts end-to-end: (1) the full S-004 script (sign in → scan → Insights → offline → restore) and (2) the full S-006 freelancer-mode script (sign in → scan → tag as business → Insights → Profile → ΑΦΜ → export PDF → share — `S-006-UREV-0001` §A).
  - No new outbound host (`registry.npmjs.org` + `expo.dev` already on the allowlist).
  - `agent-safety-officer` + `engineering-manager` co-sign on the final pin set after `expo install --fix`. `architect` co-sign on the SDK choice. `security-privacy-officer` co-sign on the encryption round-trip result.
  Design: N/A.
  Approach: `npx expo install --fix` against a clean clone in S-007 → `expo-doctor` until clean → regenerate `package-lock.json` → manually verify ADR-0006 deps + chart-kit → encryption round-trip test → atomic single-PR commit. Lands **first** in S-007 so the freelancer-mode UREV from S-006 (`S-006-UREV-0001` §A) can finally be exercised on a real Expo Go device.
  Size: M (research + dependency tree update + RN config touch-ups + render-test verification + encryption round-trip)
  Impact-notes: { external-surface: no (npmjs.com + expo.dev already on allowlist); supply-chain: yes (transitive re-pin of ~20 packages requires `agent-safety-officer` co-sign per `AGENTS.md` §4.11) }
  Links: [docs/adr/S-005-ADR-0012-Expo-sdk-upgrade.md, docs/adr/S-003-ADR-0007-Expo-runtime-tree.md, docs/adr/S-003-ADR-0006-Offline-cache-strategy.md, docs/sprints/S-004-implementation-login-insights-cache-runnable-scanner/S-004-UREV-0001-Login-insights-cache-runnable-scanner.md, docs/sprints/S-006-implementation-freelancer-mode-and-sdk-upgrade/S-006-LOG-0001-Freelancer-mode-and-sdk-upgrade.md, docs/sprints/S-006-implementation-freelancer-mode-and-sdk-upgrade/S-006-UREV-0001-Freelancer-mode-and-sdk-upgrade.md]

<!-- BLG-0017, BLG-0018, BLG-0019 shipped in S-006 — see `docs/done.md` Sprint S-006 entry. -->
<!-- BLG-0020, BLG-0021 shipped in S-007 — see `docs/done.md` Sprint S-007 entry. -->
<!-- BLG-0022 shipped in S-008 — see `docs/done.md` Sprint S-008 entry. ADR-0013 accepted. -->
