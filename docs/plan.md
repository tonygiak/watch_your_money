# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-007 (implementation, `sdk-upgrade-and-on-device-acceptance`)** has just closed. Two of the three Ready items shipped at the contract level, plus the BLG-0016 acceptance bullet 5 partial:

- **BLG-0020 — Wire `expo-sharing` + `expo-file-system` into the Profile export `shareImpl`.** `mobile/src/lib/share.ts` ships `defaultShareImpl({ base64, filename })` — lazy-requires `expo-file-system` + `expo-sharing` at call time, writes the base64 PDF bytes to the sandboxed cache directory, then opens the native share sheet via `shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: filename })`. `ProfileScreen.tsx` falls back to `defaultShareImpl` when the `shareImpl` prop is omitted; tests still inject a fake. Privacy contract from ADR-0009 §3 honored byte-identically — no logging of bytes / filename / target. The two SDK 54 transitive deps (`expo-sharing`, `expo-file-system`) arrive when BLG-0016 lands; until then the lazy require gracefully degrades.
- **BLG-0021 — Replace plain `TextInput` date entry with `@react-native-community/datetimepicker`.** `mobile/src/screens/profile/DateField.tsx` wraps the picker behind a `loadPicker()` try / catch — under SDK 54 the require resolves and the native picker opens; under SDK 51 (today's tree) the require returns null and the component renders just a trigger button. The reducer is **unchanged** at the action / state level. `mobile/jest.config.js` `transformIgnorePatterns` now includes `@react-native-community/datetimepicker` for the SDK 54 tree.
- **BLG-0016 partial — Encryption-stack round-trip test** (acceptance bullet 5, forward-only variant per S-005 plan §5). `mobile/__tests__/cache/encryption.roundtrip.test.ts` — six-case test of the AES-256-GCM round-trip via `@noble/ciphers/aes` `gcm()` directly. Includes Greek UTF-8 round-trip, deterministic key + IV round-trip, GCM tag mismatch + tampered-ciphertext rejection, and a `randomBytes()` length sanity check. The test runs under whatever `@noble/ciphers` resolution is loaded; today that's SDK 51's `0.5.3`, tomorrow that's SDK 54's resolution — the test catches a regression in either direction.

The third Ready item (the full SDK upgrade itself) was **deferred for the third sprint running**:

- **BLG-0016 — Expo SDK 51 → 54 upgrade — deferred again per `AGENTS.md` §4.10.** Two install attempts in S-007 hit `UNABLE_TO_VERIFY_LEAF_SIGNATURE` against `registry.npmjs.org` for the SDK 54 tree (TLS chain validation failing on the host environment for the newer / re-signed tarballs). The principled options ruled out: (a) `strict-ssl=false` (would weaken supply-chain TLS posture in violation of `agent-runtime-security.md`); (b) third-party registry mirror (would expand outbound allowlist mid-sprint, requires an ADR per `AGENTS.md` §3.2.1 + §4.11). The deferral keeps the in-tree SDK 51 pin set and the encryption stack from ADR-0006 §2 byte-identical. **The third deferral is recorded as an escalation** — S-008 must be a chaired discovery sprint that resolves the network environment or amends ADR-0012. BLG-0016 stays Ready in `docs/backlog.md` with the escalation note. The on-device verification of the §2.8 freelancer-mode acceptance script (`S-006-UREV-0001` §A) remains gated until BLG-0016 lands.

`make check` is **green at S-007 close: 143 backend + 203 mobile = 346 tests across 21+ suites** (+6 vs. S-006 close baseline of 340 tests across 21 suites). Backend: `ruff check` + `mypy app tests` (52 source files clean) + `pytest` (143 passed). Mobile: `tsc --noEmit` clean + `jest` (203 passed across 19 suites — 14 pure-TS + 5 jest-expo render). No flaky tests, no skipped tests beyond the baseline.

One new backlog item was opened at S-007 close, queued for S-008:

- **BLG-0022** — BLG-0016 escalation — discovery sprint chaired by `orchestrator` with `agent-safety-officer` + `architect` + `engineering-manager` + `mobile-builder` + `devops-engineer` to surface options (network-environment fix, ADR-0012 §1 amendment toward Strategy 3 EAS dev client, or split-into-two-upgrade approach).

Five backlog items still planned across BLG-0004 / BLG-0009 / BLG-0011 / BLG-0014 / BLG-0015 (real-receipt fixtures, drift-detection CI, Profile language switch, chart-kit re-eval, live insights-RPC integration test); none was activated in S-007.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (shipped features now include the BLG-0020 share-sheet wiring + BLG-0021 native date-picker scaffold + the encryption round-trip test — all gated for full on-device by BLG-0016) and §2.7 (sprint snapshot now reflects S-007 closing).

## Next sprint

- **Type**: `discovery` (per the BLG-0016 escalation — third deferral on the same outbound surface).
- **Theme proposal**: `sdk-upgrade-path-forward`.
- **Number**: **S-008**.
- **Why discovery, not implementation**: BLG-0016 has been deferred three sprints in a row on the same external-host failure mode. Per `AGENTS.md` §4.10, the third occurrence escalates to `agent-safety-officer` who must lead the next decision. Per `AGENTS.md` §4.4, no in-sprint workaround is acceptable — the path forward is decided through a multi-round chaired ADR debate, not improvised in implementation.

### Goals for the discovery sprint S-008

1. **BLG-0022 — chair a multi-round ADR debate** covering the three options identified in `S-007-REV-0001`:
   - **(a) Network-environment fix.** Move the install to a different machine / network where the SDK 54 tarballs validate cleanly. An `npm` proxy that strips the failing TLS validation in a controlled way (e.g. Verdaccio with our own validated tarball mirror). A one-shot `npm-cache add tarball` flow against pre-validated tarballs from a different host. None of these expand the outbound allowlist at runtime — only at build / install time.
   - **(b) ADR-0012 §1 amendment toward Strategy 3 (EAS dev client / TestFlight).** ADR-0012 originally rejected this as an "MVP-incompatible operational shift". Three deferrals is enough signal to revisit. The trade-off changes when "stay on stock Expo Go" stops being achievable. EAS dev client doesn't require Expo Go on the user's device at all — it ships a custom app via TestFlight / Play internal testing. Operational footprint: meaningful build / signing / distribution work; net positive: removes the Expo Go SDK-version dependency entirely.
   - **(c) Split-into-two-upgrade approach.** SDK 54 dev-client first (smaller blast radius — only `agent-safety-officer` + `engineering-manager` review the dev-client tree), full Expo Go a separate sprint. Lets the supply-chain audit happen on a smaller surface first.
2. **Output**: an ADR (`ADR-0013` likely, or an `ADR-0012` amendment per `AGENTS.md` §4.4 supersession rules) that makes BLG-0016 **executable** in S-009 implementation — no fourth deferral on the same outbound surface.
3. **Folded-in question**: does BLG-0014 (`react-native-chart-kit` re-eval) ride along with the chosen path, or stay passive until the upgrade actually lands? Decision recorded in the same ADR.
4. **Not in scope for S-008**: BLG-0004 (real-receipt fixtures), BLG-0009 (drift-detection CI), BLG-0011 (language switch), BLG-0015 (live insights-RPC integration test). Those stay planned and wait for S-008's chosen path to settle the supply-chain footprint of the S-009 upgrade.
5. **Update `AGENTS.md` §2.7** at S-008 close with the chosen path and the new sprint queue.

### Acceptance test at S-008 review (discovery)

By the end of S-008:

- `docs/adr/S-008-ADR-0013-*.md` (or an `ADR-0012` amendment) records: chair, participants, multi-round positions, recorded dissent, final decision, and the supply-chain implications signed off by `agent-safety-officer`.
- BLG-0016 in `docs/backlog.md` is updated from "Ready, deferred + escalated" to "Ready, executable per ADR-0013" (or per the amendment).
- `S-008-REV-0001` records the §4.11 sign-offs: `agent-safety-officer` (the supply-chain footprint of the chosen path), `architect` (the technical decision), `engineering-manager` (the engineering-quality bar of the chosen path), `mobile-builder` (the executor's read on feasibility), `devops-engineer` (the deploy / build implications), `orchestrator` (chair).
- `make check` green (no production-code change in a discovery sprint; the only change is documentation + ADR + backlog updates).

### Cadence after that

- **S-009 — implementation** — pulls BLG-0016 first under the path settled by S-008; folds in BLG-0020 + BLG-0021 on-device verification (both shipped at the contract level in S-007 — the on-device half completes when the SDK 54 tree actually runs). Then runs `S-009-UREV-0001` end-to-end on whatever runtime the S-008 ADR settled on (stock Expo Go if Strategy A wins, EAS dev client if Strategy B wins, or split if Strategy C wins).
- **S-010 — discovery (likely)** — opens the door to one of: country expansion (RO / IT / PT / ES adapters per `AGENTS.md` §5.9), real-receipt fixtures (BLG-0004 + BLG-0009 if consenting users surface), or post-MVP UX gaps from S-009 user testing.

## Open questions queued for S-008 discovery

- **Network-environment options.** Is a different machine / network an option for the install? Is Verdaccio (or similar) acceptable as a pre-validated tarball mirror, or does that count as a new outbound host requiring an allowlist update?
- **EAS dev client supply-chain footprint.** ADR-0012 §1 rejected this as MVP-incompatible. Is the rejection still right after three deferrals?
- **Split-upgrade timing.** If S-008 chooses (c), how do we sequence the dev-client upgrade vs. the Expo Go upgrade?

## Notes for whoever picks this up

- **The S-005 ADRs + DES are still the contracts.** ADR-0008 (Tag-as-business UX), ADR-0009 (PDF export pipeline), ADR-0010 (inferred-category posture — deferred), ADR-0011 (`tzdata` codification), ADR-0012 (SDK upgrade — escalated to S-008) + DES-0004 (Profile screen) + DES-0005 (Tag-as-business inline flow) all locked. S-006 + S-007 implemented against them; S-008 amends only ADR-0012 §1.
- **Contract-level acceptance for BLG-0020 + BLG-0021 is complete.** S-008 (discovery) doesn't touch the wiring; S-009 (implementation) re-tests them on-device once the SDK 54 tree lands.
- **The encryption-stack round-trip test ships under SDK 51** but the test contract is SDK-version-agnostic — it runs under whatever `@noble/ciphers` resolution is loaded. When SDK 54 lands, the test moves with it byte-identically. If the round-trip ever fails, BLG-0016 is **blocked** pending an ADR-0006 amendment per ADR-0012 §5 + agent-safety-officer condition 5.
- **The PDF must never be persisted server-side.** ADR-0009 §3 stays hard. The S-006 implementation honors this and S-007's BLG-0020 wiring keeps it that way (the share sheet hands the bytes to the user's chosen target — that's the user's choice, not ours).
- **`category` is lowercased server-side, not client-side.** Mobile preserves user input as typed; the server normalizes. This is what makes the by-category Insights rollup collapse `"Groceries"` and `"groceries"` correctly.
- **PowerShell `make check` quirk persists**: bare `make check` may misresolve the target on PowerShell sessions where the workspace path contains the Greek folder name `Υπολογιστής`. Workaround in `S-006-UREV-0001` / `S-007-UREV-0001` §1: run `ruff check`, `mypy`, `pytest`, `tsc`, `jest` directly with the venv / npm binaries the Makefile would otherwise invoke. Logged in every sprint LOG since S-003.
