# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-012 (implementation, `mobile-qr-validator-shape`)** has just closed. **BLG-0032 shipped solo** — the smallest plausible Ready item not gated on consented fixtures, per `.agents/agents/go.md` rule #3 ("no mid-sprint questions").

- **BLG-0032 — Mobile `validateGrQrCode` discriminated-union mirror.** `mobile/src/parsers/gr.ts` rewritten end-to-end per ADR-0014 §1. New exported function `validateGrQrCode(input: string)` returns a discriminated union over Family A (`einvoicing` → `{ uuid, token }`), Family B (`aade` → `{ sig }`), Family C (`epsilon` → `{ hash, index }`), and the Family C placeholder (`unknown_code` → plain 12–64-hex strings, awaiting BLG-0029 to identify the cash-register / fiscal-system origin). The six regex constants mirror the published ADR-0014 §3 patterns verbatim; `GR_VIEWER_PATH_REGEX` is unchanged for the defense-in-depth back-compat with `mobile/__tests__/parsers/gr.test.ts`'s pinned-source assertion. `validateGrQrUrl` rewritten as a delegate narrowed to the einvoicing happy path so every existing caller (`mobile/src/api/receipts.ts`, the pre-flight in the scanner) stays byte-identical. `mobile/src/screens/ScannerScreen.tsx` consumes the discriminator and gates submission on a module-level `IMPLEMENTED_FAMILIES = new Set<GrQrFamily>(["einvoicing"])` — a one-line widening once BLG-0027 + BLG-0028 land. **Test suite: 22 new tests in `mobile/__tests__/parsers/gr.test.ts` (7 → 29) — every family branch, every rejection path, family disambiguation.**

Backlog state after S-012:

- **Ready (carried to S-013)**: BLG-0030 (XS-S, gated on consented AADE receipt), BLG-0027 (M, gated on BLG-0030), BLG-0028 (M, gated on consented Epsilon Net fixture).
- **Planned (gated)**: BLG-0029 (XS, gated on owner photo of Family C receipt), BLG-0033 (M, post-MVP), BLG-0034 (XS, gated on BLG-0023 running one production release cycle).
- **Carried**: BLG-0004, BLG-0009, BLG-0011, BLG-0014, BLG-0015 — unchanged.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 (new entry for BLG-0032) and §2.7 (updated with the S-012 close).

`make check` posture: **411 tests across 21+ suites — green** (389 → 411, +22 from the new validator suite). Mobile 229; backend 182 (unchanged from S-011 — no backend touched in S-012).

## Next sprint

- **Type**: `implementation` if at least one consented fixture has arrived by sprint open; otherwise a small `discovery` interlude documenting fixture acquisition status and the operator runbook.
- **Theme**: **`first-gr-adapter-expansions`** — BLG-0030 (AADE HTML-shape spike) lands first since it gates BLG-0027; BLG-0027 (AADE limited-info adapter) and BLG-0028 (Epsilon Net full-SKU adapter) ship next. The mobile validator from S-012 already has the shape — only `mobile/src/screens/ScannerScreen.tsx#IMPLEMENTED_FAMILIES` widens.
- **Number**: **S-013**.
- **Why implementation (conditional)**: §4.1.2 — Ready queue is non-empty (BLG-0030 / 0027 / 0028 all Ready). The conditional on fixture acquisition is the §5.8.1 consent gate, not a process gate.

### Sizing risk

BLG-0030 (XS-S) + BLG-0027 (M) + BLG-0028 (M) ≈ ~1.5 M-equivalents. The bottleneck remains **consented-fixture acquisition** — same as at S-011 close. If no AADE fixture arrives, BLG-0030 + BLG-0027 stay parked; if no Epsilon fixture arrives, BLG-0028 stays parked. The fallback is a small discovery interlude that records the fixture-acquisition status and refines the operator runbook for re-attempting acquisition (e.g. project-owner sweeps a wallet sample with §5.8.1 consent baked into the request).

### Acceptance at S-013 review

- `backend/app/parsers/gr/` re-organized as a registry-of-adapters per ADR-0014 §3: `einvoicing/`, `aade/`, `epsilon/` subpackages each exposing `parse(html_or_qr) -> ParsedReceipt`; the dispatcher in `backend/app/parsers/registry.py` routes based on QR shape (linear `can_parse` walk per ADR-0001 §5).
- `ParsedReceipt` and the `receipts` table gain `is_limited_info: bool` per ADR-0014 §2 / §4. Schema migration applied + RLS regression test.
- `docs/spikes/gr-aade-html-shape/` populated (BLG-0030); ToS / robots.txt review recorded per ADR-0014 §4.
- ≥ 1 consented AADE fixture + ≥ 1 consented Epsilon Net fixture in `backend/tests/fixtures/receipts/` with `provenance.md` per §5.8.1.
- `mobile/src/screens/ScannerScreen.tsx#IMPLEMENTED_FAMILIES` widens to include the families whose backend adapters landed.
- `make check` green; ~411 → ~430+ tests after the adapter additions land.
- `AGENTS.md` §2.6 updated with the new user-visible behavior (scanning an AADE receipt now lands in history as a limited-info receipt; scanning an Epsilon Net receipt now lands with full SKUs); §2.7 snapshot at S-013 close.

### Cadence after that

- **S-014** — likely implementation, mopping up whichever of BLG-0027 / BLG-0028 carries from S-013 plus BLG-0029 (Family C, if owner photo arrives) plus any BLGs spawned by BLG-0030's findings. If a non-trivial product decision surfaces (e.g. AADE genuinely forbids automated fetches and BLG-0027 narrows to QR-string-only mode), a small discovery interlude may be inserted between S-013 and S-014.
- **Post-MVP** — BLG-0033 (cross-source dedup) and BLG-0034 (HS256 retirement) stay parked. BLG-0034 unlocks once BLG-0023 has run one production release cycle without incident.

## Open questions for S-013

- **Consented AADE + Epsilon fixtures still missing.** If `docs/sprints/S-012-.../S-012-UREV-0001-Mobile-qr-validator-shape.md` "How to act on this" section has not produced fixtures by S-013 open, the sprint becomes either a discovery interlude or a small mop-up sprint focused on the runbook for fixture acquisition.
- **AADE ToS / robots.txt outcome.** Same open question as at S-011 close. If AADE forbids automated fetches, BLG-0027 narrows to "parse-the-QR-string-only mode" (the SIG hex becomes `mark`, merchant remains "Άγνωστος έμπορος" until a future feature). The §2.2 / §2.8 wording from ADR-0014 §6 already permits this degraded path. `agent-safety-officer` sign-off required for the first BLG-0030 fetch.
- **The 2026-05-12 `502 upstream_error` from the live device.** Still unexplained. Hypothesis remains: AADE QR misread as e-invoicing.gr by the pre-validator — but the BLG-0032 work in S-012 directly removes that ambiguity at the validator level, so the next live-device run should either reproduce the 502 against a true e-invoicing.gr URL (real bug) or no longer reproduce it (confirmed root cause). Open BLG-0035 in S-013 close if the 502 still appears.
- **Family C identification timing.** BLG-0029 is gated on the project owner sending a photo of the printed receipt + system name. The `unknown_code` placeholder in `validateGrQrCode` already classifies these scans so the on-device telemetry distinguishes them from "malformed" — that lets us measure how often Family C actually appears in the wild without needing the identification step first.
- **Supabase JWT-key rotation timing.** Per `docs/runbooks/rotate-supabase-jwt-signing-keys.md`, rotation back to ES256 should still be scheduled within the next deploy window now that BLG-0023 is live and ≥ 95 % covered. The HS256-transitional path stays active for ≥ one full release cycle post-rotation; BLG-0034 retires it.

## Notes for whoever picks this up

- **`IMPLEMENTED_FAMILIES` is the one-line switch.** S-013's mobile-side work for BLG-0027 + BLG-0028 is: add `"aade"` and `"epsilon"` (or just `"aade"`, or just `"epsilon"`, depending on which adapter lands first) to the set in `mobile/src/screens/ScannerScreen.tsx`. No reducer change, no UX change, no i18n change.
- **`validateGrQrUrl` is intentionally narrower than `validateGrQrCode`.** Keep it that way until BLG-0027 + BLG-0028 land. `mobile/src/api/receipts.ts` uses it as the e-invoicing-only pre-flight; widening it before the backend adapters exist would let AADE / Epsilon URLs round-trip a backend 422 with `UnsupportedQrUrl`, which is a worse UX than the on-device "unsupported provider" toast.
- **The `unknown_code` placeholder shape is locked.** When BLG-0029 identifies Family C, the test `classifies a plain 15-hex-char string as `unknown_code`` in `mobile/__tests__/parsers/gr.test.ts` keeps passing — only the family discriminator (and possibly the regex bound, if the identified format is narrower) changes.
- **ADR-0014 §3 + ADR-0001 §5 stay locked.** S-013's backend work is registry-of-adapters plus the `is_limited_info` migration — no ADR change.
- **PowerShell `make check` quirk persists** with the Greek folder name. Direct binary invocations (`ruff check`, `mypy`, `pytest`, `tsc`, `jest`) remain the documented workaround.
- **`NODE_EXTRA_CA_CERTS` workaround from S-009 is still in force.** Per-developer-machine; not committed; documented in `S-009-UREV-0001`.
- **The S-005 / S-007 / S-008 / S-009 / S-010 / S-011 ADRs stay locked.** ADR-0001 (parser interface) is *populated* by ADR-0014 but not superseded — the contract holds verbatim. ADR-0002 §1 is *superseded* by ADR-0015; ADR-0002 §6 is *amended* by ADR-0016.
