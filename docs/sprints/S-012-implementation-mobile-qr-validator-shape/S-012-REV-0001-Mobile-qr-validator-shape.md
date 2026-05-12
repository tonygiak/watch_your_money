# Sprint S-012 — Review

- Type: implementation
- Closed: 2026-05-12
- Chair: `orchestrator`

## Outcomes

- **BLG-0032 shipped**. `mobile/src/parsers/gr.ts` now exports `validateGrQrCode(input: string)` returning a discriminated union covering all three Greek QR families documented in ADR-0014 §3 (`einvoicing` / `aade` / `epsilon`) plus the `unknown_code` placeholder branch for Family C awaiting BLG-0029 identification.
- `validateGrQrUrl` remains as the e-invoicing-only delegate consumed by `mobile/src/api/receipts.ts` defense-in-depth — every existing caller stays byte-identical at the type level *and* behaviour level.
- `mobile/src/screens/ScannerScreen.tsx` now consumes the discriminator. A new module-level constant `IMPLEMENTED_FAMILIES = new Set(["einvoicing"])` documents — and gates — *why* AADE / Epsilon / `unknown_code` are routed to the existing `unsupported_qr` UX today: backend adapters (BLG-0027 + BLG-0028) have not landed yet. S-013 widens this set to one line.
- 22 new tests in `mobile/__tests__/parsers/gr.test.ts` cover every family branch + every rejection path + the cross-family disambiguation contract. All 8 pre-existing `validateGrQrUrl` tests stay green, including the pinned-regex-source defense-in-depth assertion.

## `make check`

- Status: **green**
- Last run: 2026-05-12 22:05
- Composition (direct-binary workaround per S-009-UREV; the PowerShell `make check` quirk on the Greek folder name persists):
  - Mobile `tsc --noEmit`: clean.
  - Mobile `jest`: **229 passed** across 19 suites (203 → 229; +22 new `gr.test.ts`, +4 pre-existing scanner-state from S-011).
  - Backend `pytest`: **182 passed** (unchanged from S-011 close — no backend touched).
  - Backend `ruff check .`: clean.
  - Backend `mypy app`: 31 source files, no issues.
  - **Total: 411 tests across 21+ suites — green** (389 → 411).

## Sign-offs (from `AGENTS.md` §4.11)

- **New mobile screen or UX flow** wording (`product-designer`, `localization-specialist`): N/A — no user-visible flow change beyond the silent reclassification of AADE / Epsilon scans from "unparseable" into "recognised but not yet supported." No new strings, no copy change. `localization-specialist` review: no new strings shipped — implicit pass.
- **New / changed parser logic** (`parser-specialist`, `qa`): signed off — the mobile validator mirrors the published ADR-0014 §3 shapes; backend adapters carry to S-013; the test suite covers every discriminator branch + every rejection path.
- **No new runtime dependency**, **no new MCP integration**, **no new outbound host**: `agent-safety-officer` audit trail is `none` across the LOG (every entry).
- **No user-data flow change**: `security-privacy-officer` N/A.
- **Edits to `AGENTS.md`**: §2.6 and §2.7 updates by `product-owner` for content; `orchestrator` records the change in this LOG / REV pair.

## ADRs decided

None. S-012 is a pure implementation sprint following ADR-0014 §1 verbatim.

## Items moved backlog → done

- **BLG-0032** — Mobile `validateGrQrCode` — discriminated-union mirror for the three GR QR families.

## New backlog items (drift / follow-ups)

None. No drift surfaced. Every gated item (BLG-0027, BLG-0028, BLG-0029, BLG-0030) stays Ready / planned with the same gating conditions as at S-011 close.

## Learnings

- **Shape-ahead-of-adapter is cheap and de-risks the next sprint.** Shipping the on-device discriminator in S-012 means that when BLG-0027 + BLG-0028 land in S-013, the mobile side is already done — only the scanner's `IMPLEMENTED_FAMILIES` set widens. This pattern is worth applying to other defense-in-depth mirrors when the adapter side is fixture-gated.
- **The pinned-regex-source assertion (`GR_VIEWER_PATH_REGEX.source` equality check) is the kind of defense-in-depth test that survives refactors.** It caught the existing-callers contract risk *before* we refactored `validateGrQrUrl` into a delegate.
- **TypeScript named-group return types are optional even when the regex guarantees them.** `match.groups.hash` is `string | undefined` under `strict`; we destructure into local consts with explicit `undefined` checks rather than non-null assertions, keeping the parser hot path exception-free.
- **The 15-hex example `45C07BD642067E5` from the 2026-05-12 wallet sample is now a tested fixture for the `unknown_code` branch.** When BLG-0029 identifies what Family C actually is, the test stays valid — only the family discriminator (and the regex bound, if needed) changes.

## Next sprint

- Type: implementation (Ready queue still non-empty: BLG-0030, BLG-0027, BLG-0028 stay Ready; BLG-0029 stays planned).
- Theme proposal: **`first-gr-adapter-expansions`** — pull BLG-0030 first (consented AADE-fixture-gated spike), then BLG-0027 + BLG-0028 (consented-fixture-gated adapters). The scope is **strictly contingent on at least one consented fixture arriving**. If no fixtures arrive, S-013 becomes a small discovery interlude documenting the fixture acquisition status and the runbook to bring them in.
- Sprint deploy step: the ADR-0015 §9.4 Supabase rotation from "Legacy HS256" back to "JWT Signing Keys (ES256)" is still pending per the S-011 plan. Schedule it in the S-013 deploy window per `docs/runbooks/rotate-supabase-jwt-signing-keys.md`.
- Out of scope: BLG-0034 (HS256 retirement) stays planned until BLG-0023 has run one full release cycle in production.
