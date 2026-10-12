-- =====================================================================
--  Call-center tests — TEST PROJECT / LOCAL SANDBOX ONLY.
--  Each block switches to a role (anon / agent / supervisor / outsider)
--  and raises "FAIL ..." if a rule is broken, or prints "PASS ...".
--  Guard: every block first checks the CC_TEST_STUB tag and stops otherwise;
--  setup statements before a block (T09, T12, T14) are inside begin…rollback.
-- =====================================================================

-- T01 — no login: nothing is readable or callable
begin;
set local role anon;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform 1 from public.cc_orders limit 1;    raise exception 'FAIL T01 anon read cc_orders';    exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_customers limit 1; raise exception 'FAIL T01 anon read cc_customers'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_staff limit 1;     raise exception 'FAIL T01 anon read cc_staff';     exception when insufficient_privilege then null; end;
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
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if (select count(*) from public.cc_delivery_areas) <> 0 then raise exception 'FAIL T02 outsider sees areas'; end if;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', '{}', '{}', '[{"sku":"T-201","qty":1}]');
        raise exception 'FAIL T02 outsider created order'; exception when insufficient_privilege then null; end;
  raise notice 'PASS T02 non-staff user is blocked';
end $$;
rollback;

-- T03 — products: staff only, 4 columns only, keyset pages of at most 1,000 (M3)
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n1 int; n2 int; n3 int; n4 int; last1 text; last2 text; total int; cols text;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select count(*) into total from public.cc_list_products(null, 1000);
  if total < 5 then raise exception 'FAIL T03 agent sees % products', total; end if;
  select count(*), max(sku) into n1, last1 from public.cc_list_products(null, 2);
  select count(*), max(sku) into n2, last2 from public.cc_list_products(last1, 2);
  select count(*) into n3 from public.cc_list_products(last2, 2);
  if n1 <> 2 or n2 <> 2 or last2 <= last1 then raise exception 'FAIL T03 paging % % % %', n1, n2, last1, last2; end if;
  if n1 + n2 + n3 <> total then raise exception 'FAIL T03 pages do not add up (% + % + % <> %)', n1, n2, n3, total; end if;
  select count(*) into n4 from public.cc_list_products(null, 5000);
  if n4 > 1000 then raise exception 'FAIL T03 limit not capped'; end if;
  select pg_get_function_result('public.cc_list_products(text,int)'::regprocedure) into cols;
  if cols ~* 'cost|margin' then raise exception 'FAIL T03 cost/margin exposed: %', cols; end if;
  raise notice 'PASS T03 products: % rows, pages 2+2+%, result columns = %', total, n3, cols;
end $$;
rollback;

begin;
set local role anon;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform * from public.cc_list_products(null, 10); raise exception 'FAIL T03b anon listed products';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_products limit 1; raise exception 'FAIL T03b old view still exists';
  exception when undefined_table then null; end;
  raise notice 'PASS T03b anon cannot list products; old cc_products view is gone';
end $$;
rollback;

begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'outsider@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform * from public.cc_list_products(null, 10); raise exception 'FAIL T03c outsider listed products';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T03c signed-in non-staff cannot list products';
end $$;
rollback;

-- T04 — agent creates an order; prices come from the database, sent prices are ignored
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare o public.cc_orders; area uuid;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
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
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
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
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
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
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
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
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
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
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
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
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
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
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
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
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if not exists (select 1 from public.cc_delivery_areas where name = 'منطقة اختبار 2' and fee = 27.50) then
    raise exception 'FAIL T11 agent cannot see new area'; end if;
  raise notice 'PASS T11b agent sees the updated area';
end $$;
rollback;

-- T12 — duplicated sku in products_master (M4): not listed, cannot be ordered (test data only, rolled back)
begin;
alter table public.products_master drop constraint products_master_pkey;
insert into public.products_master (sku, name, price) values ('T-201', 'لبن مكرر (تجريبي)', 99);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare cust uuid; addr uuid;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if exists (select 1 from public.cc_list_products(null, 1000) where sku = 'T-201') then
    raise exception 'FAIL T12 duplicated sku is listed'; end if;
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into addr from public.cc_addresses where customer_id = cust limit 1;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', json_build_object('id', cust)::jsonb,
          json_build_object('id', addr)::jsonb, '[{"sku":"T-201","qty":1}]');
        raise exception 'FAIL T12 order with duplicated sku accepted';
  exception when sqlstate 'P0003' then null; end;
  raise notice 'PASS T12 duplicated sku hidden from the list and rejected with a clear message';
end $$;
rollback;

-- T13 — address length limits with clear messages and field hints (L5)
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare cust uuid; area uuid; msg text; hnt text; f record;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into area from public.cc_delivery_areas where name = 'منطقة اختبار 1';
  for f in select * from (values
      ('street', repeat('ش', 151)), ('building', repeat('1', 31)), ('floor', repeat('1', 21)),
      ('apartment', repeat('1', 21)), ('landmark', repeat('ع', 151)), ('notes', repeat('م', 201)), ('street', '   ')
    ) as t(field, val) loop
    begin
      perform public.cc_create_order(gen_random_uuid(), 'phone', json_build_object('id', cust)::jsonb,
        (json_build_object('area_id', area, 'street', 'شارع', 'building', '1')::jsonb) || jsonb_build_object(f.field, f.val),
        '[{"sku":"T-203","qty":1}]');
      raise exception 'FAIL T13 % with % chars accepted', f.field, char_length(f.val);
    exception when invalid_parameter_value then
      get stacked diagnostics msg = message_text, hnt = pg_exception_hint;
      if hnt <> f.field then raise exception 'FAIL T13 hint % for field %', hnt, f.field; end if;
    end;
  end loop;
  begin perform public.cc_create_order(gen_random_uuid(), 'phone', '{"name":"عميل","phone":"0123"}',
          json_build_object('area_id', area, 'street', 'ش', 'building', '1')::jsonb, '[{"sku":"T-203","qty":1}]');
        raise exception 'FAIL T13 bad phone accepted';
  exception when invalid_parameter_value then get stacked diagnostics hnt = pg_exception_hint;
        if hnt <> 'phone' then raise exception 'FAIL T13 phone hint %', hnt; end if; end;
  raise notice 'PASS T13 too-long / empty address fields and bad phone rejected (last message: %)', msg;
end $$;
rollback;

-- T14 — a deactivated staff account loses access immediately
begin;
update public.cc_staff set active = false where user_id = (select id from auth.users where email = 'agent@cc.test');
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if (select count(*) from public.cc_orders) <> 0 then raise exception 'FAIL T14 inactive agent reads orders'; end if;
  begin perform * from public.cc_list_products(null, 10); raise exception 'FAIL T14 inactive agent lists products';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T14 deactivated account sees nothing';
end $$;
rollback;

-- T15 — agent cannot promote itself (no write path to cc_staff)
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'agent@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin update public.cc_staff set role = 'supervisor' where user_id = auth.uid(); raise exception 'FAIL T15 agent updated own role';
  exception when insufficient_privilege then null; end;
  begin insert into public.cc_staff (user_id, display_name, role) values (auth.uid(), 'x', 'supervisor'); raise exception 'FAIL T15 agent inserted staff row';
  exception when insufficient_privilege then null; end;
  if public.cc_my_role() <> 'agent' then raise exception 'FAIL T15 role changed'; end if;
  raise notice 'PASS T15 agent cannot change its own role';
end $$;
rollback;

-- T16 — every cc_* function is SECURITY DEFINER with an empty search_path; anon cannot execute any (L1)
do $$
declare bad text;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select string_agg(p.proname, ', ') into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'cc\_%'
     and (not p.prosecdef or p.proconfig is null or not ('search_path=""' = any(p.proconfig))
          or has_function_privilege('anon', p.oid, 'execute'));
  if bad is not null then raise exception 'FAIL T16 %', bad; end if;
  raise notice 'PASS T16 all cc_* functions: SECURITY DEFINER, search_path empty, no anon EXECUTE';
end $$;
