# Rule: Row Level Security required on every Supabase table

Every Supabase table that holds user-scoped data **must** have Row Level Security (RLS) enabled, with policies tied to `auth.uid()`. No exceptions.

## Required pattern

For each user-scoped table:

1. `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
2. Explicit `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies that compare `auth.uid()` to the row's `user_id` (directly or via join).
3. Migrations live in `db/migrations/`, policies in `db/policies/`. Both are owned by `data-architect` and reviewed by `security-privacy-officer`.

## Mobile client

- The mobile app uses the **anon key only**. The service key never reaches the device.
- All reads/writes from the mobile client go through RLS-protected tables.
- The backend may use the service key — but only for parser ingestion paths that have already authenticated the calling user.

## Tests

- A migration is incomplete until a test confirms RLS denies cross-user access.
- `qa` enforces this in `make check`.

Owner: `data-architect` + `security-privacy-officer`. Always-on. See `AGENTS.md` §2.4 and §5.4.5.
