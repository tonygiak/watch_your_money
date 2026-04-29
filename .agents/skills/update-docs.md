# Skill: update-docs

Keep documentation honestly current. Used by every agent at sprint close.

## Inputs

- The work just completed in the active sprint.

## Outputs

- Updated `README.md`, `docs/plan.md`, `docs/backlog.md`, `docs/done.md`.
- Updated `AGENTS.md` §2.6 (shipped features) and §2.7 (sprint snapshot) when applicable.
- Updated runbooks under `docs/runbooks/`.
- Updated architecture pages under `docs/architecture/`.

## Procedure

1. **Backlog → done**: move every completed `BLG-*` from `docs/backlog.md` to `docs/done.md`. Group `done.md` entries by sprint, newest on top.
2. **Plan**: rewrite `docs/plan.md` with the next sprint's focus (chosen by `orchestrator`).
3. **AGENTS.md §2.7**: update snapshot date, current sprint, just completed, last delivered to users, next sprint.
4. **AGENTS.md §2.6**: append any user-visible feature shipped this sprint (concise titles only).
5. **Runbooks**: update or add runbooks for any new operation (deploy, rotate, refresh fixtures).
6. **Architecture**: update if structure changed (new layer, new adapter, new flow).
7. **README.md**: ensure setup, run, test, and deploy instructions are accurate from a fresh clone.

## Gotchas

- `done.md` is **append-only**; never delete entries.
- Keep `AGENTS.md` under the ~800-line soft cap; push detail into `.agents/` first (`agents-doctor.md`).
- Never paste secrets, OTPs, or PII into docs (`secrets-only-via-env.md`, `agent-runtime-security.md` §3).
