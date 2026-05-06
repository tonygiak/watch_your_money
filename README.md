# Greek e-receipt finance app

A self-evolving, agent-built personal-finance mobile app for Greek consumers and freelancers. Captures **SKU-level** receipt data from Greek **e-invoice QR codes** with zero OCR — backed by a country-agnostic schema and a pluggable parser so RO/IT/PT/ES adapters can be added without disturbing the core.

> **Read this first:** the project is governed by `[AGENTS.md](./AGENTS.md)`. For the latest user-facing snapshot, jump to **§2.6** (shipped features) and **§2.7** (current sprint).

## Status

The project is at the end of **Sprint S-000 (bootstrap)**. The repo is fully scaffolded, the agentic system is in place, the migration + RLS are in `db/`, the backend exposes a healthcheck, the mobile app has Greek-first formatting helpers — and `make check` is green. The next sprint is **discovery (S-001)** to finalize the parser interface and the first set of Ready backlog items. See `[docs/plan.md](./docs/plan.md)`.

## Repository layout

```
backend/   FastAPI service (Python 3.11+). Pluggable parsers under app/parsers/<cc>/.
mobile/    Expo / React Native client (TypeScript strict).
db/        Supabase migrations and RLS policies (forward-only).
docs/      Plan, backlog, done log, ADRs, sprints, runbooks, templates, architecture.
.agents/   The agentic system: agents (WHO), skills (HOW), rules (WHAT), context (WHY).
.cursor/   Cursor MDC files mirroring .agents/ for auto-discovery.
Makefile   Quality gate: install / run / test / lint / typecheck / build / check / ci.
```

See `[AGENTS.md` §8](./AGENTS.md) for full layout details.

## Prerequisites

- **Python 3.11+** (3.12 works).
- **Node.js 20 or 22** with **npm 10+**.
- **GNU Make** (3.81+).
- A real **Android / iOS device with Expo Go** for QR scanning (kicks in once Expo is wired in S-002).

## Getting started

```bash
make install         # creates backend/.venv, installs Python deps, runs npm install for mobile
make check           # the green-or-red contract; runs install + lint + typecheck + test
```

> **Windows note**: GNU Make 3.81 (mingw32) cannot locate the default `Makefile` when the cwd path contains non-ASCII characters (e.g. the Greek folder name `Υπολογιστής`). The fix is to pass `-f Makefile` explicitly, e.g. `make -f Makefile check`. Upgrading to a newer Make build also resolves it. POSIX users are unaffected.

## Day-to-day commands


| Command            | What it does                                                                            |
| ------------------ | --------------------------------------------------------------------------------------- |
| `make install`     | Install backend (.venv + pip) and mobile (npm) deps.                                    |
| `make run-backend` | Start FastAPI dev server on port 8000 (`/health` is the smoke test).                    |
| `make run-mobile`  | Start the mobile app (full Expo wiring lands in S-002).                                 |
| `make test`        | Run backend + mobile tests.                                                             |
| `make lint`        | Run ruff (backend) + eslint (mobile, configured in S-002).                              |
| `make typecheck`   | Run mypy (backend) + tsc --noEmit (mobile).                                             |
| `make check`       | Definition of done: install + lint + typecheck + test. **Sprint close requires green.** |
| `make ci`          | Alias for `make check`.                                                                 |
| `make clean`       | Remove caches, venv, and node_modules.                                                  |


## How the agentic system works (in 60 seconds)

- The `**AGENTS.md`** file is the entry point — mission, hard constraints, sprint flow, schemas, sign-offs.
- The `**.agents/`** folder is the canonical knowledge base. Four sub-folders with one responsibility each:
  - `agents/` (WHO), `skills/` (HOW), `rules/` (WHAT), `context/` (WHY).
- The `**.cursor/rules/`** folder mirrors `.agents/` as MDC files so Cursor auto-discovers the right context for the file you're editing.
- The `**go`** command runs **exactly one sprint** end-to-end. Type `go` (or `go <direction>`) in a Cursor agent chat. After the sprint, read `[AGENTS.md` §2.7](./AGENTS.md) and the latest `docs/sprints/S-<NNN>-`* folder to see what changed.

## Running the backend manually

```bash
make install
make run-backend
# In another shell:
curl http://localhost:8000/health
```

## Configuration

Environment variables (never committed). See `backend/.env.sample` and `mobile/.env.sample`.


| Variable               | Where            | Why                                             |
| ---------------------- | ---------------- | ----------------------------------------------- |
| `SUPABASE_URL`         | backend + mobile | Supabase project URL                            |
| `SUPABASE_SERVICE_KEY` | **backend only** | Server-side privileged access (never on device) |
| `SUPABASE_ANON_KEY`    | **mobile only**  | RLS-gated client access                         |
| `BACKEND_API_URL`      | mobile           | URL of the FastAPI service                      |
| `EINVOICING_BASE_URL`  | backend          | Defaults to `https://e-invoicing.gr`            |


## Hard constraints (do not bypass)

From `[AGENTS.md` §2.4](./AGENTS.md):

- **No OCR.** Structure comes from the e-invoicing infrastructure.
- **No third-party paid services** beyond Supabase + Railway/Render + the official `e-invoicing.gr` endpoint.
- **RLS on every user-scoped table**, tied to `auth.uid()`.
- **No country-specific schema lock-in** — `country_code` from day one.
- **No hard-coded secrets** — environment variables only.

## License

TBD — captured as a backlog item in the next discovery sprint.