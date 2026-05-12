# Sprint S-009 — Review

- Type: implementation
- Theme: `sdk-upgrade-and-on-device-acceptance-v2`
- Closed: 2026-05-09
- Chair: orchestrator

## Outcome

S-009 shipped **BLG-0016 + BLG-0020 + BLG-0021 fully**. The three-sprint Expo SDK 51 → 54 upgrade landed.

| Item | Outcome |
| --- | --- |
| **BLG-0016 — Expo SDK 51 → 54 upgrade** | **Done.** ADR-0013 §3 pre-flight checklist executed end-to-end. Step 1 (`node --version` → v22.22.0) passed. Step 2 (Node update) skipped. Step 3 (TLS smoke test) **failed even on Node v22.22.0** with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Step 3a (Windows CA bundle export to `~/ca-bundle.pem` + `NODE_EXTRA_CA_CERTS`) **passed the retry on the first try** — 62 OS-managed root CAs, 97208-byte PEM bundle, never committed, fully reversible. Step 4 ran cleanly: `mobile/package.json` rewritten with the SDK 54 pin set (exact pins per ADR-0007 §1, no carets / tildes), `mobile/package-lock.json` regenerated, `expo-doctor` reports **17/17 checks passed**, both ADR-0012 §3 deviations closed (`@react-native-community/netinfo@11.4.1`, `typescript@5.9.2`). Three drift candidates surfaced and were resolved in-sprint without expanding scope: (a) `mobile/tsconfig.json` `moduleResolution: "node"` override (SDK 51 artifact) blocked SDK 54's `customConditions` → override removed; (b) eight `JSX.Element` usages broke under React 19 → migrated to `React.JSX.Element` across 8 screens; (c) `babel-preset-expo` and `expo-modules-core` nested under `node_modules/expo/` rather than promoted to the project root → both promoted to direct `devDependencies` at the exact versions present in the tree. **Encryption-stack round-trip test from S-007 stayed byte-identical** — runs unchanged under the SDK 54 `@noble/ciphers@0.5.3` resolution. `react-native-chart-kit@6.12.0` survived the upgrade — BLG-0014 stays passive per ADR-0012 §6. |
| **BLG-0020 — Share-sheet hand-off (on-device-resolution)** | **Done.** `expo-file-system@19.0.22` + `expo-sharing@14.0.8` are now direct deps (added via `npx expo install` to discover the SDK-54-expected pins, then exact-pinned per ADR-0007 §1). The S-007 lazy-require pattern in `mobile/src/lib/share.ts` is unchanged at the source level; the `defaultShareImpl` runtime path now resolves cleanly. Privacy contract (ADR-0009 §3 / DES-0004 §3.4) honored byte-identically. Acceptance bullet 3 (the on-device share-sheet hand-off) is now reachable via `S-009-UREV-0001`. |
| **BLG-0021 — Native date-picker (on-device-resolution)** | **Done.** `@react-native-community/datetimepicker@8.4.4` is now a direct dep. The S-007 `loadPicker()` `try / catch` pattern in `mobile/src/screens/profile/DateField.tsx` is unchanged at the source level; the `loadPicker()` indirection now returns the real `DateTimePicker` component. Acceptance bullet 5 (the on-device picker open) is now reachable via `S-009-UREV-0001`. |

## `make check` at sprint close

**346 tests across 21+ suites — green.**

- Backend: `ruff check . → All checks passed`; `mypy app tests → Success: no issues found in 52 source files`; `pytest → 143 passed, 2 warnings in 7.23s` (unchanged from S-007 / S-008 close — the two warnings are the known harmless `reportlab` `ast.NameConstant` deprecation and `requests` urllib3 version-mismatch).
- Mobile: `tsc --noEmit → clean` under the new `expo/tsconfig.base` (`moduleResolution: "bundler"` + `customConditions: ["react-native"]`); `jest → 203 passed across 19 suites in ~35 s under jest-expo@54.0.17 + react@19.1.0 + react-native@0.81.5`.

No flaky tests, no skipped tests, no new warnings beyond the existing reportlab / requests deprecation notes.

## §4.11 sign-offs

| Change kind | Required sign-off | Recorded |
| --- | --- | --- |
| New runtime dependency | `agent-safety-officer` + `engineering-manager` | `agent-safety-officer` — supply-chain co-sign on the SDK 54 transitive re-pin (~30 net-new packages, all from `registry.npmjs.org` already on the allowlist; no new outbound host). The two devDependency promotions (`babel-preset-expo@54.0.10`, `expo-modules-core@3.0.30`) are required by SDK 54's nested-`node_modules` layout under npm 10's hoisting rules and were already in the lockfile as transitive deps — only their top-level visibility changed. The three new direct deps for BLG-0020 + BLG-0021 (`expo-file-system@19.0.22`, `expo-sharing@14.0.8`, `@react-native-community/datetimepicker@8.4.4`) were pre-approved in the S-007 BLG sign-off chain (the contract-level wiring landed under that approval; this sprint just landed the runtime resolution). `engineering-manager` — final pin set co-signed: every dependency exact-pinned per ADR-0007 §1 (no carets / tildes); `expo-doctor` 17/17; both ADR-0012 §3 deviations closed. |
| New mobile screen / UX flow | `product-designer` + `localization-specialist` | **N/A** — no source-level UX change. BLG-0020 + BLG-0021's UX contract was pre-signed in DES-0004 §3.4 + §9 and shipped at the source level in S-007; S-009 just landed the runtime deps. The native date-picker chrome localizes via the device locale; on a Greek phone it renders Greek month / weekday names automatically. |
| User-data flow change | `security-privacy-officer` | `security-privacy-officer` — confirms (a) encryption-stack round-trip test green under SDK 54 — ADR-0006 §2 honored byte-identically (the `@noble/ciphers@0.5.3` resolution is unchanged; the BLG-0007 fixture-driven test stays as the regression canary); (b) `defaultShareImpl` runtime resolution preserves ADR-0009 §3 byte-identically — bytes / filename / share target never logged; (c) the `NODE_EXTRA_CA_CERTS` workflow uses the OS-managed Windows trust store, augments TLS verification, never disables it; the `ca-bundle.pem` file is in the developer's home directory and is never committed (verified — no `.pem` files in git status). |
| Schema migration | `data-architect` + `security-privacy-officer` | **N/A — none.** |
| Auth flow change | `security-privacy-officer` + `data-architect` | **N/A — none.** |
| New endpoint / API contract change | `architect` + `engineering-manager` | **N/A — none.** |
| New parser logic | `parser-specialist` + `qa` | **N/A — none.** |
| New EU country adapter | `parser-specialist` + `architect` + `data-architect` | **N/A — none.** |
| New MCP integration / new outbound host | `agent-safety-officer` + `architect` | **N/A — none.** Pre-flight Step 3a uses the OS-managed Windows trust store, not a new outbound host. |
| Sprint scope change mid-sprint | `orchestrator` + `product-manager` | **N/A — no scope change.** Three drift candidates surfaced and were resolved in-sprint as runtime-tree mechanics (not contract changes), per `AGENTS.md` §4.1.1 ("the simplest temporary path is taken to keep `make check` green"). All three are SDK-version-mechanical regressions, not architectural decisions: (i) `tsconfig.json` `moduleResolution` override removal aligns to the new SDK 54 base; (ii) `JSX.Element` → `React.JSX.Element` is the canonical React 19 migration; (iii) `babel-preset-expo` + `expo-modules-core` direct-dep promotion is the documented SDK 54 + npm 10 hoisting workaround. None require an ADR. |
| Adding / retiring an agent | `agents-doctor` (+ `orchestrator`) | **N/A — none.** |
| Edits to `AGENTS.md` | `agents-doctor` (structural) / section owner (content) / `orchestrator` (sprint LOG) | `agents-doctor` — N/A (no structural edits). Section owner — `product-owner` (§2.6 / §2.7 content edits reflect S-009 close). `orchestrator` — recorded in `S-009-LOG-0001` 11:50 entry. |
| ADR co-sign | per ADR | `architect` — SDK choice co-sign: Option A executed per ADR-0013 §3 with full success on Step 3a; Option B (EAS dev client) remains deferred per ADR-0012 §1 / ADR-0013 §4. ADR-0013 closed (purpose served — the upgrade landed under Option A). |

## Drift items opened during S-009

None survived the sprint. The three drift candidates surfaced in the LOG (tsconfig override; React 19 JSX namespace; SDK 54 + npm 10 nesting) were all resolved in-sprint as runtime-tree mechanics, with no contract changes and no follow-up ADRs needed. `S-009-LOG-0001` 11:40, 11:42, 11:44, 11:45 entries record the resolutions for audit.

## Backlog updates

- **BLG-0016** — moved to `docs/done.md` Sprint S-009 entry. Three-sprint deferral closed.
- **BLG-0020** — moved to `docs/done.md` Sprint S-009 entry (the on-device-resolution half; the contract-level half landed in S-007 and has its own done.md entry).
- **BLG-0021** — moved to `docs/done.md` Sprint S-009 entry (the on-device-resolution half; the contract-level half landed in S-007 and has its own done.md entry).
- BLG-0004 / BLG-0009 / BLG-0011 / BLG-0014 / BLG-0015 unchanged.
- **No new backlog items opened** — every drift was resolved in-sprint without surfacing follow-up work. The Ready queue is now empty for delivery work; the next sprint is automatically discovery (per `AGENTS.md` §4.1.2).

## Learnings

1. **The CA gap was wider than Node v22 LTS.** S-008's diagnosis was directionally correct (Node.js bundles its own Mozilla CA store), but the fact that the smoke test failed even on the latest LTS means `registry.npmjs.org` adopted a CA that even Node 22's bundled store doesn't cover. The OS trust store via `NODE_EXTRA_CA_CERTS` was the necessary path. ADR-0013 §3 Step 3a was correctly placed as the fallback for exactly this case — having the fallback documented saved the sprint.
2. **`process.versions.node` is the source of truth for Node version diagnostics.** npm's `EBADENGINE` warnings inexplicably reported `current: { node: 'v20.11.0' }` despite both `node --version` and `process.versions.node` reporting v22.22.0. The cosmetic warning was confusing during install. Future SDK upgrades should route diagnostics through `node -p "process.versions"` rather than trusting npm's environment summary.
3. **SDK 54 + npm 10 hoisting requires direct-dep promotion of two transitive deps.** `babel-preset-expo` and `expo-modules-core` end up nested at `node_modules/expo/node_modules/` under npm 10's resolution — they're invisible to top-level `babel.config.js` and `jest-expo/src/preset/setup.js` resolution. Two extra `devDependencies` lines fix it; documenting this as the canonical SDK 54 + npm 10 layout in `mobile/package.json` is the simplest path. (Future Expo CLIs may promote these for us, but until they do, this is the contract.)
4. **React 19 removes the global `JSX` namespace.** Eight files in S-009 needed the `: JSX.Element` → `: React.JSX.Element` migration. Mechanical, but worth recording — every future React-major-version upgrade should grep for global type namespaces before declaring the work done.
5. **Expo's `tsconfig.base` evolves between SDK majors.** SDK 54's `expo/tsconfig.base` introduced `moduleResolution: "bundler"` + `customConditions: ["react-native"]`. Any in-tree override of `moduleResolution` becomes incompatible. Future SDK upgrades should diff `expo/tsconfig.base` between the old and new SDK before regenerating the lockfile.
6. **The forward-only encryption round-trip test from S-007 was the right call.** It caught zero regressions because there were no regressions — but the same test would have caught a `@noble/ciphers` ABI break in either direction without any extra work. The S-007 REV §3 learning held.

## Next sprint

Per `AGENTS.md` §4.1.2 (Ready queue is empty post-S-009; the only Ready items left are post-MVP / waiting on external inputs):

- **S-010 — discovery (likely)** — chaired by `orchestrator` with `product-owner` + `product-manager` + `architect` + `data-architect` + `parser-specialist` + `localization-specialist` + `agent-safety-officer`. Discovery questions: (a) which of `BLG-0004` (real-receipt fixtures) / `BLG-0009` (CI drift hook) / `BLG-0011` (language switch) / `BLG-0015` (live insights RPC test) is closest to Ready? (b) does the §2.9 out-of-scope list need a fresh review now that the SDK 54 tree unblocks on-device acceptance? (c) is the door open for an EU country expansion discovery (RO / IT / PT / ES adapter per §5.9 + ADR-0001 pluggable parser interface)? Output: refreshed Ready items for S-011. The MVP definition-of-done (§2.8) is now reachable end-to-end; discovery time is the right place to decide which post-MVP direction to invest in next.
