# Skill: add-migration

Add a forward-only Supabase migration with RLS coverage. Used by `data-architect`.

## Inputs

- A Ready backlog item describing the schema change.
- An ADR (or existing decision) for any non-trivial change.

## Outputs

- A new migration file `db/migrations/<NNNN>_<short_name>.sql`.
- Updated / new RLS policies under `db/policies/` if the change touches user-scoped data.
- A test under `backend/tests/db/` (or equivalent) that verifies RLS denies cross-user access where applicable.

## Procedure

1. **Pick the next number**: highest existing `db/migrations/<NNNN>_*` + 1, zero-padded to 4 digits.
2. **Write the migration**:
   - DDL only; idempotent where reasonable (`IF NOT EXISTS`).
   - For new user-scoped tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
   - Include `country_code TEXT NOT NULL DEFAULT 'GR'` on every receipt-bearing table (`country-agnostic-schema.md`).
   - Add indexes the access pattern requires (e.g. `(user_id, issue_date)` on `receipts`).
3. **Write or update RLS policies** in `db/policies/<table>.sql`:
   - explicit `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies tied to `auth.uid()`.
4. **Apply locally** (or in CI) and verify:
   - migration applies cleanly on a fresh DB,
   - RLS denies cross-user access in tests.
5. **Update** `docs/architecture/data-model.md` if the change is structural.

## Required sign-offs

Per `AGENTS.md` §4.11: schema migration / new RLS policy → `data-architect` + `security-privacy-officer`. Auth-flow change → `security-privacy-officer` + `data-architect`.

## Forbidden

- Down-migrations (we move forward — `code-conventions.md` SQL).
- User-scoped tables without RLS (`rls-required.md`).
- Hardcoded `'GR'` outside the country resolution layer (`country-agnostic-schema.md`).
