# Skill: add-endpoint

Add a new FastAPI endpoint that follows our conventions and ships with tests. Used by `backend-builder`.

## Inputs

- A Ready backlog item with acceptance criteria.
- An ADR or existing pattern for the data flow (no new architectural decisions in delivery).

## Outputs

- A route module under `backend/app/routes/`.
- Pydantic models under `backend/app/models/`.
- Service / repository code under `backend/app/services/`.
- Tests under `backend/tests/routes/`.

## Procedure

1. **Define request / response models** in `backend/app/models/` with Pydantic v2.
2. **Create the route** in `backend/app/routes/<resource>.py` using an `APIRouter`. Wire it into `backend/app/main.py`.
3. **Implement the service** in `backend/app/services/<resource>_service.py`. Keep route handlers thin.
4. **Wire Supabase access** through `backend/app/services/supabase_client.py` (already exists). Never construct ad-hoc clients.
5. **Read secrets** only from environment via `backend/app/config.py`.
6. **Write tests** in `backend/tests/routes/test_<resource>.py` covering:
   - happy path,
   - validation failure,
   - auth failure (RLS path),
   - any acceptance criterion from the backlog item.
7. **Run `make check`** locally and fix anything red.

## Required sign-offs

Per `AGENTS.md` §4.11: API contract changes need `architect` + `engineering-manager`. User-data flow changes also need `security-privacy-officer` + `agent-safety-officer`.

## Gotchas

- No global mutable state in route modules.
- All errors return a typed `ErrorResponse`; never `raise Exception(...)` to the client.
- For `e-invoicing.gr` fetches, set `response.encoding = 'utf-8'` (`localization-conventions.md`, `parser-internals.md`).
