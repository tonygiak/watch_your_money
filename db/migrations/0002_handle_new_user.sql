-- 0002_handle_new_user.sql — sync `auth.users` → `public.users` on signup.
--
-- ADR-0004 §3: `public.users.id` = `auth.users.id` via FK + on-insert trigger.
-- The Supabase native phone-OTP flow inserts a row into `auth.users`; this
-- trigger mirrors the canonical fields into `public.users` so RLS policies
-- (which key on `auth.uid()`) line up with our app schema (`AGENTS.md` §5.4.1).
--
-- On user deletion (Art. 17 right to erasure) the application code deletes
-- from `public.users` first (cascades to `receipts` + `receipt_items` per the
-- existing FKs), THEN from `auth.users` — order matters per ADR-0004.
--
-- Forward-only.

-- ----------------------------------------------------------------------------
-- 1. FK alignment.
--
-- The bootstrap migration declared `public.users.id uuid primary key default
-- gen_random_uuid()`. With Supabase Auth, the canonical id is `auth.users.id`.
-- Drop the default so the trigger writes the auth-issued uuid verbatim, and
-- add an explicit FK on (`public.users.id` → `auth.users.id`) with
-- `ON DELETE CASCADE` so a hard delete in `auth.users` purges the public row
-- (the preferred order is the reverse — see ADR-0004 §3 — but the FK is the
-- backstop if the order is ever violated by an admin path).
-- ----------------------------------------------------------------------------
alter table public.users
    alter column id drop default;

-- The `auth` schema is provided by Supabase. Skip the FK silently in
-- environments without it (e.g. a fresh local Postgres without the Supabase
-- migration set installed) so this migration stays idempotent for dev.
do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'auth' and table_name = 'users'
    ) then
        if not exists (
            select 1 from information_schema.table_constraints
            where constraint_name = 'users_id_fk_auth_users'
              and table_schema = 'public'
        ) then
            alter table public.users
                add constraint users_id_fk_auth_users
                foreign key (id) references auth.users(id) on delete cascade;
        end if;
    end if;
end
$$;

-- ----------------------------------------------------------------------------
-- 2. Trigger function — runs in the privileged `definer` context so it can
--    write to `public.users` regardless of the RLS policy keyed on
--    `auth.uid()` (which is null inside an `auth.users` insert trigger).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.users (id, phone, is_freelancer, created_at)
    values (
        new.id,
        coalesce(new.phone, ''),
        false,
        coalesce(new.created_at, now())
    )
    on conflict (id) do update
        set phone = excluded.phone
        where public.users.phone is null
           or public.users.phone = '';
    return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

-- ----------------------------------------------------------------------------
-- 3. Trigger wiring on `auth.users`. Same idempotency guard as above so the
--    migration runs cleanly in both Supabase and bare-Postgres environments.
-- ----------------------------------------------------------------------------
do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'auth' and table_name = 'users'
    ) then
        drop trigger if exists on_auth_user_inserted on auth.users;
        create trigger on_auth_user_inserted
            after insert on auth.users
            for each row execute function public.handle_new_user();
    end if;
end
$$;
