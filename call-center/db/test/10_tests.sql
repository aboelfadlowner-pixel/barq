-- =====================================================================
--  Call-center tests — TEST PROJECT / LOCAL SANDBOX ONLY.
--  Each block switches to a user (anon / the call-center account / outsider)
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
  if total < 5 then raise exception 'FAIL T03 account sees % products', total; end if;
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
     <> 'T-101=weight,T-104=weight,T-201=unit,T-203=unit,T-900=unit' then
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
  if got <> 'T-101=unit,T-104=weight,T-201=unit,T-203=weight,T-900=unit' then raise exception 'FAIL T26 list %', got; end if;
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
