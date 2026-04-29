# Done

Append-only ledger of everything **completed**, grouped by sprint, newest on top. When an item completes, **move** it from `docs/backlog.md` here.

---

## Sprint S-000 — Bootstrap (closed YYYY-MM-DD)

> The bootstrap sprint did not pull from `docs/backlog.md` (the backlog did not exist yet). The work below is recorded directly here as the realized scope of `AGENTS.md` §6.

- **Repository scaffold** — `backend/`, `mobile/`, `db/`, `docs/`, `.agents/`, `.cursor/rules/` created with the structures defined in `AGENTS.md` §3.4 and §8.
- **Agentic system docs** — full `.agents/agents/`, `.agents/skills/`, `.agents/rules/`, `.agents/context/` populated per `AGENTS.md` §3.4.
- **Cursor rules** — `.cursor/rules/rules-always.mdc` plus per-agent and per-skill MDC files referencing `.agents/` content.
- **Backend** — minimal FastAPI app with `/health`, the abstract `BaseReceiptParser` interface, the GR adapter stub built on the §5.3.4 reference parser, and a passing pytest suite.
- **Mobile** — minimal Expo app shell with placeholder Home screen, i18n + format helpers, and a passing jest suite.
- **Database** — `db/migrations/0001_init.sql` creating `users`, `receipts`, `receipt_items` with `country_code` and full RLS policies under `db/policies/`.
- **Quality gate** — top-level `Makefile` with `install`, `run-backend`, `run-mobile`, `test`, `lint`, `typecheck`, `build`, `check`, `ci`. `make check` is green at sprint close.
- **Sprint artifacts** — `S-000-PLN-0001`, `S-000-LOG-0001`, `S-000-REV-0001`, `S-000-UREV-0001` under `docs/sprints/S-000-bootstrap-repository-scaffold/`.
- **AGENTS.md §2.7** — sprint snapshot updated to reflect bootstrap completion and queued discovery sprint.

Sign-offs: `agents-doctor` (structural), `architect` (technical), `engineering-manager` (quality gate), `agent-safety-officer` (no new external surface; allowlist established), `orchestrator` (sprint review).
