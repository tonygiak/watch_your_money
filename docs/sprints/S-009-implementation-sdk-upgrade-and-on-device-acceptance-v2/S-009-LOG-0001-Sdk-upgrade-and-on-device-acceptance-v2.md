# Sprint S-009 — LOG

## 2026-05-09 11:30 — Sprint open
- Agent: orchestrator
- Action: S-009 sprint folder created; PLN-0001 written. Sprint type: implementation. Theme: `sdk-upgrade-and-on-device-acceptance-v2`. User direction: bare `Implementation` — honored in scope (the sprint planned in `docs/plan.md` after S-008).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: PLN at `docs/sprints/S-009-implementation-sdk-upgrade-and-on-device-acceptance-v2/S-009-PLN-0001-Sdk-upgrade-and-on-device-acceptance-v2.md`.

## 2026-05-09 11:31 — ADR-0013 §3 Step 1: Node.js version check
- Agent: mobile-builder
- Action: `node --version` → `v22.22.0`; `npm --version` → `10.9.0`. Per ADR-0013 §3, Node v22.x.x or later → **skip Step 2**, proceed to Step 3.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Pre-flight Step 1 passed. Node 22 LTS already installed (was already on this version at S-008 close per `docs/plan.md` "Open questions for S-009"). No `winget install` step needed.

## 2026-05-09 11:31 — ADR-0013 §3 Step 3: TLS smoke test (first attempt)
- Agent: mobile-builder
- Action: `mkdir %TEMP%\npm-tls-test-s009 && cd $_ && npm pack expo@^54.0.0 --dry-run`. Command failed with `npm error code UNABLE_TO_VERIFY_LEAF_SIGNATURE` against `https://registry.npmjs.org/expo`. Per ADR-0013 §3, fallback to **Step 3a** (Windows CA bundle export).
- Outbound hosts contacted: registry.npmjs.org (TLS handshake failed before any package metadata fetched)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Step 3 failed despite Node v22.22.0. The CA gap is wider than the v22 LTS bundle. Diagnosis: even the Mozilla CA store shipped with Node 22 (released earlier in 2025) does not include the root currently anchoring `registry.npmjs.org`'s TLS chain — the OS-managed Windows trust store via `NODE_EXTRA_CA_CERTS` is the necessary path.

## 2026-05-09 11:32 — ADR-0013 §3 Step 3a: Windows CA bundle export
- Agent: mobile-builder
- Action: PowerShell `Get-ChildItem Cert:\LocalMachine\Root | ForEach-Object { ...PEM... }` exported **62 OS-managed root CAs** to `$env:USERPROFILE\ca-bundle.pem` (97208 bytes). Set `$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\ca-bundle.pem"`. Re-ran the Step 3 smoke test from a fresh temp dir.
- Outbound hosts contacted: none (key generation step)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: `agent-safety-officer` — pre-approved per ADR-0013 Round 2: the `ca-bundle.pem` file is in the developer's home directory, **not committed**, fully reversible (delete the file + unset the env var), augments TLS trust without disabling it. Recorded as a process step, not a sensitive operation.
- Outcome: `ca-bundle.pem` written. **Never committed** per ADR-0013 §3 step 3a.

## 2026-05-09 11:32 — ADR-0013 §3 Step 3 (retry): TLS smoke test passes
- Agent: mobile-builder
- Action: `npm pack expo@^54.0.0 --dry-run` retried with `NODE_EXTRA_CA_CERTS` set. Output: `npm notice package: expo@54.0.0`, full tarball file listing, `total files: 371`, exit 0 — no TLS error.
- Outbound hosts contacted: registry.npmjs.org (TLS handshake succeeded with Windows OS trust store)
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Pre-flight Step 3a successful. Option A (host CA environment fix) is the operative path for S-009. Option B (EAS dev client) stays deferred per ADR-0012 §1 / ADR-0013 §4. Proceed to Step 4 (SDK 54 upgrade).

## 2026-05-09 11:33 — ADR-0013 §3 Step 4: SDK 54 upgrade — Phase 1 (root expo bump)
- Agent: mobile-builder
- Action: `cd mobile && npm install expo@~54.0.0 --save-exact`. Installed `expo@54.0.34` (latest in the `~54.0.0` range as of sprint date). 85 packages added, 180 removed, 38 changed. The same `EBADENGINE` warnings that npm has been emitting since the host's first SDK 54 install attempt appeared (claiming `current: { node: 'v20.11.0' }` despite `node --version` and `process.versions.node` both reporting `v22.22.0`); diagnosed as cosmetic — the actual install ran on Node 22 and succeeded.
- Outbound hosts contacted: registry.npmjs.org
- MCP tools invoked: none
- Dependencies added: expo@54.0.34 (root pin) — transitive set rebalanced
- Sensitive approvals: none — within the SDK 54 transitive pre-approval recorded in ADR-0012 Round 2.
- Outcome: `mobile/package.json` `"expo": "54.0.34"`. Tree partially upgraded; React, RN, expo-* still at SDK 51 versions — to be reconciled in Phase 2.

## 2026-05-09 11:34 — ADR-0013 §3 Step 4: SDK 54 upgrade — Phase 2 (compat-matrix discovery)
- Agent: mobile-builder
- Action: `npx expo install --fix`. Tool printed the SDK 54 expected versions for 16 packages and attempted to install. Failed with `npm error code ERESOLVE` — `expo-camera@17.0.10` peers `react@19.1.0` via `react-native@0.81.5`, but the in-tree `react@18.2.0` blocked resolution. **Decision**: rather than bisecting the resolution, rewrite `mobile/package.json` atomically with the full SDK 54 pin set (per ADR-0007 §1 — exact pins, no carets / tildes) and run a clean `npm install`.
- Outbound hosts contacted: registry.npmjs.org
- MCP tools invoked: none
- Dependencies added: none (resolution rejected)
- Sensitive approvals: none
- Outcome: SDK 54 expected matrix captured from `expo install --fix` output. Clean-install path chosen.

## 2026-05-09 11:35 — ADR-0013 §3 Step 4: SDK 54 upgrade — Phase 3 (atomic clean install)
- Agent: mobile-builder
- Action: Rewrote `mobile/package.json` with the full SDK 54 pin set, exact pins per ADR-0007 §1. `dependencies`: `expo@54.0.34`, `react@19.1.0`, `react-native@0.81.5`, `expo-camera@17.0.10`, `expo-crypto@15.0.9`, `expo-localization@17.0.8`, `expo-secure-store@15.0.8`, `expo-status-bar@3.0.9`, `react-native-safe-area-context@5.6.0`, `react-native-screens@4.16.0`, `react-native-svg@15.12.1`, `@react-native-async-storage/async-storage@2.2.0`, `@react-native-community/netinfo@11.4.1`, `@react-navigation/native@6.1.18` (unchanged), `@react-navigation/native-stack@6.11.0` (unchanged), `@supabase/supabase-js@2.45.0` (unchanged), `@noble/ciphers@0.5.3` (unchanged — ADR-0006 stack), `react-native-chart-kit@6.12.0` (unchanged — BLG-0014 passive). `devDependencies`: `jest-expo@54.0.17`, `@types/react@19.1.10`, `eslint-config-expo@10.0.0`, `typescript@5.9.2`, `@testing-library/react-native@13.2.0` (bumped from 12.5.1 — required by React 19 peer), `react-test-renderer@19.1.0` (bumped from 18.2.0 — must match `react`), `jest@29.7.0` + `ts-jest@29.2.5` + `@types/jest@29.5.14` (unchanged). Removed `mobile/package-lock.json`. Ran `npm install`. Output: `added 1073 packages, removed 64 packages, changed 9 packages, audited 1083 packages in 2m`. Exit 0.
- Outbound hosts contacted: registry.npmjs.org
- MCP tools invoked: none
- Dependencies added: ~30 net-new transitive packages (the SDK 54 transitive re-pin pre-approved by `agent-safety-officer` in ADR-0012 Round 2)
- Sensitive approvals: `agent-safety-officer` + `engineering-manager` co-sign on the final pin set per `AGENTS.md` §4.11 (recorded in `S-009-REV-0001`).
- Outcome: SDK 54 tree installed cleanly. `mobile/package-lock.json` regenerated.

## 2026-05-09 11:37 — Add gated deps (BLG-0020 + BLG-0021)
- Agent: mobile-builder
- Action: `npx expo install expo-file-system expo-sharing @react-native-community/datetimepicker` to discover the SDK-54-expected pins. Tool installed `expo-file-system@~19.0.22`, `expo-sharing@~14.0.8`, `@react-native-community/datetimepicker@8.4.4`. Replaced the two tilde pins with exact pins (`19.0.22`, `14.0.8`) per ADR-0007 §1. Re-ran `npm install` to reconcile the lockfile.
- Outbound hosts contacted: registry.npmjs.org
- MCP tools invoked: none
- Dependencies added: expo-file-system@19.0.22, expo-sharing@14.0.8, @react-native-community/datetimepicker@8.4.4
- Sensitive approvals: pre-recorded in BLG-0020 + BLG-0021 sign-off chain (S-007 done.md entry: `agent-safety-officer` confirms all three are within the existing `npmjs.com` allowlist; `expo-file-system` + `expo-sharing` are first-party Expo deps; `@react-native-community/datetimepicker` is community-maintained, in Expo's bundledNativeModules.json).
- Outcome: All three runtime resolutions for BLG-0020 + BLG-0021 lazy-requires now exist at the project root.

## 2026-05-09 11:39 — `expo-doctor` first run (post-install)
- Agent: mobile-builder
- Action: `npx expo-doctor`. Output: `Running 17 checks on your project... 17/17 checks passed. No issues detected!`.
- Outbound hosts contacted: registry.npmjs.org (one-time `expo-doctor@1.18.19` fetch via `npx`; not a runtime dep)
- MCP tools invoked: none
- Dependencies added: none (npx cache fetch only, not added to package.json)
- Sensitive approvals: none — `expo-doctor` is a developer-tool inspection, equivalent to `npx tsc`.
- Outcome: BLG-0016 acceptance bullet 2 satisfied. Both ADR-0012 §3 deviations closed: `@react-native-community/netinfo@11.4.1` (was 11.3.2), `typescript@5.9.2` (was 5.6.3). `expo install --fix` re-run on the same tree reports `Dependencies are up to date`.

## 2026-05-09 11:40 — Typecheck under SDK 54 (first run)
- Agent: mobile-builder
- Action: `npx tsc --noEmit`. Failed: `tsconfig.json(3,3): error TS5098: Option 'customConditions' can only be used when 'moduleResolution' is set to 'node16', 'nodenext', or 'bundler'.` Diagnosis: SDK 54's `expo/tsconfig.base` now uses `moduleResolution: "bundler"` + `customConditions: ["react-native"]`; the in-tree `mobile/tsconfig.json` overrode `moduleResolution: "node"` (an SDK 51 artifact), which is incompatible with the new base.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none — tsconfig fix is mechanical regression cleanup, not a contract change.
- Outcome: Drift surfaced. Resolution: remove the override.

## 2026-05-09 11:41 — Typecheck fix: remove stale `moduleResolution: "node"` override
- Agent: mobile-builder
- Action: Edited `mobile/tsconfig.json` — removed the `"moduleResolution": "node"` line so SDK 54's `expo/tsconfig.base` flows through with `moduleResolution: "bundler"` + `customConditions: ["react-native"]`. Re-ran `npx tsc --noEmit`. New error: `Cannot find namespace 'JSX'.` reported across 11 occurrences in 8 screen files. Diagnosis: React 19 removed the global `JSX` namespace; the `JSX.Element` return type annotation must migrate to `React.JSX.Element` (or another React-namespaced form).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: First drift resolved. Second drift surfaced.

## 2026-05-09 11:42 — JSX namespace migration (React 19)
- Agent: mobile-builder
- Action: Replaced `: JSX.Element` with `: React.JSX.Element` across `src/screens/HomeScreen.tsx`, `src/screens/insights/InsightsScreen.tsx`, `src/screens/login/LoginScreen.tsx`, `src/screens/profile/DateField.tsx`, `src/screens/profile/ProfileScreen.tsx`, `src/screens/receipt/ReceiptDetailScreen.tsx`, `src/screens/receipt/TagPanel.tsx`, `src/screens/ScannerScreen.tsx` (8 files, 11 occurrences). All eight screens already had `import React from "react"` so no new imports needed. Re-ran `npx tsc --noEmit` → exit 0, clean.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none — purely a type annotation migration, no runtime / contract impact.
- Outcome: Mobile typecheck green under SDK 54 + React 19.

## 2026-05-09 11:43 — Jest first run under SDK 54
- Agent: mobile-builder
- Action: `npx jest`. 14 of 19 suites pass (all `ts` project suites — pure-TS reducer + lib + parser tests). 5 of 19 suites fail (all `rn` project suites — render smoke tests for Scanner / Login / Insights / ReceiptDetail / Profile). Failure mode: `Cannot find module 'babel-preset-expo'`. Root cause: SDK 54's npm 10 hoisting nests `babel-preset-expo` at `node_modules/expo/node_modules/babel-preset-expo` rather than promoting it to the project root; `mobile/babel.config.js` `presets: ["babel-preset-expo"]` resolves from the project root and can't find it.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none (failure)
- Sensitive approvals: none
- Outcome: Third drift surfaced. Resolution: promote `babel-preset-expo` to a direct devDependency.

## 2026-05-09 11:44 — Promote `babel-preset-expo` to direct devDependency
- Agent: mobile-builder
- Action: Read the nested copy's `package.json` to lock the version exactly: `babel-preset-expo@54.0.10`. Added `"babel-preset-expo": "54.0.10"` to `mobile/package.json` `devDependencies`. Ran `npm install` to reconcile. Re-ran `npx expo-doctor` to confirm no compat regression — still `17/17 checks passed`. Re-ran `npx jest`. New failure: `Cannot find module 'expo-modules-core' from 'node_modules/jest-expo/src/preset/setup.js'`. Same root cause: `expo-modules-core@3.0.30` is nested under `expo/node_modules/`. Resolution: same pattern.
- Outbound hosts contacted: registry.npmjs.org (npm install reconciliation)
- MCP tools invoked: none
- Dependencies added: babel-preset-expo@54.0.10 (devDependency promotion — already in the tree as a transitive of `expo`)
- Sensitive approvals: `agent-safety-officer` — pre-approved within the SDK 54 transitive scope; the package was already in the lockfile, only its top-level visibility changed.
- Outcome: Fourth drift surfaced (continuation of the same nesting pattern).

## 2026-05-09 11:45 — Promote `expo-modules-core` to direct devDependency
- Agent: mobile-builder
- Action: Added `"expo-modules-core": "3.0.30"` to `mobile/package.json` `devDependencies`. Ran `npm install` to reconcile.
- Outbound hosts contacted: registry.npmjs.org (npm install reconciliation)
- MCP tools invoked: none
- Dependencies added: expo-modules-core@3.0.30 (devDependency promotion — already in the tree as a transitive of `expo`)
- Sensitive approvals: `agent-safety-officer` — pre-approved within the SDK 54 transitive scope.
- Outcome: Both nesting-resolution gaps closed.

## 2026-05-09 11:46 — Jest under SDK 54: full green
- Agent: qa
- Action: `npx jest` re-run. All 19 suites pass: 14 `ts` (format / locale / phone / scanner state / i18n / parsers GR / insights state / sanitizer / afm / InMemoryCacheRepository / encryption.roundtrip / tag.state / profile.state / login.state) + 5 `rn` (ScannerScreen.render / LoginScreen.render / InsightsScreen.render / ReceiptDetailScreen.render / ProfileScreen.render). **203 tests passed across 19 suites in ~35 s**. The encryption-stack round-trip test from S-007 (`__tests__/cache/encryption.roundtrip.test.ts`) runs unchanged under SDK 54's `@noble/ciphers@0.5.3` resolution — BLG-0016 acceptance bullet 5 confirmed (forward-only variant per S-005 plan §5).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: `security-privacy-officer` — encryption round-trip clean under SDK 54; ADR-0006 §2 honored byte-identically.
- Outcome: BLG-0016 acceptance bullets 6 + 5 satisfied (all existing tests pass under `jest-expo@54.0.17`; encryption round-trip clean).

## 2026-05-09 11:48 — Backend gates re-run (no expected change)
- Agent: qa
- Action: `backend/.venv/Scripts/python.exe -m ruff check .` → `All checks passed!`. `python.exe -m mypy app tests` → `Success: no issues found in 52 source files`. `python.exe -m pytest` → `143 passed, 2 warnings in 7.23s` (the same `reportlab` `ast.NameConstant` and `requests` urllib3 version-mismatch deprecation warnings carried forward from S-006 / S-007 — known harmless). No backend changes in S-009.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Backend baseline confirmed unchanged. **Combined `make check` total: 143 backend + 203 mobile = 346 tests across 21+ suites — green**, identical count to S-007 / S-008 close.

## 2026-05-09 11:50 — Sprint close
- Agent: orchestrator
- Action: Wrote `S-009-REV-0001` with `make check` outcome + §4.11 sign-offs. Wrote `S-009-UREV-0001` with the on-device acceptance scripts (S-004 + S-006 freelancer-mode flows, now reachable on stock Expo Go). Moved BLG-0016 / BLG-0020 / BLG-0021 from `docs/backlog.md` to `docs/done.md` Sprint S-009 entry. Updated `AGENTS.md` §2.6 (added the BLG-0016 line + the BLG-0020 / BLG-0021 on-device-resolution updates) and §2.7 (snapshot now reads "S-009 closed; SDK 54 live; on-device verification reachable via UREV"). Updated `docs/plan.md` "Where we are" + "Next sprint" (S-010 — likely discovery: country expansion / real-receipt fixtures / post-MVP UX gaps; the Ready queue is now empty for delivery work).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: `orchestrator` — sprint-close enforcement (`AGENTS.md` §4.1.5 + §4.11).
- Outcome: S-009 sprint bundle complete: PLN, LOG, REV, UREV. Three sprints of `UNABLE_TO_VERIFY_LEAF_SIGNATURE` deferral closed; the Expo SDK 51 → 54 upgrade is live.
