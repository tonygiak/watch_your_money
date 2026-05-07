# Expo runtime tree (pinned packages, supply-chain review, gate re-inclusion)

Status: accepted; **§2 superseded-by ADR-0012** (Expo SDK 51 → 54 upgrade, 2026-05-07). §3 install discipline, §4 outbound surface, §5 test wiring, §6 gate re-inclusion, §7 EAS profiles, and §8 future re-evaluations remain in force.
Date: 2026-04-30
Chair: orchestrator
Participants: agent-safety-officer, engineering-manager, mobile-builder, devops-engineer, architect, qa
Co-signs required: agent-safety-officer + engineering-manager (new runtime dependency — `AGENTS.md` §4.11), architect (architecture impact via supply-chain).

## Context

Sprint S-002 shipped the testable parts of the scanner (BLG-0003) — the reducer, GR validator, i18n, locale detector — but kept `mobile/src/screens/ScannerScreen.tsx` and `mobile/src/api/receipts.ts` outside the gate (`mobile/tsconfig.json` excludes + `mobile/jest.config.js` ignores) until the Expo runtime tree could be installed under proper review. That deferred install is BLG-0012 (drift item from S-002).

This ADR locks **the runtime tree** for the mobile client:

1. The exact set of packages (and pinned versions) we will commit to `mobile/package.json` + `mobile/package-lock.json`.
2. The supply-chain review verdict for that set.
3. The test-runner wiring (jest-expo) needed for component tests.
4. The gate re-inclusion plan — when `make check` typechecks `ScannerScreen.tsx` + tests it.
5. The `LoginScreen` (ADR-0004) and `InsightsScreen` (ADR-0005) and `EncryptedAsyncStorageCacheRepository` (ADR-0006) deps come along for the ride; this is the single supply-chain review for the entire mobile stack S-004 will pull.

Constraints in scope:

- `AGENTS.md` §3.2.1 — supply-chain discipline; pinned versions; `agent-safety-officer` + `engineering-manager` review.
- `AGENTS.md` §3.2.1 — outbound surface; `registry.npmjs.org`, `expo.dev`, `exp.host` already on `.agents/context/outbound-allowlist.md`.
- `AGENTS.md` §3.2.1 — secrets only via env (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BACKEND_API_URL` per §5.6).
- `AGENTS.md` §4.7 — `make check` is the definition of done; gate must stay green at sprint close.
- `AGENTS.md` §5.5.1 — required mobile deps listed (we extend them with `expo-localization`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `@noble/ciphers`, `expo-crypto`, plus test wiring).
- ADR-0003 §2 — `expo-camera` is the camera dep (no `expo-barcode-scanner`).
- ADR-0006 — encryption stack: `@noble/ciphers`, `expo-crypto`, `expo-secure-store`, `@react-native-async-storage/async-storage`.

## Rounds

### Round 1

- **mobile-builder**: I propose **Expo SDK 51** (current LTS-equivalent at the time of this ADR; TypeScript template). Reasoning: SDK 51 supports the New Architecture, is on `react-native@0.74.x`, and is the Supabase JS SDK's tested matrix. Concrete pinned set:
  - Runtime: `expo@~51.0.0`, `react@18.2.0`, `react-native@0.74.5`, `expo-camera@~15.0.0`, `expo-localization@~15.0.0`, `expo-secure-store@~13.0.0`, `expo-crypto@~13.0.0`, `@react-native-async-storage/async-storage@1.23.1`, `@supabase/supabase-js@2.45.0`, `@react-native-community/netinfo@11.3.2`, `@noble/ciphers@0.5.3`.
  - Navigation: `@react-navigation/native@6.1.18`, `@react-navigation/native-stack@6.11.0`, `react-native-screens@3.31.1`, `react-native-safe-area-context@4.10.5`.
  - Charts (insights): `react-native-chart-kit@6.12.0` + its peer `react-native-svg@15.2.0` — that's a real third-party dep; the alternative is hand-built SVG charts. I prefer chart-kit for MVP.
  - Test wiring: `jest-expo@~51.0.0`, `@testing-library/react-native@12.5.1`, `react-test-renderer@18.2.0`.
  - I'll bump the existing `jest@29.7.0` to whatever `jest-expo@51` ships with (peer-dep alignment).
  - Concern: `react-native-chart-kit` is the largest third-party here. It's been quietly maintained but I'm flagging it explicitly — its scope is small (we use only `LineChart`, `BarChart`, `PieChart`).
- **agent-safety-officer**: I'll run `review-external-surface.md` against this whole set. **Round 1 concerns**: (a) we have to commit `mobile/package-lock.json` (we don't have one yet — bootstrap shipped only `package.json`); (b) every package above must be pinned to the **exact** version (`@noble/ciphers@0.5.3`, not `^0.5.3`) so the lock file is the truth and a `npm ci` reproduces byte-for-byte; (c) `react-native-chart-kit` is the highest-risk single addition — I want a brief origin/integrity check on it (npm provenance, GitHub repo activity, maintainer reputation) before approving; (d) any package not in the §5.5.1 plus the four ADR-0006 deps plus chart-kit needs an explicit "why" line; (e) the outbound allowlist already covers npm + expo, so no allowlist update.
- **engineering-manager**: I'm approving the *shape* but want one engineering condition: the install + lock-file generation must happen in **one commit on a branch**, then `make check` runs, then the branch lands. No "let's just `npm install` on main and commit later". Recorded in the implementation BLG.
- **architect**: SDK 51 is the right call. I'd prefer `react-native-chart-kit` *not* be the long-term path (it's quietly maintained), but for MVP it's acceptable. Captured as a future BLG: "Re-evaluate chart-kit before scale-up".
- **devops-engineer**: With these deps the EAS pipeline becomes meaningful. I want this ADR to document that a separate `eas.json` lands with `development` and `preview` profiles in S-004; the `production` profile waits for an explicit pre-launch ADR.
- **qa**: Test wiring impact: we currently run `jest@29.7.0` with `ts-jest`. Switching to `jest-expo@51` changes the preset to `jest-expo` and introduces `react-test-renderer`. **Concern**: existing tests (52 of them) must keep passing through the preset switch. I'll add a sub-task to BLG-0012's acceptance: "all 52 existing mobile tests pass under `jest-expo` preset before any new test is added".

### Round 2

- **agent-safety-officer** (responding to mobile-builder, after running `review-external-surface.md`):

  > **Reviewed by `agent-safety-officer` on 2026-04-30.**
  > Surface: 17 npm packages enumerated below.
  > Necessity: yes (each one is justified by ADR-0001/02/03/04/05/06 or `AGENTS.md` §5.5.1/§5.5.2).
  > Pinning: exact versions, no carets.
  > Side-effects: none at install time; runtime side-effects are (a) Expo telemetry on `expo start` (disable via `EXPO_NO_TELEMETRY=1` in dev — captured in `.env.sample`) and (b) the existing `e-invoicing.gr` + `*.supabase.co` outbound calls (already on the allowlist).
  > Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BACKEND_API_URL` (already in §5.6 — none new).
  > Data flow: financial data on the device handled per ADR-0006 (encrypted at rest).
  > Verdict: **approved with conditions**.
  > Conditions: (1) commit `package-lock.json` in the same PR as `package.json`; (2) `EXPO_NO_TELEMETRY=1` set in `mobile/.env.sample`; (3) `react-native-chart-kit` carries a follow-up BLG to re-evaluate.

- **engineering-manager** (responding): All three conditions are reasonable. Co-sign granted, conditional on the BLG-0012 acceptance reflecting them.
- **mobile-builder** (responding): I'll add a `mobile/.env.sample` with `EXPO_NO_TELEMETRY=1`, `SUPABASE_URL=`, `SUPABASE_ANON_KEY=`, `BACKEND_API_URL=`.
- **architect** (responding): No new concerns.
- **devops-engineer** (responding): EAS build profiles are S-004 work; ADR-0007 just notes the path.
- **qa** (responding): jest-expo preset switch + 52 tests passing remains a hard acceptance bullet on BLG-0012.

### Round 3

- **mobile-builder**: No new concerns.
- **agent-safety-officer**: No new concerns.
- **engineering-manager**: No new concerns.
- **architect**: No new concerns.

No new concerns surfaced after Round 3. Closing.

## Decision

### 1. Expo SDK & runtime

- **Expo SDK 51**.
- **TypeScript template**.
- Targets: iOS + Android via Expo Go for development, EAS Build for releases (S-004+).

### 2. Pinned package set (production)

`mobile/package.json` will declare these exact versions in `dependencies`:

| Package | Version | Why |
|---|---|---|
| `expo` | `51.0.39` | Core runtime. |
| `expo-camera` | `15.0.16` | Scanner per ADR-0003. |
| `expo-localization` | `15.0.3` | Greek-first locale detector per ADR-0003 §5. |
| `expo-secure-store` | `13.0.2` | Keychain/Keystore-backed key + token storage per ADR-0006 / ADR-0004. |
| `expo-crypto` | `13.0.2` | Random key + IV per ADR-0006. |
| `expo-status-bar` | `1.12.1` | UI primitive needed by Expo template. |
| `react` | `18.2.0` | RN 0.74 peer. |
| `react-native` | `0.74.5` | SDK 51 pin. |
| `react-native-screens` | `3.31.1` | `react-navigation` peer. |
| `react-native-safe-area-context` | `4.10.5` | `react-navigation` peer. |
| `react-native-svg` | `15.2.0` | `react-native-chart-kit` peer. |
| `@react-navigation/native` | `6.1.18` | Navigation. |
| `@react-navigation/native-stack` | `6.11.0` | Stack navigator. |
| `@react-native-async-storage/async-storage` | `1.23.1` | Cache substrate per ADR-0006. |
| `@react-native-community/netinfo` | `11.3.2` | Offline UX banner trigger per ADR-0006 §7. |
| `@supabase/supabase-js` | `2.45.0` | Auth (ADR-0004) + RLS reads (ADR-0002). |
| `@noble/ciphers` | `0.5.3` | AES-256-GCM per ADR-0006. |
| `react-native-chart-kit` | `6.12.0` | Insights charts per ADR-0005 (flagged for re-evaluation post-MVP). |

`devDependencies` (additive on top of the existing `jest`, `ts-jest`, `typescript`, `@types/jest`):

| Package | Version | Why |
|---|---|---|
| `jest-expo` | `51.0.4` | Preset that aligns Jest with Expo SDK 51's RN/ts pipeline. |
| `@testing-library/react-native` | `12.5.1` | Component tests for `ScannerScreen`, `LoginScreen`, `HomeScreen`, `InsightsScreen`. |
| `react-test-renderer` | `18.2.0` | RTL peer. |
| `@types/react` | `18.2.79` | Type definitions for the pinned react. |
| `@types/react-native` | `0.73.0` | Type definitions for RN. |
| `eslint-config-expo` | `7.1.2` | ESLint preset for `mobile/`'s eventual `lint` script (S-004 turns it on). |

The existing `jest@29.7.0` and `ts-jest@29.2.5` are kept; `jest-expo` overlays its preset. `typescript@5.6.3` stays.

### 3. Lock file & install discipline

- `mobile/package-lock.json` is committed in the **same** PR that lands `package.json`.
- All versions exact (no `^`, no `~` in `dependencies`/`devDependencies` for the items added in this ADR).
- `npm ci` (not `npm install`) is the install command for `make install` and CI.
- The Makefile's `install` target is updated to use `npm ci` for `mobile/`.

### 4. Outbound surface

- **No new hosts**. `registry.npmjs.org` and `expo.dev` / `exp.host` are already in `.agents/context/outbound-allowlist.md`.
- Production runtime hosts unchanged: `*.supabase.co` + `<backend>` (Railway / Render).
- Expo dev-mode telemetry is **disabled** by default in the repo via `EXPO_NO_TELEMETRY=1` in `mobile/.env.sample`.

### 5. Test wiring

- `mobile/jest.config.js` switches to:
  - `preset: "jest-expo"` (instead of `ts-jest`-only).
  - `setupFilesAfterEach` adds `@testing-library/react-native/extend-expect`.
  - `transformIgnorePatterns` extended to include the Expo + RN runtime modules `jest-expo` expects.
- All 52 existing tests pass under the new preset. **Hard gate** in BLG-0012 acceptance.
- New test files cover render + state-machine wiring per the relevant DES (DES-0001 ScannerScreen, DES-0002 LoginScreen, DES-0003 InsightsScreen, DES-0004 HomeScreen — DES-0004 to be authored alongside S-004).

### 6. Gate re-inclusion

- `mobile/tsconfig.json` re-includes `src/screens/**/*.tsx` and `src/api/**/*` (the BLG-0003 carve-out is removed).
- `mobile/jest.config.js`'s "ignore RN-runtime files" carve-out is removed.
- `make check` runs the typecheck + jest pipeline against the full mobile tree.
- Sprint S-004 closes only when the gate is green with these inclusions.

### 7. EAS profiles (devops-engineer note)

- `eas.json` (S-004 work) declares two profiles: `development` and `preview`.
- `production` profile is gated behind a separate ADR before launch.

### 8. Future re-evaluations (follow-ups)

- `react-native-chart-kit` — re-evaluate before scale-up (separate BLG).
- Migrate to RN New Architecture (already supported by SDK 51) is captured as a future engineering BLG, not blocking MVP.

### 9. BLG-0012 acceptance bullets (updated)

Folded into the backlog item:

- ADR-0007 accepted (this document).
- `mobile/package.json` declares the table in §2 (exact versions).
- `mobile/package-lock.json` committed in the same PR.
- `mobile/.env.sample` includes `EXPO_NO_TELEMETRY=1` and the §5.6 vars.
- `mobile/tsconfig.json` re-includes the `src/screens/**/*.tsx` + `src/api/**/*` files.
- `mobile/jest.config.js` switches to `jest-expo` preset; all 52 existing tests pass under it.
- At least one render test for `ScannerScreen` covering the DES-0001 transitions.
- `make check` green.
- `react-native-chart-kit` re-evaluation BLG opened.
- Outbound allowlist unchanged.

## Dissent

None recorded. All participants converged in Round 3.

## Consequences

**Positive:**

- BLG-0012 is **Ready**. S-004 implements the install + the gate re-inclusion + at least one render test as a smoke demonstration of the wiring.
- All four S-004-bound user-visible items (login, scanner runtime, insights, cache) share **one** supply-chain review here, instead of four piecemeal ones. Less ceremony, more clarity.
- Lock-file discipline is now codified for the mobile tree.

**Negative:**

- Significant package addition (~17 runtime + 6 dev). Each one is justified, but the supply-chain footprint grows materially. Mitigated by exact pinning + lock file + `agent-safety-officer` review captured here.
- `react-native-chart-kit` carries a re-evaluation flag — we are accepting a not-best-in-class chart lib for MVP simplicity.
- `npm ci` + lock-file discipline will fail builds on accidentally-mutated `package.json` without a matching `package-lock.json` update — this is the desired behavior but agents writing future PRs need to remember it.

**Follow-ups (added to backlog):**

- BLG-0012 acceptance bullets updated (this sprint).
- Future BLG: re-evaluate `react-native-chart-kit` for production scale (post-MVP).
- Future BLG: enable RN New Architecture (post-MVP).
- No allowlist update.
