-- =====================================================================
--  ROLLBACK — removes ONLY the call-center objects (cc_*).
--  ⚠️ Deletes all call-center customers, addresses, orders and areas.
--  Does not touch products_master, dc_stock_levels or any other existing table.
--  Run only with explicit approval.
-- =====================================================================
begin;
drop function if exists public.cc_send_out(uuid, text);
drop function if exists public.cc_ack_edit(uuid);
drop function if exists public.cc_edit_order(uuid, uuid, jsonb, jsonb, text);
drop function if exists public.cc_set_stage(uuid, text);
drop function if exists public.cc_prep_orders();
drop function if exists public.cc_set_staff(uuid, text, boolean);
drop function if exists public.cc_list_staff();
drop function if exists public.cc_list_categories();
drop function if exists public.cc_join_with_code(text);
drop function if exists public.cc_signup_code_status();
drop function if exists public.cc_set_signup_code(text);
drop function if exists public.cc_code_hash(text, text);
drop function if exists public.cc_sale_unit_status();
drop function if exists public.cc_place_order(uuid, uuid, jsonb, jsonb, jsonb, text);
drop function if exists public.cc_cancel_order_as(uuid, uuid, text);
drop function if exists public.cc_save_agent(uuid, text, boolean);
drop function if exists public.cc_require_agent(uuid);
drop function if exists public.cc_save_area(uuid, text, numeric, boolean);
drop function if exists public.cc_cancel_order(uuid, text);
drop function if exists public.cc_create_order(uuid, jsonb, jsonb, jsonb, text);
drop function if exists public.cc_create_order(uuid, text, jsonb, jsonb, jsonb, text);  -- earlier draft
drop function if exists public.cc_list_products(text, int);
drop function if exists public.cc_sold_by(text);
drop view     if exists public.cc_products;
drop table    if exists public.cc_product_sale_unit, public.cc_sync_status, public.cc_settings, public.cc_join_attempts,
                        public.cc_categories, public.cc_product_categories;
drop table    if exists public.cc_order_stage_events, public.cc_order_edits;
drop table    if exists public.cc_order_events, public.cc_order_items, public.cc_orders, public.cc_agents,
                        public.cc_addresses, public.cc_customers, public.cc_delivery_areas;
drop function if exists public.cc_is_staff();  -- after the tables whose policies use it
drop function if exists public.cc_is_admin();
drop function if exists public.cc_my_role();   -- earlier draft
drop table    if exists public.cc_staff;
drop sequence if exists public.cc_order_no_seq;
commit;
