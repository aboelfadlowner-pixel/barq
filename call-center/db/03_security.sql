-- =====================================================================
--  Abu El Fadl Call Center — RLS + grants (FOR REVIEW — NOT APPLIED ANYWHERE)
--
--  • anon (no login)          : no access to anything cc_*.
--  • signed in, not staff     : no rows, no products, cannot create orders.
--  • the active account       : read areas, customers, addresses, orders;
--                               products only through cc_list_products().
--  • writes                   : ONLY through the security-definer functions
--                               (create order / cancel / save area). No direct
--                               insert, update or delete on any cc_* table.
--  Explicit grants are included because newer Supabase projects require them
--  for Data API access. Safe to re-run (drop policy if exists + create).
-- =====================================================================

alter table public.cc_staff          enable row level security;
alter table public.cc_delivery_areas enable row level security;
alter table public.cc_customers      enable row level security;
alter table public.cc_addresses      enable row level security;
alter table public.cc_orders         enable row level security;
alter table public.cc_order_items    enable row level security;
alter table public.cc_order_events   enable row level security;

-- Start from zero (Supabase's default privileges grant ALL on new tables to anon/authenticated).
revoke all on public.cc_staff, public.cc_delivery_areas, public.cc_customers, public.cc_addresses,
              public.cc_orders, public.cc_order_items, public.cc_order_events
  from anon, authenticated, public;
revoke all on sequence public.cc_order_no_seq from anon, authenticated, public;

-- Read-only grants for signed-in users; RLS below decides which rows.
grant select on public.cc_staff, public.cc_delivery_areas, public.cc_customers, public.cc_addresses,
                public.cc_orders, public.cc_order_items, public.cc_order_events
  to authenticated;

-- Each user sees only their own staff row (the app checks it after login).
drop policy if exists cc_staff_self on public.cc_staff;
create policy cc_staff_self on public.cc_staff
  for select to authenticated using (user_id = auth.uid());

-- The active call-center account can read everything else (CONFIRMED: one shared account).
drop policy if exists cc_areas_staff_read     on public.cc_delivery_areas;
drop policy if exists cc_customers_staff_read on public.cc_customers;
drop policy if exists cc_addresses_staff_read on public.cc_addresses;
drop policy if exists cc_orders_staff_read    on public.cc_orders;
drop policy if exists cc_items_staff_read     on public.cc_order_items;
drop policy if exists cc_events_staff_read    on public.cc_order_events;
create policy cc_areas_staff_read     on public.cc_delivery_areas for select to authenticated using ((select public.cc_is_staff()));
create policy cc_customers_staff_read on public.cc_customers      for select to authenticated using ((select public.cc_is_staff()));
create policy cc_addresses_staff_read on public.cc_addresses      for select to authenticated using ((select public.cc_is_staff()));
create policy cc_orders_staff_read    on public.cc_orders         for select to authenticated using ((select public.cc_is_staff()));
create policy cc_items_staff_read     on public.cc_order_items    for select to authenticated using ((select public.cc_is_staff()));
create policy cc_events_staff_read    on public.cc_order_events   for select to authenticated using ((select public.cc_is_staff()));

-- M3: the earlier draft exposed products through a view; products are now read
-- only through cc_list_products(). Remove the draft view if a test run created it.
drop view if exists public.cc_products;

-- Functions: Postgres (and Supabase's default privileges) grant EXECUTE to
-- PUBLIC / anon on new functions — remove that, then allow signed-in users only.
-- Each function still checks the caller is the active account itself.
drop function if exists public.cc_my_role();   -- earlier draft (roles), replaced by cc_is_staff()
revoke all on function public.cc_is_staff()                                             from public, anon;
-- cc_sold_by is internal (used by the functions below); nobody calls it directly.
revoke all on function public.cc_sold_by(text)                                          from public, anon, authenticated;
revoke all on function public.cc_list_products(text, int)                               from public, anon;
revoke all on function public.cc_create_order(uuid, jsonb, jsonb, jsonb, text)          from public, anon;
revoke all on function public.cc_cancel_order(uuid, text)                               from public, anon;
revoke all on function public.cc_save_area(uuid, text, numeric, boolean)                from public, anon;

grant execute on function public.cc_is_staff()                                          to authenticated;
grant execute on function public.cc_list_products(text, int)                            to authenticated;
grant execute on function public.cc_create_order(uuid, jsonb, jsonb, jsonb, text) to authenticated;
grant execute on function public.cc_cancel_order(uuid, text)                            to authenticated;
grant execute on function public.cc_save_area(uuid, text, numeric, boolean)             to authenticated;
