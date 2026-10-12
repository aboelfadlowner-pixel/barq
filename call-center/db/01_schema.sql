-- =====================================================================
--  Abu El Fadl Call Center — schema (FOR REVIEW — NOT APPLIED ANYWHERE)
--
--  Adds new cc_* objects only. Does NOT alter, drop or write to any
--  existing table. products_master is only read (through cc_products
--  and inside cc_create_order).
-- =====================================================================

create sequence if not exists public.cc_order_no_seq start 1001;

-- Staff accounts (CONFIRMED: two accounts — agent and supervisor).
-- Rows link to Supabase Auth users; passwords live in Supabase Auth only.
create table if not exists public.cc_staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role         text not null check (role in ('agent', 'supervisor')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Delivery areas and fees (managed by the supervisor from the app).
create table if not exists public.cc_delivery_areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(btrim(name)) between 1 and 80),
  fee        numeric(10,2) not null check (fee >= 0),
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Customers: one row per mobile number (normalized 01xxxxxxxxx).
create table if not exists public.cc_customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 120),
  phone      text not null unique check (phone ~ '^0[0-9]{8,10}$'),
  phone2     text check (phone2 is null or phone2 ~ '^0[0-9]{8,10}$'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index if not exists cc_customers_phone2_idx on public.cc_customers (phone2);

create table if not exists public.cc_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cc_customers(id),
  area_id     uuid not null references public.cc_delivery_areas(id),
  street      text not null check (length(btrim(street)) > 0),
  building    text not null check (length(btrim(building)) > 0),
  floor       text,
  apartment   text,
  landmark    text,
  notes       text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
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
  source            text not null check (source in ('phone', 'whatsapp', 'facebook')),
  payment_method    text not null default 'cash' check (payment_method = 'cash'),
  status            text not null default 'new' check (status in ('new', 'cancelled')),

  customer_id       uuid not null references public.cc_customers(id),
  customer_name     text not null,
  customer_phone    text not null,

  address_id        uuid references public.cc_addresses(id),
  area_id           uuid not null references public.cc_delivery_areas(id),
  area_name         text not null,
  street            text not null,
  building          text not null,
  floor             text,
  apartment         text,
  landmark          text,
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
