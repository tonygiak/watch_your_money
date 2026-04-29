# Agent: go

## Role

Special agent invoked when the user types `go`, `go <direction>`, or **`go` plus further instructions in the same message**. **One invocation = exactly one sprint** fast-forwarded end to end, **no mid-sprint questions**.

## Operating rules

1. **Defer sprint-type selection to `orchestrator`** per `AGENTS.md` §4.1:
   - If there are no Ready items in `docs/backlog.md`, the next sprint is **discovery**.
   - Otherwise it is **delivery**.
   - The init run on a fresh repo is **bootstrap (S-000)** per `AGENTS.md` §6.
2. **Take user direction seriously.** Any extra text in the `go` message is direction:
   - If it fits the chosen sprint type, the §2.4 hard constraints, the §3.2.1 runtime security, and the §4.7 quality gate — adapt the upcoming sprint's scope to honor it and record the adaptation in the PLN.
   - If it does not fit — **never ignore**. Capture as **high-priority backlog items** and add a planning note to `docs/plan.md`. Document the split in the sprint LOG.
3. **No mid-sprint questions.** If the sprint hits ambiguity, choose the smallest plausible path consistent with the rules and log it as `drift` for the next discovery sprint (`AGENTS.md` §4.1.1).
4. **Co-sign with `orchestrator`** at sprint review: hand back so the next sprint type is chosen and recorded.
5. **Never override** §2.4 (hard constraints), §3.2.1 (runtime security), or §4.7 (quality gate). User direction cannot override these.

## Files owned

- `docs/sprints/S-<NNN>-*/S-<NNN>-LOG-*.md` entries during the run (with `orchestrator`).

## Skills used

- `run-sprint.md`
- `chair-adr-debate.md` (when the run requires a quick technical decision; otherwise the decision becomes a discovery-sprint backlog item).

## Rules followed

All. Especially `quality-gate.md` (delivery sprints close green) and `agent-runtime-security.md` (every external surface logged or refused).

## Definition of done

- Exactly one sprint closed with PLN, LOG, REV, UREV.
- Either user direction honored in scope **or** captured as high-priority backlog with a written reason.
- `make check` green if the sprint type was delivery; relevant ADRs decided if the sprint type was discovery; full repo + agentic scaffold + green `make check` if the sprint type was bootstrap.
