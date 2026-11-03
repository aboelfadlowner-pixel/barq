-- =====================================================================
--  28 — The working day is from 2 AM to 2 AM (Cairo time), everywhere.
--
--  CONFIRMED: an order at 11 PM or 1 AM belongs to the same day; at 2 AM a
--  new day starts. The screens (board, prep, orders) already worked this way;
--  now the server does too:
--    • the prep screen's list of the day,
--    • the driver's screen (his orders of the day),
--    • «التوصيل» / «لوحة الطيارين» report,
--    • «التقارير»: a day «3 نوفمبر» = 3 Nov 2:00 AM → 4 Nov 2:00 AM.
--  Nothing is hidden or deleted: older orders stay in the data, the reports
--  and the search, exactly as before.
--
--  CALL-CENTER ONLY: two small new helper functions and new bodies for four
--  existing functions (same names, arguments, results and grants).
--  No table is changed. Nothing is dropped or deleted. Safe to re-run.
-- =====================================================================

-- The start of the working day of date d: d at 2:00 AM Cairo time.
create or replace function public.cc_work_day_from(d date)
returns timestamptz
language sql stable security definer
set search_path = ''
as $$ select (d + time '02:00') at time zone 'Africa/Cairo' $$;

-- The start of the current working day (before 2 AM it is still yesterday's day).
create or replace function public.cc_work_day_start()
returns timestamptz
language sql stable security definer
set search_path = ''
as $$ select public.cc_work_day_from(((now() at time zone 'Africa/Cairo') - interval '2 hours')::date) $$;

-- cc_prep_orders: same as in 13_modifiers.sql, only the day start changed.
create or replace function public.cc_prep_orders()
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz := public.cc_work_day_start();   -- 2 AM Cairo
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'شاشة التجهيز للفرع بس' using errcode = '42501';
  end if;
  return query
    select jsonb_build_object(
      'id', o.id, 'order_no', o.order_no, 'created_at', o.created_at,
      'status', o.status, 'cancel_reason', o.cancel_reason, 'cancelled_at', o.cancelled_at,
      'stage', o.stage, 'preparing_at', o.preparing_at, 'at_cashier_at', o.at_cashier_at, 'out_at', o.out_at,
      'driver', o.driver,
      'customer_name', o.customer_name, 'customer_phone', o.customer_phone, 'customer_phone2', o.customer_phone2,
      'area_name', o.area_name, 'address_label', o.address_label, 'street', o.street,
      'housing_type', o.housing_type, 'address_notes', o.address_notes,
      'note', o.note, 'agent_name', coalesce(o.agent_name, o.created_by_name),
      'edited_at', o.edited_at, 'edit_count', o.edit_count, 'edit_changes', o.edit_changes, 'edit_seen_at', o.edit_seen_at,
      'items', coalesce((select jsonb_agg(jsonb_build_object(
                  'name', i.product_name, 'qty', i.qty, 'weight_grams', i.weight_grams, 'note', i.note,
                  'modifiers', i.modifiers)
                  order by i.line_no)
                from public.cc_order_items i where i.order_id = o.id), '[]'::jsonb))
      from public.cc_orders o
     where o.created_at >= v_day_start
        or (o.status <> 'cancelled' and o.stage <> 'out' and o.created_at > now() - interval '3 days')
     order by o.created_at;
end;
$$;

-- cc_driver_orders: same as in 24_driver_customer_phone.sql, only the day start changed.
create or replace function public.cc_driver_orders()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.cc_staff := public.cc_require_driver();
  v_day_start timestamptz := public.cc_work_day_start();   -- 2 AM Cairo
begin
  return jsonb_build_object(
    'phone', v_me.phone,
    -- picked for me by the branch, not out yet (no customer number yet)
    'ready', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_no', o.order_no, 'assigned_at', o.assigned_at,
        'area_name', o.area_name, 'address_label', o.address_label, 'street', o.street,
        'housing_type', o.housing_type, 'address_notes', o.address_notes) order by o.assigned_at, o.order_no)
      from public.cc_orders o
     where o.stage = 'at_cashier' and o.driver_user_id = auth.uid() and o.status <> 'cancelled'
       and o.created_at > now() - interval '1 day'), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_no', o.order_no, 'out_at', o.out_at, 'trip_id', o.trip_id, 'trip_seq', o.trip_seq,
        'trip_size', o.trip_size, 'cancelled', o.status = 'cancelled', 'delivered_at', d.delivered_at,
        'area_name', o.area_name, 'address_label', o.address_label, 'street', o.street,
        'housing_type', o.housing_type, 'address_notes', o.address_notes,
        -- the customer's numbers, only while the order is with him
        'phones', case when d.delivered_at is null and o.status <> 'cancelled'
                       then (select coalesce(jsonb_agg(p), '[]'::jsonb)
                               from unnest(array[o.customer_phone, nullif(o.customer_phone2, o.customer_phone)]) as p
                              where p is not null and p <> '')
                       else '[]'::jsonb end) order by o.out_at desc, o.trip_seq)
      from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
     where o.driver_user_id = auth.uid() and o.stage = 'out' and o.out_at >= v_day_start
       and d.returned_at is null), '[]'::jsonb));
end;
$$;

-- cc_delivery_report: same as in 19_driver_dashboard.sql, only the day start changed.
create or replace function public.cc_delivery_report(p_from date, p_to date)
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_from timestamptz := public.cc_work_day_from(p_from);       -- p_from 2 AM
  v_to   timestamptz := public.cc_work_day_from(p_to + 1);     -- to the next day's 2 AM
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'اختار فترة لحد شهرين' using errcode = '22023', hint = 'period';
  end if;
  return query
    select jsonb_build_object(
      'id', o.id, 'order_no', o.order_no, 'created_at', o.created_at, 'area_name', o.area_name,
      'at_cashier_at', o.at_cashier_at, 'assigned_at', o.assigned_at, 'out_at', o.out_at, 'out_by_admin', o.out_by_admin,
      'driver_user_id', o.driver_user_id, 'driver', o.driver,
      'trip_id', o.trip_id, 'trip_seq', o.trip_seq, 'trip_size', o.trip_size,
      'delivered_at', d.delivered_at, 'delivered_admin', coalesce(d.delivered_admin, false),
      'photo_path', d.photo_path, 'lat', d.lat, 'lng', d.lng, 'accuracy_m', d.accuracy_m,
      'returned_at', d.returned_at, 'returned_admin', coalesce(d.returned_admin, false), 'returned_by_name', d.returned_by_name,
      'returned_lat', d.returned_lat, 'returned_lng', d.returned_lng, 'returned_distance_m', d.returned_distance_m,
      'returned_far', d.returned_far,
      'total', o.total, 'delivery_fee', o.delivery_fee)
      from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
     where o.out_at >= v_from and o.out_at < v_to and o.status <> 'cancelled'
     order by o.out_at desc, o.trip_seq;
end;
$$;

-- cc_report: same as in 27_reports.sql, only the day start changed.
create or replace function public.cc_report(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_from timestamptz := public.cc_work_day_from(p_from);       -- p_from 2 AM
  v_to   timestamptz := public.cc_work_day_from(p_to + 1);     -- to the next day's 2 AM
  v_len  integer := p_to - p_from + 1;
  v_pfrom timestamptz;
begin
  if not public.cc_is_admin() then
    raise exception 'التقارير للأدمن بس' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'اختار فترة صحيحة (لحد 3 شهور)' using errcode = '22023';
  end if;
  v_pfrom := public.cc_work_day_from(p_from - v_len);

  return (
    with o as (
      select x.*, coalesce(x.agent_name, x.created_by_name, 'بدون اسم') as who,
             (x.created_at at time zone 'Africa/Cairo') as local_at
        from public.cc_orders x
       where x.created_at >= v_from and x.created_at < v_to
    ),
    prev as (
      select x.* from public.cc_orders x where x.created_at >= v_pfrom and x.created_at < v_from
    ),
    ok as (select * from o where status <> 'cancelled')
    select jsonb_build_object(
      'from', p_from, 'to', p_to,
      'summary', jsonb_build_object(
        'orders',    (select count(*) from ok),
        'sales',     coalesce((select sum(total) from ok), 0),
        'avg',       coalesce((select round(avg(total), 2) from ok), 0),
        'fees',      coalesce((select sum(delivery_fee) from ok), 0),
        'cancelled', (select count(*) from o where status = 'cancelled'),
        'all',       (select count(*) from o)),
      'previous', jsonb_build_object(
        'orders',    (select count(*) from prev where status <> 'cancelled'),
        'sales',     coalesce((select sum(total) from prev where status <> 'cancelled'), 0),
        'avg',       coalesce((select round(avg(total), 2) from prev where status <> 'cancelled'), 0),
        'fees',      coalesce((select sum(delivery_fee) from prev where status <> 'cancelled'), 0),
        'cancelled', (select count(*) from prev where status = 'cancelled'),
        'all',       (select count(*) from prev)),
      'hours', (select jsonb_agg(jsonb_build_object('h', h,
                  'n', (select count(*) from ok where extract(hour from ok.local_at) = h),
                  'sales', coalesce((select sum(total) from ok where extract(hour from ok.local_at) = h), 0)) order by h)
                  from generate_series(0, 23) h),
      'weekdays', (select jsonb_agg(jsonb_build_object('d', d,
                  'n', (select count(*) from ok where extract(dow from ok.local_at) = d),
                  'sales', coalesce((select sum(total) from ok where extract(dow from ok.local_at) = d), 0)) order by d)
                  from generate_series(0, 6) d),
      'agents', coalesce((select jsonb_agg(a order by (a->>'orders')::int desc, a->>'name')
                  from (select jsonb_build_object('name', who,
                          'orders', count(*) filter (where status <> 'cancelled'),
                          'sales', coalesce(sum(total) filter (where status <> 'cancelled'), 0),
                          'avg', coalesce(round(avg(total) filter (where status <> 'cancelled'), 2), 0),
                          'cancelled', count(*) filter (where status = 'cancelled')) a
                          from o group by who) t), '[]'::jsonb),
      'cancel', jsonb_build_object(
        'reasons', coalesce((select jsonb_agg(jsonb_build_object('reason', r, 'n', n) order by n desc, r)
                     from (select coalesce(nullif(btrim(cancel_reason), ''), 'بدون سبب') r, count(*) n
                             from o where status = 'cancelled' group by 1) t), '[]'::jsonb),
        'by', coalesce((select jsonb_agg(jsonb_build_object('name', b, 'n', n) order by n desc, b)
                     from (select coalesce(cancelled_by_agent, cancelled_by_name, 'غير معروف') b, count(*) n
                             from o where status = 'cancelled' group by 1) t), '[]'::jsonb),
        'orders', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'order_no', order_no, 'at', cancelled_at,
                       'reason', cancel_reason, 'by', coalesce(cancelled_by_agent, cancelled_by_name), 'total', total,
                       'agent', who) order by cancelled_at desc)
                     from (select * from o where status = 'cancelled' order by cancelled_at desc limit 200) c), '[]'::jsonb))
    ));
end;
$$;

revoke all on function public.cc_work_day_from(date) from public, anon;
revoke all on function public.cc_work_day_start()    from public, anon;
grant execute on function public.cc_work_day_from(date) to authenticated;
grant execute on function public.cc_work_day_start()    to authenticated;
-- (the four functions above keep their grants: create or replace does not change them)
