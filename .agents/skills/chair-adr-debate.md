# Skill: chair-adr-debate

Procedure used by `orchestrator` to chair a multi-round ADR debate per `AGENTS.md` §4.4.

## Inputs

- The decision to be made (problem statement, constraints, prior ADRs).
- The list of relevant agents.

## Outputs

- One `S-<NNN>-ADR-<CCCC>-<title>.md` under `docs/adr/` (and a copy or link in the active sprint folder).

## Procedure

1. **Open the debate**. Post a one-paragraph problem statement and invite the relevant agents (e.g. for parser ADRs: `parser-specialist`, `architect`, `data-architect`, `qa`; for new external surfaces: add `agent-safety-officer`).
2. **Round 1**. Each agent posts position + reasoning + concerns.
3. **Round 2+**. Each round addresses concerns raised in the previous round. Run rounds until either:
   - consensus emerges, or
   - new concerns stop arriving and dissent is captured.
4. **Apply the tie-breaker priority** if consensus fails (`AGENTS.md` §4.4):
   1. Hard constraints (§2.4).
   2. Runtime security (§3.2.1).
   3. `architect` (technical) or `product-owner` (product).
   4. Recorded majority of relevant agents.
5. **Check sign-offs** required for the change kind (`AGENTS.md` §4.11). If a co-sign is missing, do not close.
6. **Write the ADR** using `docs/templates/adr.md`:
   - Status, date, chair (orchestrator), participants.
   - Context, rounds, decision, dissent, consequences.
7. **Add follow-ups** to `docs/backlog.md` as `BLG-*` items.

## Minimum runtime

- **At least two rounds** of cross-agent reply for any decision that crosses agent boundaries.
- Single round is allowed only when the decision is uncontested **and** the ADR records that explicitly.

## Gotchas

- Dissent is recorded **verbatim** — do not paraphrase it away.
- ADRs that introduce new external surfaces (new MCP server, new outbound host, new dependency, new data flow) require co-sign by `agent-safety-officer`.
