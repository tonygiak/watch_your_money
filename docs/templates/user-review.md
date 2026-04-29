# Template: User review (`UREV`)

File path: `docs/sprints/S-<NNN>-<sprint-type>-<short-title>/S-<NNN>-UREV-0001-<short-title>.md`.

The user review is always required. For delivery sprints it tells the human how to verify shipped work end-to-end. For discovery sprints it tells the human how to review decisions and Ready items before any code is written.

```
# Sprint S-<NNN> — User review

## Where we are right now
<one-paragraph summary, also reflected in AGENTS.md §2.7>

## What changed
- <bullet>

## How to verify (delivery sprints)
1. <action — e.g. "run `make run-backend` and `make run-mobile`">
2. <action — e.g. "scan a real Greek receipt with Expo Go">
3. <expected result>

## How to review (discovery sprints)
1. Read the new ADRs under `docs/adr/`.
2. Read the Ready items in `docs/backlog.md`.
3. Confirm the sprint plan in `docs/plan.md` reflects what comes next.

## Where to look next
- `AGENTS.md` §2.6 — shipped features
- `AGENTS.md` §2.7 — current sprint snapshot
- `docs/plan.md` — next sprint
- `docs/backlog.md` — what's planned / in-progress
- `docs/done.md` — what has been completed (newest on top)
```
