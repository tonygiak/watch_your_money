-- RLS policies for public.receipts.
--
-- A user reads, inserts, updates, and deletes only their own receipts.
-- The mobile client uses the Supabase anon key under `auth.uid()`.
-- The backend service key bypasses RLS only inside parser ingestion paths
-- that have already authenticated the calling user.

drop policy if exists receipts_self_select on public.receipts;
create policy receipts_self_select
    on public.receipts
    for select
    using (user_id = auth.uid());

drop policy if exists receipts_self_insert on public.receipts;
create policy receipts_self_insert
    on public.receipts
    for insert
    with check (user_id = auth.uid());

drop policy if exists receipts_self_update on public.receipts;
create policy receipts_self_update
    on public.receipts
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists receipts_self_delete on public.receipts;
create policy receipts_self_delete
    on public.receipts
    for delete
    using (user_id = auth.uid());
