# Sprint S-000 — Log

## 2026-04-28 23:55 — sprint kickoff
- Agent: orchestrator
- Action: User invoked `go` on a fresh repo (only `AGENTS.md` and `reference/` present, no commits). Selected sprint type **bootstrap (S-000)** per `AGENTS.md` §6 — this is the only legal first sprint.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none yet
- Sensitive approvals: none
- Outcome: PLN written, scope locked.

## 2026-04-28 23:58 — repo scaffold
- Agent: agents-doctor
- Action: Created `backend/`, `mobile/`, `db/`, `docs/`, `.agents/`, `.cursor/rules/` skeletons per `AGENTS.md` §3.4 and §8.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: directory tree in place.

## 2026-04-29 00:00 — agentic system docs
- Agent: agents-doctor
- Action: Wrote `.agents/rules/*.md` (8 always-on rules), `.agents/agents/*.md` (17 agents covering the §3.3 roster), `.agents/skills/*.md` (10 starter runbooks), `.agents/context/*.md` (architecture, stack, parser-internals, decisions, outbound-allowlist).
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: agentic knowledge base populated.

## 2026-04-29 00:08 — Cursor MDC bootstrap
- Agent: agents-doctor
- Action: Wrote `.cursor/rules/rules-always.mdc` (always-apply, references all rules) plus per-agent and per-skill MDC files. Always-apply agents: `product-owner`, `product-manager`, `orchestrator`, `engineering-manager`, `security-privacy-officer`, `agent-safety-officer`, `localization-specialist`. Other agents and all skills are file-glob-scoped.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: Cursor will auto-discover the right context per file.

## 2026-04-29 00:12 — way-of-working docs
- Agent: product-manager
- Action: Authored `docs/templates/{backlog-item,adr,sprint-plan,sprint-log,sprint-review,user-review,runbook}.md`. Wrote `docs/plan.md`, `docs/backlog.md` (BLG-0001 … BLG-0008), `docs/done.md`, `docs/architecture/overview.md`, `docs/adr/README.md`. All schemas trace to `AGENTS.md` §4.9.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: way-of-working docs ready; backlog seeded for S-001.

## 2026-04-29 00:16 — backend scaffold
- Agent: backend-builder + parser-specialist
- Action: Wrote `backend/requirements.txt`, `backend/requirements-dev.txt`, `backend/pyproject.toml` (ruff + mypy + pytest config), `backend/app/{__init__,config,main}.py`, `backend/app/routes/health.py`, `backend/app/services/supabase_client.py`, `backend/app/parsers/{__init__,base,registry}.py`, `backend/app/parsers/gr/{__init__,url,parser}.py`. Tests: `backend/tests/conftest.py`, `routes/test_health.py`, `parsers/test_gr_url.py`, `parsers/test_gr_parser.py`, `parsers/test_registry.py`. Wrote `backend/.env.sample` and `backend/tests/fixtures/receipts/README.md`.
- Outbound hosts contacted: none (no live HTTP — parser tests use in-memory HTML)
- MCP tools invoked: none
- Dependencies added: fastapi==0.115.6, uvicorn[standard]==0.32.1, pydantic==2.10.3, requests==2.32.3, beautifulsoup4==4.12.3, supabase==2.10.0, python-dotenv==1.0.1; dev: pytest==8.3.4, pytest-cov==6.0.0, ruff==0.8.4, mypy==1.13.0, types-requests==2.32.0.20241016, types-beautifulsoup4==4.12.0.20241020.
- Sensitive approvals: agent-safety-officer + engineering-manager — pinned versions, lock file (pip's resolver uses requirements-dev.txt as the source of truth at this stage; a proper lock will land with CI in `BLG-0008`).
- Outcome: 13 backend tests passing.

## 2026-04-29 00:18 — mobile scaffold
- Agent: mobile-builder + localization-specialist
- Action: Wrote `mobile/package.json`, `mobile/tsconfig.json` (strict, excludes `src/screens/**` for the bootstrap), `mobile/jest.config.js`, `mobile/src/lib/{format,i18n}.ts`, `mobile/__tests__/lib/{format,i18n}.test.ts`, `mobile/src/screens/HomeScreen.tsx` (placeholder, excluded from typecheck until Expo is wired in S-002), `mobile/.env.sample`.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: typescript@5.6.3, jest@29.7.0, ts-jest@29.2.5, @types/jest@29.5.14.
- Sensitive approvals: agent-safety-officer + engineering-manager — minimal devDependencies only; React Native / Expo runtime deps are explicitly deferred to a delivery sprint behind an ADR.
- Outcome: 11 mobile tests passing.

## 2026-04-29 00:19 — database scaffold
- Agent: data-architect + security-privacy-officer
- Action: Wrote `db/migrations/0001_init.sql` (users, receipts, receipt_items with `country_code`, indexes, `(user_id, mark)` uniqueness), `db/policies/{users,receipts,receipt_items}.sql` (explicit `auth.uid()`-based RLS for select/insert/update/delete), `db/README.md`.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: data-architect + security-privacy-officer — RLS on every user-scoped table; country_code from day one.
- Outcome: schema and policies ready; live application is queued for `BLG-0008`.

## 2026-04-29 00:20 — quality gate
- Agent: engineering-manager + devops-engineer
- Action: Wrote `Makefile` (install, run-backend, run-mobile, test, lint, typecheck, build, check, ci, clean) cross-platform via `OS` detection. Set `PYTHONUTF8=1`, `PIP_NO_COLOR=1`, `PIP_PROGRESS_BAR=off` to defeat cp1252 rendering on the Greek-named cwd. Wrote `.gitignore` and a comprehensive `README.md`.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: `make check` now wraps install + lint + typecheck + test for backend + mobile.

## 2026-04-29 00:25 — make check verification
- Agent: orchestrator + qa
- Action: Ran `make -f Makefile check` end-to-end. Documented Windows quirk: GNU Make 3.81 mingw32 cannot find a default `Makefile` when the cwd path contains non-ASCII characters; mitigation captured in README. Fixed two `UP037` ruff lint findings (redundant string forward-references). Verified ruff, mypy, pytest, jest, tsc all green.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: none
- Outcome: **`make check`: green.** 13 backend tests + 11 mobile tests pass.

## 2026-04-29 00:28 — sprint close
- Agent: orchestrator
- Action: Wrote sprint REV + UREV. Updated `AGENTS.md` §2.6 (no user-visible features yet) and §2.7 (snapshot reflects bootstrap closed). Picked next sprint type: **discovery (S-001)** — Ready queue is empty and the first set of ADRs (parser interface, scan UX, OTP, insights, offline cache, CI) must be debated before any implementation sprint can pull Ready items.
- Outbound hosts contacted: none
- MCP tools invoked: none
- Dependencies added: none
- Sensitive approvals: agents-doctor (structural), architect (technical), engineering-manager (quality gate), agent-safety-officer (no new external surface; allowlist established), orchestrator (sprint review).
- Outcome: sprint S-000 closed green.
