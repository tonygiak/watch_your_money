# Expo SDK 51 → 54 upgrade (supersedes ADR-0007 §2)

Status: accepted
Date: 2026-05-07
Chair: orchestrator
Participants: architect, engineering-manager, agent-safety-officer, mobile-builder, devops-engineer, qa, security-privacy-officer
Co-signs required: agent-safety-officer + engineering-manager (new runtime dependency / supply-chain delta — `AGENTS.md` §4.11), architect (architecture impact via supply-chain), mobile-builder (executor), security-privacy-officer (encryption-relevant deps re-evaluated against ADR-0006).

## Context

The S-004 UREV walk-through (2026-05-07) discovered that **Expo Go on iOS only ships the latest SDK runtime (SDK 54 as of 2026-05-07)**. The project is pinned to **Expo SDK 51** per ADR-0007 §2. Result: on-device verification of the S-004 acceptance script (sign in → scan → Insights → offline → restore) **cannot run on a stock Expo Go install**. The backend boots cleanly, migrations apply, and `make check` is green — only the on-device runtime path is blocked.

`AGENTS.md` §2.5 sets a hard quality bar: *"Mobile-first and responsive on iOS and Android."* That bar cannot be honored on a stock Expo Go install while the project stays on SDK 51 — every new install of Expo Go from the App Store / Play Store gets the SDK that ships with the latest Expo Go binary, not whatever the project asks for.

The decision space:

1. **Stay on SDK 51, with workarounds.** Sideload an older Expo Go APK on Android (via `expo.dev/go?sdkVersion=51&platform=android`) or use an iOS Simulator on a Mac. This is operationally fine for *us*, but does **not** unblock real Greek consumers running the latest Expo Go off the store — which is exactly the §2.5 acceptance bar.
2. **Upgrade to SDK 54.** Latest stable as of 2026-05-07. Matches the Expo Go binary on both stores. Carries a transitive re-pin of ~20 packages.
3. **Eject from Expo Go and ship via EAS dev-client / TestFlight / Play internal testing.** Removes the Expo Go dependency entirely. **Major** operational shift — meaningful build / signing / distribution work. Out of MVP scope.

The S-004 UREV addendum also surfaced **two existing in-tree compat-matrix warnings** that `expo start` prints today on SDK 51:

- `@react-native-community/netinfo@11.3.2` — SDK 51 expects `11.3.1`. ADR-0007 §2 currently pins `11.3.2`.
- `typescript@5.6.3` — SDK 51 expects `~5.3.3`. ADR-0007 §2 currently keeps `5.6.3`.

Both deviations are documented decisions in ADR-0007 (`mobile-builder` Round 1 picked `netinfo@11.3.2`; the `typescript@5.6.3` line is the ADR's "stays" choice). Per `AGENTS.md` §3.2 / §4.4, silently editing them mid-conversation would violate process. The S-004 UREV addendum requires this ADR to **explicitly** address them — re-align to the SDK matrix or record a deliberate deviation.

Constraints in scope:

- `AGENTS.md` §2.5 — mobile-first on iOS and Android.
- `AGENTS.md` §3.2.1 — supply-chain discipline; pinned versions; `agent-safety-officer` + `engineering-manager` review for new runtime deps; outbound surface only via the allowlist.
- `AGENTS.md` §4.7 — `make check` green at sprint close.
- `AGENTS.md` §4.11 — "New runtime dependency" requires `agent-safety-officer` + `engineering-manager` co-sign; the SDK upgrade transitively re-pins ~20 packages.
- ADR-0006 — encryption stack: `@noble/ciphers`, `expo-secure-store`, `expo-crypto`, `@react-native-async-storage/async-storage`. None of these may change behavior under the upgrade or ADR-0006 must amend.
- ADR-0007 — current (SDK 51) runtime tree. This ADR supersedes §2 only; the discipline (exact pins, lockfile, `EXPO_NO_TELEMETRY=1`, single-PR install) stays in force.

## Rounds

### Round 1

- **mobile-builder**: I propose **target SDK 54**. Reasoning: (a) it's the only version Expo Go for iOS currently runs, so it directly unblocks the §2.5 acceptance bar; (b) Expo's compat matrix for SDK 54 is well-published; (c) the S-004 acceptance script doesn't use any SDK-51-specific API. Strategy: `npx expo install --fix` against a clean clone gives us the SDK-54-aligned versions for everything in our `mobile/package.json`; we then run `expo-doctor` until clean, regenerate `mobile/package-lock.json`, and commit in a single PR (same discipline as ADR-0007 Round 1). Concrete pin set will land in S-006 after `expo install --fix` — not committed in this discovery sprint.
- **architect**: SDK 54 is the right call. The "stay on SDK 51 with sideload" workaround does not honor the §2.5 mobile-first acceptance bar for end users. Eject-from-Expo-Go is an MVP-incompatible operational shift. **Position: SDK 54.**
- **agent-safety-officer**: A major SDK rev pulls a meaningful transitive re-pin. Per `AGENTS.md` §4.11 ("New runtime dependency"), the supply-chain co-sign pair (me + engineering-manager) applies. I'll run `review-external-surface.md` against the SDK 54 tree once the diff is captured. **Concerns**: (a) the SDK 54 tree must not introduce a new outbound host — `npmjs.com` and `expo.dev` are already on the allowlist, but if SDK 54 adds, say, a Sentry / analytics dep by default, that's an allowlist update we'd need to debate separately; (b) the encryption stack from ADR-0006 (`@noble/ciphers`, `expo-secure-store`, `expo-crypto`) MUST survive functionally — a behavioral change there is a separate ADR; (c) the existing two compat-matrix warnings (`netinfo`, `typescript`) must be addressed by THIS ADR explicitly (S-004 UREV said so).
- **engineering-manager**: I'll co-sign on (a) single-PR install discipline (commit `package.json` + `package-lock.json` + any RN config changes atomically), (b) `expo-doctor` clean before merge, (c) all 198 existing tests stay green under the new preset. The `jest-expo` preset will likely bump to `jest-expo@~54.0.0`; that's expected and approved as long as the existing test files run unchanged.
- **devops-engineer**: EAS impact: the `eas.json` profiles from the S-004 era (`development`, `preview`) will need to bump their `sdkVersion`. That's a one-line change. The Expo dev-mode telemetry-disabled rule (`EXPO_NO_TELEMETRY=1` in `mobile/.env.sample` from ADR-0007 §4) carries forward unchanged.
- **qa**: Test impact: same `make check` gate. The two-project Jest layout from BLG-0012 (`ts` + `rn`) stays. The render smoke tests for `LoginScreen` / `InsightsScreen` / `ScannerScreen` should still pass under `jest-expo@54` because they don't depend on SDK-version-specific behavior. **Hard acceptance**: 198 existing tests pass under the new preset BEFORE any new test is added.
- **security-privacy-officer**: My only concern is the encryption stack: `@noble/ciphers@0.5.3`, `expo-secure-store@13.0.2`, `expo-crypto@13.0.2`. SDK 54 typically ships compatible versions for the Expo modules (likely `expo-secure-store@~14.x`, `expo-crypto@~14.x`); `@noble/ciphers` is a pure-JS dep with no SDK linkage so its version is independent of the upgrade. The AES-256-GCM contract from ADR-0006 §2 must hold byte-for-byte through the upgrade. **Hard acceptance**: a round-trip test with the existing `EncryptedAsyncStorageCacheRepository` against pre-upgrade encrypted state proves the upgrade is non-breaking; if it isn't, ADR-0006 amends.

### Round 2

- **agent-safety-officer** (responding, after running `review-external-surface.md` against the SDK 54 tree as projected from Expo's compat matrix on 2026-05-07):

  > **Reviewed by `agent-safety-officer` on 2026-05-07.**
  > Surface: SDK 54 transitive tree (projected from `expo install --fix` simulation against the SDK 54 compat matrix; the actual install diff is captured in S-006).
  > Necessity: yes — required to honor §2.5 on a stock Expo Go install.
  > Pinning: exact (no carets in `dependencies` / `devDependencies`).
  > Side-effects: install-time = standard `npm install` from `registry.npmjs.org` plus Expo's CDN at `expo.dev` (both already on the allowlist). Runtime side-effects unchanged: Expo telemetry on `expo start` (disabled via `EXPO_NO_TELEMETRY=1`); the existing `*.supabase.co` and `<backend>` outbound calls.
  > Secrets: none new. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BACKEND_API_URL` carry over.
  > Data flow: financial data on the device handled per ADR-0006 — encryption stack must survive (see condition 5).
  > Verdict: **approved with conditions**. Conditions:
  > 1. The upgrade lands in **one** S-006 commit on a feature branch.
  > 2. `mobile/package-lock.json` is regenerated and committed in the same change.
  > 3. `expo-doctor` runs clean (zero compat warnings) before merge.
  > 4. The two existing in-tree compat-matrix warnings (`@react-native-community/netinfo@11.3.2`; `typescript@5.6.3`) are explicitly resolved against the SDK 54 matrix and the resolution is recorded in this ADR §3.
  > 5. The encryption-relevant deps (`@noble/ciphers`, `expo-secure-store`, `expo-crypto`) survive the upgrade with no behavioral change to the AES-256-GCM stack from ADR-0006 §2 — verified by a round-trip test in S-006 against pre-upgrade encrypted state. If the encryption stack changes behavior, the upgrade is blocked pending an ADR-0006 amendment.
  > 6. `react-native-chart-kit` survives the upgrade or, if it does not, BLG-0014 collapses into this upgrade and ADR-0007 §8 is resolved as part of the same S-006 PR with a swap (e.g. `victory-native`).

- **engineering-manager** (responding): All six conditions are reasonable. Co-sign granted, conditional on BLG-0016 acceptance bullets reflecting them.
- **architect** (responding): No new concerns. Co-sign on ADR-0007 §2 supersession.
- **mobile-builder** (responding): I'll execute the install + lockfile regeneration + `expo-doctor` run + render-test verification in S-006. Estimated size: M (a couple of days, including the encryption round-trip verification).
- **devops-engineer** (responding): I'll bump `eas.json` profiles in the same PR. EAS Build itself does not need re-configuration.
- **qa** (responding): The 198-tests-stay-green bullet is the BLG-0016 hard acceptance.
- **security-privacy-officer** (responding): Encryption round-trip test is BLG-0016 acceptance bullet (condition 5). Co-sign granted.

### Round 3

- **mobile-builder**: No new concerns.
- **agent-safety-officer**: No new concerns.
- **engineering-manager**: No new concerns.
- **architect**: No new concerns.
- **security-privacy-officer**: No new concerns.

No new concerns surfaced after Round 3. Closing.

## Decision

### 1. Target SDK

- **Expo SDK 54** (latest stable as of 2026-05-07). Matches the Expo Go binary on iOS and Android stores.

### 2. Upgrade strategy

- Run `npx expo install --fix` against a clean clone of `mobile/` in S-006.
- Run `expo-doctor` until it reports zero compat warnings.
- Regenerate `mobile/package-lock.json`.
- Manually verify the encryption-relevant deps (`@noble/ciphers`, `expo-secure-store`, `expo-crypto`) and the chart dep (`react-native-chart-kit`) survive — explicit acceptance bullets in BLG-0016.
- Commit in a **single** S-006 PR: `mobile/package.json` + `mobile/package-lock.json` + any required `mobile/babel.config.js` / `mobile/jest.config.js` / `mobile/tsconfig.json` updates + `eas.json` profile bumps, atomically.

### 3. Compat-matrix warnings — explicit resolution

Per `agent-safety-officer` condition 4, the two existing in-tree compat-matrix warnings on SDK 51 are addressed by THIS ADR rather than carried forward:

- **`@react-native-community/netinfo`** — re-aligned to **whatever SDK 54's compat matrix expects** as of S-006 install. The `11.3.2` deviation that ADR-0007 §2 carried was justified at the time; on the SDK 54 matrix that deviation has no longer-relevant context. The S-006 PR records the SDK-54-expected version as the new pin.
- **`typescript`** — re-aligned to **whatever SDK 54's compat matrix expects** as of S-006 install. The `5.6.3` deviation that ADR-0007 §2 carried (build-time tooling deviation, defensible) is **dropped** — the deliberate-deviation option was rejected because no agent supplied a fresh reason to keep `5.6.3` against SDK 54's expected matrix.

Both resolutions follow the same rule: **align with `expo-doctor`-clean** unless a deliberate deviation is explicitly justified in this section. No deviation is declared today.

### 4. Pinned package set

- The full SDK 54 pinned table is written into the S-006 PR's diff; it is **not** transcribed into this ADR. Reason: at the time of writing, `npx expo install --fix` has not been run; copying a projected version table would invite drift between the ADR and the actual install. The ADR locks the **rules** for the table (exact pins, no carets, lockfile committed, `expo-doctor` clean); the **values** are recorded in S-006's `S-006-LOG-0001` and the S-006 PR description.
- ADR-0007 §2 is **superseded by ADR-0012 §3 + the S-006 PR table** — for §2 only. ADR-0007's other sections remain in force:
  - §3 lock-file & install discipline — stays.
  - §4 outbound surface — stays.
  - §5 test wiring (two-project Jest layout) — stays.
  - §6 gate re-inclusion — stays.
  - §7 EAS profiles — stays (with version bumps as noted in §2 of this ADR).
  - §8 future re-evaluations — stays.

### 5. Encryption stack contract (defense in depth on top of ADR-0006)

- `@noble/ciphers` AES-256-GCM behavior: **byte-identical** through the upgrade.
- `expo-secure-store` key namespace `wym.cache.aes-256-gcm.v1`: **survives**.
- `expo-crypto` random IV behavior: **byte-identical**.
- A BLG-0016 acceptance bullet adds a round-trip test: encrypt a sample receipt under SDK 51, check out the SDK 54 branch, decrypt and re-sanitize the same payload — the receipt must match the original byte-for-byte.
- If any of the above fails, the upgrade is **blocked** pending an ADR-0006 amendment.

### 6. `react-native-chart-kit` survival

- If `react-native-chart-kit@6.12.0` survives SDK 54 (likely — it's a pure-JS chart lib peering on `react-native-svg` which Expo bumps in lockstep with the SDK), BLG-0014 stays passive.
- If it does not survive, BLG-0014 **collapses into this upgrade**: the swap (likely to `victory-native@~37.x` or `react-native-svg-charts`) ships in the same S-006 PR with `mobile-builder` + `agent-safety-officer` + `engineering-manager` co-signs and a one-line ADR-0007 §8 resolution note.

### 7. Outbound surface

- **No change.** `registry.npmjs.org` and `expo.dev` already on `.agents/context/outbound-allowlist.md`.
- The supply-chain footprint grows transitively, but the host set does not.

### 8. EAS profiles (devops-engineer note)

- `eas.json` profiles `development` and `preview` get the SDK 54 bump in the same PR.
- `production` profile remains gated behind the separate pre-launch ADR (per ADR-0007 §7).

### 9. Test wiring

- `jest-expo` bumps to whatever SDK 54 ships (likely `jest-expo@~54.0.0`).
- The two-project Jest layout (`ts` + `rn`) from BLG-0012 stays.
- All 198 existing tests must pass under the new preset before any new test is added (BLG-0016 hard acceptance).

### 10. BLG-0016 acceptance bullets (updated)

Folded into the backlog item:

- ADR-0012 accepted (this document).
- `mobile/package.json` reflects the SDK 54 tree (exact versions, no carets), captured in the S-006 PR table.
- `mobile/package-lock.json` regenerated and committed in the same PR.
- `expo-doctor` runs clean (zero compat warnings).
- Both existing in-tree compat-matrix deviations (`netinfo`, `typescript`) re-aligned to the SDK 54 matrix per §3.
- Encryption-stack round-trip test passes (per §5).
- `react-native-chart-kit` survives (per §6) or, if not, the swap ships in the same PR with co-signs.
- `eas.json` profiles bumped to SDK 54 (per §8).
- All 198 existing tests stay green under `jest-expo@~54` (per §9).
- `expo start` no longer prints the "packages should be updated for best compatibility" block.
- A real Greek consumer can complete the S-004 acceptance script (sign in → scan → Insights → offline → restore) on a stock Expo Go install (iOS or Android, latest store version).
- Outbound allowlist unchanged.

## Dissent

None recorded. All participants converged in Round 3.

## Consequences

**Positive:**

- BLG-0016 is **Ready** with crisp acceptance: one PR in S-006, one set of `make check` + `expo-doctor` gates, one round-trip encryption test.
- The §2.5 mobile-first acceptance bar is restored: a Greek consumer with a stock Expo Go install can run the app end-to-end after S-006.
- The two existing in-tree compat-matrix warnings are resolved as a side-effect of the SDK 54 alignment, instead of as a separate item.
- ADR-0007's discipline (exact pins, lockfile, `EXPO_NO_TELEMETRY=1`, single-PR install) carries forward unchanged — the SDK rev replaces only §2 (the version table), not the rules.

**Negative:**

- Significant transitive re-pin (~20 packages). Each one is justified by the SDK 54 matrix, but the supply-chain audit footprint grows materially in S-006. Mitigated by `agent-safety-officer`'s six conditions.
- If `react-native-chart-kit` does not survive, BLG-0014 collapses into the same PR — bigger blast radius for the S-006 mobile change. Acceptable; the swap is bounded and `mobile/src/screens/insights/InsightsScreen.tsx` is the only consumer.
- If the encryption stack changes behavior, the upgrade blocks until ADR-0006 amends. This is the right behavior (we don't break user data) but extends S-006's expected runtime.

**Follow-ups (added to backlog):**

- BLG-0016 acceptance bullets updated (this sprint).
- ADR-0007 §2 marked `superseded-by ADR-0012` with a one-line pointer.
- BLG-0014 stays planned with a cross-reference to this ADR ("chart-kit survives the SDK 54 upgrade per ADR-0012 §6 unless the S-006 install proves otherwise").
- No allowlist update.
