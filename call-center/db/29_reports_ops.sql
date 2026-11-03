-- =====================================================================
--  29 — «التقارير» phase 2, for the admin only. READ-ONLY.
--
--  CONFIRMED: for the same working days as «التقارير» (2 AM → 2 AM, max 93):
--    speed     — minutes, average and middle (half the orders faster, half slower):
--                order → prep started, prep (started → at the cashier),
--                waiting for the driver (cashier → out), delivery (out → delivered),
--                and order → out; plus the 10 slowest orders to go out;
--    areas     — orders, sales and delivery fees per area;
--    items     — per product: orders, pieces, kilos, sales (top 50 by sales);
--    modifiers — per add-on: times and money (top 30).
--  Cancelled orders are never counted.
--
--  CALL-CENTER ONLY: one new function. Nothing is changed or deleted. Safe to re-run.
-- =====================================================================

create or replace function public.cc_report_ops(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_from timestamptz := public.cc_work_day_from(p_from);
  v_to   timestamptz := public.cc_work_day_from(p_to + 1);
begin
  if not public.cc_is_admin() then
    raise exception 'التقارير للأدمن بس' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'اختار فترة صحيحة (لحد 3 شهور)' using errcode = '22023';
  end if;

  return (
    with ok as (
      select o.*, d.delivered_at
        from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
       where o.created_at >= v_from and o.created_at < v_to and o.status <> 'cancelled'
    ),
    m as (                                 -- minutes of each step (null when the step is missing or out of order)
      select id, order_no, created_at, area_name, driver,
             case when preparing_at >= created_at then extract(epoch from preparing_at - created_at) / 60 end as to_prep,
             case when at_cashier_at >= preparing_at then extract(epoch from at_cashier_at - preparing_at) / 60 end as prep,
             case when out_at >= at_cashier_at then extract(epoch from out_at - at_cashier_at) / 60 end as wait,
             case when delivered_at >= out_at then extract(epoch from delivered_at - out_at) / 60 end as deliver,
             case when out_at >= created_at then extract(epoch from out_at - created_at) / 60 end as total
        from ok
    ),
    li as (
      select i.*, o.id as oid from public.cc_order_items i join ok o on o.id = i.order_id
    )
    select jsonb_build_object(
      'from', p_from, 'to', p_to,
      'speed', (select jsonb_build_object(
          'orders', count(*),
          'to_prep', jsonb_build_object('n', count(to_prep), 'avg', round(avg(to_prep)), 'mid', round((percentile_cont(0.5) within group (order by to_prep))::numeric)),
          'prep',    jsonb_build_object('n', count(prep),    'avg', round(avg(prep)),    'mid', round((percentile_cont(0.5) within group (order by prep))::numeric)),
          'wait',    jsonb_build_object('n', count(wait),    'avg', round(avg(wait)),    'mid', round((percentile_cont(0.5) within group (order by wait))::numeric)),
          'deliver', jsonb_build_object('n', count(deliver), 'avg', round(avg(deliver)), 'mid', round((percentile_cont(0.5) within group (order by deliver))::numeric)),
          'total',   jsonb_build_object('n', count(total),   'avg', round(avg(total)),   'mid', round((percentile_cont(0.5) within group (order by total))::numeric)))
        from m),
      'slow', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'order_no', order_no, 'at', created_at,
                     'area', area_name, 'driver', driver, 'to_prep', round(to_prep), 'prep', round(prep),
                     'wait', round(wait), 'total', round(total)) order by total desc)
                   from (select * from m where total is not null order by total desc limit 10) s), '[]'::jsonb),
      'areas', coalesce((select jsonb_agg(jsonb_build_object('name', a, 'orders', n, 'sales', s, 'fees', f) order by n desc, s desc)
                   from (select coalesce(nullif(btrim(area_name), ''), 'بدون منطقة') a, count(*) n,
                                coalesce(sum(total), 0) s, coalesce(sum(delivery_fee), 0) f
                           from ok group by 1) t), '[]'::jsonb),
      'items', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'sku', sku, 'orders', n, 'qty', q, 'kg', kg, 'sales', s) order by s desc, n desc)
                   from (select max(product_name) name, sku, count(distinct oid) n, coalesce(sum(qty), 0) q,
                                round(coalesce(sum(weight_grams), 0) / 1000.0, 2) kg, coalesce(sum(line_total), 0) s
                           from li group by sku order by 6 desc, 3 desc limit 50) t), '[]'::jsonb),
      'items_count', (select count(distinct sku) from li),
      'modifiers', coalesce((select jsonb_agg(jsonb_build_object('group', g, 'name', nm, 'times', t, 'sales', s) order by t desc, s desc)
                   from (select x->>'group' g, x->>'name' nm,
                                sum(coalesce((x->>'qty')::int, 1) * coalesce(li.qty, 1)) t,
                                round(sum(coalesce((x->>'price')::numeric, 0) * coalesce((x->>'qty')::int, 1) * coalesce(li.qty, 1)), 2) s
                           from li cross join lateral jsonb_array_elements(
                                  case when jsonb_typeof(li.modifiers) = 'array' then li.modifiers else '[]'::jsonb end) x
                          group by 1, 2 order by 3 desc, 4 desc limit 30) t), '[]'::jsonb)
    ));
end;
$$;

revoke all on function public.cc_report_ops(date, date) from public, anon;
grant execute on function public.cc_report_ops(date, date) to authenticated;
