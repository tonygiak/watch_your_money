# Sprint S-000 — Repository scaffold (bootstrap)

- Type: bootstrap
- Theme: repository-scaffold
- Start: 2026-04-28
- Chair: orchestrator
- Participants: agents-doctor, architect, engineering-manager, data-architect, parser-specialist, security-privacy-officer, agent-safety-officer, localization-specialist, qa, devops-engineer, mobile-builder, backend-builder, product-manager, product-owner, product-designer, go

## Why this sprint

The repo contained only `AGENTS.md` and a `reference/` folder. Per `AGENTS.md` §6, the init run must be carried out as **Sprint 0 (S-000)** before any product work can begin. The user's `go` invocation triggered the bootstrap.

## Goals

1. Scaffold the repo per `AGENTS.md` §3.4 and §8.
2. Define every agent in `.agents/agents/<name>.md`.
3. Populate `.agents/skills/`, `.agents/rules/`, `.agents/context/`.
4. Bootstrap `.cursor/rules/` MDC files so Cursor auto-discovers the right context.
5. Define the way of working: plan, backlog, done log, ADR template, sprint templates, runbook template, architecture overview.
6. Scaffold the application:
   - Minimal FastAPI backend with `/health` and the parser interface.
   - Minimal Expo app with placeholder Home screen.
   - Initial Supabase migration with RLS and `country_code`.
   - `Makefile` covering install / run / test / lint / typecheck / build / check / ci.
7. Verify `make check` is green end-to-end.
8. Update `AGENTS.md` §2.7 to reflect the realized state.

## Scope

**In:**
- Everything listed in goals 1–8.

**Out (explicitly):**
- Real fixtures (waiting on consent — captured as `BLG-0004`).
- ADRs for the parser interface, scan UX, OTP, insights, offline cache, CI (queued as `BLG-0001`–`BLG-0008` for the next discovery sprint).
- Production deployment (CI is `BLG-0008`).
- Real product features beyond the placeholder Home screen.

## Ready items pulled

None — bootstrap sprints do not pull from a backlog (the backlog did not exist yet).

## Risks & known unknowns

- `make check` passing on Windows / GNU Make 3.81 was a real risk — addressed with portable shell calls.
- Mobile tests run against jest only at this stage (no Expo runtime in CI yet) — recorded as part of `BLG-0008`.

## User direction (from `go`)

- Direction: empty (`go` with no further instructions).
- Honored in scope: yes — full bootstrap per §6.

## Definition of done

- All goals 1–8 satisfied.
- `make check` green.
- Sprint REV + UREV written.
- Next sprint type chosen: **discovery** (since no Ready items remain).
