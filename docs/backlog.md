# Backlog

Everything **planned** or **in progress**. Schema in `AGENTS.md` §4.9.1 and `docs/templates/backlog-item.md`. When an item completes, **move** (don't duplicate) it into `docs/done.md`.

> S-004 (`login-insights-cache-runnable-scanner`) closed: BLG-0005, BLG-0006, BLG-0007, BLG-0012 shipped (moved to `docs/done.md`). Three new items added as drift / follow-ups: BLG-0013 (`tzdata` runtime dep), BLG-0014 (`react-native-chart-kit` re-evaluation), BLG-0015 (live insights-RPC integration test). BLG-0004 (real-receipt fixtures) and BLG-0009 (drift-detection CI) and BLG-0011 (language switch) carry over unchanged.
>
> **Post-close verification finding (2026-05-07):** during the S-004 UREV walk-through, on-device runtime verification was blocked because Expo Go on iOS only supports the latest SDK (54), while the project is pinned to SDK 51 per ADR-0007 §2. `make check` stayed green, the backend boots cleanly, and the migrations apply successfully — only the on-device acceptance test in S-004-UREV-0001 §16-37 cannot be completed against current Expo Go. Mitigation tracked as **BLG-0016** below: ADR debate in S-005 (discovery), upgrade applied in S-006 (implementation).

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
  - `agent-safety-officer` co-sign recorded once the canary set is defined (a re-fetch IS a real outbound call to `e-invoicing.gr` from CI — the host is already on the allowlist but the schedule + identity used must be reviewed).
  - The canary `raw.html` is published in the repo with consent, and the comparison is structural (selectors return non-empty), not byte-equal — upstream HTML can re-flow without breaking the parser.
  Design: N/A.
  Approach: Build on top of `.github/workflows/ci.yml` shipped in S-002 (BLG-0008). Codified follow-up of ADR-0001.
  Size: S
  Impact-notes: { external-surface: e-invoicing.gr (already on allowlist) }
  Links: [docs/adr/S-001-ADR-0001-Parser-interface.md, .agents/skills/refresh-fixtures.md, .github/workflows/ci.yml]

- ID: BLG-0011
  Title: Profile screen language switch (Greek / English)
  Status: planned
  Ready: no (out of MVP scope per §2.9 unless user-test reveals it's blocking)
  Owner: mobile-builder
  Type: product
  Outcome: A user can switch the app's display language between Greek and English from the Profile screen, overriding the device-locale default established by ADR-0003 §5.
  Acceptance:
  - Profile screen lists "Γλώσσα / Language" with two options.
  - Choice persists across app restarts (stored in AsyncStorage under `wym.prefs.language`).
  - Choice overrides the locale-detector default in `mobile/src/lib/locale.ts`.
  - All `scanner.*`, `home.*`, `login.*`, `insights.*`, `offline.*` strings re-render immediately on switch (no app reload).
  - `agent-safety-officer` review: stored language is **not** PII; AsyncStorage write is acceptable without encryption (no override of ADR-0006 §5 sanitizer rules — preferences are in a separate namespace `wym.prefs.*`).
  Design: TBD if the item activates.
  Approach: Built on top of `mobile/src/i18n/`. Captured as a follow-up of ADR-0003.
  Size: S
  Impact-notes: { localization: yes }
  Links: [docs/adr/S-001-ADR-0003-Scanner-ux-flow.md]

- ID: BLG-0013
  Title: Codify `tzdata` as a Windows-host runtime dep (drift from S-004)
  Status: planned
  Ready: no (S-005 discovery)
  Owner: agent-safety-officer (with engineering-manager + architect)
  Type: agentic
  Outcome: A clean rule for "Python `zoneinfo` requirement on Windows hosts" so we don't re-debate it the next time it surfaces. Either an addendum to ADR-0007 (mobile + backend pinned trees) or a new short ADR. The package is data-only and PyPI is already on the allowlist, but mid-implementation runtime-dep adds need to be retroactively recorded per `AGENTS.md` §3.2.1 supply-chain discipline.
  Acceptance:
  - One ADR (or amendment) decided in S-005 discovery covering Windows-host stdlib gaps and the canonical fix (`tzdata`).
  - `tzdata` pin updated to whatever the ADR concludes (currently `tzdata==2024.2`).
  - `backend/requirements.txt` carries the comment line referencing the ADR id.
  - `agent-safety-officer` co-sign recorded in the ADR.
  Design: N/A.
  Approach: Discovery item. Already shipped functionally in S-004; this BLG closes the audit-trail gap.
  Size: XS
  Impact-notes: { external-surface: PyPI (already on allowlist) }
  Links: [docs/sprints/S-004-implementation-login-insights-cache-runnable-scanner/S-004-LOG-0001-Login-insights-cache-runnable-scanner.md, docs/adr/S-003-ADR-0007-Expo-runtime-tree.md]

- ID: BLG-0014
  Title: Re-evaluate `react-native-chart-kit` post-MVP per ADR-0007 §8
  Status: planned
  Ready: no (post-MVP — only blocking if a security advisory drops)
  Owner: mobile-builder (with agent-safety-officer + product-designer)
  Type: engineering
  Outcome: Either `react-native-chart-kit` is confirmed as the long-term chart library, replaced with a better-maintained alternative (`victory-native`, `react-native-svg-charts`, custom SVG via `react-native-svg`), or removed in favor of plain table-based renders if charts add little.
  Acceptance:
  - Comparison ADR (or short decision note) listing maintenance cadence, bundle-size delta, accessibility coverage, and security posture for the candidates.
  - If a swap is proposed, ADR-0007 §2 is amended via the standard ADR superseding flow.
  - `make check` green after the change.
  - `agent-safety-officer` co-sign on any new dep.
  Design: N/A.
  Approach: Post-MVP discovery work. Tracked here so we don't lose the watch flag.
  Size: S (research) → M (if a swap lands)
  Impact-notes: { external-surface: yes if a new dep is proposed }
  Links: [docs/adr/S-003-ADR-0007-Expo-runtime-tree.md, docs/sprints/S-004-implementation-login-insights-cache-runnable-scanner/S-004-REV-0001-Login-insights-cache-runnable-scanner.md]

- ID: BLG-0016
  Title: Upgrade Expo SDK 51 → 54 (Expo Go compatibility + compat-matrix alignment)
  Status: planned
  Ready: no (S-005 discovery owns the ADR; S-006 implementation applies it)
  Owner: mobile-builder (with architect, engineering-manager, agent-safety-officer)
  Type: engineering
  Outcome: A real Greek consumer can run the Watch-Your-Money app on Expo Go (iOS or Android, latest store version) end-to-end, and `expo-doctor` reports a clean compat matrix (no version-drift warnings on `expo start`). ADR-0007 is amended (or superseded) so the mobile runtime tree stays on a supported Expo SDK and matches the SDK's expected dependency versions. Without this, `AGENTS.md` §2.5 ("Mobile-first … iOS and Android") cannot be honored on a stock Expo Go install, and the in-tree drift surfaced as warnings on `expo start` (today: `@react-native-community/netinfo@11.3.2` vs SDK 51 expected `11.3.1`; `typescript@5.6.3` vs SDK 51 expected `~5.3.3`) is not silently inherited into the SDK 54 tree.
  Acceptance:
  - One ADR (S-005) deciding: (a) target Expo SDK version (default: latest stable at decision time, currently SDK 54), (b) upgrade strategy — `npx expo install --fix` + `expo-doctor` vs manual pin update — and (c) whether `react-native-chart-kit` (BLG-0014), `@noble/ciphers` (ADR-0006), `expo-secure-store` (ADR-0006), `expo-camera` + `@supabase/supabase-js` (ADR-0004) survive the upgrade.
  - The same ADR explicitly addresses the **two existing in-tree compat-matrix warnings** flagged on `expo start` 2026-05-07:
    - `@react-native-community/netinfo` — SDK 51 expects `11.3.1`, ADR-0007 §2 currently pins `11.3.2`. The ADR must record either (a) re-align to the SDK-expected version, or (b) keep the deviation with an explicit justification recorded.
    - `typescript` — SDK 51 expects `~5.3.3`, ADR-0007 §2 currently keeps `5.6.3`. Same choice: align to the SDK matrix or record the deliberate deviation. (Note: TypeScript is build-time tooling — keeping `5.6.3` is defensible if the SDK 54 matrix accepts it.)
  - ADR co-signs: `architect` + `engineering-manager` + `agent-safety-officer` (supply-chain — major SDK rev pulls a new transitive tree) + `mobile-builder` (executor). Per `AGENTS.md` §4.11, "New runtime dependency" applies because the SDK upgrade transitively re-pins ~20 packages.
  - In S-006: `mobile/package.json`, `mobile/package-lock.json`, `mobile/babel.config.js`, `mobile/jest.config.js`, and any RN config that the SDK rev requires are updated atomically. `expo-doctor` runs clean (no compat-matrix warnings, no peer-dep warnings).
  - `expo start` no longer prints the "packages should be updated for best compatibility" block — verified manually at S-006-UREV-0001.
  - All existing tests stay green (`make check`: 70 backend + 128 mobile = 198 tests, no suite skipped, no regressions in the `ts` or `rn` Jest projects).
  - The `RuntimeAcceptance` block in `S-006-UREV-0001` confirms a real Greek consumer can: scan QR with Expo Go (iOS or Android, latest store version) → land on Login → complete the full S-004 acceptance script (sign in, scan, view Insights, go offline, restore).
  - No new outbound host introduced (Expo upgrade itself stays within the existing allowlist: `npmjs.com`, `expo.dev`, etc.).
  - Greek-first copy and locale formatting unchanged after upgrade (`localization-specialist` smoke check).
  - ADR-0007 amended via the standard superseding flow if the SDK pin moves; otherwise a new short ADR records "stay on 51" with explicit reasoning (unlikely — Expo Go for iOS doesn't ship older SDKs).
  Design: N/A.
  Approach: Discovery item in S-005 (ADR debate). Implementation in S-006 alongside the freelancer-mode bullets, OR as the very first item if the freelancer flow can't be tested without on-device runtime first. The compat-matrix alignment is folded in here (rather than as a separate BLG) because resolving it in isolation against SDK 51 would be wasted work — SDK 54 will re-pin both packages anyway, and `expo-doctor` clean is the catch-all criterion.
  Size: M (research + dependency tree update + RN config touch-ups + render-test verification)
  Impact-notes: { external-surface: no (npmjs.com + expo.dev already on allowlist); supply-chain: yes (transitive re-pin of ~20 packages requires `agent-safety-officer` co-sign per `AGENTS.md` §4.11) }
  Links: [docs/adr/S-003-ADR-0007-Expo-runtime-tree.md, docs/sprints/S-004-implementation-login-insights-cache-runnable-scanner/S-004-UREV-0001-Login-insights-cache-runnable-scanner.md]

- ID: BLG-0015
  Title: Live integration test for the insights RPCs (slow-marked)
  Status: planned
  Ready: no (waits on Supabase test project provisioning)
  Owner: backend-builder + devops-engineer
  Type: engineering
  Outcome: A `slow`-marked pytest hits a real Supabase test project's `insights_summary_for_user` and `insights_top_products_for_user` RPCs and asserts the same response shape as the contract tests. Closes the loop on ADR-0005 §8 ("the SQL RPC must be tested against real Postgres at least once").
  Acceptance:
  - `backend/tests/insights/test_supabase_rpc.py` (or similar) with `@pytest.mark.slow` and explicit env-var gating (`SUPABASE_TEST_URL`, `SUPABASE_TEST_SERVICE_KEY`).
  - The test seeds at most a handful of receipts into a `test_*` schema, runs both RPCs, asserts shape + decimal-as-string formatting, and tears down.
  - `make check` keeps the slow tests off by default (`-m "not slow"`); a separate `make test-slow` (or env flag) runs them.
  - `devops-engineer` documents the Supabase test-project provisioning runbook under `docs/runbooks/`.
  - No real user data ever touches the test project.
  Design: N/A.
  Approach: Wait for the Supabase test project to be created. Likely lands in S-005 implementation if the project is up by then; otherwise carries forward.
  Size: S
  Impact-notes: { external-surface: yes (Supabase test project — the host is already on the allowlist) }
  Links: [docs/adr/S-003-ADR-0005-Insights-computation.md, db/migrations/0003_insights_rpc.sql]
