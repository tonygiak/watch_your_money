# Sprint S-008 — PLN (Plan)

- Type: discovery
- Theme: `sdk-upgrade-path-forward`
- Number: S-008
- Date opened: 2026-05-08
- Chair: orchestrator

## Why this sprint exists

BLG-0016 (Expo SDK 51 → 54 upgrade) was deferred for the **third sprint running** in S-007. Both install attempts hit `UNABLE_TO_VERIFY_LEAF_SIGNATURE` against `registry.npmjs.org` for the SDK 54 tree — TLS certificate chain validation failing on the host environment. The rules ruled out (a) `strict-ssl=false` and (b) third-party registry mirror mid-sprint. Per `AGENTS.md` §4.10, a third deferral on the same outbound surface triggers an `agent-safety-officer`-led discovery sprint.

Per `AGENTS.md` §4.1.1 ("No new architectural decisions in a delivery sprint") and §4.4 ("All meaningful decisions are recorded as ADRs after a real multi-round debate"), the path forward is a chaired discovery sprint that settles the question before the next implementation attempt.

## Goals

1. **Chair a multi-round ADR debate** (per `AGENTS.md` §4.4) covering the three options identified in `S-007-REV-0001`: (a) fix the host TLS/CA environment, (b) amend ADR-0012 §1 toward EAS dev client / TestFlight, (c) split-into-two-upgrade approach. The chair is `orchestrator`; participants are `agent-safety-officer`, `architect`, `engineering-manager`, `mobile-builder`, `devops-engineer`.
2. **Produce ADR-0013** (or an ADR-0012 amendment per `AGENTS.md` §4.4 supersession rules) with a decision that makes BLG-0016 executable in S-009 — no fourth deferral on the same outbound surface.
3. **Clarify BLG-0014** (chart-kit re-eval): does it ride along with the chosen upgrade path, or stay passive?
4. **Update backlog and done** to reflect BLG-0022 complete and BLG-0016 unblocked.

## Scope

**In scope for S-008:**

- BLG-0022 — the discovery debate itself.
- ADR-0013 (or ADR-0012 amendment).
- Backlog / done / plan / `AGENTS.md` §2.7 updates.
- BLG-0014 disposition (ride-along or remain passive — recorded in the ADR).

**Not in scope for S-008:**

- No production code changes of any kind.
- BLG-0004 (real-receipt fixtures), BLG-0009 (drift-detection CI), BLG-0011 (language switch), BLG-0015 (live insights-RPC integration test) — all remain unchanged pending the supply-chain footprint of the S-009 upgrade.
- The actual `npm install --fix` / `expo-doctor` run — that is S-009 implementation.

## Participants

| Agent | Role in this sprint |
|---|---|
| `orchestrator` | Chair — opens debate, drives rounds, records ADR |
| `agent-safety-officer` | Lead on supply-chain implications of every option |
| `architect` | Technical position on each option |
| `engineering-manager` | Engineering-quality bar for the chosen path |
| `mobile-builder` | Executor's read on feasibility |
| `devops-engineer` | Build / signing / distribution implications |

## Definition of done

- `docs/adr/S-008-ADR-0013-*.md` (or ADR-0012 amendment) exists, is accepted, and records: chair, participants, multi-round positions, recorded dissent (if any), final decision, supply-chain implications co-signed by `agent-safety-officer`.
- BLG-0016 in `docs/backlog.md` updated from "Ready, deferred + escalated" to "Ready, executable per ADR-0013."
- BLG-0022 moved to `docs/done.md`.
- `docs/plan.md` updated for S-009.
- `AGENTS.md` §2.7 updated.
- `make check` green (no production code changes in this sprint — should be identical to S-007 close: 346 tests).
