# Sprint S-007 — PLN

- Type: implementation
- Theme: `sdk-upgrade-and-on-device-acceptance`
- Opened: 2026-05-07
- Chair: orchestrator
- Driver: go
- Definition of Ready check: PASSED — three Ready items pulled from `docs/backlog.md` (BLG-0016, BLG-0020, BLG-0021); ADR-0012 + DES-0004 + ADR-0009 + ADR-0006 are the contracts; no new architecture required in this sprint.

## Why implementation, not discovery

Per `AGENTS.md` §4.1.2 the Ready queue is non-empty:

- **BLG-0016 — Expo SDK 51 → 54 upgrade.** Ready since S-005 close, deferred from S-006 to S-007 per `AGENTS.md` §4.10 (npm registry hung when probing the SDK 54 compat matrix at S-006 18:35 — see `S-006-LOG-0001`). Anchored to ADR-0012.
- **BLG-0020 — Wire `expo-sharing` + `expo-file-system` into the Profile export `shareImpl`.** Ready as soon as BLG-0016 lands. Anchored to DES-0004 §3.4 + ADR-0009.
- **BLG-0021 — Replace plain `TextInput` date entry with `@react-native-community/datetimepicker`.** Ready as soon as BLG-0016 lands. Anchored to DES-0004 §3.4 + §9.

Five other backlog items (BLG-0004 / BLG-0009 / BLG-0011 / BLG-0014 / BLG-0015) stay planned; none activates in S-007.

## Goals

The driving outcome is to **finally run the freelancer-mode acceptance script on a real Greek consumer's stock Expo Go device** — closing the BLG-0016 deferral and unblocking the on-device half of `AGENTS.md` §2.8. After S-007 the §2.8 MVP is reachable end-to-end on a real phone.

1. **BLG-0016 first.** Per ADR-0012 §2: `npx expo install --fix` against the SDK 54 compat matrix; regenerate `mobile/package-lock.json`; `expo-doctor` clean; encryption-stack round-trip test (forward-only variant per S-005 plan §5).
2. **BLG-0020 in parallel after BLG-0016 lands.** Compose a default `shareImpl` from `expo-sharing@~14.x` + `expo-file-system@~19.x` (both in the SDK 54 expected matrix); the prop indirection from S-006 stays for tests; only the production fallback is added.
3. **BLG-0021 in parallel after BLG-0016 lands.** Replace the two plain `TextInput`s on `ProfileScreen.tsx` with `@react-native-community/datetimepicker`. The reducer is unchanged at the action / state level; only the way `EXPORT_FROM_CHANGED` and `EXPORT_TO_CHANGED` are dispatched changes.
4. `S-007-UREV-0001` runs the full §2.8 freelancer-mode acceptance script (`S-006-UREV-0001` §A) **and** the previously-deferred S-004 UREV addendum (sign in → scan → Insights → offline → restore) on stock Expo Go.
5. `make check` green at sprint close.

## Sequencing

S-007 sequences as **BLG-0016 first, then BLG-0020 + BLG-0021 in parallel** (they touch independent surfaces — share-sheet wiring vs. date-picker swap). Once those land, run `S-007-UREV-0001` on a real Expo Go device.

## Strategy

### Strategy A (selected) — `npx expo install --fix` against a clean clone

Per ADR-0012 §2 verbatim:

1. Bump `expo` in `mobile/package.json` to the SDK 54 line (`54.0.34` is the latest patch as of 2026-05-07; exact pin per ADR-0007 §3 / ADR-0012 §4).
2. Run `npm install --legacy-peer-deps` against the new pin so the new `expo` package lands.
3. Run `npx expo install --fix` to align every other dep with the SDK 54 compat matrix (this writes the new exact pins back into `package.json`).
4. Run `npx expo install expo-sharing expo-file-system @react-native-community/datetimepicker` to add the three new BLG-0020 / BLG-0021 deps under the SDK 54 matrix.
5. Run `npx expo-doctor` until clean.
6. Drop carets where `expo install` left them (ADR-0012 §4: exact pins, no carets in `dependencies` / `devDependencies`).
7. Regenerate `mobile/package-lock.json` from the resulting tree.
8. Run the encryption round-trip test (BLG-0016 acceptance bullet 5 — forward-only variant: encrypt + decrypt under SDK 54 with a known plaintext, asserting the AES-256-GCM round-trip is unbroken; if any of the three encryption-relevant deps regress, the upgrade blocks pending an ADR-0006 amendment).
9. `make check` green.

### Strategy B (fallback) — defer again

If the npm registry hangs for the second sprint running, BLG-0016 stays Ready and S-007 narrows to: (a) write the encryption-stack round-trip test under SDK 51 (so it lands the day SDK 54 does), (b) keep BLG-0020 / BLG-0021 Ready, (c) close S-007 as a thin `make check`-green sprint with the deferral logged. This is `AGENTS.md` §4.10 ("MCP / external host unreachable") applied a second time. We do not enter Strategy B without explicit registry failure evidence in the LOG.

Strategy A is the planned path.

## Acceptance test at S-007 review

By the end of S-007:

- The single S-007 PR contains `mobile/package.json` (SDK 54 pinset, exact versions, no carets), regenerated `mobile/package-lock.json`, any required `mobile/babel.config.js` / `mobile/jest.config.js` / `mobile/tsconfig.json` updates, and (when the file is introduced) `eas.json` profile bumps.
- `expo-doctor` runs clean (zero compat-matrix warnings).
- Both in-tree compat-matrix deviations from S-005 (`@react-native-community/netinfo`, `typescript`) are re-aligned to the SDK 54 expected versions per ADR-0012 §3.
- The encryption-stack round-trip test (BLG-0016 acceptance bullet 5 — forward-only variant) passes.
- `react-native-chart-kit` survives. If it doesn't, BLG-0014 collapses into the same PR with the swap (per ADR-0012 §6).
- All 340 existing tests (143 backend + 197 mobile from the S-006 close baseline) pass under `jest-expo@~54`.
- A real Greek freelancer with stock Expo Go (iOS or Android, latest store version) runs the full eight-step script in `S-006-UREV-0001` §A end-to-end **and** the S-004 UREV addendum in the same Expo Go session. Both end-to-end. (This bullet is exercised in `S-007-UREV-0001`.)
- `make check` green.
- The §4.11 sign-offs are recorded in `S-007-REV-0001`:
  - **New runtime dependency**: `agent-safety-officer` + `engineering-manager` — the BLG-0016 transitive re-pin (~20 packages) + the three SDK-54-matrix deps from BLG-0020 / BLG-0021.
  - **New mobile screen / UX flow**: `product-designer` + `localization-specialist` — the date-picker swap on Profile is a small UX delta from BLG-0021.
  - **User-data flow**: `security-privacy-officer` — encryption-stack survival; share-sheet hand-off does not expose new PII surface (the user picks the share target).
  - **Schema migration**: none.
  - **Auth flow change**: none.
  - **Sprint scope change mid-sprint**: none expected.
  - **Adding / retiring an agent**: none.

## Out of scope (explicit)

- BLG-0004 (real-receipt fixtures) — unchanged. Stays Ready: no consenting receipt holders.
- BLG-0009 (drift-detection CI) — unchanged. Stays planned: depends on BLG-0004.
- BLG-0011 (language switch) — unchanged. Out of MVP scope per `AGENTS.md` §2.9.
- BLG-0014 (chart-kit re-eval) — unchanged unless it doesn't survive the upgrade.
- BLG-0015 (live insights-RPC integration test) — unchanged. Waits on Supabase test project.

## Risks and mitigations

- **NPM registry hangs again** → Strategy B. Logged per `AGENTS.md` §4.10. Encryption round-trip test still lands under SDK 51 so the day SDK 54 ships, the test moves with it.
- **`react-native-chart-kit` doesn't survive SDK 54** → BLG-0014 collapses into the BLG-0016 PR with `victory-native@~37.x` (per ADR-0012 §6). The Insights screen is the only consumer.
- **`@noble/ciphers` AES-256-GCM round-trip regresses under SDK 54** → upgrade is blocked pending an ADR-0006 amendment (ADR-0012 §5 + agent-safety-officer condition 5). Falls back to Strategy B.
- **`jest-expo@~54` preset's `transformIgnorePatterns` regression** → adjust `mobile/jest.config.js` to include the new SDK 54 packages; existing 197 mobile tests must still pass before any new test is added (ADR-0012 §9).
- **PowerShell `make check` quirk with the Greek-character workspace path** → unchanged from S-003 / S-004 / S-005 / S-006. Run `ruff`, `mypy`, `pytest`, `tsc`, `jest` directly with the venv / npm binaries the Makefile would otherwise invoke. Logged in `S-007-LOG-0001`.

## Open questions

None pre-S-007. ADR-0012 + DES-0004 + ADR-0009 cover every contract bullet; the Ready items reference only those.

## Definition of done

- BLG-0016 / BLG-0020 / BLG-0021 moved from `docs/backlog.md` to `docs/done.md` (one entry under "Sprint S-007").
- `S-007-LOG-0001`, `S-007-REV-0001`, `S-007-UREV-0001` written.
- `AGENTS.md` §2.6 + §2.7 updated.
- `docs/plan.md` updated.
- `make check` green.
- Sign-offs per ADR + §4.11 recorded in REV.
