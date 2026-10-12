-- =====================================================================
--  ROLLBACK — removes ONLY the call-center objects (cc_*).
--  ⚠️ Deletes all call-center customers, addresses, orders and areas.
--  Does not touch products_master, dc_stock_levels or any other existing table.
--  Run only with explicit approval.
-- =====================================================================
begin;
drop function if exists public.cc_save_area(uuid, text, numeric, boolean);
drop function if exists public.cc_cancel_order(uuid, text);
drop function if exists public.cc_create_order(uuid, text, jsonb, jsonb, jsonb, text);
drop function if exists public.cc_list_products(text, int);
drop function if exists public.cc_sold_by(text);
drop view     if exists public.cc_products;
drop table    if exists public.cc_order_events, public.cc_order_items, public.cc_orders,
                        public.cc_addresses, public.cc_customers, public.cc_delivery_areas;
drop function if exists public.cc_my_role();   -- after the tables whose policies use it
drop table    if exists public.cc_staff;
drop sequence if exists public.cc_order_no_seq;
commit;
