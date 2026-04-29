# Rule: Code conventions (Python + TypeScript)

Pragmatic, idiomatic, readable, testable.

## Python (backend)

- Python **3.11+**.
- Format with `ruff format`. Lint with `ruff check`. Type-check with `mypy`.
- Pydantic v2 models for all request/response shapes.
- Functions over classes when state isn't required.
- No untyped `dict` flying through the parser; use Pydantic models.
- File layout: `backend/app/<domain>/<file>.py`. Tests mirror the layout under `backend/tests/`.
- Imports are sorted by ruff's `I` rule; no relative imports beyond one level.
- Do not catch `Exception` to "keep tests green" — surface the failure (see `quality-gate.md`).

## TypeScript / React Native (mobile)

- TypeScript **strict** mode.
- Format with `prettier`. Lint with `eslint`.
- Functional components with hooks; no class components.
- All Supabase access through a single `mobile/src/lib/supabase.ts` module.
- Localized strings live in `mobile/src/lib/i18n.ts`; no inline Greek/English text in screens.
- Tests live next to source as `*.test.ts(x)` or under `mobile/__tests__/`.

## SQL (db)

- Migrations are forward-only, numbered (`0001_init.sql`, `0002_*.sql`, …).
- Every table that holds user data has RLS (`rls-required.md`).
- Every receipt-bearing table carries `country_code` (`country-agnostic-schema.md`).

## Naming

- snake_case in Python and SQL.
- camelCase in TypeScript variables; PascalCase for components and types.
- File names: kebab-case for skill / rule / context docs, PascalCase for React components, snake_case for Python modules.

## Comments

- Comments explain **why**, not **what**.
- No commit-message-as-comment ("// added on 2026-04-28").

Owner: `engineering-manager`. Always-on.
