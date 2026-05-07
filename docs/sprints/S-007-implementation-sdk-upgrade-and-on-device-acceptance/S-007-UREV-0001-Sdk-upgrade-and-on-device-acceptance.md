# Sprint S-007 — UREV (User Review)

- Type: implementation
- Theme: `sdk-upgrade-and-on-device-acceptance`
- Closed: 2026-05-07

## Quick read

S-007 was meant to close the on-device half of `AGENTS.md` §2.8 by upgrading Expo SDK 51 → 54 (BLG-0016) and folding `expo-sharing` / `expo-file-system` / `@react-native-community/datetimepicker` into the Profile-screen export action (BLG-0020 / BLG-0021).

Two of those three Ready items shipped at the contract level (BLG-0020 + BLG-0021). The SDK upgrade itself (BLG-0016) is **deferred for the third sprint running** — the npm registry rejected SDK 54 tarballs with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` in this host environment (TLS chain validation failing) and the principled response per `AGENTS.md` §4.10 is to defer rather than weaken `agent-runtime-security.md`. The third deferral is recorded as an **escalation**: S-008 must be a discovery sprint that resolves the network environment or amends ADR-0012.

The encryption-stack round-trip test from BLG-0016 acceptance bullet 5 (forward-only variant per S-005 plan §5) **shipped today** under the in-tree SDK 51 tree — it catches an AES-256-GCM regression in either direction the moment SDK 54 (or any future SDK) lands.

## What you can verify today (without leaving the laptop)

`make check` is green: 143 backend + 203 mobile = **346 tests across 21+ suites** (+6 vs. S-006 close baseline of 340).

### Prerequisites

- Python 3.11+ with `make install` already run (no backend changes in S-007 — `requirements.txt` byte-identical to S-006 close).
- Node.js (Expo SDK 51 toolchain — same as S-006 close; **no upgrade in S-007**).
- The workspace path may contain Greek characters — that's expected; see "Known limitations" below for the `make` workaround.

### 1. Run the gate

From the workspace root:

```
make check
```

(If `make check` complains about resolving the target on PowerShell with the Greek-character path, run the equivalent commands directly:

```
cd backend
.venv\Scripts\python.exe -m ruff check .
.venv\Scripts\python.exe -m mypy app tests
.venv\Scripts\python.exe -m pytest -q

cd ..\mobile
npx tsc --noEmit
npm test --silent
```
)

You should see:

- `ruff check . → All checks passed`
- `mypy → Success: no issues found in 52 source files`
- `pytest → 143 passed in ~2 s`
- `tsc → clean`
- `jest → 203 passed across 19 suites in ~15 s`

**Total: 346 tests across 21+ suites, all green.** This proves:

- Every BLG-0017 / 0018 / 0019 acceptance bullet from S-006 (unchanged contract).
- Every BLG-0020 / 0021 acceptance bullet covered at the contract level (the on-device-only bullets stay gated on BLG-0016).
- The AES-256-GCM round-trip test (BLG-0016 acceptance bullet 5) passes under the in-tree `@noble/ciphers@0.5.3` resolution — and is the first signal that catches a regression when SDK 54 lands.

### 2. Inspect the new code (optional)

Three new / modified files carry S-007's contract-level work:

1. **`mobile/__tests__/cache/encryption.roundtrip.test.ts`** — six-case test of the AES-256-GCM round-trip via `@noble/ciphers/aes` `gcm()`. Includes Greek UTF-8 round-trip, deterministic key + IV round-trip, GCM tag mismatch + tampered-ciphertext rejection, and a `randomBytes()` length sanity check.
2. **`mobile/src/lib/share.ts`** — `defaultShareImpl({ base64, filename })`. Lazy-requires `expo-file-system` + `expo-sharing` so the test path stays clean. The Profile screen falls back to this when the `shareImpl` prop is omitted.
3. **`mobile/src/screens/profile/DateField.tsx`** — wraps `@react-native-community/datetimepicker` behind `loadPicker()`. Falls back to a plain trigger button when the dep is not installed (today's SDK 51 path). The reducer is unchanged; only the way `EXPORT_FROM_CHANGED` / `EXPORT_TO_CHANGED` are emitted changes.

The `mobile/src/screens/profile/ProfileScreen.tsx` diff is small: import the two new modules, swap the two `TextInput`s for `DateField`, fall back to `defaultShareImpl` when the prop is omitted.

## What a Greek freelancer will see — gating recap

Same §A as `S-006-UREV-0001`: the eight-step freelancer-mode acceptance script + the previously-deferred S-004 UREV addendum. Both stay gated on BLG-0016 — meaning they're still reachable only through an Expo dev build (SDK 51 tree), not stock Expo Go (which now requires SDK 54+ on the iOS App Store / Google Play Store).

After S-008 lands an ADR resolving BLG-0016's network-environment issue, the next implementation sprint runs the SDK 54 install + the on-device acceptance scripts in one pass.

## Known limitations (for the human reading this UREV)

- **BLG-0016 deferred for the third sprint running.** The two install attempts in S-007 (one before S-007 in S-006, then two more in S-007) all hit TLS chain-validation errors (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) for the SDK 54 tree on `registry.npmjs.org`. The principled response per `AGENTS.md` §4.10 is to defer rather than (a) disable `strict-ssl` (would weaken supply-chain TLS posture in violation of `agent-runtime-security.md`) or (b) switch to a third-party registry mirror (would expand outbound allowlist mid-sprint, requires an ADR per `AGENTS.md` §3.2.1 + §4.11). S-008 must be a discovery sprint chaired by `orchestrator` with `agent-safety-officer` + `architect` + `engineering-manager` + `mobile-builder` + `devops-engineer` to surface options.
- **`expo-sharing` + `expo-file-system` + `@react-native-community/datetimepicker` are not yet pinned.** They will arrive transitively when BLG-0016 lands (all three are part of the SDK 54 expected matrix). Until then:
  - The Profile-screen export action's `defaultShareImpl` would throw `Cannot find module 'expo-sharing'` if invoked at runtime under SDK 51. The existing `try { await shareFn(...); } catch { ... }` swallows that gracefully — the export still succeeds server-side; the user just doesn't get the share-sheet hand-off.
  - The Profile-screen `DateField` renders just a trigger button under SDK 51 (the picker doesn't open). The default-month range is still computed correctly; the user just can't pick a different range without typing — which is a regression from S-006's plain `TextInput` path. **This is the only user-visible regression in S-007 for SDK 51 dev builds**; it disappears the moment BLG-0016 lands.
- **`react-native-chart-kit` survival** — still untested under SDK 54 (BLG-0014 stays passive per ADR-0012 §6 until BLG-0016 lands).
- **PowerShell `make check` quirk persists**: bare `make check` may misresolve the target on PowerShell sessions where the workspace path contains the Greek folder name `Υπολογιστής`. Workaround in §1 above.
- **No real-receipt fixtures yet.** BLG-0004 stays planned; the freelancer-mode and PDF-export paths are exercised against in-memory fakes + the synthetic `gr-001-supermarket` fixture from S-002.
- **No drift-detection CI yet.** BLG-0009 stays planned; the canary fetch from `e-invoicing.gr` is queued for a later sprint.

## How to review S-007 itself (for `product-owner` / `product-manager`)

1. Read `S-007-PLN-0001` to confirm scope (Strategy A planned; Strategy B fallback executed when the registry blocked).
2. Read `S-007-LOG-0001` for the audit trail (in particular the 21:35 entry recording the third BLG-0016 deferral with the escalation note, and the 21:45 entry recording the encryption-stack round-trip test).
3. Read `S-007-REV-0001` for the closing balance, sign-offs, learnings, and the next-sprint recommendation (S-008 discovery).
4. Skim `docs/done.md` Sprint S-007 entry for the per-BLG outcomes (BLG-0020 + BLG-0021 closed; BLG-0016 stays Ready).
5. Confirm `AGENTS.md` §2.6 + §2.7 reflect the new contract-level shipped behavior + the next sprint focus.
6. Confirm `docs/plan.md` carries the S-007 close snapshot and queues S-008 (discovery).
7. Confirm `docs/backlog.md` no longer carries BLG-0020 / BLG-0021 but **still carries BLG-0016** as Ready with the third-deferral / escalation note.

If anything in this UREV feels short of `AGENTS.md` §2.8, raise it as a backlog item before S-008 starts so the discovery sprint can fold it into the agenda.

## Discovery questions for S-008 (proposed agenda)

1. **What network-environment fix lets the SDK 54 install run on this host?** Options to evaluate: a different machine / network for the install, an `npm` proxy that strips the failing TLS validation in a controlled way, or a one-shot `npm-cache add tarball` flow against pre-validated tarballs from a different host.
2. **Does ADR-0012 §1 need to amend toward Strategy 3 (EAS dev client / TestFlight, accepting the operational shift)?** ADR-0012 originally rejected this as MVP-incompatible; three deferrals is enough signal to revisit. The trade-off changes when "stay on stock Expo Go" stops being achievable.
3. **Does the supply-chain audit footprint of the SDK 54 transitive re-pin warrant a side-by-side dev-client first, with full Expo Go a separate sprint?** Splitting the upgrade in two would let `agent-safety-officer` review the supply-chain delta against a dev-client tree before the full Expo Go bar.
4. **Does the BLG-0014 chart-kit re-eval get folded into S-008 or stay passive?** The S-006 / S-007 deferrals on BLG-0016 mean we still don't know whether `react-native-chart-kit@6.12.0` survives SDK 54. If S-008 settles a different upgrade path, this question simplifies.
5. **Are there any S-006 / S-007 user-testing signals that should re-prioritize the post-MVP backlog (BLG-0011 language switch, real-receipt fixtures, drift-detection CI)?**

These are the right questions for a chaired discovery sprint. The output is one (or two) ADRs that move BLG-0016 from "Ready, deferred three times" to "Ready, executable in S-009 implementation".
