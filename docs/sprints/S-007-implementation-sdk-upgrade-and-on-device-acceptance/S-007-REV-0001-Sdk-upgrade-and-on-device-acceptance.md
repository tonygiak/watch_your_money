# Sprint S-007 — REV (Sprint Review)

- Type: implementation
- Theme: `sdk-upgrade-and-on-device-acceptance`
- Closed: 2026-05-07
- Chair: orchestrator

## Outcome

S-007 shipped **BLG-0020 + BLG-0021 at the contract level** and **BLG-0016 (partial — encryption-stack round-trip test only)**. The full SDK 51 → 54 upgrade itself is **deferred for the third sprint running**, escalated under `AGENTS.md` §4.10.

| Item | Outcome |
| --- | --- |
| **BLG-0016 — Expo SDK 51 → 54 upgrade** | **Partial — deferred to S-008.** Two install attempts hit `UNABLE_TO_VERIFY_LEAF_SIGNATURE` against `registry.npmjs.org` for the SDK 54 tree (TLS chain validation failing on the host environment for newer / re-signed tarballs). The principled options ruled out: (a) `strict-ssl=false` (violates `agent-runtime-security.md`); (b) third-party registry mirror (expands outbound allowlist mid-sprint, requires an ADR per `AGENTS.md` §3.2.1 + §4.11). Per `AGENTS.md` §4.10 ("MCP server / external host unreachable → skip the action, log in `LOG`, do not auto-retry, pick simplest temporary path that does not expand outbound surface"), the deferral was recorded with an **escalation note**: third deferral on the same Ready item triggers `agent-safety-officer` to assess whether a network-environment fix or ADR-0012 amendment is needed before the next attempt. **The encryption-stack round-trip test (BLG-0016 acceptance bullet 5 — forward-only variant per S-005 plan §5) shipped today** so the day SDK 54 lands, the test catches a regression in either direction. |
| **BLG-0020 — `expo-sharing` + `expo-file-system` wiring** | **Done at the contract level.** `mobile/src/lib/share.ts` defines `defaultShareImpl` with lazy-require + graceful fallback. `ProfileScreen.tsx` falls back to the default when the `shareImpl` prop is omitted; tests still inject a fake. The on-device share-sheet hand-off stays gated on BLG-0016 (the two SDK 54 deps arrive transitively when BLG-0016 lands; the privacy contract from ADR-0009 §3 is honored byte-identically — `defaultShareImpl` never logs the bytes / filename / target). |
| **BLG-0021 — `@react-native-community/datetimepicker` swap** | **Done at the contract level.** `mobile/src/screens/profile/DateField.tsx` wraps the picker behind a `loadPicker()` try / catch; ProfileScreen replaces the two plain `TextInput`s with `DateField` components; the reducer's `EXPORT_FROM_CHANGED` / `EXPORT_TO_CHANGED` actions are unchanged. `jest.config.js` `transformIgnorePatterns` now includes `@react-native-community/datetimepicker` for the `rn` Jest project. The on-device picker open stays gated on BLG-0016. |

## `make check` at sprint close

**346 tests across 21+ suites — green.**

- Backend: `ruff check . → All checks passed`; `mypy app tests → Success: no issues found in 52 source files`; `pytest → 143 passed in 1.84 s` (unchanged from S-006 close).
- Mobile: `tsc --noEmit → clean`; `jest → 203 passed across 19 suites in ~15 s` (+6 tests vs. S-006 close — the new `__tests__/cache/encryption.roundtrip.test.ts`; +1 suite).

No flaky tests, no skipped tests, no new warnings beyond the existing reportlab / requests deprecation notes from S-006.

## §4.11 sign-offs

| Change kind | Required sign-off | Recorded |
| --- | --- | --- |
| New runtime dependency | `agent-safety-officer` + `engineering-manager` | **N/A — none added in S-007.** The in-tree SDK 51 pin set is unchanged byte-identically (the package.json was edited transiently then restored). The eventual `expo-sharing` / `expo-file-system` / `@react-native-community/datetimepicker` pins arrive with BLG-0016 — sign-off chain pre-recorded in ADR-0012 (S-005) and BLG-0020 / BLG-0021. |
| New mobile screen / UX flow | `product-designer` + `localization-specialist` | `product-designer` — confirms `defaultShareImpl` matches DES-0004 §3.4 (write to cache dir → open share sheet → user picks target); confirms `DateField` matches DES-0004 §3.4 + §9 (native picker, device-locale-driven chrome). `localization-specialist` — no new strings; the `Από` / `Έως` labels stay; the picker chrome localizes via the device locale; on a Greek phone, the picker renders Greek month / weekday names automatically. |
| User-data flow | `security-privacy-officer` | `security-privacy-officer` — confirms (a) the encryption-stack round-trip test does not introduce any new PII surface (test fixture is the synthetic supermarket receipt from S-002); (b) `defaultShareImpl` honors ADR-0009 §3 byte-identically — no logging of bytes / filename / target; the user's chosen share target is the user's, not ours; (c) the lazy-require pattern keeps the eventual `expo-sharing` / `expo-file-system` deps off the test path entirely until BLG-0016 lands. |
| Schema migration | `data-architect` + `security-privacy-officer` | **N/A — none.** |
| Auth flow change | `security-privacy-officer` + `data-architect` | **N/A — none.** |
| New endpoint / API contract change | `architect` + `engineering-manager` | **N/A — none.** |
| New parser logic | `parser-specialist` + `qa` | **N/A — none.** |
| New EU country adapter | `parser-specialist` + `architect` + `data-architect` | **N/A — none.** |
| New MCP integration / new outbound host | `agent-safety-officer` + `architect` | **N/A — none.** |
| Sprint scope change mid-sprint | `orchestrator` + `product-manager` | `orchestrator` — confirms the BLG-0016 deferral narrowed S-007 scope to "what doesn't depend on the SDK 54 install"; the deferral is the §4.10 failure-mode flow, not a discretionary scope change. `product-manager` — concurs; the §2.8 MVP bullet 9 (PDF export → native share sheet) and bullet 4 (on-device receipt scanning under stock Expo Go) stay reachable through S-008 once BLG-0016 lands. |
| Adding / retiring an agent | `agents-doctor` (+ `orchestrator`) | **N/A — none.** |
| Edits to `AGENTS.md` | `agents-doctor` (structural) / section owner (content) / `orchestrator` (sprint LOG) | `agents-doctor` — N/A (no structural edits). Section owner — `product-owner` (§2.6 / §2.7 content edits reflect S-007 close). `orchestrator` — recorded in `S-007-LOG-0001` 22:10 entry. |
| Sprint deferral under §4.10 | `agent-safety-officer` + `engineering-manager` (+ `orchestrator` for cycle impact) | `agent-safety-officer` — co-signs the third-deferral with the escalation note. `engineering-manager` — co-signs that the in-tree SDK 51 tree still satisfies `make check`. `orchestrator` — records the cycle impact: S-008 is queued as discovery to address the BLG-0016 network-environment options or amend ADR-0012. |

## Drift items opened during S-007

None new beyond the BLG-0016 deferral (which was already Ready / planned). The escalation note attached to BLG-0016 is the new addition: the third deferral on the same outbound surface triggers an `agent-safety-officer`-led discovery sprint to assess options.

## Backlog updates

- **BLG-0016** — stays in `docs/backlog.md` Ready, with the deferral note updated and the escalation hook recorded.
- **BLG-0020** — moved to `docs/done.md` Sprint S-007 entry (closed at the contract level; on-device verification gated on BLG-0016).
- **BLG-0021** — moved to `docs/done.md` Sprint S-007 entry (closed at the contract level; on-device verification gated on BLG-0016).
- BLG-0004 / BLG-0009 / BLG-0011 / BLG-0014 / BLG-0015 unchanged.
- No new BLG opened.

## Learnings

1. **Cache-only reinstall is a viable pattern under TLS-restricted networks.** When `npm install --prefer-offline` can resolve a fully cached SDK 51 tree in 23 s without any registry round-trip, that's worth knowing for future drift recovery — and it's why `make check` is green in S-007 even after two failed SDK 54 attempts.
2. **Lazy-require + try / catch is the right pattern for SDK-version-bridged code.** The S-007 `share.ts` and `DateField.tsx` files mirror the existing `cache/rotate.ts` pattern: native deps loaded only when called, and the test path stays clean. The same pattern would help the BLG-0014 chart-kit swap if it ever lands.
3. **The encryption-stack round-trip test is more useful as a forward-only artifact than as a side-by-side test.** The S-005 plan §5 considered both variants; S-007 confirms the forward-only variant (encrypt + decrypt under the current SDK with a known plaintext) is plenty — it catches a regression in either direction without needing pre-upgrade ciphertext on disk.
4. **A third deferral on the same Ready item is an escalation, not just a delay.** Per the closing note, the next attempt either resolves the network environment first (so the install can actually run) or amends ADR-0012 with a different approach (e.g. EAS-dev-client / TestFlight, accepting the operational shift that ADR-0012 §1 originally rejected). S-008 is the right place for that conversation.

## Next sprint

Per `AGENTS.md` §4.1.2 (Ready queue is non-empty post-S-007 — BLG-0016 stays Ready; the rest are unchanged), the next sprint *could* be implementation. But per the escalation note above and the §4.10 failure-mode flow, the principled call is:

- **S-008 — discovery (likely)** — chaired by `orchestrator` with `agent-safety-officer` + `architect` + `engineering-manager` + `mobile-builder` + `devops-engineer`. The discovery questions: (a) what network-environment fix lets the SDK 54 install run on this host? (b) does ADR-0012 §1 need to amend toward Strategy 3 (EAS dev client / TestFlight, accepting the operational shift)? (c) does the supply-chain audit footprint of the SDK 54 transitive re-pin warrant a side-by-side dev-client first, with full Expo Go a separate sprint? Output: an ADR-0013 (or an ADR-0012 amendment) that lets BLG-0016 be Ready in a way that actually ships in S-009.

If S-008 surfaces enough Ready items in parallel (e.g. BLG-0011 language switch, BLG-0014 chart-kit re-eval), it can fold those into the same discovery output.
