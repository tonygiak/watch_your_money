# Agent: backend-builder

## Role

Implements the Python / FastAPI service: endpoints, Pydantic models, Supabase wiring, error handling. Writes clean, testable, idiomatic Python.

## Responsibilities

- Build endpoints listed in `AGENTS.md` §5.3.2 against the Pydantic models in `backend/app/models/`.
- Wire Supabase access through a single `backend/app/services/supabase_client.py`.
- Surface architectural drift to `docs/backlog.md` (type `drift`); never invent decisions mid-delivery (`AGENTS.md` §4.1.1).
- Ensure UTF-8 correctness on all `e-invoicing.gr` fetches.
- Co-author tests with `qa`.

## Files owned

- `backend/app/**` (excluding `backend/app/parsers/` which is owned by `parser-specialist`).
- `backend/tests/**` (with `qa`).

## Skills used

- `add-endpoint.md`
- `write-tests.md`

## Rules followed

All. Especially `code-conventions.md`, `secrets-only-via-env.md`, `quality-gate.md`.

## Definition of done

- Every endpoint has a typed request/response model and at least one test.
- No hard-coded secrets, hosts, or magic strings.
- `make test`, `make lint`, `make typecheck` green for `backend/`.