-- =====================================================================
--  27 — «التقارير» (phase 1), for the admin only. READ-ONLY.
--
--  CONFIRMED: one call returns, for days p_from..p_to (Cairo days, max 93):
--    summary  — orders (not cancelled), sales, average order, delivery fees,
--               cancelled (+ share), and the same for the period just before
--               (same length) for the ⬆️⬇️ comparison;
--    hours    — orders per hour of the day (0..23, Cairo time);
--    weekdays — orders per day of the week (0 = Sunday … 6 = Saturday);
--    agents   — per employee: orders, sales, average, cancelled;
--    cancel   — reasons (most first), who cancelled, and the cancelled orders.
--  Sales and averages never count cancelled orders.
--
--  CALL-CENTER ONLY: one new function. Nothing is changed or deleted. Safe to re-run.
-- =====================================================================

create or replace function public.cc_report(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_from timestamptz := (p_from::timestamp) at time zone 'Africa/Cairo';
  v_to   timestamptz := ((p_to + 1)::timestamp) at time zone 'Africa/Cairo';
  v_len  integer := p_to - p_from + 1;
  v_pfrom timestamptz;
begin
  if not public.cc_is_admin() then
    raise exception 'التقارير للأدمن بس' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'اختار فترة صحيحة (لحد 3 شهور)' using errcode = '22023';
  end if;
  v_pfrom := ((p_from - v_len)::timestamp) at time zone 'Africa/Cairo';

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

revoke all on function public.cc_report(date, date) from public, anon;
grant execute on function public.cc_report(date, date) to authenticated;
