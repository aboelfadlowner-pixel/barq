-- =====================================================================
--  Call-center tests — TEST PROJECT / LOCAL SANDBOX ONLY.
--  Each block switches to a user (anon / the call-center account / outsider)
--  and raises "FAIL ..." if a rule is broken, or prints "PASS ...".
--  Guard: every block first checks the CC_TEST_STUB tag and stops otherwise;
--  setup statements before a block (T09, T12, T14) are inside begin…rollback.
-- =====================================================================

-- Setup (local sandbox only): the older tests below call the core functions cc_create_order /
-- cc_cancel_order directly; on the real database only the role-checked wrappers can (10_edit_order.sql).
-- T32 checks that real setup.
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  grant execute on function public.cc_create_order(uuid, jsonb, jsonb, jsonb, text) to authenticated;
  grant execute on function public.cc_cancel_order(uuid, text) to authenticated;
end $$;

-- T01 — no login: nothing is readable or callable
begin;
set local role anon;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform 1 from public.cc_orders limit 1;    raise exception 'FAIL T01 anon read cc_orders';    exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_customers limit 1; raise exception 'FAIL T01 anon read cc_customers'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_staff limit 1;     raise exception 'FAIL T01 anon read cc_staff';     exception when insufficient_privilege then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), '{}', '{}', '[]');
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
  begin perform public.cc_create_order(gen_random_uuid(), '{}', '{}', '[{"sku":"T-201","qty":1}]');
        raise exception 'FAIL T02 outsider created order'; exception when insufficient_privilege then null; end;
  raise notice 'PASS T02 non-staff user is blocked';
end $$;
rollback;

-- T03 — products: staff only, 4 columns only, keyset pages of at most 1,000 (M3)
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n1 int; n2 int; n3 int; n4 int; last1 text; last2 text; total int; cols text;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select count(*) into total from public.cc_list_products(null, 1000);
  if total < 4 then raise exception 'FAIL T03 account sees % products', total; end if;   -- 5 in the stub, T-900 (price 0) hidden
  select count(*), max(sku) into n1, last1 from public.cc_list_products(null, 2);
  select count(*), max(sku) into n2, last2 from public.cc_list_products(last1, 2);
  select count(*) into n3 from public.cc_list_products(last2, 2);
  if n1 <> 2 or n2 <> 2 or last2 <= last1 then raise exception 'FAIL T03 paging % % % %', n1, n2, last1, last2; end if;
  if n1 + n2 + n3 <> total then raise exception 'FAIL T03 pages do not add up (% + % + % <> %)', n1, n2, n3, total; end if;
  select count(*) into n4 from public.cc_list_products(null, 5000);
  if n4 > 1000 then raise exception 'FAIL T03 limit not capped'; end if;
  select pg_get_function_result('public.cc_list_products(text,int)'::regprocedure) into cols;
  if cols ~* 'cost|margin' then raise exception 'FAIL T03 cost/margin exposed: %', cols; end if;
  if (select string_agg(sku || '=' || sold_by, ',' order by sku) from public.cc_list_products(null, 1000))
     <> 'T-101=weight,T-104=weight,T-201=unit,T-203=unit' then   -- T-900 (price 0) not listed (12_active_products)
    raise exception 'FAIL T03 sold_by: %', (select string_agg(sku || '=' || sold_by, ',' order by sku) from public.cc_list_products(null, 1000));
  end if;
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

-- T04 — the account creates an order; prices come from the database, sent prices are ignored
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare o public.cc_orders; area uuid;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select id into area from public.cc_delivery_areas where name = 'منطقة اختبار 1';
  o := public.cc_create_order(
    'aaaaaaaa-0000-0000-0000-000000000001',
    '{"name":"عميل اختبار","phone":"01011112222"}',
    json_build_object('area_id', area, 'street', 'شارع اختبار', 'label', 'البيت', 'housing_type', 'building', 'notes', 'الدور 3 — بجوار الاختبار')::jsonb,
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
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare o1 public.cc_orders; o2 public.cc_orders; before int; area uuid;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select count(*) into before from public.cc_orders;
  select id into area from public.cc_delivery_areas where name = 'منطقة اختبار 1';
  o2 := public.cc_create_order(
    'aaaaaaaa-0000-0000-0000-000000000001',
    '{"name":"اسم مختلف","phone":"01099998888"}',
    json_build_object('area_id', area, 'street', 'x', 'label', 'البيت')::jsonb,
    '[{"sku":"T-203","qty":9}]');
  select * into o1 from public.cc_orders where client_request_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if o2.id <> o1.id then raise exception 'FAIL T05 duplicate order created'; end if;
  if (select count(*) from public.cc_orders) <> before then raise exception 'FAIL T05 order count changed'; end if;
  if exists (select 1 from public.cc_customers where phone = '01099998888') then raise exception 'FAIL T05 customer created by repeat'; end if;
  raise notice 'PASS T05 repeat submit returned the same order %', o1.order_no;
end $$;
commit;

-- T06 — the account cannot write tables directly (only through the functions)
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare oid uuid;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select id into oid from public.cc_orders where client_request_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin insert into public.cc_delivery_areas (name, fee) values ('مباشر', 1); raise exception 'FAIL T06 inserted area directly'; exception when insufficient_privilege then null; end;
  begin update public.cc_orders set total = 1 where id = oid; raise exception 'FAIL T06 updated order'; exception when insufficient_privilege then null; end;
  begin insert into public.cc_customers (name, phone) values ('x', '01000000000'); raise exception 'FAIL T06 inserted customer'; exception when insufficient_privilege then null; end;
  begin delete from public.cc_orders where id = oid; raise exception 'FAIL T06 deleted order'; exception when insufficient_privilege then null; end;
  raise notice 'PASS T06 no direct writes to orders, customers or areas';
end $$;
rollback;

-- T07 — invalid input is rejected and nothing is saved
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare before int; cust uuid; addr uuid; off_area uuid;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select count(*) into before from public.cc_orders;
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into addr from public.cc_addresses where customer_id = cust limit 1;
  select id into off_area from public.cc_delivery_areas where not active limit 1;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-104","qty":1,"weight_grams":500}]'); raise exception 'FAIL T07 qty+weight accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-104","weight_grams":5}]'); raise exception 'FAIL T07 5 g accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"NOPE","qty":1}]'); raise exception 'FAIL T07 unknown sku accepted';
  exception when no_data_found then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb,
          json_build_object('area_id', off_area, 'street', 's', 'label', 'البيت')::jsonb,
          '[{"sku":"T-201","qty":1}]'); raise exception 'FAIL T07 inactive area accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), '{"name":"مكرر","phone":"01011112222"}',
          json_build_object('id', addr)::jsonb, '[{"sku":"T-201","qty":1}]'); raise exception 'FAIL T07 duplicate phone accepted';
  exception when unique_violation then null; end;
  if (select count(*) from public.cc_orders) <> before then raise exception 'FAIL T07 a rejected order was saved'; end if;
  raise notice 'PASS T07 bad quantity/weight, unknown sku, inactive area, duplicate phone rejected';
end $$;
rollback;

-- T08 — existing customer + saved address; zero-price product allowed
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare o public.cc_orders; cust uuid; addr uuid;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into addr from public.cc_addresses where customer_id = cust limit 1;
  o := public.cc_create_order('aaaaaaaa-0000-0000-0000-000000000002',
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

-- T10 — cancel needs a reason, works once, and is recorded
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
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
  raise notice 'PASS T10 cancel with reason, once, recorded';
end $$;
commit;

-- T11 — the account manages areas and sees the result
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
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
  raise notice 'PASS T11 adds and edits areas';
end $$;
commit;

begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if not exists (select 1 from public.cc_delivery_areas where name = 'منطقة اختبار 2' and fee = 27.50) then
    raise exception 'FAIL T11 cannot see new area'; end if;
  raise notice 'PASS T11b updated area is visible';
end $$;
rollback;

-- T12 — duplicated sku in products_master (M4): not listed, cannot be ordered (test data only, rolled back)
begin;
alter table public.products_master drop constraint products_master_pkey;
insert into public.products_master (sku, name, price) values ('T-201', 'لبن مكرر (تجريبي)', 99);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare cust uuid; addr uuid;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if exists (select 1 from public.cc_list_products(null, 1000) where sku = 'T-201') then
    raise exception 'FAIL T12 duplicated sku is listed'; end if;
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into addr from public.cc_addresses where customer_id = cust limit 1;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb,
          json_build_object('id', addr)::jsonb, '[{"sku":"T-201","qty":1}]');
        raise exception 'FAIL T12 order with duplicated sku accepted';
  exception when sqlstate 'P0003' then null; end;
  raise notice 'PASS T12 duplicated sku hidden from the list and rejected with a clear message';
end $$;
rollback;

-- T13 — address length limits with clear messages and field hints (L5)
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare cust uuid; area uuid; msg text; hnt text; f record;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into area from public.cc_delivery_areas where name = 'منطقة اختبار 1';
  for f in select * from (values
      ('label', repeat('ب', 41), 'label'), ('label', '  ', 'label'), ('street', repeat('ش', 151), 'street'),
      ('street', '   ', 'street'), ('housing_type', 'castle', 'housingType'), ('notes', repeat('م', 201), 'notes'),
      ('area_id', '', 'areaId')
    ) as t(field, val, hint) loop
    begin
      perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb,
        (json_build_object('label', 'البيت', 'area_id', area, 'street', 'شارع')::jsonb) || jsonb_build_object(f.field, f.val),
        '[{"sku":"T-203","qty":1}]');
      raise exception 'FAIL T13 % = "%" accepted', f.field, f.val;
    exception when invalid_parameter_value then
      get stacked diagnostics msg = message_text, hnt = pg_exception_hint;
      if hnt <> f.hint then raise exception 'FAIL T13 hint % for field %', hnt, f.field; end if;
    end;
  end loop;
  begin perform public.cc_create_order(gen_random_uuid(), '{"name":"عميل","phone":"0123"}',
          json_build_object('area_id', area, 'street', 'ش', 'label', 'البيت')::jsonb, '[{"sku":"T-203","qty":1}]');
        raise exception 'FAIL T13 bad phone accepted';
  exception when invalid_parameter_value then get stacked diagnostics hnt = pg_exception_hint;
        if hnt <> 'phone' then raise exception 'FAIL T13 phone hint %', hnt; end if; end;
  raise notice 'PASS T13 address name/street/housing type/notes/area checked with field hints, bad phone rejected (last message: %)', msg;
end $$;
rollback;

-- T14 — a deactivated staff account loses access immediately
begin;
update public.cc_staff set active = false where user_id = (select id from auth.users where email = 'staff@cc.test');
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if (select count(*) from public.cc_orders) <> 0 then raise exception 'FAIL T14 inactive account reads orders'; end if;
  begin perform * from public.cc_list_products(null, 10); raise exception 'FAIL T14 inactive account lists products';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T14 deactivated account sees nothing';
end $$;
rollback;

-- T15 — the account cannot add staff or change its own staff row (no write path to cc_staff)
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin update public.cc_staff set display_name = 'x' where user_id = auth.uid(); raise exception 'FAIL T15 updated own staff row';
  exception when insufficient_privilege then null; end;
  begin insert into public.cc_staff (user_id, display_name) values ((select id from auth.users where email = 'outsider@cc.test'), 'x');
        raise exception 'FAIL T15 added a staff account';
  exception when insufficient_privilege then null; end;
  if not public.cc_is_staff() then raise exception 'FAIL T15 lost access'; end if;
  raise notice 'PASS T15 cannot add staff or change its own staff row';
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

-- T20 — sold by unit vs by weight (Storage Unit): decimals rejected for unit products,
--       kg lines only for كيلو products, لتر counts as unit; nothing saved on rejection
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare before int; cust uuid; addr uuid; msg text; o public.cc_orders;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select count(*) into before from public.cc_orders;
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into addr from public.cc_addresses where customer_id = cust limit 1;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-203","qty":1.5}]'); raise exception 'FAIL T20 decimal qty accepted';
  exception when invalid_parameter_value then get stacked diagnostics msg = message_text; end;
  if msg not like 'لا يمكن أن تحتوي الكمية على أرقام عشرية%' then raise exception 'FAIL T20 decimal message: %', msg; end if;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-203","qty":"1.5"}]'); raise exception 'FAIL T20 decimal qty (text) accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-203","weight_grams":500}]'); raise exception 'FAIL T20 weight on unit product accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-201","weight_grams":1000}]'); raise exception 'FAIL T20 liter product sold by weight';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-900","weight_grams":500}]'); raise exception 'FAIL T20 no-unit product sold by weight';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-101","qty":1}]'); raise exception 'FAIL T20 piece qty on kilo product accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
          '[{"sku":"T-101","weight_grams":250.5}]'); raise exception 'FAIL T20 fractional grams accepted';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.cc_orders) <> before then raise exception 'FAIL T20 a rejected order was saved'; end if;
  o := public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
         '[{"sku":"T-101","weight_grams":250},{"sku":"T-201","qty":2}]');
  if o.subtotal <> 189.00 or not o.is_estimated then raise exception 'FAIL T20 totals % / %', o.subtotal, o.is_estimated; end if;
  raise notice 'PASS T20 unit products whole numbers only (Arabic decimal message), كيلو by weight, لتر/no unit by unit';
end $$;
rollback;

-- T21 — the internal helper cc_sold_by is not callable by signed-in users
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform public.cc_sold_by('T-101'); raise exception 'FAIL T21 account called cc_sold_by directly';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T21 cc_sold_by is internal only';
end $$;
rollback;

-- T22 — no order source; new address fields; second number; editing a saved address
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare o public.cc_orders; o2 public.cc_orders; cust uuid; addr uuid; area uuid; old_area uuid; n_addr int;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cc_orders' and column_name = 'source') then
    raise exception 'FAIL T22 cc_orders still has a source column'; end if;
  select id into cust from public.cc_customers where phone = '01011112222';
  select id, area_id into addr, old_area from public.cc_addresses where customer_id = cust limit 1;
  select count(*) into n_addr from public.cc_addresses where customer_id = cust;
  if (select label from public.cc_addresses where id = addr) <> 'البيت'
     or (select housing_type from public.cc_addresses where id = addr) <> 'building' then
    raise exception 'FAIL T22 new address fields not saved'; end if;

  -- second number for a customer who has none → saved on the customer and on the order
  o := public.cc_create_order(gen_random_uuid(), json_build_object('id', cust, 'phone2', '01233334444')::jsonb,
         json_build_object('id', addr)::jsonb, '[{"sku":"T-203","qty":1}]');
  if o.customer_phone2 is distinct from '01233334444' then raise exception 'FAIL T22 order phone2 %', o.customer_phone2; end if;
  if (select phone2 from public.cc_customers where id = cust) is distinct from '01233334444' then raise exception 'FAIL T22 customer phone2 not saved'; end if;
  if o.address_label <> 'البيت' or o.housing_type <> 'building' or o.address_notes not like 'الدور 3%' then
    raise exception 'FAIL T22 order address snapshot % / % / %', o.address_label, o.housing_type, o.address_notes; end if;
  -- an existing second number is not overwritten (copied onto the order only)
  o := public.cc_create_order(gen_random_uuid(), json_build_object('id', cust, 'phone2', '01255556666')::jsonb,
         json_build_object('id', addr)::jsonb, '[{"sku":"T-203","qty":1}]');
  if (select phone2 from public.cc_customers where id = cust) <> '01233334444' then raise exception 'FAIL T22 phone2 overwritten'; end if;
  if o.customer_phone2 <> '01255556666' then raise exception 'FAIL T22 order phone2 not the typed one'; end if;
  begin perform public.cc_create_order(gen_random_uuid(), json_build_object('id', cust, 'phone2', '123')::jsonb,
          json_build_object('id', addr)::jsonb, '[{"sku":"T-203","qty":1}]'); raise exception 'FAIL T22 bad phone2 accepted';
  exception when invalid_parameter_value then null; end;

  -- editing the saved address: same row updated (no new address), order uses the new data
  o2 := public.cc_create_order(gen_random_uuid(), json_build_object('id', cust)::jsonb,
          json_build_object('id', addr, 'label', 'الشغل', 'area_id', old_area, 'street', 'شارع جديد 12', 'housing_type', 'office', 'notes', '')::jsonb,
          '[{"sku":"T-203","qty":1}]');
  if (select count(*) from public.cc_addresses where customer_id = cust) <> n_addr then raise exception 'FAIL T22 edit created a new address'; end if;
  if (select label || '|' || street || '|' || housing_type || '|' || coalesce(notes, '-') || '|' || (updated_by is not null)::text
        from public.cc_addresses where id = addr) <> 'الشغل|شارع جديد 12|office|-|true' then
    raise exception 'FAIL T22 address not updated'; end if;
  if o2.address_label <> 'الشغل' or o2.street <> 'شارع جديد 12' or o2.housing_type <> 'office' then raise exception 'FAIL T22 edited snapshot'; end if;
  if (select street from public.cc_orders where id = o.id) <> 'شارع اختبار' then raise exception 'FAIL T22 old order changed by address edit'; end if;
  -- someone else's address cannot be edited through a customer
  begin perform public.cc_create_order(gen_random_uuid(), '{"name":"عميل تاني","phone":"01577778888"}',
          json_build_object('id', addr, 'label', 'x', 'area_id', old_area, 'street', 'سرقة')::jsonb, '[{"sku":"T-203","qty":1}]');
        raise exception 'FAIL T22 edited another customer''s address';
  exception when no_data_found then null; end;
  if (select street from public.cc_addresses where id = addr) <> 'شارع جديد 12' then raise exception 'FAIL T22 foreign edit changed address'; end if;
  raise notice 'PASS T22 no source; label/housing type/notes saved; phone2 saved once + copied to order; saved address edited in place';
end $$;
rollback;

-- T23 — employee names: add, no duplicates (case/space), rename, deactivate
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare a public.cc_agents; b public.cc_agents;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  a := public.cc_save_agent(null, 'عمر', true);
  begin perform public.cc_save_agent(null, '  عمر ', true); raise exception 'FAIL T23 duplicate name accepted';
  exception when unique_violation then null; end;
  b := public.cc_save_agent(null, 'Omar', true);
  begin perform public.cc_save_agent(null, 'OMAR', true); raise exception 'FAIL T23 case duplicate accepted';
  exception when unique_violation then null; end;
  begin perform public.cc_save_agent(null, '   ', true); raise exception 'FAIL T23 empty name accepted';
  exception when invalid_parameter_value then null; end;
  b := public.cc_save_agent(b.id, 'كريم', false);
  if b.name <> 'كريم' or b.active then raise exception 'FAIL T23 rename/deactivate'; end if;
  if (select count(*) from public.cc_agents) <> 2 then raise exception 'FAIL T23 agents not readable'; end if;
  begin insert into public.cc_agents (name) values ('مباشر'); raise exception 'FAIL T23 direct insert';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T23 names: add, no duplicates (spaces/case), rename, deactivate, no direct writes';
end $$;
rollback;

-- T24 — orders and cancels carry the employee name; repeat keeps the first name; inactive/unknown rejected
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare omar public.cc_agents; mona public.cc_agents; old public.cc_agents; o public.cc_orders; o2 public.cc_orders; c public.cc_orders;
        cust uuid; addr uuid; req uuid := gen_random_uuid();
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  omar := public.cc_save_agent(null, 'عمر', true);
  mona := public.cc_save_agent(null, 'منى', true);
  old  := public.cc_save_agent(null, 'قديم', false);
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into addr from public.cc_addresses where customer_id = cust limit 1;
  o := public.cc_place_order(omar.id, req, json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb, '[{"sku":"T-203","qty":2}]');
  if o.agent_id <> omar.id or o.agent_name <> 'عمر' or o.created_by_name <> 'مركز الاتصال' then raise exception 'FAIL T24 agent % %', o.agent_name, o.created_by_name; end if;
  if (select by_name from public.cc_order_events where order_id = o.id and status = 'new') <> 'عمر' then raise exception 'FAIL T24 event name'; end if;
  o2 := public.cc_place_order(mona.id, req, json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb, '[{"sku":"T-203","qty":5}]');
  if o2.id <> o.id or o2.agent_name <> 'عمر' then raise exception 'FAIL T24 repeat changed the order/name'; end if;
  begin perform public.cc_place_order(old.id, gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb, '[{"sku":"T-203","qty":1}]');
        raise exception 'FAIL T24 inactive agent accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_place_order(null, gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb, '[{"sku":"T-203","qty":1}]');
        raise exception 'FAIL T24 no agent accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_cancel_order_as(mona.id, o.id, '  '); raise exception 'FAIL T24 cancel without reason';
  exception when invalid_parameter_value then null; end;
  c := public.cc_cancel_order_as(mona.id, o.id, 'العميل لغى');
  if c.status <> 'cancelled' or c.cancelled_by_agent <> 'منى' or c.agent_name <> 'عمر' then raise exception 'FAIL T24 cancel names % %', c.cancelled_by_agent, c.agent_name; end if;
  if (select by_name from public.cc_order_events where order_id = o.id and status = 'cancelled') <> 'منى' then raise exception 'FAIL T24 cancel event name'; end if;
  raise notice 'PASS T24 order by عمر, repeat keeps عمر, inactive/no name rejected, cancelled by منى';
end $$;
rollback;

-- T25 — signed-out and non-staff users cannot use the employee functions
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'outsider@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform public.cc_save_agent(null, 'دخيل', true); raise exception 'FAIL T25 outsider saved a name';
  exception when insufficient_privilege then null; end;
  begin perform public.cc_place_order(gen_random_uuid(), gen_random_uuid(), '{}', '{}', '[]'); raise exception 'FAIL T25 outsider placed order';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.cc_agents) <> 0 then raise exception 'FAIL T25 outsider reads names'; end if;
  raise notice 'PASS T25 non-staff cannot read names, add names or place orders';
end $$;
rollback;
begin;
set local role anon;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform public.cc_place_order(gen_random_uuid(), gen_random_uuid(), '{}', '{}', '[]'); raise exception 'FAIL T25 anon placed order';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_agents; raise exception 'FAIL T25 anon read names';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T25b signed-out users have no access to names or ordering';
end $$;
rollback;

-- T26 — "sold by weight" from the products sheet wins over the storage unit; fallback still works
begin;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
end $$;
-- setup as the table owner (the edge function writes with the service role)
insert into public.cc_product_sale_unit (sku, sold_by_weight) values ('T-101', false), ('T-203', true);
insert into public.cc_sync_status (name, finished_at, ok, rows_total, message) values ('sale_unit', now(), true, 2, 'ok');
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare got text; o public.cc_orders; ag public.cc_agents; cust uuid; addr uuid; st record;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select string_agg(sku || '=' || sold_by, ',' order by sku) into got from public.cc_list_products(null, 1000);
  -- T-101 storage كيلو but sheet No → unit; T-203 storage Unit but sheet Yes → weight;
  -- T-104 not in the sheet list → storage كيلو → weight; T-201 لتر → unit; T-900 nothing → unit
  if got <> 'T-101=unit,T-104=weight,T-201=unit,T-203=weight' then raise exception 'FAIL T26 list %', got; end if;
  ag := public.cc_save_agent(null, 'اختبار الوزن', true);
  select id into cust from public.cc_customers where phone = '01011112222';
  select id into addr from public.cc_addresses where customer_id = cust limit 1;
  begin perform public.cc_place_order(ag.id, gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb, '[{"sku":"T-101","weight_grams":500}]');
        raise exception 'FAIL T26 weight accepted for a sheet-unit product';
  exception when invalid_parameter_value then null; end;
  o := public.cc_place_order(ag.id, gen_random_uuid(), json_build_object('id', cust)::jsonb, json_build_object('id', addr)::jsonb,
         '[{"sku":"T-101","qty":2},{"sku":"T-203","weight_grams":250}]');
  if o.subtotal <> 842.25 or not o.is_estimated then raise exception 'FAIL T26 order % %', o.subtotal, o.is_estimated; end if;
  select * into st from public.cc_sale_unit_status();
  if not st.ok or st.rows_total <> 2 then raise exception 'FAIL T26 status'; end if;
  begin perform 1 from public.cc_product_sale_unit; raise exception 'FAIL T26 app read the sheet table directly';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_sync_status; raise exception 'FAIL T26 app read the status table directly';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T26 sheet flag wins (T-101 unit, T-203 weight), storage-unit fallback, order rules follow it, tables not readable directly';
end $$;
rollback;
begin;
set local role anon;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform * from public.cc_sale_unit_status(); raise exception 'FAIL T26b anon read sync status';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T26b signed-out users cannot read the sync status';
end $$;
rollback;

-- T27 — registration code: set by staff only, never stored as text, wrong code counted, right code links the account
begin;
insert into auth.users (id, email) values (gen_random_uuid(), 'newbie@cc.test'), (gen_random_uuid(), 'newbie2@cc.test');
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'outsider@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform public.cc_set_signup_code('12345678'); raise exception 'FAIL T27 outsider set the code';
  exception when insufficient_privilege then null; end;
  if public.cc_join_with_code('anything') then raise exception 'FAIL T27 joined with no code set'; end if;
exception when invalid_parameter_value then null;   -- "no code yet" is the expected error
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare st record; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform public.cc_set_signup_code('1234'); raise exception 'FAIL T27 short code accepted';
  exception when invalid_parameter_value then null; end;
  perform public.cc_set_signup_code('Abu-2026x');
  select * into st from public.cc_signup_code_status();
  if not st.is_set then raise exception 'FAIL T27 status'; end if;
  begin perform 1 from public.cc_settings; raise exception 'FAIL T27 settings readable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.cc_settings where value_hash like '%Abu-2026x%' or salt like '%Abu-2026x%') then raise exception 'FAIL T27 code stored as text'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'newbie@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if public.cc_is_staff() then raise exception 'FAIL T27 newbie is staff before joining'; end if;
  if (select count(*) from public.cc_orders) <> 0 or (select count(*) from public.cc_customers) <> 0 then raise exception 'FAIL T27 newbie reads data before joining'; end if;
  if public.cc_join_with_code('wrong-code') then raise exception 'FAIL T27 wrong code accepted'; end if;
  if not public.cc_join_with_code('  Abu-2026x ') then raise exception 'FAIL T27 right code refused'; end if;
  if not public.cc_is_staff() then raise exception 'FAIL T27 not linked after the right code'; end if;
  if not public.cc_join_with_code('anything') then raise exception 'FAIL T27 already-linked should return true'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.cc_join_attempts where not ok) <> 1 then raise exception 'FAIL T27 wrong try not recorded'; end if;
  raise notice 'PASS T27 code: staff-only, hashed, wrong try recorded, right code links the account';
end $$;
-- 5 wrong tries in an hour lock that account
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'newbie2@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare i int; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  for i in 1..5 loop perform public.cc_join_with_code('nope'); end loop;
  begin perform public.cc_join_with_code('Abu-2026x'); raise exception 'FAIL T27 lock not applied';
  exception when program_limit_exceeded then null; end;
  if public.cc_is_staff() then raise exception 'FAIL T27 locked account got in'; end if;
  raise notice 'PASS T27b 5 wrong tries lock the account for an hour';
end $$;
rollback;

-- T28 — a stopped (inactive) account cannot rejoin with the code; signed-out cannot call the functions
begin;
update public.cc_staff set active = false where user_id = (select id from auth.users where email = 'staff@cc.test');
insert into public.cc_settings (key, salt, value_hash) values ('signup_code', 's', public.cc_code_hash('s', 'Abu-2026x'));
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform public.cc_join_with_code('Abu-2026x'); raise exception 'FAIL T28 stopped account rejoined';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T28 a stopped account stays stopped';
end $$;
rollback;
begin;
set local role anon;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform public.cc_join_with_code('x'); raise exception 'FAIL T28b anon joined';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T28b signed-out users cannot use the code';
end $$;
rollback;

-- T29 — categories: staff sees active categories with their products; empty/inactive hidden; tables closed to the app
begin;
insert into public.cc_categories (reference, name, sort_order, active) values
  ('c01', 'مخبوزات ابو الفضل', 2, true), ('c02', 'اجبان', 1, true), ('c03', 'فاضي', 3, true), ('c04', 'قديم', 4, false);
insert into public.cc_product_categories (sku, reference) values
  ('T-101', 'c02'), ('T-104', 'c02'), ('T-203', 'c01'), ('T-201', null), ('T-102', 'c04');
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare got text; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select string_agg(name || ':' || array_to_string(skus, '+'), ',') into got from public.cc_list_categories();
  if got is distinct from 'اجبان:T-101+T-104,مخبوزات ابو الفضل:T-203' then raise exception 'FAIL T29 list = %', got; end if;
  begin perform * from public.cc_categories; raise exception 'FAIL T29 table readable';
  exception when insufficient_privilege then null; end;
  begin insert into public.cc_product_categories (sku, reference) values ('X', 'c01'); raise exception 'FAIL T29 table writable';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T29 categories listed with their products (empty/old hidden), tables closed to the app';
end $$;
rollback;
begin;
update public.cc_staff set active = false where user_id = (select id from auth.users where email = 'staff@cc.test');
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform * from public.cc_list_categories(); raise exception 'FAIL T29b stopped account listed categories';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T29b stopped account cannot list categories';
end $$;
rollback;

-- T30 — roles: admin manages settings and accounts; call_center works orders but no settings; prep sees nothing yet
begin;
insert into auth.users (id, email) values (gen_random_uuid(), 'cc@cc.test'), (gen_random_uuid(), 'prep@cc.test');
insert into public.cc_staff (user_id, display_name, role)
select id, 'x', case email when 'cc@cc.test' then 'call_center' else 'prep' end from auth.users where email in ('cc@cc.test', 'prep@cc.test');
insert into public.cc_settings (key, salt, value_hash) values ('signup_code', 's', public.cc_code_hash('s', 'Abu-2026x'))
on conflict (key) do nothing;
-- call_center
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'cc@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if public.cc_my_role() <> 'call_center' or not public.cc_is_staff() or public.cc_is_admin() then raise exception 'FAIL T30 call_center role'; end if;
  if (select count(*) from public.cc_delivery_areas) = 0 then raise exception 'FAIL T30 call_center cannot read areas'; end if;
  begin perform public.cc_save_area(null, 'منطقة كول سنتر', 10, true); raise exception 'FAIL T30 call_center saved an area';
  exception when insufficient_privilege then null; end;
  begin perform public.cc_save_agent(null, 'اسم', true); raise exception 'FAIL T30 call_center saved a name';
  exception when insufficient_privilege then null; end;
  begin perform public.cc_set_signup_code('12345678x'); raise exception 'FAIL T30 call_center set the code';
  exception when insufficient_privilege then null; end;
  begin perform * from public.cc_list_staff(); raise exception 'FAIL T30 call_center listed accounts';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T30 call_center: reads orders/areas, no settings, no accounts';
end $$;
reset role;
-- prep
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'prep@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if public.cc_my_role() <> 'prep' or public.cc_is_staff() then raise exception 'FAIL T30 prep role'; end if;
  if (select count(*) from public.cc_delivery_areas) + (select count(*) from public.cc_customers) + (select count(*) from public.cc_orders) <> 0 then raise exception 'FAIL T30 prep reads data'; end if;
  begin perform * from public.cc_list_products(null, 10); raise exception 'FAIL T30 prep lists products';
  exception when insufficient_privilege then null; end;
  if public.cc_join_with_code('Abu-2026x') is not true then raise exception 'FAIL T30 prep join'; end if;
  if public.cc_my_role() <> 'prep' then raise exception 'FAIL T30 code changed the prep role'; end if;
  raise notice 'PASS T30b prep: sees no customers/orders/products, cannot order, the code does not change the role';
end $$;
reset role;
-- admin
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n int; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select count(*) into n from public.cc_list_staff() where email in ('staff@cc.test', 'cc@cc.test', 'prep@cc.test');
  if n <> 3 then raise exception 'FAIL T30 admin list %', n; end if;
  perform public.cc_save_area(null, 'منطقة أدمن', 10, true);
  perform public.cc_set_staff((select user_id from public.cc_list_staff() where email = 'cc@cc.test'), 'prep', false);
  if (select role || '/' || active from public.cc_list_staff() where email = 'cc@cc.test') <> 'prep/false' then raise exception 'FAIL T30 set_staff'; end if;
  begin perform public.cc_set_staff(auth.uid(), 'call_center', true); raise exception 'FAIL T30 admin changed own role';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_set_staff((select user_id from public.cc_list_staff() where email = 'prep@cc.test'), 'boss', true); raise exception 'FAIL T30 unknown role accepted';
  exception when invalid_parameter_value then null; end;
  raise notice 'PASS T30c admin: settings, list accounts, change role/stop others, not own account, unknown role refused';
end $$;
reset role;
-- first run: the accounts in use become admin only while there is no admin
do $$ begin
  update public.cc_staff set role = 'call_center';
  update public.cc_staff set role = 'admin' where active and not exists (select 1 from public.cc_staff where role = 'admin');
  if (select count(*) from public.cc_staff where role = 'admin') <> (select count(*) from public.cc_staff where active) then raise exception 'FAIL T30 first run'; end if;
  update public.cc_staff set role = 'prep' where user_id = (select id from auth.users where email = 'prep@cc.test');
  update public.cc_staff set role = 'admin' where active and not exists (select 1 from public.cc_staff where role = 'admin');
  if (select role from public.cc_staff where user_id = (select id from auth.users where email = 'prep@cc.test')) <> 'prep' then raise exception 'FAIL T30 re-run promoted again'; end if;
  raise notice 'PASS T30d first run makes the current accounts admin; re-running changes nothing';
end $$;
rollback;

-- T31 — preparation: prep sees today's orders (no prices) and moves them one step; call center sees the stage
begin;
insert into auth.users (id, email) values (gen_random_uuid(), 'prep2@cc.test'), (gen_random_uuid(), 'cc2@cc.test');
insert into public.cc_staff (user_id, display_name, role)
select id, 'x', case email when 'prep2@cc.test' then 'prep' else 'call_center' end from auth.users where email in ('prep2@cc.test', 'cc2@cc.test');
select set_config('cc.oid', (select id::text from public.cc_orders where status = 'new' order by created_at limit 1), true);
select set_config('cc.cancelled', coalesce((select id::text from public.cc_orders where status = 'cancelled' limit 1), ''), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'prep2@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare oid uuid := current_setting('cc.oid')::uuid; r jsonb; o jsonb; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select x into o from public.cc_prep_orders() x where x->>'id' = oid::text;
  if o is null then raise exception 'FAIL T31 order not in the prep list'; end if;
  if jsonb_array_length(o->'items') = 0 or o ? 'total' or (o->'items'->0) ? 'unit_price' then raise exception 'FAIL T31 items/prices %', o; end if;
  if o->>'stage' <> 'new' then raise exception 'FAIL T31 starts at %', o->>'stage'; end if;
  begin perform public.cc_set_stage(oid, 'at_cashier'); raise exception 'FAIL T31 skipped a step';
  exception when invalid_parameter_value then null; end;
  r := public.cc_set_stage(oid, 'preparing');
  if r->>'stage' <> 'preparing' or r->>'preparing_at' is null then raise exception 'FAIL T31 preparing %', r; end if;
  r := public.cc_set_stage(oid, 'preparing');   -- double tap: no error, no change
  r := public.cc_set_stage(oid, 'new');         -- wrong tap: one step back
  if r->>'stage' <> 'new' or r->>'preparing_at' is not null then raise exception 'FAIL T31 back %', r; end if;
  perform public.cc_set_stage(oid, 'preparing');
  perform public.cc_set_stage(oid, 'at_cashier');
  -- 18_driver_tracking.sql: «خرج» is the driver's tap now, not the branch's
  begin perform public.cc_set_stage(oid, 'out'); raise exception 'FAIL T31 branch sent out';
  exception when invalid_parameter_value then null; end;
  if (select at_cashier_at is null or preparing_at is null from public.cc_orders where id = oid) then raise exception 'FAIL T31 times'; end if;
  if current_setting('cc.cancelled') <> '' then
    begin perform public.cc_set_stage(current_setting('cc.cancelled')::uuid, 'preparing'); raise exception 'FAIL T31 cancelled order moved';
    exception when invalid_parameter_value then null; end;
  end if;
  begin perform public.cc_set_stage(oid, 'boss'); raise exception 'FAIL T31 unknown stage';
  exception when invalid_parameter_value then null; end;
  begin perform * from public.cc_order_stage_events; raise exception 'FAIL T31 log readable';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T31 prep: list without prices, one step at a time, double tap safe, one step back, cancelled blocked';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'cc2@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare oid uuid := current_setting('cc.oid')::uuid; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if (select stage from public.cc_orders where id = oid) <> 'at_cashier' or (select at_cashier_at from public.cc_orders where id = oid) is null then raise exception 'FAIL T31b call center does not see the stage'; end if;
  begin perform public.cc_set_stage(oid, 'preparing'); raise exception 'FAIL T31b call center moved a stage';
  exception when insufficient_privilege then null; end;
  begin perform * from public.cc_prep_orders(); raise exception 'FAIL T31b call center opened the prep list';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T31b call center sees stage and times, cannot change them';
end $$;
reset role;
do $$ begin
  if (select count(*) from public.cc_order_stage_events where order_id = current_setting('cc.oid')::uuid) <> 4 then raise exception 'FAIL T31c log count'; end if;
  raise notice 'PASS T31c every tap is logged with who and when';
end $$;
rollback;

-- T32 — edit an order until «على الكاشير»; the branch sees «اتعدّل» with what changed; old lines kept in the log
begin;
revoke execute on function public.cc_create_order(uuid, jsonb, jsonb, jsonb, text) from authenticated;
revoke execute on function public.cc_cancel_order(uuid, text) from authenticated;
insert into auth.users (id, email) values (gen_random_uuid(), 'prep3@cc.test');
insert into public.cc_staff (user_id, display_name, role) select id, 'x', 'prep' from auth.users where email = 'prep3@cc.test';
insert into public.cc_agents (name) values ('موظف تعديل') on conflict do nothing;
select set_config('cc.agent', (select id::text from public.cc_agents where name = 'موظف تعديل'), true);
select set_config('cc.area2', (select id::text from public.cc_delivery_areas where active order by name desc limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare o public.cc_orders; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  -- the core functions are closed; the wrappers work
  begin perform public.cc_cancel_order(gen_random_uuid(), 'x'); raise exception 'FAIL T32 core cancel callable';
  exception when insufficient_privilege then null; end;
  o := public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), '{"name": "عميل تعديل", "phone": "01055555555"}',
         jsonb_build_object('label', 'البيت', 'area_id', (select id from public.cc_delivery_areas where active order by name limit 1), 'street', 'شارع التعديل'),
         '[{"sku": "T-101", "weight_grams": 1000}, {"sku": "T-201", "qty": 2}]', null);
  perform set_config('cc.edited', o.id::text, true);
end $$;
reset role;
select set_config('cc.old101', (select price::text from public.products_master where sku = 'T-101'), true);
update public.products_master set price = price + 100 where sku in ('T-101', 'T-203');   -- prices change in the sheet
select set_config('cc.new203', (select price::text from public.products_master where sku = 'T-203'), true);
set local role authenticated;
do $$ declare o public.cc_orders; oid uuid := current_setting('cc.edited')::uuid; old_price numeric := current_setting('cc.old101')::numeric; begin
  begin perform public.cc_edit_order(current_setting('cc.agent')::uuid, oid, null, '[{"sku": "T-101", "weight_grams": 1000}, {"sku": "T-201", "qty": 2}]', null);
    raise exception 'FAIL T32 no-change edit accepted';
  exception when invalid_parameter_value then null; end;
  o := public.cc_edit_order(current_setting('cc.agent')::uuid, oid,
         jsonb_build_object('area_id', current_setting('cc.area2'), 'street', 'شارع جديد'),
         '[{"sku": "T-101", "weight_grams": 500}, {"sku": "T-203", "qty": 3, "note": "بارد"}]', 'اتصل قبل الوصول');
  if (select unit_price from public.cc_order_items where order_id = oid and sku = 'T-101') <> old_price then raise exception 'FAIL T32 kept line price changed'; end if;
  if (select unit_price from public.cc_order_items where order_id = oid and sku = 'T-203') <> current_setting('cc.new203')::numeric then raise exception 'FAIL T32 new line price'; end if;
  if o.total <> (select sum(line_total) from public.cc_order_items where order_id = oid) + o.delivery_fee then raise exception 'FAIL T32 totals'; end if;
  if o.edit_count <> 1 or o.edited_by_name <> 'موظف تعديل' or o.street <> 'شارع جديد' or o.note <> 'اتصل قبل الوصول' then raise exception 'FAIL T32 order fields'; end if;
  if (select string_agg(c->>'kind', ',' order by c->>'kind') from jsonb_array_elements(o.edit_changes) c) <> 'added,address,amount,order_note,removed' then
    raise exception 'FAIL T32 changes %', o.edit_changes; end if;
  if exists (select 1 from public.cc_addresses where street = 'شارع جديد') then raise exception 'FAIL T32 saved address changed'; end if;
end $$;
reset role;
-- the branch: «اتعدّل» shows until «شُفت التعديل»; then the order reaches the cashier and editing stops
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'prep3@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare oid uuid := current_setting('cc.edited')::uuid; x jsonb; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  select y into x from public.cc_prep_orders() y where y->>'id' = oid::text;
  if x->>'edited_at' is null or x->>'edit_seen_at' is not null or jsonb_array_length(x->'edit_changes') <> 5 then raise exception 'FAIL T32 prep mark %', x; end if;
  begin perform public.cc_edit_order(null, oid, null, '[]', null); raise exception 'FAIL T32 prep edited';
  exception when insufficient_privilege then null; end;
  if not public.cc_ack_edit(oid) then raise exception 'FAIL T32 ack'; end if;
  perform public.cc_set_stage(oid, 'preparing');
  perform public.cc_set_stage(oid, 'at_cashier');
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare oid uuid := current_setting('cc.edited')::uuid; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  if (select edit_seen_at from public.cc_orders where id = oid) is null then raise exception 'FAIL T32 ack not saved'; end if;
  begin perform public.cc_edit_order(current_setting('cc.agent')::uuid, oid, null, '[{"sku": "T-201", "qty": 1}]', null); raise exception 'FAIL T32 edited at the cashier';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ declare oid uuid := current_setting('cc.edited')::uuid; begin
  if (select count(*) from public.cc_order_edits where order_id = oid) <> 1 then raise exception 'FAIL T32 log'; end if;
  if (select jsonb_array_length(old_items) from public.cc_order_edits where order_id = oid) <> 2 then raise exception 'FAIL T32 old lines not kept'; end if;
  raise notice 'PASS T32 edit: kept lines keep their price, new lines today''s price, totals recomputed, changes listed, saved address untouched, branch mark + ack, blocked at the cashier, old lines logged, core create/cancel closed';
end $$;
rollback;

-- T33 — the branch no longer types the driver: «خرج مع الطيار» is the driver's own tap (18_driver_tracking.sql)
begin;
insert into auth.users (id, email) values (gen_random_uuid(), 'prep4@cc.test');
insert into public.cc_staff (user_id, display_name, role) select id, 'x', 'prep' from auth.users where email = 'prep4@cc.test';
select set_config('cc.oid', (select id::text from public.cc_orders where status = 'new' order by created_at limit 1), true);
update public.cc_orders set stage = 'at_cashier', at_cashier_at = now() where id = current_setting('cc.oid')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'prep4@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare oid uuid := current_setting('cc.oid')::uuid; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
  begin perform public.cc_send_out(oid, 'محمد (01012345678)'); raise exception 'FAIL T33 branch typed the driver';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_set_stage(oid, 'out'); raise exception 'FAIL T33 branch sent out';
  exception when invalid_parameter_value then null; end;
  if (select stage from public.cc_orders where id = oid) <> 'at_cashier' then raise exception 'FAIL T33 stage changed'; end if;
  raise notice 'PASS T33 the branch cannot send an order out or type the driver any more (the driver taps «خرجت»)';
end $$;
rollback;

-- T34 — like Foodics: only active products from the current sheet, priced above zero (12_active_products.sql)
begin;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
end $$;
-- a stand-in for the data-center sheet table (inside this transaction only; rolled back below)
create table public.dc_products (sku text primary key, name text, price numeric, is_active boolean);
insert into public.dc_products values ('T-101', 'x', 420, true), ('T-201', 'x', 42, false), ('T-203', 'x', 9, null), ('T-900', 'x', 0, true);
-- T-104 is not in the sheet at all
grant select on public.dc_products to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare got text;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  select string_agg(sku, ',' order by sku) into got from public.cc_list_products(null, 1000);
  -- T-101 active → shown · T-201 inactive → hidden · T-203 active not set → shown · T-900 price 0 → hidden · T-104 not in sheet → hidden
  if got is distinct from 'T-101,T-203' then raise exception 'FAIL T34 list %', got; end if;
  raise notice 'PASS T34 only active products from the sheet with a price above zero are listed';
end $$;
rollback;

-- T35 — add-ons like Foodics (13_modifiers.sql): admin links groups to a product with min/max; prices from the
-- database; required group; limits; repeated draft unchanged; edit keeps an add-on's price; branch sees add-ons
begin;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
end $$;
insert into public.cc_modifier_groups (id, name) values
  ('00000000-0000-4000-8000-0000000000a1', 'اضافة ارز بلبن'), ('00000000-0000-4000-8000-0000000000a2', 'الطعم');
insert into public.cc_modifier_options (id, group_id, name, price, active, sort) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'عسل', 5, true, 1),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', 'مكسرات', 20, true, 2),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a2', 'فانيليا', 0, true, 1),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000a2', 'موقوف', 0, false, 2);
insert into auth.users (id, email) values (gen_random_uuid(), 'cc35@cc.test');
insert into public.cc_staff (user_id, display_name, role) select id, 'x', 'call_center' from auth.users where email = 'cc35@cc.test';
insert into public.cc_agents (name) values ('موظف إضافات') on conflict do nothing;
select set_config('cc.agent', (select id::text from public.cc_agents where name = 'موظف إضافات'), true);
select set_config('cc.req', gen_random_uuid()::text, true);
select set_config('cc.p203', (select price::text from public.products_master where sku = 'T-203'), true);
-- call_center: can read the add-ons, cannot change the links
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'cc35@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  begin perform public.cc_save_product_modifiers('T-203', '[]'); raise exception 'FAIL T35 call_center saved links';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_modifier_options limit 1; raise exception 'FAIL T35 table readable';
  exception when insufficient_privilege then null; end;
  begin perform public.cc_price_modifiers('T-203', '[]', 1, null); raise exception 'FAIL T35 pricing callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare o public.cc_orders; o2 public.cc_orders; l jsonb; d jsonb; area uuid := (select id from public.cc_delivery_areas where active order by name limit 1);
  items jsonb := '[{"sku": "T-203", "qty": 2, "modifiers": [{"id": "00000000-0000-4000-8000-0000000000b1", "qty": 2}, {"id": "00000000-0000-4000-8000-0000000000b2", "qty": 1}, {"id": "00000000-0000-4000-8000-0000000000b3", "qty": 1}]}, {"sku": "T-201", "qty": 1}]';
  price203 numeric := current_setting('cc.p203')::numeric;
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  begin perform public.cc_save_product_modifiers('T-203', '[{"group_id": "00000000-0000-4000-8000-0000000000a1", "min": 2, "max": 1}]'); raise exception 'FAIL T35 min > max accepted';
  exception when invalid_parameter_value then null; end;
  if public.cc_save_product_modifiers('T-203', '[{"group_id": "00000000-0000-4000-8000-0000000000a1", "min": 0, "max": 5},
                                               {"group_id": "00000000-0000-4000-8000-0000000000a2", "min": 1, "max": 1}]') <> 2 then raise exception 'FAIL T35 save'; end if;
  begin perform public.cc_save_product_modifiers('T-203', '[{"group_id": "00000000-0000-4000-8000-0000000000a1", "min": 0, "max": 5, "default": "00000000-0000-4000-8000-0000000000b3"}]');
    raise exception 'FAIL T35 default from another group accepted';
  exception when invalid_parameter_value then null; end;
  perform public.cc_save_product_modifiers('T-203', '[{"group_id": "00000000-0000-4000-8000-0000000000a1", "min": 0, "max": 5},
                                               {"group_id": "00000000-0000-4000-8000-0000000000a2", "min": 1, "max": 1, "default": "00000000-0000-4000-8000-0000000000b3"}]');
  d := public.cc_list_modifiers();
  if (select x->>'default' from jsonb_array_elements(d->'links') x where x->>'group_id' = '00000000-0000-4000-8000-0000000000a2') <> '00000000-0000-4000-8000-0000000000b3' then raise exception 'FAIL T35 default %', d->'links'; end if;
  if jsonb_array_length(d->'links') <> 2 or jsonb_array_length(d->'groups') <> 2
     or (select jsonb_array_length(g->'options') from jsonb_array_elements(d->'groups') g where g->>'name' = 'الطعم') <> 1 then raise exception 'FAIL T35 list %', d; end if;

  -- required flavour missing / over the limit / add-on of another product / inactive option
  begin perform public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), '{"name": "عميل إضافات", "phone": "01066666666"}',
      jsonb_build_object('label', 'البيت', 'area_id', area, 'street', 'ش'), '[{"sku": "T-203", "qty": 1}]', null);
    raise exception 'FAIL T35 required group skipped';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), '{"name": "عميل إضافات", "phone": "01066666666"}',
      jsonb_build_object('label', 'البيت', 'area_id', area, 'street', 'ش'),
      '[{"sku": "T-203", "qty": 1, "modifiers": [{"id": "00000000-0000-4000-8000-0000000000b1", "qty": 6}, {"id": "00000000-0000-4000-8000-0000000000b3", "qty": 1}]}]', null);
    raise exception 'FAIL T35 max ignored';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), '{"name": "عميل إضافات", "phone": "01066666666"}',
      jsonb_build_object('label', 'البيت', 'area_id', area, 'street', 'ش'),
      '[{"sku": "T-201", "qty": 1, "modifiers": [{"id": "00000000-0000-4000-8000-0000000000b1", "qty": 1}]}]', null);
    raise exception 'FAIL T35 add-on of another product';
  exception when no_data_found then null; end;
  begin perform public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), '{"name": "عميل إضافات", "phone": "01066666666"}',
      jsonb_build_object('label', 'البيت', 'area_id', area, 'street', 'ش'),
      '[{"sku": "T-203", "qty": 1, "modifiers": [{"id": "00000000-0000-4000-8000-0000000000b4", "qty": 1}]}]', null);
    raise exception 'FAIL T35 inactive option';
  exception when no_data_found then null; end;

  -- 2 × (product + عسل×2 + مكسرات + فانيليا) = 2 × product + 2 × 30
  o := public.cc_place_order(current_setting('cc.agent')::uuid, current_setting('cc.req')::uuid, '{"name": "عميل إضافات", "phone": "01066666666"}',
         jsonb_build_object('label', 'البيت', 'area_id', area, 'street', 'ش'), items, null);
  select to_jsonb(i) into l from public.cc_order_items i where i.order_id = o.id and i.sku = 'T-203';
  if (l->>'line_total')::numeric <> price203 * 2 + 60 or jsonb_array_length(l->'modifiers') <> 3 then raise exception 'FAIL T35 line %', l; end if;
  if o.subtotal <> (select sum(line_total) from public.cc_order_items where order_id = o.id) or o.total <> o.subtotal + o.delivery_fee then raise exception 'FAIL T35 totals'; end if;
  o2 := public.cc_place_order(current_setting('cc.agent')::uuid, current_setting('cc.req')::uuid, '{"name": "عميل إضافات", "phone": "01066666666"}',
         jsonb_build_object('label', 'البيت', 'area_id', area, 'street', 'ش'), items, null);
  if o2.id <> o.id or o2.total <> o.total then raise exception 'FAIL T35 repeated draft changed the order'; end if;
  perform set_config('cc.o35', o.id::text, true);
end $$;
reset role;
update public.cc_modifier_options set price = 7 where id = '00000000-0000-4000-8000-0000000000b1';   -- عسل price changes
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare o public.cc_orders; oid uuid := current_setting('cc.o35')::uuid; l jsonb; x jsonb;
  price203 numeric := (select unit_price from public.cc_order_items where order_id = current_setting('cc.o35')::uuid and sku = 'T-203');
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  -- only the add-ons change: مكسرات 1 → 2 (عسل keeps 5)
  o := public.cc_edit_order(current_setting('cc.agent')::uuid, oid, null,
         '[{"sku": "T-203", "qty": 2, "modifiers": [{"id": "00000000-0000-4000-8000-0000000000b1", "qty": 2}, {"id": "00000000-0000-4000-8000-0000000000b2", "qty": 2}, {"id": "00000000-0000-4000-8000-0000000000b3", "qty": 1}]}, {"sku": "T-201", "qty": 1}]', null);
  select to_jsonb(i) into l from public.cc_order_items i where i.order_id = oid and i.sku = 'T-203';
  if (l->>'line_total')::numeric <> price203 * 2 + 100 then raise exception 'FAIL T35 edit price %', l; end if;
  if (select string_agg(c->>'kind', ',') from jsonb_array_elements(o.edit_changes) c) <> 'modifiers' then raise exception 'FAIL T35 edit changes %', o.edit_changes; end if;
  if o.total <> (select sum(line_total) from public.cc_order_items where order_id = oid) + o.delivery_fee then raise exception 'FAIL T35 edit totals'; end if;
  select y into x from public.cc_prep_orders() y where y->>'id' = oid::text;
  if (select jsonb_array_length(i->'modifiers') from jsonb_array_elements(x->'items') i where i->>'name' = l->>'product_name') <> 3 then raise exception 'FAIL T35 prep %', x; end if;
  raise notice 'PASS T35 add-ons: admin-only links with min/max, database prices, option chosen in advance, required group, limits, other product/inactive refused, repeat unchanged, edit keeps add-on price, prep sees add-ons';
end $$;
rollback;

-- T36 — one account per person (14_account_names.sql): the code + a name links the account with that name;
-- the name is used on orders whatever the app sends; old accounts write their name once; admin sees names
begin;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
end $$;
insert into auth.users (id, email) values (gen_random_uuid(), 'new36@cc.test'), (gen_random_uuid(), 'other36@cc.test');
insert into public.cc_agents (name) values ('كريم 36') on conflict do nothing;   -- a name added earlier from the list
select set_config('cc.other_agent', (select id::text from public.cc_agents where name = 'كريم 36'), true);
-- the admin sets a code
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin perform public.cc_set_signup_code('code-3636'); end $$;
reset role;
-- a new person: wrong code → false; no name → refused; right code + name → linked with that name
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'new36@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare o public.cc_orders; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  if public.cc_join_with_code('wrong-code', 'سارة 36') then raise exception 'FAIL T36 wrong code joined'; end if;
  begin perform public.cc_join_with_code('code-3636', ' '); raise exception 'FAIL T36 empty name';
  exception when invalid_parameter_value then null; end;
  if not public.cc_join_with_code('code-3636', '  سارة   36 ') then raise exception 'FAIL T36 right code'; end if;
  if public.cc_my_role() <> 'call_center' then raise exception 'FAIL T36 role'; end if;
  begin perform public.cc_set_my_name('اسم تاني'); raise exception 'FAIL T36 renamed itself';
  exception when invalid_parameter_value then null; end;
  -- the app sends another person's name: the order is still saved with this account's name
  o := public.cc_place_order(current_setting('cc.other_agent')::uuid, gen_random_uuid(), '{"name": "عميل 36", "phone": "01036363636"}',
         jsonb_build_object('label', 'البيت', 'area_id', (select id from public.cc_delivery_areas where active order by name limit 1), 'street', 'ش 36'),
         '[{"sku": "T-201", "qty": 1}]', null);
  if o.agent_name <> 'سارة 36' then raise exception 'FAIL T36 order name %', o.agent_name; end if;
end $$;
reset role;
-- another new person cannot take a name already used by an account; can take a list name nobody uses
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'other36@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  begin perform public.cc_join_with_code('code-3636', 'سارة 36'); raise exception 'FAIL T36 same name twice';
  exception when unique_violation then null; end;
  if not public.cc_join_with_code('code-3636', 'كريم 36') then raise exception 'FAIL T36 list name'; end if;
end $$;
reset role;
-- an old account without a name writes it once; the admin list shows names
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare n text; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  if (public.cc_set_my_name('المسؤول 36')).name <> 'المسؤول 36' then raise exception 'FAIL T36 set my name'; end if;
  select string_agg(coalesce(a.name, '-'), ',' order by a.name) into n from public.cc_list_accounts() a where a.email like '%36@cc.test' or a.email = 'staff@cc.test';
  if n <> 'المسؤول 36,سارة 36,كريم 36' then raise exception 'FAIL T36 list %', n; end if;
  if (select other_agent from (select (select agent_id from public.cc_staff where user_id = auth.uid()) other_agent) x) is null then raise exception 'FAIL T36 link'; end if;
  raise notice 'PASS T36 accounts with names: code + name links the account, orders always carry the account''s own name, no duplicate names, list names taken over, old accounts name themselves once, admin list shows names';
end $$;
rollback;

-- T37 — customers page (15_customer_profile.sql): list with totals, search, sort; a customer's numbers and favourites
begin;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
end $$;
insert into public.cc_agents (name) values ('موظف 37') on conflict do nothing;
insert into auth.users (id, email) values (gen_random_uuid(), 'prep37@cc.test');
insert into public.cc_staff (user_id, display_name, role) select id, 'x', 'prep' from auth.users where email = 'prep37@cc.test';
select set_config('cc.agent', (select id::text from public.cc_agents where name = 'موظف 37'), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare o1 public.cc_orders; o3 public.cc_orders; s jsonb; cid uuid; r record;
  addr jsonb := jsonb_build_object('label', 'البيت', 'area_id', (select id from public.cc_delivery_areas where active order by name limit 1), 'street', 'ش 37');
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  o1 := public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), '{"name": "عميلة المفضل", "phone": "01037373737"}', addr,
          '[{"sku": "T-201", "qty": 2}, {"sku": "T-203", "qty": 1}]', null);
  cid := o1.customer_id;
  perform public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), jsonb_build_object('id', cid), jsonb_build_object('id', o1.address_id),
          '[{"sku": "T-201", "qty": 1}]', null);
  o3 := public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), jsonb_build_object('id', cid), jsonb_build_object('id', o1.address_id),
          '[{"sku": "T-203", "qty": 5}]', null);
  perform public.cc_cancel_order_as(current_setting('cc.agent')::uuid, o3.id, 'تجربة');
  s := public.cc_customer_stats(cid);
  if (s->>'orders')::int <> 2 or (s->>'cancelled')::int <> 1 then raise exception 'FAIL T37 counts %', s; end if;
  if (s->>'total')::numeric <> (select sum(total) from public.cc_orders where customer_id = cid and status <> 'cancelled') then raise exception 'FAIL T37 total %', s; end if;
  if s->'top_products'->0->>'sku' <> 'T-201' or (s->'top_products'->0->>'orders')::int <> 2 then raise exception 'FAIL T37 favourite %', s->'top_products'; end if;
  if s->'top_area'->>'name' is null then raise exception 'FAIL T37 area'; end if;
  select * into r from public.cc_list_customers('7373', 'orders', 50, 0) limit 1;
  if r.id <> cid or r.orders <> 2 then raise exception 'FAIL T37 search by phone'; end if;
  select * into r from public.cc_list_customers('المفضل', 'last', 50, 0) limit 1;
  if r.id <> cid then raise exception 'FAIL T37 search by name'; end if;
  select * into r from public.cc_list_customers(null, 'orders', 1, 0);
  if r.orders < 2 then raise exception 'FAIL T37 sort by orders'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'prep37@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  begin perform public.cc_list_customers(null, 'last', 10, 0); raise exception 'FAIL T37 prep listed customers';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T37 customers page: list with call-center totals, search by name/phone, sort, customer numbers (orders, cancelled, total, favourite product, usual area), prep blocked';
end $$;
rollback;

-- T38 — blocked numbers (16_blocked_numbers.sql): blocked number refused, who/when kept, unblock, list; prep cannot
begin;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
end $$;
insert into public.cc_agents (name) values ('موظف 38') on conflict do nothing;
insert into auth.users (id, email) values (gen_random_uuid(), 'prep38@cc.test');
insert into public.cc_staff (user_id, display_name, role) select id, 'x', 'prep' from auth.users where email = 'prep38@cc.test';
insert into public.cc_blocked_phones (phone, source) values ('01038383800', 'foodics');
select set_config('cc.agent', (select id::text from public.cc_agents where name = 'موظف 38'), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare o1 public.cc_orders; o2 public.cc_orders; cid uuid; r record; n int; req uuid := gen_random_uuid();
  addr jsonb := jsonb_build_object('label', 'البيت', 'area_id', (select id from public.cc_delivery_areas where active order by name limit 1), 'street', 'ش 38');
begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  -- a number blocked on Foodics cannot order, even as a new customer
  begin
    perform public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), '{"name": "محظور فودكس", "phone": "01038383800"}', addr, '[{"sku": "T-201", "qty": 1}]', null);
    raise exception 'FAIL T38 Foodics-blocked number ordered';
  exception when invalid_parameter_value then
    if sqlerrm not like '%القائمة السوداء%' then raise; end if;
  end;
  if exists (select 1 from public.cc_customers where phone = '01038383800') then raise exception 'FAIL T38 customer created for a blocked number'; end if;
  -- a customer with a second number; block them from the call center → both numbers blocked
  o1 := public.cc_place_order(current_setting('cc.agent')::uuid, req, '{"name": "عميل 38", "phone": "01038383801", "phone2": "01038383802"}', addr, '[{"sku": "T-201", "qty": 1}]', null);
  cid := o1.customer_id;
  n := public.cc_set_blocked(array['01038383801', '01038383802'], true);
  if n <> 2 then raise exception 'FAIL T38 block count %', n; end if;
  select * into r from public.cc_blocked_of(array['01038383802', '01099999999']);
  if r.phone <> '01038383802' or r.blocked_by_name is null or r.blocked_at is null or r.source <> 'call_center' then raise exception 'FAIL T38 who/when %', r; end if;
  if (select count(*) from public.cc_blocked_of(array['01038383802', '01099999999'])) <> 1 then raise exception 'FAIL T38 only blocked numbers returned'; end if;
  begin
    perform public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), jsonb_build_object('id', cid), jsonb_build_object('id', o1.address_id), '[{"sku": "T-201", "qty": 1}]', null);
    raise exception 'FAIL T38 blocked customer ordered';
  exception when invalid_parameter_value then
    if sqlerrm not like '%القائمة السوداء%' then raise; end if;
  end;
  -- the draft that was already sent still comes back (no error, no second order)
  o2 := public.cc_place_order(current_setting('cc.agent')::uuid, req, jsonb_build_object('id', cid), jsonb_build_object('id', o1.address_id), '[{"sku": "T-201", "qty": 1}]', null);
  if o2.id <> o1.id then raise exception 'FAIL T38 resent draft'; end if;
  -- list shows the customer's name; unknown number has none
  select * into r from public.cc_list_blocked() where phone = '01038383801';
  if r.customer_id <> cid or r.customer_name <> 'عميل 38' then raise exception 'FAIL T38 list %', r; end if;
  select * into r from public.cc_list_blocked() where phone = '01038383800';
  if r.customer_id is not null or r.source <> 'foodics' then raise exception 'FAIL T38 Foodics row %', r; end if;
  -- blocking again changes nothing; bad number refused
  if public.cc_set_blocked(array['01038383801'], true) <> 0 then raise exception 'FAIL T38 double block'; end if;
  begin perform public.cc_set_blocked(array['123'], true); raise exception 'FAIL T38 bad number';
  exception when invalid_parameter_value then null; end;
  -- unblock → can order again
  if public.cc_set_blocked(array['01038383801', '01038383802'], false) <> 2 then raise exception 'FAIL T38 unblock'; end if;
  perform public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(), jsonb_build_object('id', cid), jsonb_build_object('id', o1.address_id), '[{"sku": "T-201", "qty": 1}]', null);
end $$;
do $$ begin
  begin perform 1 from public.cc_blocked_phones; raise exception 'FAIL T38 table readable directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'prep38@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  begin perform public.cc_set_blocked(array['01038383801'], true); raise exception 'FAIL T38 prep blocked a number';
  exception when insufficient_privilege then null; end;
  begin perform public.cc_list_blocked(); raise exception 'FAIL T38 prep listed blocked';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS T38 blocked numbers: Foodics/call-center blocked number refused (new and saved customer), both numbers blocked together, who/when kept, list with customer name, unblock, resent draft unaffected, prep cannot';
end $$;
rollback;

-- T39 — only the admin unblocks (17_admin_unblock.sql); the call center still blocks
begin;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
end $$;
insert into auth.users (id, email) values (gen_random_uuid(), 'cc39@cc.test');
insert into public.cc_staff (user_id, display_name, role) select id, 'x', 'call_center' from auth.users where email = 'cc39@cc.test';
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'cc39@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  if public.cc_set_blocked(array['01039393900'], true) <> 1 then raise exception 'FAIL T39 call center could not block'; end if;
  begin perform public.cc_set_blocked(array['01039393900'], false); raise exception 'FAIL T39 call center unblocked';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.cc_blocked_of(array['01039393900'])) <> 1 then raise exception 'FAIL T39 number unblocked'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  if not public.cc_is_admin() then raise exception 'FAIL T39 staff@cc.test is not admin'; end if;
  if public.cc_set_blocked(array['01039393900'], false) <> 1 then raise exception 'FAIL T39 admin could not unblock'; end if;
  raise notice 'PASS T39 only the admin unblocks; the call center blocks but cannot unblock';
end $$;
rollback;

-- T40 — drivers (18_driver_tracking.sql): the branch picks the driver at the cashier (can change him), the driver sees
--        only his picked orders (number + address), «خرجت» once for all = one trip, «سلّمت» needs his photo path,
--        branch «الطيار رجع» for the trip, admin report / fixes, who can do what
begin;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
end $$;
insert into auth.users (id, email) values (gen_random_uuid(), 'drv40@cc.test'), (gen_random_uuid(), 'drv40b@cc.test'), (gen_random_uuid(), 'prep40@cc.test'), (gen_random_uuid(), 'cc40@cc.test');
insert into public.cc_agents (name) values ('طيار 40'), ('طيار 40ب') on conflict do nothing;
insert into public.cc_staff (user_id, display_name, role, agent_id)
select u.id, 'x', case when u.email like 'drv%' then 'driver' when u.email like 'prep%' then 'prep' else 'call_center' end,
       (select id from public.cc_agents where name = case u.email when 'drv40@cc.test' then 'طيار 40' when 'drv40b@cc.test' then 'طيار 40ب' end)
  from auth.users u where u.email in ('drv40@cc.test', 'drv40b@cc.test', 'prep40@cc.test', 'cc40@cc.test');
-- three orders ready at the cashier (placed by the call center inside this test)
insert into public.cc_agents (name) values ('موظف 40') on conflict do nothing;
select set_config('cc.agent', (select id::text from public.cc_agents where name = 'موظف 40'), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare addr jsonb := jsonb_build_object('label', 'البيت', 'area_id', (select id from public.cc_delivery_areas where active order by name limit 1), 'street', 'ش 40');
  o public.cc_orders; i int; begin
  for i in 1..3 loop
    o := public.cc_place_order(current_setting('cc.agent')::uuid, gen_random_uuid(),
           jsonb_build_object('name', 'عميل 40-' || i, 'phone', '0104040410' || i), addr, '[{"sku": "T-201", "qty": 1}]', null);
    perform set_config('cc.o' || i, o.id::text, true);
  end loop;
end $$;
reset role;
update public.cc_orders set stage = 'at_cashier', preparing_at = now(), at_cashier_at = now()
 where id::text in (current_setting('cc.o1'), current_setting('cc.o2'), current_setting('cc.o3'));
select set_config('cc.drv', (select id::text from auth.users where email = 'drv40@cc.test'), true);
select set_config('cc.drvb', (select id::text from auth.users where email = 'drv40b@cc.test'), true);
select set_config('cc.cc40', (select id::text from auth.users where email = 'cc40@cc.test'), true);
update public.cc_staff set phone = '01040404041' where user_id = current_setting('cc.drvb')::uuid;

-- the branch picks the drivers: o2 then o1 for drv, o3 for drvb first then changed to drv b … and back
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'prep40@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  begin perform public.cc_assign_driver(current_setting('cc.o1')::uuid, current_setting('cc.cc40')::uuid); raise exception 'FAIL T40 picked a non-driver';
  exception when invalid_parameter_value then null; end;
  perform public.cc_assign_driver(current_setting('cc.o2')::uuid, current_setting('cc.drv')::uuid);
  perform pg_sleep(0.01);
  perform public.cc_assign_driver(current_setting('cc.o1')::uuid, current_setting('cc.drv')::uuid);
  perform public.cc_assign_driver(current_setting('cc.o3')::uuid, current_setting('cc.drv')::uuid);
  perform public.cc_assign_driver(current_setting('cc.o3')::uuid, current_setting('cc.drvb')::uuid);   -- changed his mind
  if public.cc_assign_driver(current_setting('cc.o3')::uuid, null) is not null then raise exception 'FAIL T40 unpick'; end if;
  perform public.cc_assign_driver(current_setting('cc.o3')::uuid, current_setting('cc.drvb')::uuid);
  begin perform public.cc_set_stage(current_setting('cc.o1')::uuid, 'out'); raise exception 'FAIL T40 branch sent out';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- the driver
select set_config('request.jwt.claims', json_build_object('sub', current_setting('cc.drv'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare d jsonb; r jsonb; o1 uuid := current_setting('cc.o1')::uuid; o2 uuid := current_setting('cc.o2')::uuid; at timestamptz; begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP'; end if;
  if exists (select 1 from public.cc_orders) or exists (select 1 from public.cc_customers) then raise exception 'FAIL T40 driver reads tables'; end if;
  d := public.cc_driver_orders();
  if d->>'phone' is not null or jsonb_array_length(d->'ready') <> 2 then raise exception 'FAIL T40 only my picked orders %', d->'ready'; end if;
  if d->'ready'->0->>'id' <> o2::text then raise exception 'FAIL T40 picked order first'; end if;
  r := d->'ready'->0;
  if r ? 'customer_name' or r ? 'customer_phone' or r ? 'total' or not r ? 'street' or not r ? 'order_no' then raise exception 'FAIL T40 driver sees too much %', r; end if;
  begin perform public.cc_driver_take(); raise exception 'FAIL T40 out without phone';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_set_phone(null, '123'); raise exception 'FAIL T40 bad phone';
  exception when invalid_parameter_value then null; end;
  perform public.cc_set_phone(current_setting('cc.drv')::uuid, '010 4040 4040');
  if public.cc_driver_take() <> 2 then raise exception 'FAIL T40 take'; end if;
  d := public.cc_driver_orders();
  if jsonb_array_length(d->'ready') <> 0 or jsonb_array_length(d->'mine') <> 2 or (d->'mine'->0->>'trip_size')::int <> 2 then raise exception 'FAIL T40 mine %', d; end if;
  begin perform public.cc_driver_take(); raise exception 'FAIL T40 took twice';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_assign_driver(o1, null); raise exception 'FAIL T40 driver picks drivers';
  exception when insufficient_privilege then null; end;
  begin perform public.cc_driver_delivered(o2, 'someone-else/x.jpg', 31.2, 29.9, 20); raise exception 'FAIL T40 foreign photo';
  exception when invalid_parameter_value then null; end;
  begin perform public.cc_driver_delivered(o2, null, null, null, null); raise exception 'FAIL T40 no photo';
  exception when invalid_parameter_value then null; end;
  at := public.cc_driver_delivered(o2, current_setting('cc.drv') || '/o2.jpg', 31.2, 29.9, 15);
  if at is null or public.cc_driver_delivered(o2, current_setting('cc.drv') || '/o2-again.jpg', null, null, null) <> at then raise exception 'FAIL T40 delivered'; end if;
  begin perform public.cc_driver_returned(current_setting('cc.drv')::uuid); raise exception 'FAIL T40 driver marked himself back';
  exception when insufficient_privilege then null; end;
  begin perform public.cc_delivery_report(current_date - 1, current_date); raise exception 'FAIL T40 driver opened the report';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select driver from public.cc_orders where id = current_setting('cc.o2')::uuid) <> 'طيار 40 (01040404040)' then raise exception 'FAIL T40 label %', (select driver from public.cc_orders where id = current_setting('cc.o2')::uuid); end if;
  if (select trip_seq from public.cc_orders where id = current_setting('cc.o2')::uuid) <> 1 or (select assigned_at is null from public.cc_orders where id = current_setting('cc.o1')::uuid) then raise exception 'FAIL T40 trip order'; end if;
end $$;

-- the other driver sees only his own and cannot deliver someone else's
select set_config('request.jwt.claims', json_build_object('sub', current_setting('cc.drvb'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare d jsonb; begin
  d := public.cc_driver_orders();
  if jsonb_array_length(d->'ready') <> 1 or d->'ready'->0->>'id' <> current_setting('cc.o3') then raise exception 'FAIL T40 driver b list %', d; end if;
  begin perform public.cc_driver_delivered(current_setting('cc.o2')::uuid, current_setting('cc.drvb') || '/y.jpg', null, null, null); raise exception 'FAIL T40 delivered another''s';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- the branch: cannot re-pick an order already out; «الطيار رجع» for the trip; back to «قيد التجهيز» drops the pick
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'prep40@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare r record; begin
  begin perform public.cc_assign_driver(current_setting('cc.o1')::uuid, current_setting('cc.drvb')::uuid); raise exception 'FAIL T40 re-picked an order out';
  exception when invalid_parameter_value then null; end;
  select * into r from public.cc_drivers_out() where user_id = current_setting('cc.drv')::uuid;
  if r.orders <> 2 or r.delivered <> 1 then raise exception 'FAIL T40 drivers out %', r; end if;
  if public.cc_driver_returned(current_setting('cc.drv')::uuid) <> 2 then raise exception 'FAIL T40 returned'; end if;
  begin perform public.cc_driver_returned(current_setting('cc.drv')::uuid); raise exception 'FAIL T40 returned twice';
  exception when invalid_parameter_value then null; end;
  perform public.cc_set_stage(current_setting('cc.o3')::uuid, 'preparing');
  begin perform public.cc_delivery_report(current_date - 1, current_date); raise exception 'FAIL T40 branch opened the report';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if (select driver_user_id is not null or assigned_at is not null from public.cc_orders where id = current_setting('cc.o3')::uuid) then raise exception 'FAIL T40 pick kept after going back'; end if;
end $$;

-- the call center: sees the times, not the photo or the place; cannot record
select set_config('request.jwt.claims', json_build_object('sub', current_setting('cc.cc40'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare d jsonb; begin
  d := public.cc_order_delivery_of(current_setting('cc.o2')::uuid);
  if d->>'delivered_at' is null or d->>'returned_at' is null or d->>'assigned_at' is null or d ? 'photo_path' or d ? 'lat' then raise exception 'FAIL T40 call center view %', d; end if;
  begin perform public.cc_admin_delivery(current_setting('cc.o1')::uuid, 'delivered'); raise exception 'FAIL T40 call center recorded';
  exception when insufficient_privilege then null; end;
  begin perform public.cc_assign_driver(current_setting('cc.o3')::uuid, null); raise exception 'FAIL T40 call center picked';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.cc_order_delivery; raise exception 'FAIL T40 proof table readable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- the admin: report with photo/place/trip/pick time; records a step for a driver (marked)
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'staff@cc.test'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ declare r jsonb; d jsonb; begin
  select x into r from public.cc_delivery_report(current_date - 1, current_date + 1) x where x->>'id' = current_setting('cc.o2');
  if r->>'photo_path' is null or (r->>'lat')::float <> 31.2 or r->>'returned_at' is null or (r->>'trip_size')::int <> 2 or r->>'assigned_at' is null or r->>'delivered_admin' <> 'false' then raise exception 'FAIL T40 report %', r; end if;
  perform public.cc_admin_delivery(current_setting('cc.o1')::uuid, 'delivered');
  d := public.cc_order_delivery_of(current_setting('cc.o1')::uuid);
  if d->>'delivered_admin' <> 'true' or d->>'delivered_at' is null then raise exception 'FAIL T40 admin record %', d; end if;
  begin perform public.cc_delivery_report(current_date, current_date - 1); raise exception 'FAIL T40 bad period';
  exception when invalid_parameter_value then null; end;
  if not exists (select 1 from public.cc_list_drivers() where user_id = current_setting('cc.drv')::uuid) then raise exception 'FAIL T40 drivers list'; end if;
  if (select phone from public.cc_list_phones() where user_id = current_setting('cc.drv')::uuid) <> '01040404040' then raise exception 'FAIL T40 phones'; end if;
  perform public.cc_set_staff(current_setting('cc.cc40')::uuid, 'driver', true);
  raise notice 'PASS T40 drivers: branch picks/changes the driver at the cashier, driver sees only his picked orders (number+address), «خرجت» once = one trip in pick order, photo in his folder, server time, branch «الطيار رجع» for the trip, back to preparing drops the pick, admin report and records, call center sees times only';
end $$;
rollback;
