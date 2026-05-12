# Sprint S-009 — sdk-upgrade-and-on-device-acceptance-v2

- Type: implementation
- Theme: `sdk-upgrade-and-on-device-acceptance-v2`
- Start: 2026-05-09
- Chair: orchestrator
- Participants: mobile-builder (driver), agent-safety-officer, engineering-manager, architect, security-privacy-officer, product-designer, localization-specialist, qa, devops-engineer

## Why this sprint

S-008 (`sdk-upgrade-path-forward`) closed with **ADR-0013 accepted**. BLG-0016 is now Ready and executable per the ADR-0013 §3 pre-flight checklist. The Ready queue contains exactly one unblocked item that gates §2.8 MVP bullets 4 (on-device scanning under stock Expo Go) and 9 (PDF export → native share sheet); per `AGENTS.md` §4.1.2 the next sprint is implementation.

This is the **fourth attempt** at the SDK 51 → 54 upgrade after three sprints of `UNABLE_TO_VERIFY_LEAF_SIGNATURE` deferrals (S-005, S-006, S-007). The ADR-0013 §3 pre-flight checklist is the execution contract — Step 1 (`node --version`) at sprint open returns **v22.22.0**, so the Node.js update from Step 2 is **already done** and S-009 starts at Step 3 (TLS smoke test).

## Goals

1. **Run the ADR-0013 §3 pre-flight checklist** — TLS smoke test → if needed, Windows CA bundle export → if both exhausted, escalate to BLG-0023 + S-010.
2. **BLG-0016 — Expo SDK 51 → 54 upgrade** (if pre-flight passes): `npx expo install --fix`, `expo-doctor` clean, regenerated lockfile, all 346 existing tests green under `jest-expo@~54`.
3. **BLG-0020 + BLG-0021 on-device verification** (contingent on BLG-0016 landing): `defaultShareImpl` hand-off to native share sheet; `DateField` opens native picker — both verified on stock Expo Go.
4. **S-009-UREV-0001** — end-to-end acceptance script on stock Expo Go (sign in → scan → Insights → offline → restore + freelancer-mode tag → ΑΦΜ → export PDF → share).

## Scope

**In:**

- ADR-0013 §3 pre-flight checklist execution (Steps 1–4).
- `mobile/package.json` rewrite to the SDK 54 pin set (no carets, exact pins).
- `mobile/package-lock.json` full regeneration.
- Any required updates to `mobile/babel.config.js`, `mobile/jest.config.js`, `mobile/tsconfig.json` to keep the two-project Jest layout (BLG-0012) green.
- Forward-only encryption-stack round-trip test (BLG-0016 acceptance bullet 5) re-run under SDK 54.
- `eas.json` profile bumps to SDK 54 (if `eas.json` exists; `agent-safety-officer` co-sign on EAS surface change if newly added).
- `AGENTS.md` §2.6 + §2.7 + `docs/plan.md` updated at sprint close.

**Out (explicitly):**

- New product features. This is a runtime-tree upgrade.
- New endpoints, schemas, RLS policies, parser logic.
- BLG-0014 (`react-native-chart-kit` re-eval) — passive per ADR-0012 §6 unless the install proves it does not survive SDK 54; collapses into this PR only if needed.
- BLG-0011 (Profile language switch), BLG-0004 / BLG-0009 (real-receipt fixtures), BLG-0015 (live insights RPC test) — unchanged, queued for S-010+.

## Ready items pulled (delivery only)

- **BLG-0016** — Expo SDK 51 → 54 upgrade (Expo Go compatibility + compat-matrix alignment). Acceptance bullets per `docs/backlog.md` BLG-0016, with bullet 5 (encryption-stack round-trip) shipped in S-007 (forward-only variant per S-005 plan §5).
- **BLG-0020 (on-device verification)** — share-sheet hand-off via `defaultShareImpl` → `expo-sharing` + `expo-file-system` under SDK 54.
- **BLG-0021 (on-device verification)** — native date-picker via `DateField` → `@react-native-community/datetimepicker` under SDK 54.

## Risks & known unknowns

- **TLS smoke test still fails despite Node 22.** Mitigation: Step 3a (Windows CA bundle export via `NODE_EXTRA_CA_CERTS`). If both exhausted: Step 3a's exhaustion clause triggers BLG-0023 + S-010 discovery for Option B (EAS dev client). No `strict-ssl=false`, no new outbound host.
- **`react-native-chart-kit@6.12.0` does not survive `expo install --fix`.** Mitigation: per ADR-0012 §6, BLG-0014 collapses into this PR with a swap (`victory-native@~37.x` or `react-native-svg-charts`) co-signed by `mobile-builder` + `agent-safety-officer` + `engineering-manager` + `product-designer`.
- **`expo-doctor` flags a deviation that ADR-0012 §3 didn't anticipate.** Mitigation: re-align to SDK-54-expected versions; record as a learning in REV. The two known deviations (`@react-native-community/netinfo`, `typescript`) must close.
- **Encryption-stack round-trip test fails under SDK 54** (`@noble/ciphers` or `expo-secure-store` regression). Mitigation: per BLG-0016 acceptance bullet 5, the upgrade is **blocked** pending an ADR-0006 amendment. Sprint cannot close until resolved.
- **PowerShell `make check` quirk** with the Greek workspace path. Mitigation: run `ruff check`, `mypy`, `pytest`, `tsc`, `jest` directly — logged since S-003.

## User direction (if `go` was used)

- Direction: `Implementation` (one word — implicit "run the implementation sprint as planned").
- Honored in scope: yes — S-009 is exactly the implementation sprint planned in `docs/plan.md` after S-008. No backlog split needed.

## Definition of done

- ADR-0013 §3 pre-flight checklist ran end-to-end and the outcome (pass / exhausted) is logged in `S-009-LOG-0001`.
- If pre-flight passed: `mobile/package.json` reflects the SDK 54 pin set, `mobile/package-lock.json` regenerated, `expo-doctor` reports zero compat warnings, all in-tree compat-matrix deviations closed.
- All 346 existing tests pass under `jest-expo@~54` (143 backend unchanged + 203 mobile re-rendered).
- Encryption-stack round-trip test (`mobile/__tests__/cache/encryption.roundtrip.test.ts`) green under SDK 54.
- BLG-0016, BLG-0020, BLG-0021 moved from `backlog.md` to `done.md` Sprint S-009 entry.
- `make check` green (or direct-binary equivalent per the PowerShell quirk).
- `S-009-REV-0001`, `S-009-UREV-0001` written.
- `AGENTS.md` §2.6 + §2.7 + `docs/plan.md` updated.
- §4.11 sign-offs recorded: `agent-safety-officer` + `engineering-manager` (final pin set), `architect` (SDK choice), `security-privacy-officer` (encryption round-trip).
