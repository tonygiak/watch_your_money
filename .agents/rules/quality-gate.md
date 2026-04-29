# Rule: Quality gate (`make check` is the line)

`make check` is the **definition of done** for a delivery sprint (`AGENTS.md` §4.7). Bootstrap and discovery sprints must also leave it green when the work touches code.

## What `make check` runs

- Backend: install (idempotent) → lint → typecheck → unit + integration tests → fixture-driven parser tests at 100% accuracy.
- Mobile: lint → typecheck → unit tests.
- Aggregates a non-zero exit code on any failure.

## Rules

- **Never weaken a failing test to make it pass.** A failing parser fixture is a `drift` backlog item; the test stays red until parsing is fixed.
- **Never `git commit` over a red `make check` at sprint close.** `orchestrator` blocks sprint review until green.
- **Never silence type or lint errors with blanket ignores.** Targeted ignores require a comment explaining why.

## On red `make check` at sprint start

Per the failure-mode matrix (`AGENTS.md` §4.10):

- Stop new work.
- Open `BLG-*` titled "make-check-red".
- The next sprint is automatically a delivery sprint scoped only to "make it green".

Owner: `qa` + `engineering-manager`. Always-on.
