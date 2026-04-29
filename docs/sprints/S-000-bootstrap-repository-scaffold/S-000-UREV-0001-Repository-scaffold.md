# Sprint S-000 — User review

## Where we are right now

The repo went from a single `AGENTS.md` to a fully scaffolded, agent-ready project: backend boots, mobile helpers test green, the database migration + RLS policies are written, and `make check` is green end-to-end. Nothing is yet shipped to a real user — that starts in the next implementation sprint. The current snapshot is also reflected in `AGENTS.md` §2.7.

## What changed

- Full repository skeleton (`backend/`, `mobile/`, `db/`, `docs/`, `.agents/`, `.cursor/rules/`) created from scratch.
- The full agentic system is operational: 17 agent specs, 8 always-on rules, 10 starter skills, 5 context docs, all wired into Cursor MDC files.
- The first backlog (`docs/backlog.md`, BLG-0001 … BLG-0008) is queued for the next discovery sprint.
- Backend exposes `/health`. The abstract parser interface + Greek adapter are in place behind a registry; tests cover URL conversion, HTML parsing, and registry resolution.
- Mobile has Greek-first formatting helpers (EUR `X,XX €`, dates `DD-MM-YYYY`) and an English fallback; the home screen is staged for S-002.
- Supabase migration `0001_init.sql` creates `users`, `receipts`, `receipt_items` with `country_code` from day one. RLS is enabled and explicit `auth.uid()` policies are in `db/policies/`.

## How to verify (delivery checks)

This is a bootstrap sprint, so there is no end-user behavior yet. To verify the engineering scaffold from a fresh clone:

1. Install dependencies and run the green check:

   ```bash
   make -f Makefile check
   ```

   The expected last lines are `13 passed` (backend), `Tests: 11 passed` (mobile), and `make check: green`.
2. Boot the backend and hit the health endpoint:

   ```bash
   make -f Makefile run-backend
   # in another shell:
   curl http://localhost:8000/health
   ```
   You should see `{"status":"ok","version":"0.0.1"}`.
3. Inspect the agentic system: open `.agents/agents/`, `.agents/skills/`, `.agents/rules/`, `.agents/context/`. Each is reasonably small and self-contained.

> **Windows note**: GNU Make 3.81 (mingw32) misbehaves on the default Greek-named OneDrive path. Always pass `-f Makefile` explicitly. Documented in `README.md`.

## How to review (discovery items queued for S-001)

1. Read `docs/plan.md` for the S-001 theme: `receipt-parser-contract`.
2. Read `docs/backlog.md` items `BLG-0001` … `BLG-0008` to see the questions the discovery sprint will answer (parser interface, scan UX, OTP provider, insights computation, offline cache, CI).
3. Confirm `AGENTS.md` §2.7 reflects the current state.

## Where to look next

- `AGENTS.md` §2.6 — shipped features (still empty; first entries land in S-002).
- `AGENTS.md` §2.7 — current sprint snapshot.
- `docs/plan.md` — next sprint focus.
- `docs/backlog.md` — what's planned / in-progress.
- `docs/done.md` — what has been completed (newest on top).
