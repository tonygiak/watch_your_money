# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-008 (discovery, `sdk-upgrade-path-forward`)** has just closed. Single output: **ADR-0013 accepted**, resolving the three-sprint `UNABLE_TO_VERIFY_LEAF_SIGNATURE` blocker on BLG-0016.

**Root cause diagnosed:** The `npm ERR! code UNABLE_TO_VERIFY_LEAF_SIGNATURE` error that blocked BLG-0016 in S-005, S-006, and S-007 is a **Node.js CA bundle staleness issue**. Node.js ships its own Mozilla CA store at its release date. If `registry.npmjs.org` adopted a root or intermediate CA after the installed Node.js version was released, TLS validation fails. The fix is to update Node.js to the current LTS release (v22.x, which ships an updated CA store) or to export the Windows system CA trust store via `NODE_EXTRA_CA_CERTS`. Both approaches keep `strict-ssl` fully enabled and require no new outbound host.

**Decision (ADR-0013):** Option A — host CA environment fix — is the sole path forward for S-009. A pre-flight checklist (ADR-0013 §3) gives `mobile-builder` an unambiguous, auditable sequence before any `npx expo install --fix` attempt. ADR-0012 §1 (EAS dev client rejection) remains in force unless S-009 exhausts the pre-flight checklist.

`make check` is **green at S-008 close: 143 backend + 203 mobile = 346 tests across 21+ suites** (unchanged from S-007 — no production code changes in a discovery sprint).

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (feature catalog unchanged from S-007) and §2.7 (sprint snapshot now reflects S-008 closing).

## Next sprint

- **Type**: `implementation`
- **Theme proposal**: `sdk-upgrade-and-on-device-acceptance-v2`
- **Number**: **S-009**
- **Why implementation**: BLG-0016 is Ready and executable per ADR-0013 §3 pre-flight checklist. The Ready queue has one clearly unblocked item; per `AGENTS.md` §4.1.2, the next sprint is implementation.

### Goals for the implementation sprint S-009

1. **Run the ADR-0013 §3 pre-flight checklist** as the very first action:
   - Verify / update Node.js to v22 LTS (updates the bundled Mozilla CA store).
   - Smoke test: `npm pack expo@^54.0.0 --dry-run` in a temp dir.
   - If still failing: export Windows CA bundle via PowerShell → set `NODE_EXTRA_CA_CERTS` → retry.
   - If smoke test passes → proceed to the full SDK 54 upgrade.
   - If checklist exhausted without success → open BLG-0023 + S-010 for Option B (EAS dev client).
2. **BLG-0016 — Expo SDK 51 → 54 upgrade** (if pre-flight passes):
   - `npx expo install --fix` in `mobile/`.
   - `expo-doctor` until zero warnings.
   - Regenerate `mobile/package-lock.json`.
   - Verify all BLG-0016 acceptance bullets (encryption-stack round-trip test already shipped in S-007).
   - `make check` green under the new jest-expo@54 preset.
3. **BLG-0020 + BLG-0021 on-device verification** (contingent on BLG-0016 landing):
   - The share-sheet hand-off (`defaultShareImpl` → `expo-sharing` + `expo-file-system`) is already wired; the on-device test verifies it under SDK 54 on real Expo Go.
   - The native date-picker (`DateField.tsx` → `@react-native-community/datetimepicker`) is already wired; the on-device test verifies it opens under SDK 54.
4. **S-009-UREV-0001** — end-to-end acceptance script on stock Expo Go (iOS or Android, latest store version):
   - S-004 script: sign in → scan → Insights → offline → restore.
   - S-006 freelancer-mode script: sign in → scan → tag as business → Insights → Profile → ΑΦΜ → export PDF → native share sheet.

### Acceptance at S-009 review

- Pre-flight checklist ran per ADR-0013 §3 and outcome logged.
- `expo-doctor` reports zero compat warnings.
- `make check` green (346+ tests, now under `jest-expo@~54`).
- Real device acceptance script executed on stock Expo Go.
- `AGENTS.md` §2.6 + §2.7 updated at sprint close.

### Cadence after that

- **S-010** — depends on S-009 outcome:
  - If BLG-0016 lands: likely **discovery** — opens the door to country expansion (RO/IT/PT/ES adapters per §5.9), real-receipt fixtures (BLG-0004 + BLG-0009), or post-MVP UX gaps.
  - If pre-flight checklist is exhausted: **discovery** for BLG-0023 (EAS dev client path — `agent-safety-officer` supply-chain review of EAS CLI + code-signing surface required).

## Open questions for S-009

- **Node.js version resolved at S-008 close**: `node --version` → **v22.22.0** — already on LTS. ADR-0013 §3 Step 2 (Node.js update) is skipped; S-009 starts at Step 3 (TLS smoke test) and will execute Step 3a (Windows CA bundle export via `NODE_EXTRA_CA_CERTS`) before `npx expo install --fix`.
- Whether `react-native-chart-kit@6.12.0` survives `expo install --fix` for SDK 54 (BLG-0014 — passive unless the install proves otherwise).

## Notes for whoever picks this up

- **ADR-0013 is the new execution contract for BLG-0016.** Read `docs/adr/S-008-ADR-0013-Sdk-upgrade-env-fix.md` before touching `mobile/package.json`.
- **The S-005 ADRs + DES are still the contracts.** ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012, DES-0004, DES-0005 all locked. S-009 implements against them; ADR-0013 adds only the pre-flight checklist.
- **Contract-level acceptance for BLG-0020 + BLG-0021 is complete.** S-009 runs the on-device half once the SDK 54 tree lands.
- **The encryption-stack round-trip test ships under SDK 51** but the test contract is SDK-version-agnostic. When SDK 54 lands, the test moves with it byte-identically.
- **PowerShell `make check` quirk persists**: bare `make check` may misresolve on PowerShell sessions where the workspace path contains the Greek folder name `Υπολογιστής`. Workaround: run `ruff check`, `mypy`, `pytest`, `tsc`, `jest` directly. Logged since S-003.
