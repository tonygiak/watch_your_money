-- RLS policies for public.users.
--
-- A user can read and update their own row. Inserts come from Supabase Auth
-- triggers; we do not allow client-side inserts on this table from the mobile
-- anon role.

drop policy if exists users_self_select on public.users;
create policy users_self_select
    on public.users
    for select
    using (id = auth.uid());

drop policy if exists users_self_update on public.users;
create policy users_self_update
    on public.users
    for update
    using (id = auth.uid())
    with check (id = auth.uid());
