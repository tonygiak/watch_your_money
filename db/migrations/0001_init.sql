-- 0001_init.sql — initial schema for the Greek e-receipt finance app.
--
-- Country-agnostic by design (`country_code` from day one).
-- RLS is required on every user-scoped table; policies live in db/policies/.
--
-- Forward-only. We never write down-migrations.

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
create table if not exists public.users (
    id              uuid primary key default gen_random_uuid(),
    phone           text not null unique,
    afm             text,
    email           text,
    is_freelancer   boolean not null default false,
    created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- receipts
-- ----------------------------------------------------------------------------
create table if not exists public.receipts (
    id                       uuid primary key default gen_random_uuid(),
    user_id                  uuid not null references public.users(id) on delete cascade,
    country_code             text not null default 'GR',
    merchant_name            text,
    merchant_afm             text,
    merchant_address         text,
    document_number          text,
    mark                     text,
    uid                      text,
    authentication_code      text,
    issue_date               date,
    transmission_timestamp   timestamptz,
    payment_method           text,
    subtotal                 numeric(14,2),
    discount                 numeric(14,2),
    surcharge                numeric(14,2),
    total                    numeric(14,2),
    net_value                numeric(14,2),
    vat_total                numeric(14,2),
    provider                 text,
    raw_html                 text,
    is_business_expense      boolean not null default false,
    business_category        text,
    notes                    text,
    created_at               timestamptz not null default now(),
    constraint receipts_mark_per_user_unique unique (user_id, mark)
);

create index if not exists receipts_user_issue_date_idx
    on public.receipts (user_id, issue_date);

create index if not exists receipts_user_business_idx
    on public.receipts (user_id, is_business_expense);

-- ----------------------------------------------------------------------------
-- receipt_items
-- ----------------------------------------------------------------------------
create table if not exists public.receipt_items (
    id                  uuid primary key default gen_random_uuid(),
    receipt_id          uuid not null references public.receipts(id) on delete cascade,
    ean                 text,
    description         text not null,
    unit                text,
    quantity            numeric(14,3),
    unit_price          numeric(14,2),
    pre_discount_value  numeric(14,2),
    discount            numeric(14,2),
    vat_rate            numeric(5,2),
    total_value         numeric(14,2),
    inferred_category   text,
    inferred_brand      text,
    created_at          timestamptz not null default now()
);

create index if not exists receipt_items_receipt_idx
    on public.receipt_items (receipt_id);

create index if not exists receipt_items_ean_idx
    on public.receipt_items (ean);

-- ----------------------------------------------------------------------------
-- RLS — enable here; policies live in db/policies/.
-- ----------------------------------------------------------------------------
alter table public.users         enable row level security;
alter table public.receipts      enable row level security;
alter table public.receipt_items enable row level security;
