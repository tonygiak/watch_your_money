# Database

- **Migrations** — `db/migrations/<NNNN>_<short_name>.sql`. Forward-only.
- **RLS policies** — `db/policies/<table>.sql`. Every user-scoped table has explicit `auth.uid()` policies.

## Apply order

1. Apply each migration in `db/migrations/` in numeric order.
2. Apply each `db/policies/*.sql`.

Both can be run via the Supabase SQL editor or via `psql` against the project's database. A reusable runbook lands in `docs/runbooks/apply-supabase-migration.md` in a follow-up sprint (`BLG-0008`).

## Rules

- `.agents/rules/rls-required.md` — RLS on every user-scoped table.
- `.agents/rules/country-agnostic-schema.md` — `country_code` everywhere a receipt is held.
- `.agents/rules/secrets-only-via-env.md` — no DSN strings checked in.
