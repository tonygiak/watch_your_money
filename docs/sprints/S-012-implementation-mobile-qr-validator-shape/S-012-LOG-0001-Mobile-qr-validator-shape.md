# S-012 — Sprint LOG: Mobile QR-validator discriminated-union shape

Entries follow the audit-trail schema in `AGENTS.md` §4.9.3.

## 2026-05-12 21:30 — Sprint open

- Agent: `orchestrator` (chair) + `go`
- Action: Invoked by user via `go` with no further direction. Picked sprint type per `AGENTS.md` §4.1.1: Ready queue non-empty (BLG-0030, BLG-0027, BLG-0028, BLG-0032) → **implementation**. Three of the four are gated on consented fixtures that have not been acquired since S-011 close. Scope narrowed to BLG-0032 only — the one Ready item that ships pure on-device logic with no external surface and no fixture dependency. The S-011-close plan (`docs/plan.md` "Sizing risk") explicitly permits shipping BLG-0032's shape ahead of the backend adapters.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none (no new external surface introduced)
- Outcome: Sprint folder `docs/sprints/S-012-implementation-mobile-qr-validator-shape/` created. PLN written. LOG opened.

## 2026-05-12 21:35 — Survey + scope confirmation

- Agent: `mobile-builder` + `parser-specialist`
- Action: Re-read ADR-0014 §1 (`validateGrQrCode` discriminated-union contract), `mobile/src/parsers/gr.ts` (existing `validateGrQrUrl`), `mobile/src/screens/ScannerScreen.tsx` (camera handler), `mobile/src/api/receipts.ts` (defense-in-depth pre-flight), and `mobile/__tests__/parsers/gr.test.ts` (pinned regex source). Confirmed the back-compat constraint: `GR_VIEWER_PATH_REGEX.source` is asserted byte-for-byte in the existing test so the e-invoicing path regex cannot change.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Implementation plan locked. `validateGrQrCode` is added alongside (not replacing) `validateGrQrUrl`. The existing function becomes a delegate that narrows to the einvoicing case. Scanner gating uses a `IMPLEMENTED_FAMILIES` set so the S-013 flip to "AADE + Epsilon supported" is a one-line change.

## 2026-05-12 21:50 — Validator implementation

- Agent: `mobile-builder`
- Action: Rewrote `mobile/src/parsers/gr.ts`. Added the three URL-family regex constants (`GR_AADE_HOST`/`GR_AADE_PATH`/`GR_AADE_SIG_REGEX`, `GR_EPSILON_HOST`/`GR_EPSILON_PATH_REGEX`) and the Family C placeholder `GR_UNKNOWN_HEX_CODE_REGEX = /^[0-9A-Fa-f]{12,64}$/`. Implemented `validateGrQrCode(input)` per ADR-0014 §1 — URL parse first, then family routing by hostname, then non-URL fallback to the `unknown_code` hex shape. `validateGrQrUrl` rewritten as a delegate (narrows to einvoicing on success; surfaces any other family as `host` for back-compat with `mobile/src/api/receipts.ts`).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: `mobile/src/parsers/gr.ts` ready for tests.

## 2026-05-12 21:55 — Scanner integration

- Agent: `mobile-builder`
- Action: Updated `mobile/src/screens/ScannerScreen.tsx` to import `validateGrQrCode` + the `GrQrFamily` type. Added module-level `IMPLEMENTED_FAMILIES = new Set<GrQrFamily>(["einvoicing"])` and a second-stage gate in `onBarcodeScanned`: a recognised-but-not-yet-implemented family (AADE / Epsilon / `unknown_code`) routes to the existing `QR_UNSUPPORTED` state with a dev-only `console.warn`. No reducer / state-machine change required; no new i18n strings.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Scanner consumes the discriminator. The S-013 widening to AADE + Epsilon is a one-line change to `IMPLEMENTED_FAMILIES`.

## 2026-05-12 22:00 — Test suite expansion

- Agent: `qa` + `mobile-builder`
- Action: Rewrote `mobile/__tests__/parsers/gr.test.ts`. Kept the entire pre-BLG-0032 `validateGrQrUrl` suite (8 tests) including the pinned-regex-source defense-in-depth assertion. Added 21 new tests covering: Family A accept/reject, Family B accept/mixed-case-accept/non-hex-reject/missing-SIG-reject/wrong-path-reject, Family C accept/no-index-reject/non-numeric-index-reject/wrong-path-reject, Family D placeholder accept (15-hex `45C07BD642067E5` from the 2026-05-12 wallet sample)/long-hex-accept/short-hex-reject/non-hex-reject, plus the universal rejection paths and a final family-disambiguation sanity check.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: 29 tests in `__tests__/parsers/gr.test.ts` (up from 7).

## 2026-05-12 22:05 — Quality gate

- Agent: `engineering-manager` + `qa`
- Action: Ran the direct-binary workaround documented in S-009-UREV (PowerShell `make check` quirk on the Greek folder name persists). Order: mobile tsc → mobile jest → backend pytest → backend ruff → backend mypy.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: **Green across the board.**
  - `cd mobile && npx tsc --noEmit` → 0 errors.
  - `cd mobile && npx jest --no-coverage` → 19 suites, **229 passed** (203 → 229, +26: +22 new `gr.test.ts` cases plus pre-existing +4 from S-011 scanner state).
  - `cd backend && python -m pytest` → **182 passed** (unchanged from S-011 close — no backend touched in S-012).
  - `cd backend && ruff check .` → clean.
  - `cd backend && mypy app` → 31 source files, no issues.
  - **Total: 411 tests across 21+ suites — green** (389 → 411).

## 2026-05-12 22:10 — Sprint close

- Agent: `orchestrator` + `go`
- Action: Wrote REV + UREV. Moved BLG-0032 from `docs/backlog.md` to `docs/done.md` under a new "Sprint S-012" entry. Rewrote `docs/plan.md` to point at S-013 (theme: `first-gr-adapter-expansions` once consented fixtures arrive). Updated `AGENTS.md` §2.6 with the new validator-shape capability and §2.7 with the S-012 snapshot.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Sprint closed. Handoff back to `orchestrator` per `.agents/agents/go.md` rule #4.

## 2026-05-12 22:55 — Post-sprint drift findings (project-owner consented data)

- Agent: `orchestrator` (chair) + `parser-specialist` + `mobile-builder`
- Action: Project owner provided two real Greek receipts (one AADE tameiakí, one Epsilon Net) plus explicit `AGENTS.md` §5.8.1 written consent for fixture use. Project owner also pasted the **QR-decoded URL strings** from both receipts, removing the need for any image-OCR-based interpretation. Comparing the decoded URLs against the regexes shipped in S-012 surfaced two regex-shape drifts from ADR-0014 §3:
  - **Family A AADE SIG charset.** Real SIG is `[A-Z0-9]+(\.[0-9]+)?` (uppercase Latin alphanumeric + optional `.NN` suffix); the shipped `GR_AADE_SIG_REGEX = /^[0-9A-Fa-f]+$/` rejects every real AADE QR at the first non-hex character (e.g. the `M` in `DMB23002071…`).
  - **Family B Epsilon path.** Real path is `/DocViewer/<uuid>` (RFC 4122 v4 UUID); the shipped `GR_EPSILON_PATH_REGEX = /^\/fd\/(?<hash>[A-Za-z0-9]+):(?<index>[0-9]+)$/` rejects every real Epsilon QR. The host is correct.
- Outbound hosts contacted: **none** (no AADE / Epsilon fetch performed; the QR decodes alone gave full ground truth for the validator-shape question).
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: §5.8.1 written consent from the project owner recorded verbatim in `docs/spikes/gr-qr-ground-truth-2026-05-12/findings.md`. Photos remain only in the editor's local assets folder; they are not committed to the repo.
- Outcome: Spike artifact written at `docs/spikes/gr-qr-ground-truth-2026-05-12/findings.md`. Two new Ready BLGs opened (**BLG-0035** Epsilon path regex correction; **BLG-0036** AADE SIG charset correction). `docs/plan.md` rewritten to point at S-013 with the new theme `gr-validator-drift-corrections`; the previous `first-gr-adapter-expansions` theme defers to S-014 because backend adapters still need the gated AADE / Epsilon fetches (ADR-0014 §4 ToS-review precondition unchanged). `AGENTS.md` §2.7 refreshed. None of this changes the S-012 ship — `make check` posture and the BLG-0032 implementation are unchanged. These are post-sprint planning artifacts per `AGENTS.md` §4.1.5.
