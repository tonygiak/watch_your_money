-- 0003_insights_rpc.sql — PostgREST RPCs for the insights endpoints.
--
-- ADR-0005 §1: aggregation math runs in Postgres, exposed as small RPC
-- functions; FastAPI orchestrates (period boundaries, response shaping).
-- ADR-0005 §2: each RPC takes `user_uuid uuid` explicitly and filters
-- `WHERE user_id = user_uuid` (the backend service-key bypasses RLS, so
-- the explicit filter IS the security boundary). The `user_uuid` is
-- always the verified JWT `sub` — never a request parameter.
--
-- Forward-only.

-- ----------------------------------------------------------------------------
-- 1. Summary RPC
--
-- Returns a single JSON object with: current window totals, previous window
-- totals, by-category list (with `untagged` bucket per ADR-0005 §6), and
-- by-merchant list. All money rendered as text via `to_char(... 'FM999...0.00')`
-- so JSON marshalling preserves two decimals.
-- ----------------------------------------------------------------------------
create or replace function public.insights_summary_for_user(
    user_uuid       uuid,
    from_date       date,
    to_date         date,
    prev_from_date  date,
    prev_to_date    date
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
    with
    current_window as (
        select
            coalesce(sum(total),     0) as total,
            coalesce(sum(vat_total), 0) as vat_total,
            count(*)                    as receipt_count
        from public.receipts
        where user_id = user_uuid
          and issue_date between from_date and to_date
    ),
    previous_window as (
        select
            coalesce(sum(total),     0) as total,
            coalesce(sum(vat_total), 0) as vat_total,
            count(*)                    as receipt_count
        from public.receipts
        where user_id = user_uuid
          and issue_date between prev_from_date and prev_to_date
    ),
    by_category as (
        select
            coalesce(business_category, 'untagged') as category,
            sum(total)                              as total,
            count(*)                                as receipt_count
        from public.receipts
        where user_id = user_uuid
          and issue_date between from_date and to_date
        group by coalesce(business_category, 'untagged')
        order by sum(total) desc, category asc
    ),
    by_merchant as (
        select
            coalesce(merchant_name, '') as merchant_name,
            sum(total)                  as total,
            count(*)                    as receipt_count
        from public.receipts
        where user_id = user_uuid
          and issue_date between from_date and to_date
        group by coalesce(merchant_name, '')
        order by sum(total) desc, merchant_name asc
        limit 25
    )
    select jsonb_build_object(
        'current', jsonb_build_object(
            'from_date',     from_date,
            'to_date',       to_date,
            'total',         to_char((select total from current_window),     'FM9999999990.00'),
            'vat_total',     to_char((select vat_total from current_window), 'FM9999999990.00'),
            'receipt_count', (select receipt_count from current_window)
        ),
        'previous', jsonb_build_object(
            'from_date',     prev_from_date,
            'to_date',       prev_to_date,
            'total',         to_char((select total from previous_window),     'FM9999999990.00'),
            'vat_total',     to_char((select vat_total from previous_window), 'FM9999999990.00'),
            'receipt_count', (select receipt_count from previous_window)
        ),
        'by_category', coalesce(
            (select jsonb_agg(jsonb_build_object(
                'category',      category,
                'total',         to_char(total, 'FM9999999990.00'),
                'receipt_count', receipt_count
            )) from by_category),
            '[]'::jsonb
        ),
        'by_merchant', coalesce(
            (select jsonb_agg(jsonb_build_object(
                'merchant_name', merchant_name,
                'total',         to_char(total, 'FM9999999990.00'),
                'receipt_count', receipt_count
            )) from by_merchant),
            '[]'::jsonb
        )
    );
$$;

revoke all on function public.insights_summary_for_user(uuid, date, date, date, date) from public;

-- ----------------------------------------------------------------------------
-- 2. Top-products RPC
--
-- Returns a JSON array of products ordered by frequency desc, total_spend
-- desc. Grouping key: `ean` when non-empty, else falls back to `description`
-- so unbarcoded items still cluster.
-- ----------------------------------------------------------------------------
create or replace function public.insights_top_products_for_user(
    user_uuid  uuid,
    from_date  date,
    to_date    date,
    limit_n    int
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
    with
    in_window as (
        select ri.*
        from public.receipt_items ri
        join public.receipts r on r.id = ri.receipt_id
        where r.user_id = user_uuid
          and r.issue_date between from_date and to_date
    ),
    grouped as (
        select
            case when coalesce(ean, '') = '' then ''       else ean         end as ean,
            min(description)                                                as description,
            count(*)                                                        as frequency,
            sum(total_value)                                                as total_spend,
            case
                when sum(quantity) > 0 then sum(total_value) / sum(quantity)
                else 0
            end                                                             as average_unit_price
        from in_window
        group by case when coalesce(ean, '') = '' then 'desc:' || description else ean end
        order by count(*) desc, sum(total_value) desc, min(description) asc
        limit greatest(coalesce(limit_n, 10), 1)
    )
    select coalesce(
        jsonb_agg(jsonb_build_object(
            'ean',                ean,
            'description',        description,
            'frequency',          frequency,
            'total_spend',        to_char(total_spend,        'FM9999999990.00'),
            'average_unit_price', to_char(average_unit_price, 'FM9999999990.00')
        )),
        '[]'::jsonb
    )
    from grouped;
$$;

revoke all on function public.insights_top_products_for_user(uuid, date, date, int) from public;
