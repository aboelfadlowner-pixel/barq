-- =====================================================================
--  Abu El Fadl Call Center — schema (FOR REVIEW — NOT APPLIED ANYWHERE)
--
--  Adds new cc_* objects only. Does NOT alter, drop or write to any
--  existing table. products_master and dc_stock_levels are only read (inside
--  cc_list_products, cc_create_order and cc_sold_by).
--
--  Apply 01 + 02 + 03 together in ONE transaction (see apply_cc.sql), so a
--  failure leaves nothing behind and no table is ever visible without RLS.
--  Safe to re-run: every statement is "if not exists" / "or replace".
-- =====================================================================

-- Preflight: stop before creating anything if this is not the expected database.
do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise exception 'auth.uid() غير موجود — ده مش مشروع Supabase. وقف التطبيق.';
  end if;
  if to_regclass('public.products_master') is null then
    raise exception 'جدول products_master غير موجود. وقف التطبيق.';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'products_master'
         and column_name in ('sku', 'name', 'barcode', 'price')) <> 4 then
    raise exception 'products_master ناقصه عمود من (sku, name, barcode, price). وقف التطبيق.';
  end if;
  -- Storage Unit from the DC sheet decides "sold by weight" (read only).
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'dc_stock_levels'
         and column_name in ('sku', 'unit')) <> 2 then
    raise exception 'جدول dc_stock_levels (sku, unit) غير موجود — مصدر «وحدة التخزين». وقف التطبيق.';
  end if;
end $$;

create sequence if not exists public.cc_order_no_seq start 1001;

-- Staff accounts (CONFIRMED: ONE shared call-center account, no roles — it can
-- do everything: orders, cancel, delivery areas). A row links to a Supabase Auth
-- user; the password lives in Supabase Auth only. "active = false" locks it out.
create table if not exists public.cc_staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Delivery areas and fees (managed from the app).
create table if not exists public.cc_delivery_areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(btrim(name)) between 1 and 80),
  fee        numeric(10,2) not null check (fee >= 0),
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Customers: one row per main mobile number (normalized 01xxxxxxxxx).
-- phone2 is optional and intentionally NOT unique (see review note L6).
create table if not exists public.cc_customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 120),
  phone      text not null unique check (phone ~ '^0[0-9]{8,10}$'),
  phone2     text check (phone2 is null or phone2 ~ '^0[0-9]{8,10}$'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists cc_customers_phone2_idx on public.cc_customers (phone2);

-- Address length limits (L5). cc_create_order checks the same limits first and
-- returns a clear Arabic message; these constraints are the last line of defence.
create table if not exists public.cc_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cc_customers(id),
  area_id     uuid not null references public.cc_delivery_areas(id),
  label        text not null,                    -- اسم العنوان: البيت، الشغل، …
  street       text not null,                    -- الشارع (and building number, written by the call center)
  housing_type text,                             -- نوع السكن (optional)
  notes        text,                             -- معلومات إضافية: floor, flat, landmark, …
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  updated_at   timestamptz,
  updated_by   uuid references auth.users(id),
  constraint cc_addresses_label_len    check (char_length(btrim(label)) between 1 and 40),
  constraint cc_addresses_street_len   check (char_length(btrim(street)) between 1 and 150),
  constraint cc_addresses_housing_type check (housing_type is null or housing_type in ('apartment', 'villa', 'house', 'office', 'shop')),
  constraint cc_addresses_notes_len    check (notes is null or char_length(notes) <= 200)
);
create index if not exists cc_addresses_customer_idx on public.cc_addresses (customer_id);

-- Orders. Customer, address, fee and prices are copied in (snapshots), so a
-- later price change in the sheet or an address edit never alters an order.
create table if not exists public.cc_orders (
  id                uuid primary key default gen_random_uuid(),
  order_no          text not null unique default ('CC-' || nextval('public.cc_order_no_seq')),
  client_request_id uuid not null unique,          -- idempotency key: one draft = one order
  created_at        timestamptz not null default now(),
  created_by        uuid not null references auth.users(id),
  created_by_name   text not null,
  payment_method    text not null default 'cash' check (payment_method = 'cash'),
  status            text not null default 'new' check (status in ('new', 'cancelled')),

  customer_id       uuid not null references public.cc_customers(id),
  customer_name     text not null,
  customer_phone    text not null,                -- number used for this order
  customer_phone2   text,                         -- second number, if any

  address_id        uuid references public.cc_addresses(id),
  area_id           uuid not null references public.cc_delivery_areas(id),
  area_name         text not null,
  address_label     text not null,
  street            text not null,
  housing_type      text,
  address_notes     text,

  delivery_fee      numeric(10,2) not null check (delivery_fee >= 0),
  subtotal          numeric(12,2) not null check (subtotal >= 0),
  total             numeric(12,2) not null check (total >= 0),
  is_estimated      boolean not null,               -- true when any line is sold by weight
  note              text check (note is null or length(note) <= 300),

  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users(id),
  cancelled_by_name text,
  cancel_reason     text,
  constraint cc_orders_cancel_consistent check (
    (status = 'cancelled') = (cancelled_at is not null and cancel_reason is not null)
  )
);
create index if not exists cc_orders_created_idx  on public.cc_orders (created_at desc);
create index if not exists cc_orders_phone_idx    on public.cc_orders (customer_phone, created_at desc);
create index if not exists cc_orders_customer_idx on public.cc_orders (customer_id);

-- Order lines: exactly one of qty (by piece) or weight_grams (by weight).
create table if not exists public.cc_order_items (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.cc_orders(id) on delete cascade,
  line_no      int  not null,
  sku          text not null,
  product_name text not null,
  unit_price   numeric(12,2) not null check (unit_price >= 0),   -- price per piece, or per kg when weighed
  qty          int  check (qty between 1 and 999),
  weight_grams int  check (weight_grams between 10 and 20000),
  line_total   numeric(12,2) not null check (line_total >= 0),
  note         text check (note is null or length(note) <= 120),
  constraint cc_order_items_one_measure check ((qty is null) <> (weight_grams is null)),
  unique (order_id, line_no)
);

-- Status history (new / cancelled), shown in order details.
create table if not exists public.cc_order_events (
  id       bigint generated always as identity primary key,
  order_id uuid not null references public.cc_orders(id) on delete cascade,
  status   text not null check (status in ('new', 'cancelled')),
  at       timestamptz not null default now(),
  by       uuid references auth.users(id),
  by_name  text,
  reason   text
);
create index if not exists cc_order_events_order_idx on public.cc_order_events (order_id, at);
