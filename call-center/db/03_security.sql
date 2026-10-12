-- =====================================================================
--  Abu El Fadl Call Center — RLS + grants (FOR REVIEW — NOT APPLIED ANYWHERE)
--
--  • anon (no login)          : no access to anything cc_*.
--  • active staff (any role)  : read products, areas, customers, addresses, orders.
--  • writes                   : ONLY through the security-definer functions
--                               (create order / cancel / save area). No direct
--                               insert, update or delete on any cc_* table.
--  Explicit grants are included because newer Supabase projects require them
--  for Data API access.
-- =====================================================================

alter table public.cc_staff          enable row level security;
alter table public.cc_delivery_areas enable row level security;
alter table public.cc_customers      enable row level security;
alter table public.cc_addresses      enable row level security;
alter table public.cc_orders         enable row level security;
alter table public.cc_order_items    enable row level security;
alter table public.cc_order_events   enable row level security;

-- Start from zero.
revoke all on public.cc_staff, public.cc_delivery_areas, public.cc_customers, public.cc_addresses,
              public.cc_orders, public.cc_order_items, public.cc_order_events
  from anon, authenticated, public;
revoke all on sequence public.cc_order_no_seq from anon, authenticated, public;

-- Read-only grants for signed-in users; RLS below decides which rows.
grant select on public.cc_staff, public.cc_delivery_areas, public.cc_customers, public.cc_addresses,
                public.cc_orders, public.cc_order_items, public.cc_order_events
  to authenticated;

-- Each user sees only their own staff row (the app reads its role after login).
create policy cc_staff_self on public.cc_staff
  for select to authenticated using (user_id = auth.uid());

-- Active staff (agent or supervisor) can read everything else.
create policy cc_areas_staff_read     on public.cc_delivery_areas for select to authenticated using (public.cc_my_role() is not null);
create policy cc_customers_staff_read on public.cc_customers      for select to authenticated using (public.cc_my_role() is not null);
create policy cc_addresses_staff_read on public.cc_addresses      for select to authenticated using (public.cc_my_role() is not null);
create policy cc_orders_staff_read    on public.cc_orders         for select to authenticated using (public.cc_my_role() is not null);
create policy cc_items_staff_read     on public.cc_order_items    for select to authenticated using (public.cc_my_role() is not null);
create policy cc_events_staff_read    on public.cc_order_events   for select to authenticated using (public.cc_my_role() is not null);

-- Read-only product list for the call center: code, name, barcode, price.
-- Cost and margin are deliberately NOT exposed. Active staff only.
create or replace view public.cc_products
with (security_barrier = true) as
  select sku, name, barcode, coalesce(price, 0)::numeric(12,2) as price, updated_at
    from public.products_master
   where public.cc_my_role() is not null;
revoke all on public.cc_products from anon, authenticated, public;
grant select on public.cc_products to authenticated;

-- Functions: Postgres grants EXECUTE to PUBLIC by default — remove it.
revoke all on function public.cc_my_role()                                    from public, anon;
revoke all on function public.cc_create_order(uuid, text, jsonb, jsonb, jsonb, text) from public, anon;
revoke all on function public.cc_cancel_order(uuid, text)                     from public, anon;
revoke all on function public.cc_save_area(uuid, text, numeric, boolean)      from public, anon;

grant execute on function public.cc_my_role()                                    to authenticated;
grant execute on function public.cc_create_order(uuid, text, jsonb, jsonb, jsonb, text) to authenticated;
grant execute on function public.cc_cancel_order(uuid, text)                     to authenticated;
grant execute on function public.cc_save_area(uuid, text, numeric, boolean)      to authenticated;
