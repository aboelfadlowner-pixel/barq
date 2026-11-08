-- =====================================================================
--  32 — «استلمت»: each order in preparation is with ONE person.
--
--  CONFIRMED: every person preparing has his own device and account.
--   • «ابدأ التجهيز» = «استلمت»: the order becomes his («مع نادية»), on every screen.
--   • The other one sees it with that name and cannot move it on; he taps
--     «خده مني» to take it over (cc_prep_claim). The admin can always move it.
--   • Back to «جديد»: the order is nobody's again.
--   • The call center sees «بيجهزه: نادية» on the card and in the order page;
--     the order's history shows the person's name (not the e-mail).
--   • «التقارير» › التشغيل: who prepared how many orders and how long it took.
--
--  CALL-CENTER ONLY: three new EMPTY columns on cc_orders (prep_user_id,
--  prep_name, prep_claimed_at — nothing existing changes), two new functions,
--  and new bodies for cc_set_stage / cc_prep_orders / cc_report_ops (same names,
--  arguments and grants). Nothing is dropped or deleted. Safe to re-run.
-- =====================================================================

alter table public.cc_orders add column if not exists prep_user_id    uuid references auth.users(id);
alter table public.cc_orders add column if not exists prep_name       text;
alter table public.cc_orders add column if not exists prep_claimed_at timestamptz;

-- A person's name as the screens show it: his employee name, else his account name, else his e-mail.
create or replace function public.cc_person_name(p_user uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(a.name, nullif(nullif(btrim(s.display_name), ''), 'x'), u.email::text)
    from auth.users u
    left join public.cc_staff s on s.user_id = u.id
    left join public.cc_agents a on a.id = s.agent_id
   where u.id = p_user
$$;
revoke all on function public.cc_person_name(uuid) from public, anon, authenticated;

-- «خده مني»: take an order another person has (or one nobody has) — prep and admin.
create or replace function public.cc_prep_claim(p_order_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.cc_orders;
  v_name  text;
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'التجهيز للفرع بس' using errcode = '42501';
  end if;
  select * into v_order from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى' using errcode = '22023', hint = 'cancelled';
  end if;
  if v_order.stage not in ('preparing', 'at_cashier') then
    raise exception 'الطلب ده مش في التجهيز' using errcode = '22023', hint = 'stage';
  end if;
  v_name := public.cc_person_name(auth.uid());
  update public.cc_orders set prep_user_id = auth.uid(), prep_name = v_name, prep_claimed_at = now()
   where id = p_order_id;
  return jsonb_build_object('id', p_order_id, 'prep_name', v_name);
end;
$$;
revoke all on function public.cc_prep_claim(uuid) from public, anon;
grant execute on function public.cc_prep_claim(uuid) to authenticated;

-- cc_set_stage: same as in 18_driver_tracking.sql + the «استلمت» rule and names.
create or replace function public.cc_set_stage(p_order_id uuid, p_stage text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order  public.cc_orders;
  v_stages text[] := array['new', 'preparing', 'at_cashier', 'out'];
  v_from   int;
  v_to     int;
  v_name   text;
  v_admin  boolean := public.cc_is_admin();
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'تغيير حالة التجهيز للفرع بس' using errcode = '42501';
  end if;
  v_to := array_position(v_stages, p_stage);
  if v_to is null then
    raise exception 'حالة غير معروفة' using errcode = '22023', hint = 'stage';
  end if;
  if p_stage = 'out' then
    raise exception 'الطيار هو اللي بيدوس «خرجت» من موبايله' using errcode = '22023', hint = 'driver';
  end if;

  select * into v_order from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى — متكملش تجهيزه' using errcode = '22023', hint = 'cancelled';
  end if;
  v_from := array_position(v_stages, v_order.stage);
  if v_to = v_from then
    return jsonb_build_object('id', v_order.id, 'stage', v_order.stage);   -- double tap: nothing to do
  end if;
  if abs(v_to - v_from) <> 1 then
    raise exception 'الطلب اتغيرت حالته من جهاز تاني — اعمل تحديث' using errcode = '22023', hint = 'stale';
  end if;
  if v_order.stage = 'out' and exists (select 1 from public.cc_order_delivery d where d.order_id = p_order_id and d.delivered_at is not null) then
    raise exception 'الطلب اتسلّم للعميل — مينفعش يرجع' using errcode = '22023', hint = 'delivered';
  end if;

  -- «استلمت»: an order taken by one person is moved on only by that person (or the admin);
  -- the other one taps «خده مني» first (cc_prep_claim).
  if v_order.prep_user_id is not null and v_order.prep_user_id <> auth.uid() and not v_admin then
    raise exception 'الطلب ده مع % — دوس «خده مني» لو هتكمّله إنت', coalesce(v_order.prep_name, 'زميلك')
      using errcode = '22023', hint = 'taken';
  end if;
  v_name := public.cc_person_name(auth.uid());
  update public.cc_orders
     set stage = p_stage,
         preparing_at  = case when v_to > v_from and p_stage = 'preparing'  then now() when v_to < 2 then null else preparing_at end,
         at_cashier_at = case when v_to > v_from and p_stage = 'at_cashier' then now() when v_to < 3 then null else at_cashier_at end,
         out_at        = case when v_to < 4 then null else out_at end,
         -- back to «قيد التجهيز»: the driver picked for it is dropped; back from «خرج»: he stays picked
         driver         = case when v_to < 3 then null else driver end,
         driver_user_id = case when v_to < 3 then null else driver_user_id end,
         assigned_at    = case when v_to < 3 then null else assigned_at end,
         trip_id = case when v_to < 4 then null else trip_id end,
         trip_seq = case when v_to < 4 then null else trip_seq end,
         trip_size = case when v_to < 4 then null else trip_size end,
         out_by_admin = case when v_to < 4 then false else out_by_admin end,
         stage_by_name = v_name,
         -- «ابدأ التجهيز» = «استلمت»: the order is his; back to «جديد»: nobody's
         prep_user_id    = case when p_stage = 'new' then null when prep_user_id is null then auth.uid() else prep_user_id end,
         prep_name       = case when p_stage = 'new' then null when prep_user_id is null then v_name else prep_name end,
         prep_claimed_at = case when p_stage = 'new' then null when prep_user_id is null then now() else prep_claimed_at end
   where id = p_order_id
  returning * into v_order;
  insert into public.cc_order_stage_events (order_id, stage, by_user, by_name) values (p_order_id, p_stage, auth.uid(), v_name);
  return jsonb_build_object('id', v_order.id, 'stage', v_order.stage, 'preparing_at', v_order.preparing_at,
    'at_cashier_at', v_order.at_cashier_at, 'out_at', v_order.out_at);
end;
$$;

-- cc_prep_orders: same as in 28_work_day.sql + who has each order.
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
      'prep_user_id', o.prep_user_id, 'prep_name', o.prep_name, 'prep_claimed_at', o.prep_claimed_at,
      'prep_mine', o.prep_user_id = auth.uid(),
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

-- cc_report_ops: same as in 29_reports_ops.sql + «prep_people».
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
      -- «التجهيز»: who prepared how many, and how long (start → at the cashier)
      'prep_people', coalesce((select jsonb_agg(jsonb_build_object('name', n, 'orders', c, 'avg', a, 'mid', md) order by c desc, n)
                   from (select coalesce(o.prep_name, 'من غير اسم') n, count(*) c,
                                round(avg(m.prep)) a, round((percentile_cont(0.5) within group (order by m.prep))::numeric) md
                           from ok o join m on m.id = o.id
                          where o.preparing_at is not null group by 1) t), '[]'::jsonb),
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
