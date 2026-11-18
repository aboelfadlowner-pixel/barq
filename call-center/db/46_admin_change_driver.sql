-- =====================================================================
--  46 — the admin changes the driver when the branch picked the wrong one.
--
--  CONFIRMED: on the order's page the admin (only) has «🔄 تغيير الطيار»:
--    • on the cashier (not out yet): the name changes; the right driver presses «استلمت»;
--    • out (also delivered — same work day only): the order leaves the wrong driver's
--      lists («معايا» / «طلباتي») and goes to the right one — into his open trip if he is
--      out now, else on its own;
--    • the wrong driver gets no message — it just goes from his screen;
--    • every change is kept (from whom, to whom, who changed it, when) and shown on the
--      order's page.
--
--  CALL-CENTER ONLY: one new table (cc_order_driver_changes) and two new functions.
--  Nothing existing is changed or deleted. Safe to re-run.
-- =====================================================================

create table if not exists public.cc_order_driver_changes (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.cc_orders(id) on delete cascade,
  stage       text not null,                     -- at_cashier / out / delivered — when it was changed
  from_driver uuid references auth.users(id),
  from_label  text,
  to_driver   uuid not null references auth.users(id),
  to_label    text,
  by_user     uuid references auth.users(id),
  by_name     text,
  at          timestamptz not null default clock_timestamp()
);
create index if not exists cc_order_driver_changes_order_idx on public.cc_order_driver_changes (order_id, id);
alter table public.cc_order_driver_changes enable row level security;
revoke all on public.cc_order_driver_changes from anon, authenticated, public;

create or replace function public.cc_admin_change_driver(p_order_id uuid, p_driver uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o         public.cc_orders;
  v_d         public.cc_order_delivery;
  v_label     text;
  v_stage     text;
  v_trip      uuid;
  v_seq       int;
  v_day_start timestamptz := public.cc_work_day_start();
begin
  if not public.cc_is_admin() then
    raise exception 'تغيير الطيار للأدمن بس' using errcode = '42501';
  end if;
  select * into v_o from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_o.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى' using errcode = '22023', hint = 'cancelled';
  end if;
  if v_o.stage not in ('at_cashier', 'out') then
    raise exception 'الطلب لسه ما وصلش الكاشير' using errcode = '22023', hint = 'stale';
  end if;
  if v_o.driver_user_id is null then
    raise exception 'الطلب ده من غير طيار — الفرع يختار الطيار من شاشته' using errcode = '22023', hint = 'driver';
  end if;
  if v_o.stage = 'out' and v_o.out_at < v_day_start then
    raise exception 'تغيير الطيار في نفس يوم الشغل بس' using errcode = '22023', hint = 'day';
  end if;
  if not exists (select 1 from public.cc_staff where user_id = p_driver and role = 'driver' and active) then
    raise exception 'اختار طيار من القائمة' using errcode = '22023', hint = 'driver';
  end if;
  if p_driver = v_o.driver_user_id then
    raise exception 'ده نفس الطيار' using errcode = '22023', hint = 'nochange';
  end if;
  v_label := public.cc_driver_label(p_driver);
  v_stage := v_o.stage;

  if v_o.stage = 'at_cashier' then
    update public.cc_orders
       set driver_user_id = p_driver, driver = v_label, assigned_at = clock_timestamp()
     where id = p_order_id;
  else
    select * into v_d from public.cc_order_delivery where order_id = p_order_id for update;
    if v_d.delivered_at is not null then v_stage := 'delivered'; end if;
    -- the right driver's open trip today (out, not back yet)
    select o.trip_id into v_trip
      from public.cc_orders o
     where o.driver_user_id = p_driver and o.stage = 'out' and o.status <> 'cancelled' and o.id <> p_order_id
       and o.out_at >= v_day_start and o.trip_id is not null
       and not exists (select 1 from public.cc_order_delivery x where x.order_id = o.id and x.returned_at is not null)
     order by o.out_at desc limit 1;
    if v_trip is not null then
      select coalesce(max(trip_seq), 0) + 1 into v_seq from public.cc_orders where trip_id = v_trip;
      -- he has not come back yet, so the order is not «رجع الفرع» either
      update public.cc_order_delivery
         set returned_at = null, returned_by = null, returned_by_name = null, returned_admin = false,
             returned_lat = null, returned_lng = null, returned_accuracy_m = null, returned_distance_m = null, returned_far = null
       where order_id = p_order_id and returned_at is not null;
    else
      v_trip := gen_random_uuid();
      v_seq := 1;
    end if;
    update public.cc_orders
       set driver_user_id = p_driver, driver = v_label, trip_id = v_trip, trip_seq = v_seq
     where id = p_order_id;
    -- the trip it joined, and the one it left: numbered 1..n again
    update public.cc_orders o
       set trip_seq = r.n, trip_size = r.c
      from (select id, row_number() over (partition by trip_id order by trip_seq, order_no) as n,
                   count(*) over (partition by trip_id) as c
              from public.cc_orders
             where trip_id in (v_trip, v_o.trip_id)) r
     where o.id = r.id and (o.trip_seq is distinct from r.n or o.trip_size is distinct from r.c);
  end if;

  insert into public.cc_order_driver_changes (order_id, stage, from_driver, from_label, to_driver, to_label, by_user, by_name)
  values (p_order_id, v_stage, v_o.driver_user_id, v_o.driver, p_driver, v_label, auth.uid(), public.cc_person_name(auth.uid()));
  return v_label;
end;
$$;

-- The order's page: its driver changes, oldest first.
create or replace function public.cc_order_driver_changes(p_order_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('at', c.at, 'stage', c.stage, 'from', c.from_label, 'to', c.to_label, 'by', c.by_name)
                     order by c.id)
      from public.cc_order_driver_changes c where c.order_id = p_order_id), '[]'::jsonb);
end;
$$;

revoke all on function public.cc_admin_change_driver(uuid, uuid) from public, anon;
revoke all on function public.cc_order_driver_changes(uuid)      from public, anon;
grant execute on function public.cc_admin_change_driver(uuid, uuid) to authenticated;
grant execute on function public.cc_order_driver_changes(uuid)      to authenticated;
