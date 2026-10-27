-- =====================================================================
--  Abu El Fadl Call Center — drivers: out, delivered (photo + place), back (FOR REVIEW)
--
--  CONFIRMED:
--   • A fourth role «طيار» (driver). Each driver has an account with his name and
--     mobile number (written once).
--   • At «على الكاشير» the BRANCH picks the driver from the list (it can change
--     him until he leaves). The driver sees ONLY the orders picked for him — the
--     order number and the address — and taps «خرجت» once for all of them
--     (several orders = one trip). The branch no longer types the driver.
--   • At the customer: «سلّمت» with a photo (bag + ticket) and his place.
--     The time is the server's.
--   • The branch taps «الطيار رجع» when he is back (one tap for the whole trip).
--   • The admin sees the times, the photo and the place, and a delivery report;
--     the admin can record a step for a driver who forgot (marked as such).
--   • Photos are kept 30 days (storage: 18b_driver_photos_storage.sql).
--
--  CALL-CENTER ONLY, ADDITIVE: role «driver», a phone column on cc_staff, the
--  driver/trip columns on cc_orders, one new table (delivery proof, no direct
--  access) and new functions. cc_set_stage no longer moves an order to «out»
--  (the driver does). Nothing is deleted. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role «driver» and the driver's mobile number.
-- ---------------------------------------------------------------------
alter table public.cc_staff drop constraint if exists cc_staff_role_check;
alter table public.cc_staff add constraint cc_staff_role_check check (role in ('admin', 'call_center', 'prep', 'driver'));
alter table public.cc_staff add column if not exists phone text;

alter table public.cc_orders add column if not exists driver_user_id uuid references auth.users(id);
alter table public.cc_orders add column if not exists trip_id        uuid;
alter table public.cc_orders add column if not exists trip_seq       integer;
alter table public.cc_orders add column if not exists trip_size      integer;
alter table public.cc_orders add column if not exists out_by_admin   boolean not null default false;
alter table public.cc_orders add column if not exists assigned_at    timestamptz;      -- the branch picked the driver
create index if not exists cc_orders_driver_idx on public.cc_orders (driver_user_id, out_at desc);

-- Delivery proof: for the admin only (no direct access; functions below).
create table if not exists public.cc_order_delivery (
  order_id        uuid primary key references public.cc_orders(id),
  delivered_at    timestamptz,
  delivered_by    uuid references auth.users(id),
  delivered_admin boolean not null default false,    -- recorded by the admin for the driver
  photo_path      text,                              -- storage: cc-delivery-photos/<driver id>/<file>
  lat             double precision,
  lng             double precision,
  accuracy_m      double precision,
  returned_at     timestamptz,
  returned_by     uuid references auth.users(id),
  returned_by_name text,
  returned_admin  boolean not null default false
);
alter table public.cc_order_delivery enable row level security;
revoke all on public.cc_order_delivery from anon, authenticated, public;

-- The driver's display text kept on the order (same format as before: «الاسم (الرقم)»).
create or replace function public.cc_driver_label(p_user uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(a.name, u.email::text) || coalesce(' (' || s.phone || ')', '')
    from public.cc_staff s
    left join public.cc_agents a on a.id = s.agent_id
    left join auth.users u on u.id = s.user_id
   where s.user_id = p_user
$$;
revoke all on function public.cc_driver_label(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Admin: role list now has «driver».
-- ---------------------------------------------------------------------
create or replace function public.cc_set_staff(p_user_id uuid, p_role text, p_active boolean)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'الحسابات للأدمن بس' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'مش هتقدر تغيّر صلاحية أكونتك إنت' using errcode = '22023', hint = 'self';
  end if;
  if p_role is null or p_role not in ('admin', 'call_center', 'prep', 'driver') then
    raise exception 'صلاحية غير معروفة' using errcode = '22023', hint = 'role';
  end if;
  update public.cc_staff set role = p_role, active = coalesce(p_active, active) where user_id = p_user_id;
  if not found then
    raise exception 'الأكونت غير موجود' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

-- The accounts' mobile numbers for the admin (shown next to the drivers).
create or replace function public.cc_list_phones()
returns table (user_id uuid, phone text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'الحسابات للأدمن بس' using errcode = '42501';
  end if;
  return query select s.user_id, s.phone from public.cc_staff s where s.phone is not null;
end;
$$;

-- The mobile number: the driver writes his own once; the admin can correct anyone's.
create or replace function public.cc_set_phone(p_user_id uuid, p_phone text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  p_user_id := coalesce(p_user_id, auth.uid());             -- empty = my own number
  if p_user_id is distinct from auth.uid() and not public.cc_is_admin() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if v_phone !~ '^0[0-9]{8,10}$' then
    raise exception 'رقم الموبايل غير صحيح — مثال: 01012345678' using errcode = '22023', hint = 'phone';
  end if;
  update public.cc_staff set phone = v_phone where user_id = p_user_id and active;
  if not found then
    raise exception 'الأكونت غير موجود' using errcode = 'P0002';
  end if;
  -- orders still out carry the new label
  update public.cc_orders set driver = public.cc_driver_label(driver_user_id)
   where driver_user_id = p_user_id and stage = 'out'
     and not exists (select 1 from public.cc_order_delivery d where d.order_id = cc_orders.id and d.returned_at is not null);
  return v_phone;
end;
$$;

-- ---------------------------------------------------------------------
-- The branch no longer sends an order out (the driver does). One step back
-- from «out» is still allowed for a wrong take, if not delivered yet.
-- ---------------------------------------------------------------------
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

  select u.email::text into v_name from auth.users u where u.id = auth.uid();
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
         stage_by_name = v_name
   where id = p_order_id
  returning * into v_order;
  insert into public.cc_order_stage_events (order_id, stage, by_user, by_name) values (p_order_id, p_stage, auth.uid(), v_name);
  return jsonb_build_object('id', v_order.id, 'stage', v_order.stage, 'preparing_at', v_order.preparing_at,
    'at_cashier_at', v_order.at_cashier_at, 'out_at', v_order.out_at);
end;
$$;

-- The old «خرج مع الطيار» typed by the branch is closed (kept so old screens get a clear message).
create or replace function public.cc_send_out(p_order_id uuid, p_driver text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  raise exception 'الطيار هو اللي بيدوس «خرجت» من موبايله' using errcode = '22023', hint = 'driver';
end;
$$;

-- ---------------------------------------------------------------------
-- Driver screen.
-- ---------------------------------------------------------------------
create or replace function public.cc_require_driver()
returns public.cc_staff
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_staff public.cc_staff;
begin
  select * into v_staff from public.cc_staff where user_id = auth.uid() and active;
  if not found or v_staff.role not in ('driver', 'admin') then
    raise exception 'الشاشة دي للطيار بس' using errcode = '42501';
  end if;
  return v_staff;
end;
$$;
revoke all on function public.cc_require_driver() from public, anon, authenticated;

-- What the driver sees: the order number and the address — nothing else.
-- ready: at the cashier, not taken · mine: out with me today and not delivered (+ today's delivered).
create or replace function public.cc_driver_orders()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.cc_staff := public.cc_require_driver();
  v_day_start timestamptz := (date_trunc('day', now() at time zone 'Africa/Cairo')) at time zone 'Africa/Cairo';
begin
  return jsonb_build_object(
    'phone', v_me.phone,
    -- picked for me by the branch, not out yet
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
        'housing_type', o.housing_type, 'address_notes', o.address_notes) order by o.out_at desc, o.trip_seq)
      from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
     where o.driver_user_id = auth.uid() and o.stage = 'out' and o.out_at >= v_day_start
       and d.returned_at is null), '[]'::jsonb));
end;
$$;

-- «خرجت»: every order the branch picked for me leaves now, as one trip
-- (in the order they were picked). Returns how many.
create or replace function public.cc_driver_take()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me    public.cc_staff := public.cc_require_driver();
  v_label text;
  v_trip  uuid := gen_random_uuid();
  v_n     int;
  v_o     record;
  v_i     int := 0;
begin
  if v_me.phone is null then
    raise exception 'اكتب رقم موبايلك الأول' using errcode = '22023', hint = 'phone';
  end if;
  select count(*) into v_n from public.cc_orders
   where driver_user_id = v_me.user_id and stage = 'at_cashier' and status <> 'cancelled' and created_at > now() - interval '1 day';
  if v_n = 0 then
    raise exception 'مفيش طلبات متحددة ليك دلوقتي' using errcode = '22023', hint = 'stale';
  end if;
  v_label := public.cc_driver_label(v_me.user_id);
  for v_o in select id from public.cc_orders
              where driver_user_id = v_me.user_id and stage = 'at_cashier' and status <> 'cancelled' and created_at > now() - interval '1 day'
              order by assigned_at, order_no for update loop
    v_i := v_i + 1;
    update public.cc_orders
       set stage = 'out', out_at = now(), driver = v_label,
           trip_id = v_trip, trip_seq = v_i, trip_size = v_n, out_by_admin = false, stage_by_name = v_label
     where id = v_o.id;
    insert into public.cc_order_stage_events (order_id, stage, by_user, by_name) values (v_o.id, 'out', auth.uid(), v_label);
  end loop;
  return v_i;
end;
$$;

-- «سلّمت»: the photo (already uploaded to the driver's folder) and his place; the time is the server's.
create or replace function public.cc_driver_delivered(p_order_id uuid, p_photo text, p_lat double precision,
                                                      p_lng double precision, p_accuracy double precision)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.cc_staff := public.cc_require_driver();
  v_o  public.cc_orders;
  v_at timestamptz;
begin
  select * into v_o from public.cc_orders where id = p_order_id for update;
  if not found or v_o.driver_user_id is distinct from v_me.user_id or v_o.stage <> 'out' then
    raise exception 'الطلب ده مش معاك' using errcode = '22023', hint = 'stale';
  end if;
  select delivered_at into v_at from public.cc_order_delivery where order_id = p_order_id;
  if v_at is not null then
    return v_at;                                              -- double tap: nothing to do
  end if;
  if coalesce(p_photo, '') !~ ('^' || v_me.user_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'صوّر الطلب الأول' using errcode = '22023', hint = 'photo';
  end if;
  if to_regclass('storage.objects') is not null then          -- the photo must really be there
    if not exists (select 1 from storage.objects where bucket_id = 'cc-delivery-photos' and name = p_photo) then
      raise exception 'الصورة ما اترفعتش — جرّب تاني' using errcode = '22023', hint = 'photo';
    end if;
  end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then
    p_lat := null; p_lng := null; p_accuracy := null;
  end if;
  insert into public.cc_order_delivery (order_id, delivered_at, delivered_by, photo_path, lat, lng, accuracy_m)
  values (p_order_id, now(), auth.uid(), p_photo, p_lat, p_lng, p_accuracy)
  on conflict (order_id) do update
     set delivered_at = excluded.delivered_at, delivered_by = excluded.delivered_by, delivered_admin = false,
         photo_path = excluded.photo_path, lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m
  returning delivered_at into v_at;
  return v_at;
end;
$$;

-- ---------------------------------------------------------------------
-- Branch: «اختيار الطيار» for an order at the cashier (or change him / take
-- him off with an empty driver) — until he taps «خرجت».
-- ---------------------------------------------------------------------
create or replace function public.cc_assign_driver(p_order_id uuid, p_driver uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o     public.cc_orders;
  v_label text;
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'اختيار الطيار للفرع بس' using errcode = '42501';
  end if;
  select * into v_o from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_o.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى' using errcode = '22023', hint = 'cancelled';
  end if;
  if v_o.stage = 'out' then
    raise exception 'الطيار خرج بالطلب خلاص' using errcode = '22023', hint = 'stale';
  end if;
  if v_o.stage <> 'at_cashier' then
    raise exception 'الطلب لازم يكون على الكاشير' using errcode = '22023', hint = 'stale';
  end if;
  if p_driver is not null then
    if not exists (select 1 from public.cc_staff where user_id = p_driver and role = 'driver' and active) then
      raise exception 'اختار طيار من القائمة' using errcode = '22023', hint = 'driver';
    end if;
    v_label := public.cc_driver_label(p_driver);
  end if;
  update public.cc_orders
     set driver_user_id = p_driver, driver = v_label, assigned_at = case when p_driver is null then null else clock_timestamp() end
   where id = p_order_id;
  return v_label;
end;
$$;

-- ---------------------------------------------------------------------
-- Branch: the drivers out now, and «الطيار رجع» (the whole trip).
-- ---------------------------------------------------------------------
create or replace function public.cc_drivers_out()
returns table (user_id uuid, label text, orders integer, delivered integer, first_out_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'للفرع بس' using errcode = '42501';
  end if;
  return query
    select o.driver_user_id, min(o.driver), count(*)::int, count(d.delivered_at)::int, min(o.out_at)
      from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
     where o.stage = 'out' and o.driver_user_id is not null and d.returned_at is null
       and o.out_at > now() - interval '1 day'
     group by o.driver_user_id
     order by min(o.out_at);
end;
$$;

create or replace function public.cc_driver_returned(p_driver uuid)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text;
  v_n    int;
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'للفرع بس' using errcode = '42501';
  end if;
  select u.email::text into v_name from auth.users u where u.id = auth.uid();
  insert into public.cc_order_delivery (order_id, returned_at, returned_by, returned_by_name)
  select o.id, now(), auth.uid(), v_name
    from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
   where o.driver_user_id = p_driver and o.stage = 'out' and d.returned_at is null
     and o.out_at > now() - interval '1 day'
  on conflict (order_id) do update
     set returned_at = excluded.returned_at, returned_by = excluded.returned_by,
         returned_by_name = excluded.returned_by_name
   where public.cc_order_delivery.returned_at is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'الطيار ده مش معاه طلبات دلوقتي' using errcode = '22023', hint = 'stale';
  end if;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: record a step for a driver who forgot (marked «اتسجلت من الأدمن»).
--   p_what: 'out' (needs p_driver) | 'delivered' | 'returned'
-- ---------------------------------------------------------------------
create or replace function public.cc_admin_delivery(p_order_id uuid, p_what text, p_driver uuid default null)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o    public.cc_orders;
  v_name text;
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  select * into v_o from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_o.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى' using errcode = '22023', hint = 'cancelled';
  end if;
  select u.email::text into v_name from auth.users u where u.id = auth.uid();
  if p_what = 'out' then
    if v_o.stage <> 'at_cashier' then
      raise exception 'الطلب لازم يكون على الكاشير' using errcode = '22023', hint = 'stale';
    end if;
    if not exists (select 1 from public.cc_staff where user_id = p_driver and role = 'driver' and active) then
      raise exception 'اختار الطيار' using errcode = '22023', hint = 'driver';
    end if;
    update public.cc_orders
       set stage = 'out', out_at = now(), driver = public.cc_driver_label(p_driver), driver_user_id = p_driver,
           assigned_at = coalesce(assigned_at, now()),
           trip_id = gen_random_uuid(), trip_seq = 1, trip_size = 1, out_by_admin = true, stage_by_name = v_name
     where id = p_order_id;
    insert into public.cc_order_stage_events (order_id, stage, by_user, by_name) values (p_order_id, 'out', auth.uid(), v_name);
  elsif p_what in ('delivered', 'returned') then
    if v_o.stage <> 'out' then
      raise exception 'الطلب لسه ما خرجش' using errcode = '22023', hint = 'stale';
    end if;
    if p_what = 'delivered' then
      insert into public.cc_order_delivery (order_id, delivered_at, delivered_by, delivered_admin)
      values (p_order_id, now(), auth.uid(), true)
      on conflict (order_id) do update set delivered_at = now(), delivered_by = auth.uid(), delivered_admin = true
       where public.cc_order_delivery.delivered_at is null;
    else
      insert into public.cc_order_delivery (order_id, returned_at, returned_by, returned_by_name, returned_admin)
      values (p_order_id, now(), auth.uid(), v_name, true)
      on conflict (order_id) do update set returned_at = now(), returned_by = auth.uid(), returned_by_name = v_name, returned_admin = true
       where public.cc_order_delivery.returned_at is null;
    end if;
  else
    raise exception 'خطوة غير معروفة' using errcode = '22023', hint = 'what';
  end if;
  return true;
end;
$$;

-- Active drivers (admin picks one when recording «خرج» for a driver).
create or replace function public.cc_list_drivers()
returns table (user_id uuid, label text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'للفرع بس' using errcode = '42501';
  end if;
  return query
    select s.user_id, public.cc_driver_label(s.user_id) from public.cc_staff s
     where s.role = 'driver' and s.active order by 2;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: the delivery of each order in a period (Cairo days, to included).
-- ---------------------------------------------------------------------
create or replace function public.cc_delivery_report(p_from date, p_to date)
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_from timestamptz := (p_from::timestamp) at time zone 'Africa/Cairo';
  v_to   timestamptz := ((p_to + 1)::timestamp) at time zone 'Africa/Cairo';
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
      'returned_at', d.returned_at, 'returned_admin', coalesce(d.returned_admin, false), 'returned_by_name', d.returned_by_name)
      from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
     where o.out_at >= v_from and o.out_at < v_to and o.status <> 'cancelled'
     order by o.out_at desc, o.trip_seq;
end;
$$;

-- One order's delivery (order details; the admin sees the photo and place, the call center the times).
create or replace function public.cc_order_delivery_of(p_order_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.cc_is_admin();
  v_r jsonb;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  select jsonb_build_object(
      'out_by_admin', o.out_by_admin, 'trip_seq', o.trip_seq, 'trip_size', o.trip_size, 'assigned_at', o.assigned_at,
      'delivered_at', d.delivered_at, 'delivered_admin', coalesce(d.delivered_admin, false),
      'returned_at', d.returned_at, 'returned_admin', coalesce(d.returned_admin, false))
    || case when v_admin then jsonb_build_object('photo_path', d.photo_path, 'lat', d.lat, 'lng', d.lng, 'accuracy_m', d.accuracy_m)
            else '{}'::jsonb end
    into v_r
    from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
   where o.id = p_order_id;
  return v_r;
end;
$$;

revoke all on function public.cc_set_phone(uuid, text)                  from public, anon;
revoke all on function public.cc_list_phones()                          from public, anon;
revoke all on function public.cc_driver_orders()                        from public, anon;
revoke all on function public.cc_driver_take()                          from public, anon;
revoke all on function public.cc_assign_driver(uuid, uuid)              from public, anon;
revoke all on function public.cc_driver_delivered(uuid, text, double precision, double precision, double precision) from public, anon;
revoke all on function public.cc_drivers_out()                          from public, anon;
revoke all on function public.cc_driver_returned(uuid)                  from public, anon;
revoke all on function public.cc_admin_delivery(uuid, text, uuid)       from public, anon;
revoke all on function public.cc_list_drivers()                         from public, anon;
revoke all on function public.cc_delivery_report(date, date)            from public, anon;
revoke all on function public.cc_order_delivery_of(uuid)                from public, anon;
grant execute on function public.cc_set_phone(uuid, text)               to authenticated;
grant execute on function public.cc_list_phones()                       to authenticated;
grant execute on function public.cc_driver_orders()                     to authenticated;
grant execute on function public.cc_driver_take()                       to authenticated;
grant execute on function public.cc_assign_driver(uuid, uuid)           to authenticated;
grant execute on function public.cc_driver_delivered(uuid, text, double precision, double precision, double precision) to authenticated;
grant execute on function public.cc_drivers_out()                       to authenticated;
grant execute on function public.cc_driver_returned(uuid)               to authenticated;
grant execute on function public.cc_admin_delivery(uuid, text, uuid)    to authenticated;
grant execute on function public.cc_list_drivers()                      to authenticated;
grant execute on function public.cc_delivery_report(date, date)         to authenticated;
grant execute on function public.cc_order_delivery_of(uuid)             to authenticated;
