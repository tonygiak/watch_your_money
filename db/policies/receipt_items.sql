-- RLS policies for public.receipt_items.
--
-- A user reads / writes only items belonging to their own receipts.
-- Joins through public.receipts to pin the parent row's user_id to auth.uid().

drop policy if exists receipt_items_self_select on public.receipt_items;
create policy receipt_items_self_select
    on public.receipt_items
    for select
    using (
        exists (
            select 1
              from public.receipts r
             where r.id = receipt_items.receipt_id
               and r.user_id = auth.uid()
        )
    );

drop policy if exists receipt_items_self_insert on public.receipt_items;
create policy receipt_items_self_insert
    on public.receipt_items
    for insert
    with check (
        exists (
            select 1
              from public.receipts r
             where r.id = receipt_items.receipt_id
               and r.user_id = auth.uid()
        )
    );

drop policy if exists receipt_items_self_update on public.receipt_items;
create policy receipt_items_self_update
    on public.receipt_items
    for update
    using (
        exists (
            select 1
              from public.receipts r
             where r.id = receipt_items.receipt_id
               and r.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1
              from public.receipts r
             where r.id = receipt_items.receipt_id
               and r.user_id = auth.uid()
        )
    );

drop policy if exists receipt_items_self_delete on public.receipt_items;
create policy receipt_items_self_delete
    on public.receipt_items
    for delete
    using (
        exists (
            select 1
              from public.receipts r
             where r.id = receipt_items.receipt_id
               and r.user_id = auth.uid()
        )
    );
