# Plan

The current direction of the project and the focus of the next sprint.

## Where we are right now

Sprint **S-012 (implementation, `mobile-qr-validator-shape`)** has just closed. **BLG-0032 shipped solo** — the smallest plausible Ready item not gated on consented fixtures, per `.agents/agents/go.md` rule #3 ("no mid-sprint questions"). The new validator `validateGrQrCode(input)` returns a discriminated union over Family A (`einvoicing`), Family B (`aade`), Family C (`epsilon`), plus the Family C placeholder (`unknown_code`). `mobile/src/screens/ScannerScreen.tsx` consumes the discriminator and gates submission on a module-level `IMPLEMENTED_FAMILIES = Set(["einvoicing"])`. `make check`: **411 tests across 21+ suites — green** (389 → 411).

**Post-S-012-close, 2026-05-12 evening — drift findings from consented data.** The project owner provided two real Greek receipts (one AADE tameiakí, one Epsilon Net) under explicit `AGENTS.md` §5.8.1 consent, plus the **QR-decoded URL strings** from both. Comparing the decoded URLs against the regexes shipped in S-012 surfaced two real-world drifts from ADR-0014 §3:

1. **Family A AADE SIG charset.** Real SIG is `[A-Z0-9]+(\.[0-9]+)?` (uppercase Latin alphanumeric + optional `.NN` suffix), not hex-only. The S-012 `GR_AADE_SIG_REGEX = /^[0-9A-Fa-f]+$/` rejects every real AADE QR at the first non-hex character (e.g. the `M` in `DMB23002071…`).
2. **Family B Epsilon path.** Real path is `/DocViewer/<uuid>` (RFC 4122 v4 UUID), not `/fd/<hash>:<n>`. The S-012 `GR_EPSILON_PATH_REGEX = /^\/fd\/(?<hash>[A-Za-z0-9]+):(?<index>[0-9]+)$/` rejects every real Epsilon QR.

Both hostnames and paths-up-to-the-identifier matched ADR-0014 §3 verbatim — only the identifier-shape regexes were wrong. Full analysis + the verbatim §5.8.1 consent statement + the two consented QR-decoded URLs live at **`docs/spikes/gr-qr-ground-truth-2026-05-12/findings.md`**. **No upstream fetch was performed**; the QR decodes alone gave full ground truth for the validator-shape question. The `agent-safety-officer` + `security-privacy-officer` ToS / robots.txt review precondition from ADR-0014 §4 still gates the first AADE backend fetch; the Epsilon backend fetch still needs `agent-safety-officer` co-sign per the §4.11 outbound-host rule.

Backlog state after S-012 + the post-close findings:

- **Ready (carried to S-013)**: BLG-0035 (XS, mobile Epsilon path regex correction — no fixture gate, ground-truth captured), BLG-0036 (XS, mobile AADE SIG charset regex correction — no fixture gate, ground-truth captured).
- **Ready (still fixture-gated, carried to S-014)**: BLG-0030 (XS-S, gated on consented AADE `raw.html` + ToS review), BLG-0027 (M, gated on BLG-0030), BLG-0028 (M, gated on consented Epsilon `raw.html`).
- **Planned (gated)**: BLG-0029 (XS, gated on owner photo of Family C receipt — owner reports they cannot find one; deferred indefinitely), BLG-0033 (M, post-MVP), BLG-0034 (XS, gated on BLG-0023 running one production release cycle).
- **Carried**: BLG-0004, BLG-0009, BLG-0011, BLG-0014, BLG-0015 — unchanged.

For the latest user-facing snapshot, read `AGENTS.md` §2.6 + §2.7.

`make check` posture: **411 tests across 21+ suites — green** (unchanged from S-012 close).

## Next sprint

- **Type**: `implementation`.
- **Theme**: **`gr-validator-drift-corrections`** — pull BLG-0035 + BLG-0036 together in one PR. Both touch the same file (`mobile/src/parsers/gr.ts`), share the same test file, share one ADR-0014 §3 amendment block, and have no upstream-fetch dependency. The combined work is XS + XS ≈ S total, comfortably one sprint.
- **Number**: **S-013**.
- **Why implementation (and not discovery)**: Both BLGs sit within `parser-specialist`'s ADR-0014 §3 refinement authority per ADR-0014 §6 ("`parser-specialist` decides at BLG-0030 close … if SKU-level reachable, full-SKU adapter; if only merchant + total + date + signature, limited-info adapter") — the shape of the registry-of-adapters architecture is unchanged; only two regex constants are revised based on consented ground-truth data. No new architectural decision is taken. If the S-013 agent reads this and judges the §3 amendment crosses agent boundaries (per `AGENTS.md` §4.4), it should escalate to drift and route to a discovery interlude per §4.1.1 — but the recommendation is to ship.

### Acceptance at S-013 review

- `mobile/src/parsers/gr.ts`:
  - `GR_AADE_SIG_REGEX = /^[A-Z0-9]{1,256}(\.[0-9]+)?$/` (was `/^[0-9A-Fa-f]+$/`).
  - `GR_EPSILON_PATH_REGEX = /^\/DocViewer\/(?<uuid>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/` (was `/^\/fd\/(?<hash>[A-Za-z0-9]+):(?<index>[0-9]+)$/`).
  - `GrQrValidationOk` `epsilon` variant exposes a single `uuid` field instead of `{ hash; index }`.
- `mobile/__tests__/parsers/gr.test.ts`:
  - Family B (AADE) accept case uses the real consented SIG `DMB230020710020471523FF055EC975FA1D260A2C9674D007260427092515.00`.
  - Family C (Epsilon) accept case uses the real consented URL `https://epsilondigital-3rdpartc.epsilonnet.gr/DocViewer/99564b3c-b21f-47d0-6d4a-08deaa87277d`.
  - Reject cases keep their semantic coverage (hex-only AADE SIGs are no longer the reject target; lowercase / punctuation / oversized still are).
- `docs/adr/S-010-ADR-0014-Receipt-format-scope-expansion.md` gets one new amendment block at the bottom covering both corrections (sample text in `docs/spikes/gr-qr-ground-truth-2026-05-12/findings.md` "ADR-0014 §3 amendment" section). `parser-specialist` sign-off recorded in the S-013 sprint LOG per §4.11.
- Fixture stubs:
  - `backend/tests/fixtures/receipts/gr-aade-001/provenance.md` — verbatim §5.8.1 consent + decoded QR URL + redactions list + status `pending — BLG-0030 fetch gated; AADE ToS / robots.txt review precondition per ADR-0014 §4 still in force`.
  - `backend/tests/fixtures/receipts/gr-epsilon-001/provenance.md` — verbatim §5.8.1 consent + decoded QR URL + redactions list + status `pending — BLG-0028 fetch gated`.
  - Both folders ship **without** `raw.html` or `expected.json` in S-013.
- `make check` green; ~411 → ~414 tests after the test-case rewrites.
- `AGENTS.md` §2.6 + §2.7 updated.
- `docs/plan.md` rewritten for S-014; `docs/backlog.md` moves BLG-0035 + BLG-0036 to `docs/done.md`.

### Out of scope for S-013

- **No backend changes.** Backend adapters carry to S-014.
- **No upstream fetches.** The AADE + Epsilon hosts stay on the allowlist but are not contacted in this sprint.
- **No schema migration.** The `is_limited_info` column from ADR-0014 §2 still lands under BLG-0027 in S-014.
- **No new i18n strings, no new dependencies, no new MCP integrations.**

### Cadence after that

- **S-014** — implementation, `first-gr-adapter-expansions`. The original S-013 theme defers one sprint. BLG-0030 (AADE HTML-shape spike with `agent-safety-officer` ToS review) lands first; BLG-0027 (AADE adapter, possibly limited-info) and BLG-0028 (Epsilon adapter) follow. The mobile side is already done by S-013, so the only mobile change in S-014 is widening `IMPLEMENTED_FAMILIES` to add `"aade"` and `"epsilon"`. The fixture triplets become complete (`raw.html` + `expected.json` land alongside the existing `provenance.md`).
- **S-015+** — likely implementation, mopping up whichever of BLG-0027 / BLG-0028 carries from S-014 plus any BLGs spawned by BLG-0030's findings. BLG-0029 (Family C) remains deferred indefinitely until the owner finds a receipt of that family in the wild.
- **Post-MVP** — BLG-0033 (cross-source dedup) and BLG-0034 (HS256 retirement) stay parked.

## Open questions for S-013

- **None blocking.** Both BLGs have full ground-truth inputs captured at `docs/spikes/gr-qr-ground-truth-2026-05-12/findings.md`. No upstream fetch required, no decision to debate.
- **Light question — `mark` mapping for Epsilon receipts in S-014.** The Epsilon QR carries a `<uuid>` in the path; the slip body also prints a myDATA `MARK: <15-digit>`. ADR-0014 §3 data-architect Round 2 mapped Epsilon's URL tail to `mark`, but the myDATA MARK from the slip body is the canonical primary key across the e-invoicing.gr family. BLG-0028's first fetch will inform this decision; recorded as a follow-up in the S-014 PLN's risks list, not blocking S-013.

## Open questions for S-014 (after S-013 ships)

- **AADE ToS / robots.txt outcome.** Same open question as at S-012 close. If AADE forbids automated fetches, BLG-0027 narrows to "parse-the-QR-string-only mode" (extract `SIG` substrings, store as `mark`, merchant remains `"Άγνωστος έμπορος"` until a future feature). The §2.2 / §2.8 wording from ADR-0014 §6 already permits this degraded path. `agent-safety-officer` + `security-privacy-officer` sign-off required for the first BLG-0030 fetch.
- **The 2026-05-12 `502 upstream_error` from the live device.** Still notionally open from S-009. The most likely hypothesis (AADE QR misread as e-invoicing.gr by the pre-validator) is now ruled out structurally: the on-device discriminator from S-012 distinguishes the families pre-submission, and the S-013 regex corrections make the discrimination actually work for real receipts. If the 502 still appears in a live S-014 run, open BLG-0037 then.
- **Supabase JWT-key rotation timing.** Per `docs/runbooks/rotate-supabase-jwt-signing-keys.md`, rotation back to ES256 should still be scheduled within the next deploy window now that BLG-0023 is live. Independent of S-013 / S-014 scope.

## Notes for whoever picks this up

- **Start at `docs/spikes/gr-qr-ground-truth-2026-05-12/findings.md` after reading `AGENTS.md`.** It carries the verbatim §5.8.1 consent statement, both QR-decoded URLs, the per-segment SIG analysis, the corrected regex proposals, and the proposed ADR-0014 §3 amendment text. Everything S-013 needs as input is in that one file.
- **`IMPLEMENTED_FAMILIES` is the one-line switch for S-014.** S-013 only touches the regex shapes; the family-gate widens in S-014 when the backend adapters land.
- **`validateGrQrUrl` is intentionally narrower than `validateGrQrCode`.** Keep it that way until BLG-0027 + BLG-0028 land. `mobile/src/api/receipts.ts` uses it as the e-invoicing-only pre-flight.
- **The `unknown_code` placeholder shape is locked.** Family C is deferred; do not delete the `unknown_code` branch — keep the test that pins `45C07BD642067E5` so the structure stays in place for when the family is finally identified.
- **ADR-0014 §3 + ADR-0001 §5 stay locked.** S-013's ADR-0014 §3 amendment is a refinement of an accepted ADR (per `parser-specialist`'s §3 authority under ADR-0014 §6), not a new architectural decision. If you judge otherwise: escalate to drift per §4.10 and route to a discovery interlude.
- **PowerShell `make check` quirk persists** with the Greek folder name. Direct binary invocations (`ruff check`, `mypy`, `pytest`, `tsc`, `jest`) remain the documented workaround.
- **`NODE_EXTRA_CA_CERTS` workaround from S-009 is still in force.** Per-developer-machine; not committed; documented in `S-009-UREV-0001`.
- **The S-005 / S-007 / S-008 / S-009 / S-010 / S-011 ADRs stay locked.** ADR-0001 (parser interface) is *populated* by ADR-0014 but not superseded — the contract holds verbatim. ADR-0002 §1 is *superseded* by ADR-0015; ADR-0002 §6 is *amended* by ADR-0016.
