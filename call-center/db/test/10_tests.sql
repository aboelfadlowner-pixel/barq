-- =====================================================================
--  Call-center tests — TEST PROJECT / LOCAL SANDBOX ONLY.
--  Each block switches to a role (anon / agent / supervisor / outsider)
--  and raises "FAIL ..." if a rule is broken, or prints "PASS ...".
-- =====================================================================

-- T01 — no login: nothing is readable or callable
begin;
set local role anon;
do $$ begin
  begin perform 1 from public.cc_orders limit 1;    raise exception 'FAIL T01 anon read cc_orders';    exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_customers limit 1; raise exception 'FAIL T01 anon read cc_customers'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_products limit 1;  raise exception 'FAIL T01 anon read cc_products';  exception when insufficient_privilege then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', '{}', '{}', '[]');
        raise exception 'FAIL T01 anon create order'; exception when insufficient_privilege then null; end;
  raise notice 'PASS T01 anon has no access';
end $$;
rollback;

-- T02 — signed in but not staff: sees no rows, cannot create orders
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'outsider@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.cc_products) <> 0 then raise exception 'FAIL T02 outsider sees products'; end if;
  if (select count(*) from public.cc_delivery_areas) <> 0 then raise exception 'FAIL T02 outsider sees areas'; end if;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', '{}', '{}', '[{"sku":"T-201","qty":1}]');
        raise exception 'FAIL T02 outsider created order'; exception when insufficient_privilege then null; end;
  raise notice 'PASS T02 non-staff user is blocked';
end $$;
rollback;

-- T03 — agent sees products without cost/margin
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.cc_products) < 5 then raise exception 'FAIL T03 agent cannot see products'; end if;
  if exists (select 1 from information_schema.columns where table_name = 'cc_products' and column_name in ('cost', 'margin')) then
    raise exception 'FAIL T03 cost/margin exposed'; end if;
  raise notice 'PASS T03 agent reads products (no cost/margin)';
end $$;
rollback;

-- T04 — agent creates an order; prices come from the database, sent prices are ignored
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare o public.cc_orders; area uuid;
begin
  select id into area from public.cc_delivery_areas where name = 'منطقة اختبار 1';
  o := public.cc_create_order(
    'aaaaaaaa-0000-0000-0000-000000000001', 'whatsapp',
    '{"name":"عميل اختبار","phone":"01011112222"}',
    json_build_object('area_id', area, 'street', 'شارع اختبار', 'building', '5', 'landmark', 'بجوار الاختبار')::jsonb,
    '[{"sku":"T-104","weight_grams":500,"price":1,"note":"شرائح"},
      {"sku":"T-201","qty":2,"price":1,"unit_price":1}]',
    'اتصل قبل الوصول');
  if o.subtotal <> 164.00 then raise exception 'FAIL T04 subtotal % (expected 164.00)', o.subtotal; end if;
  if o.delivery_fee <> 20.00 or o.total <> 184.00 then raise exception 'FAIL T04 fee/total % / %', o.delivery_fee, o.total; end if;
  if not o.is_estimated then raise exception 'FAIL T04 weighted order not marked estimated'; end if;
  if o.order_no not like 'CC-%' then raise exception 'FAIL T04 order number %', o.order_no; end if;
  if (select line_total from public.cc_order_items where order_id = o.id and sku = 'T-104') <> 80.00 then
    raise exception 'FAIL T04 weight line (500 g × 160/kg should be 80.00)'; end if;
  if (select count(*) from public.cc_order_events where order_id = o.id) <> 1 then raise exception 'FAIL T04 history'; end if;
  raise notice 'PASS T04 order % created: 500 g = 80.00, 2 × 42 = 84.00, fee 20, total 184.00', o.order_no;
end $$;
commit;

-- T05 — the same draft submitted twice creates ONE order
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare o1 public.cc_orders; o2 public.cc_orders; before int; area uuid;
begin
  select count(*) into before from public.cc_orders;
  select id into area from public.cc_delivery_areas where name = 'منطقة اختبار 1';
  o2 := public.cc_create_order(
    'aaaaaaaa-0000-0000-0000-000000000001', 'phone',
    '{"name":"اسم مختلف","phone":"01099998888"}',
    json_build_object('area_id', area, 'street', 'x', 'building', '1')::jsonb,
    '[{"sku":"T-203","qty":9}]');
  select * into o1 from public.cc_orders where client_request_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if o2.id <> o1.id then raise exception 'FAIL T05 duplicate order created'; end if;
  if (select count(*) from public.cc_orders) <> before then raise exception 'FAIL T05 order count changed'; end if;
  if exists (select 1 from public.cc_customers where phone = '01099998888') then raise exception 'FAIL T05 customer created by repeat'; end if;
  raise notice 'PASS T05 repeat submit returned the same order %', o1.order_no;
end $$;
commit;

-- T06 — agent cannot cancel, edit areas, or write tables directly
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare oid uuid;
begin
  select id into oid from public.cc_orders where client_request_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin perform public.cc_cancel_order(oid, 'test'); raise exception 'FAIL T06 agent cancelled'; exception when insufficient_privilege then null; end;
  begin perform public.cc_save_area(null, 'منطقة الموظف', 10, true); raise exception 'FAIL T06 agent saved area'; exception when insufficient_privilege then null; end;
  begin update public.cc_orders set total = 1 where id = oid; raise exception 'FAIL T06 agent updated order'; exception when insufficient_privilege then null; end;
  begin insert into public.cc_customers (name, phone) values ('x', '01000000000'); raise exception 'FAIL T06 agent inserted customer'; exception when insufficient_privilege then null; end;
  begin delete from public.cc_orders where id = oid; raise exception 'FAIL T06 agent deleted order'; exception when insufficient_privilege then null; end;
  raise notice 'PASS T06 agent cannot cancel, edit areas or write tables directly';
end $$;
rollback;

-- T07 — invalid input is rejected and nothing is saved
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare before int; cust uuid; addr uuid; off_area uuid;
begin
  select count(*) into before from public.cc_orders;
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into addr from public.cc_addresses where customer_id = cust limit 1;
  select id into off_area from public.cc_delivery_areas where not active limit 1;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-104","qty":1,"weight_grams":500}]'); raise exception 'FAIL T07 qty+weight accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-104","weight_grams":5}]'); raise exception 'FAIL T07 5 g accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"NOPE","qty":1}]'); raise exception 'FAIL T07 unknown sku accepted';
  exception when no_data_found then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), 'sms', json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-201","qty":1}]'); raise exception 'FAIL T07 bad source accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', json_build_object('id', cust)::jsonb,
          json_build_object('area_id', off_area, 'street', 's', 'building', '1')::jsonb,
          '[{"sku":"T-201","qty":1}]'); raise exception 'FAIL T07 inactive area accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', '{"name":"مكرر","phone":"01011112222"}',
          json_build_object('id', addr)::jsonb, '[{"sku":"T-201","qty":1}]'); raise exception 'FAIL T07 duplicate phone accepted';
  exception when unique_violation then null; end;
  if (select count(*) from public.cc_orders) <> before then raise exception 'FAIL T07 a rejected order was saved'; end if;
  raise notice 'PASS T07 bad quantity/weight, unknown sku, bad source, inactive area, duplicate phone rejected';
end $$;
rollback;

-- T08 — existing customer + saved address; zero-price product allowed
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare o public.cc_orders; cust uuid; addr uuid;
begin
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into addr from public.cc_addresses where customer_id = cust limit 1;
  o := public.cc_create_order('aaaaaaaa-0000-0000-0000-000000000002', 'phone',
         json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
         '[{"sku":"T-900","qty":1},{"sku":"T-203","qty":3}]');
  if o.subtotal <> 27.00 or o.is_estimated then raise exception 'FAIL T08 totals % / %', o.subtotal, o.is_estimated; end if;
  if (select count(*) from public.cc_addresses where customer_id = cust) <> 1 then raise exception 'FAIL T08 address duplicated'; end if;
  raise notice 'PASS T08 repeat customer, saved address, zero-price line = 0.00';
end $$;
commit;

-- T09 — price changes in the sheet do not change existing orders (test data only)
begin;
update public.products_master set price = 999 where sku = 'T-104';
do $$ begin
  if (select line_total from public.cc_order_items i join public.cc_orders o on o.id = i.order_id
       where o.client_request_id = 'aaaaaaaa-0000-0000-0000-000000000001' and i.sku = 'T-104') <> 80.00 then
    raise exception 'FAIL T09 old order changed after price update'; end if;
  raise notice 'PASS T09 order keeps the price it was created with';
end $$;
rollback;

-- T10 — supervisor: cancel needs a reason, works once, and is recorded
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'supervisor@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare o public.cc_orders; oid uuid;
begin
  select id into oid from public.cc_orders where client_request_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  begin perform public.cc_cancel_order(oid, '  '); raise exception 'FAIL T10 empty reason accepted';
  exception when invalid_parameter_value then null; end;
  o := public.cc_cancel_order(oid, 'العميل لغى');
  if o.status <> 'cancelled' or o.cancel_reason <> 'العميل لغى' then raise exception 'FAIL T10 not cancelled'; end if;
  if (select count(*) from public.cc_order_events where order_id = oid) <> 2 then raise exception 'FAIL T10 history'; end if;
  begin perform public.cc_cancel_order(oid, 'مرة تانية'); raise exception 'FAIL T10 cancelled twice';
  exception when no_data_found then null; end;
  raise notice 'PASS T10 supervisor cancel with reason, once, recorded';
end $$;
commit;

-- T11 — supervisor manages areas; agent sees the result
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'supervisor@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare a public.cc_delivery_areas;
begin
  a := public.cc_save_area(null, 'منطقة اختبار 2', 25, true);
  a := public.cc_save_area(a.id, 'منطقة اختبار 2', 27.5, true);
  if a.fee <> 27.50 then raise exception 'FAIL T11 fee update'; end if;
  begin perform public.cc_save_area(null, 'سالبة', -1, true); raise exception 'FAIL T11 negative fee';
  exception when invalid_parameter_value then null; end;
  raise notice 'PASS T11 supervisor adds and edits areas';
end $$;
commit;

begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.cc_delivery_areas where name = 'منطقة اختبار 2' and fee = 27.50) then
    raise exception 'FAIL T11 agent cannot see new area'; end if;
  raise notice 'PASS T11b agent sees the updated area';
end $$;
rollback;
