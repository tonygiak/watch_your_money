# Skill: run-sprint

End-to-end procedure for taking one sprint from kickoff to close. Used by `orchestrator`, `product-manager`, `go`.

## Inputs

- The current state of `docs/plan.md`, `docs/backlog.md`, `docs/done.md`.
- The previous sprint's `REV` (if any).
- For `go` invocations: the user's direction (text after `go`).

## Outputs

A complete sprint bundle under `docs/sprints/S-<NNN>-<sprint-type>-<short-title>/`:

- `S-<NNN>-PLN-0001-<title>.md`
- `S-<NNN>-LOG-0001-<title>.md`
- `S-<NNN>-REV-0001-<title>.md`
- `S-<NNN>-UREV-0001-<title>.md`
- Any ADRs (`S-<NNN>-ADR-*`), designs (`S-<NNN>-DES-*`), spikes (`S-<NNN>-SPK-*`).

## Procedure

1. **Pick the sprint type** (`orchestrator`):
   - Fresh repo → `bootstrap` (S-000 only).
   - No Ready items → `discovery`.
   - Ready items present → `implementation` (a.k.a. delivery).
2. **Number the sprint**: next zero-padded `S-<NNN>` after the highest existing folder.
3. **Choose a short kebab-case title** for the sprint theme.
4. **Create the sprint folder** under `docs/sprints/`.
5. **Write the PLN** using `docs/templates/sprint-plan.md`. Include:
   - Sprint type and theme.
   - Goals tied to mission and Ready items (or, for discovery, the questions to answer).
   - Scope (what is in / out).
   - Risks and known unknowns.
   - For `go` runs: how user direction was honored or split into backlog.
6. **Open the LOG** using `docs/templates/sprint-log.md`. Append entries per `AGENTS.md` §4.9.3 as work progresses.
7. **Run the work**:
   - **Discovery**: research, debate ADRs (`chair-adr-debate.md`), produce designs, refine backlog items to **Ready** (`AGENTS.md` §4.1.3).
   - **Implementation/Delivery**: pull Ready items, implement, write tests, keep `make check` green. Surface drift to backlog instead of inventing decisions.
   - **Bootstrap (S-000 only)**: scaffold per `AGENTS.md` §6.
8. **Close**:
   - Move completed items from `backlog.md` to `done.md`.
   - Run `make check` (skip only on pure discovery sprints with zero code).
   - Write the `REV` using `docs/templates/sprint-review.md`: outcomes, learnings, follow-ups, sign-offs per `AGENTS.md` §4.11.
   - Write the `UREV` using `docs/templates/user-review.md`: how a human verifies the work.
   - Pick the next sprint type and record it at the top of the next `PLN` (or as a "Next sprint" note in this REV).
9. **Update AGENTS.md §2.7** (and §2.6 if user-visible behavior shipped). Per `AGENTS.md` §4.1.5 and §7, this is the entry point humans read after each sprint.

## Gotchas

- Never mark a sprint "done" while `make check` is red unless the sprint is purely a discovery sprint with no code touched.
- Never expand sprint scope mid-sprint without `orchestrator` + `product-manager` co-sign (`AGENTS.md` §4.11).
- Always record outbound hosts, MCP tools, deps, and approvals in the LOG even when the lists are empty.
