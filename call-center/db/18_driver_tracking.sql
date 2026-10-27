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
--   • The DRIVER taps «رجعت الفرع» when he is back (one tap for the whole trip);
--     his place is kept, and the return is marked «بعيد عن الفرع» when he is
--     more than the set distance from the branch (place set once by the admin).
--   • The ADMIN adds the drivers (name + mobile) from the admin page; each driver
--     gets a personal link (no password, no e-mail). A new link stops the old one.
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
alter table public.cc_staff add column if not exists login_token_hash text;           -- the driver's personal link (sha256)
create unique index if not exists cc_staff_login_token_idx on public.cc_staff (login_token_hash) where login_token_hash is not null;

-- The branch's place (set once by the admin) for «بعيد عن الفرع».
create table if not exists public.cc_branch (
  id         integer primary key default 1 check (id = 1),
  lat        double precision not null,
  lng        double precision not null,
  radius_m   integer not null default 300 check (radius_m between 50 and 5000),
  updated_at timestamptz not null default now()
);
alter table public.cc_branch enable row level security;
revoke all on public.cc_branch from anon, authenticated, public;

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
alter table public.cc_order_delivery add column if not exists returned_lat        double precision;
alter table public.cc_order_delivery add column if not exists returned_lng        double precision;
alter table public.cc_order_delivery add column if not exists returned_accuracy_m double precision;
alter table public.cc_order_delivery add column if not exists returned_distance_m integer;
alter table public.cc_order_delivery add column if not exists returned_far        boolean;
alter table public.cc_order_delivery enable row level security;
revoke all on public.cc_order_delivery from anon, authenticated, public;

-- The driver's display text kept on the order (same format as before: «الاسم (الرقم)»).
create or replace function public.cc_driver_label(p_user uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  -- drivers keep their name on cc_staff (they are not call-center employee names)
  select coalesce(case when s.role = 'driver' then nullif(btrim(s.display_name), '') end, a.name, u.email::text)
         || coalesce(' (' || s.phone || ')', '')
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
-- Distance in metres between two places (good enough for a few km).
-- ---------------------------------------------------------------------
create or replace function public.cc_distance_m(lat1 double precision, lng1 double precision,
                                                lat2 double precision, lng2 double precision)
returns integer
language sql immutable security definer
set search_path = ''
as $$
  select round(2 * 6371000 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2)
         + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))::integer
$$;

-- ---------------------------------------------------------------------
-- Driver: «رجعت الفرع» — every order of his still out (today) is back now,
-- with his place; «بعيد عن الفرع» when farther than the branch radius.
-- Returns { orders, distance_m, far }.
-- ---------------------------------------------------------------------
create or replace function public.cc_driver_returned(p_lat double precision, p_lng double precision, p_accuracy double precision)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me   public.cc_staff := public.cc_require_driver();
  v_b    public.cc_branch;
  v_dist integer;
  v_far  boolean;
  v_n    int;
begin
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then
    p_lat := null; p_lng := null; p_accuracy := null;
  end if;
  select * into v_b from public.cc_branch where id = 1;
  if found and p_lat is not null then
    v_dist := public.cc_distance_m(v_b.lat, v_b.lng, p_lat, p_lng);
    v_far := v_dist - least(coalesce(p_accuracy, 0), 200) > v_b.radius_m;   -- a poor GPS reading does not count against him (up to 200 m)
  end if;
  insert into public.cc_order_delivery (order_id, returned_at, returned_by, returned_by_name,
                                        returned_lat, returned_lng, returned_accuracy_m, returned_distance_m, returned_far)
  select o.id, now(), auth.uid(), public.cc_driver_label(v_me.user_id), p_lat, p_lng, p_accuracy, v_dist, v_far
    from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
   where o.driver_user_id = v_me.user_id and o.stage = 'out' and d.returned_at is null
     and o.out_at > now() - interval '1 day'
  on conflict (order_id) do update
     set returned_at = excluded.returned_at, returned_by = excluded.returned_by, returned_by_name = excluded.returned_by_name,
         returned_lat = excluded.returned_lat, returned_lng = excluded.returned_lng, returned_accuracy_m = excluded.returned_accuracy_m,
         returned_distance_m = excluded.returned_distance_m, returned_far = excluded.returned_far, returned_admin = false
   where public.cc_order_delivery.returned_at is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'مفيش طلبات معاك دلوقتي' using errcode = '22023', hint = 'stale';
  end if;
  return jsonb_build_object('orders', v_n, 'distance_m', v_dist, 'far', coalesce(v_far, false));
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: the branch's place (set once; «بعيد عن الفرع» compares with it).
-- ---------------------------------------------------------------------
create or replace function public.cc_branch_place()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_b public.cc_branch;
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  select * into v_b from public.cc_branch where id = 1;
  return case when found then jsonb_build_object('lat', v_b.lat, 'lng', v_b.lng, 'radius_m', v_b.radius_m, 'updated_at', v_b.updated_at) end;
end;
$$;

create or replace function public.cc_set_branch_place(p_lat double precision, p_lng double precision)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat not between 21 and 32 or p_lng not between 24 and 37 then
    raise exception 'المكان مش في مصر — انسخ الإحداثيات من خرائط جوجل (مثال: 31.1234, 29.8123)' using errcode = '22023', hint = 'place';
  end if;
  insert into public.cc_branch (id, lat, lng) values (1, p_lat, p_lng)
  on conflict (id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: the drivers (added from the admin page, not through sign-up).
-- The login account itself is made by the cc-drivers function (server side);
-- these functions keep the name, mobile, link and on/off.
-- ---------------------------------------------------------------------
create or replace function public.cc_admin_drivers()
returns table (user_id uuid, name text, phone text, active boolean, has_link boolean, created_at timestamptz,
               last_out_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  return query
    select s.user_id, s.display_name, s.phone, s.active, s.login_token_hash is not null, s.created_at,
           (select max(o.out_at) from public.cc_orders o where o.driver_user_id = s.user_id)
      from public.cc_staff s
     where s.role = 'driver'
     order by s.active desc, s.display_name;
end;
$$;

-- A new personal link: the old one stops working and his open sessions end.
-- Returns the link's secret ONCE (only its hash is kept).
create or replace function public.cc_new_driver_link(p_user_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not public.cc_is_admin() and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'service_role') <> 'service_role' then
    -- (no JWT at all = the server itself / SQL editor)
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  update public.cc_staff set login_token_hash = encode(pg_catalog.sha256(convert_to(v_token, 'UTF8')), 'hex')
   where user_id = p_user_id and role = 'driver';
  if not found then
    raise exception 'الطيار غير موجود' using errcode = 'P0002';
  end if;
  if to_regclass('auth.refresh_tokens') is not null then        -- end the sessions opened with the old link
    execute 'update auth.refresh_tokens set revoked = true where user_id = $1 and not revoked' using p_user_id::text;
  end if;
  return v_token;
end;
$$;

-- Name / mobile / on-off. Stopping a driver also ends his link.
create or replace function public.cc_admin_update_driver(p_user_id uuid, p_name text, p_phone text, p_active boolean)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name  text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_staff public.cc_staff;
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  select * into v_staff from public.cc_staff where user_id = p_user_id and role = 'driver';
  if not found then
    raise exception 'الطيار غير موجود' using errcode = 'P0002';
  end if;
  if char_length(v_name) not between 2 and 40 then
    raise exception 'اكتب اسم الطيار' using errcode = '22023', hint = 'name';
  end if;
  if v_phone !~ '^0[0-9]{8,10}$' then
    raise exception 'رقم الموبايل غير صحيح — مثال: 01012345678' using errcode = '22023', hint = 'phone';
  end if;
  if exists (select 1 from public.cc_staff x where x.role = 'driver' and lower(btrim(x.display_name)) = lower(v_name) and x.user_id <> p_user_id) then
    raise exception 'فيه طيار بنفس الاسم' using errcode = '23505', hint = 'name';
  end if;
  update public.cc_staff
     set display_name = v_name, phone = v_phone, active = coalesce(p_active, active),
         login_token_hash = case when coalesce(p_active, active) then login_token_hash end
   where user_id = p_user_id;
  if not coalesce(p_active, true) and to_regclass('auth.refresh_tokens') is not null then
    execute 'update auth.refresh_tokens set revoked = true where user_id = $1 and not revoked' using p_user_id::text;
  end if;
  -- orders still out carry the new label
  update public.cc_orders set driver = public.cc_driver_label(p_user_id)
   where driver_user_id = p_user_id and stage in ('at_cashier', 'out')
     and not exists (select 1 from public.cc_order_delivery d where d.order_id = cc_orders.id and d.returned_at is not null);
  return true;
end;
$$;

-- Server side only (cc-drivers function, after it made the login account):
-- the driver's name, mobile and first link. Returns the link's secret.
create or replace function public.cc_driver_setup(p_user_id uuid, p_name text, p_phone text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name  text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if char_length(v_name) not between 2 and 40 then
    raise exception 'اكتب اسم الطيار' using errcode = '22023', hint = 'name';
  end if;
  if v_phone !~ '^0[0-9]{8,10}$' then
    raise exception 'رقم الموبايل غير صحيح — مثال: 01012345678' using errcode = '22023', hint = 'phone';
  end if;
  if exists (select 1 from public.cc_staff x where x.role = 'driver' and lower(btrim(x.display_name)) = lower(v_name)) then
    raise exception 'فيه طيار بنفس الاسم' using errcode = '23505', hint = 'name';
  end if;
  insert into public.cc_staff (user_id, display_name, role, phone, active)
  values (p_user_id, v_name, 'driver', v_phone, true);
  return public.cc_new_driver_link(p_user_id);
end;
$$;

-- Server side only (cc-drivers function): which login a personal link opens.
create or replace function public.cc_driver_by_link(p_token text)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select s.user_id from public.cc_staff s
   where s.role = 'driver' and s.active and s.login_token_hash is not null
     and s.login_token_hash = encode(pg_catalog.sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
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

-- Branch: what happened to the orders that left today — «اتسلّم» and «رجع الفرع» (times only,
-- no photo, no place), so the prep screen shows when the driver is back.
create or replace function public.cc_prep_deliveries()
returns table (order_id uuid, delivered_at timestamptz, returned_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'للفرع بس' using errcode = '42501';
  end if;
  return query
    select d.order_id, d.delivered_at, d.returned_at
      from public.cc_order_delivery d
      join public.cc_orders o on o.id = d.order_id
     where o.out_at > now() - interval '24 hours';
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
      'returned_at', d.returned_at, 'returned_admin', coalesce(d.returned_admin, false), 'returned_by_name', d.returned_by_name,
      'returned_lat', d.returned_lat, 'returned_lng', d.returned_lng, 'returned_distance_m', d.returned_distance_m,
      'returned_far', d.returned_far)
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
    || case when v_admin then jsonb_build_object('photo_path', d.photo_path, 'lat', d.lat, 'lng', d.lng, 'accuracy_m', d.accuracy_m,
                                                 'returned_lat', d.returned_lat, 'returned_lng', d.returned_lng,
                                                 'returned_distance_m', d.returned_distance_m, 'returned_far', d.returned_far)
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
revoke all on function public.cc_driver_returned(double precision, double precision, double precision) from public, anon;
revoke all on function public.cc_branch_place()                         from public, anon;
revoke all on function public.cc_set_branch_place(double precision, double precision) from public, anon;
revoke all on function public.cc_admin_drivers()                        from public, anon;
revoke all on function public.cc_new_driver_link(uuid)                  from public, anon;
revoke all on function public.cc_admin_update_driver(uuid, text, text, boolean) from public, anon;
revoke all on function public.cc_driver_setup(uuid, text, text)         from public, anon, authenticated;
revoke all on function public.cc_driver_by_link(text)                   from public, anon, authenticated;
revoke all on function public.cc_distance_m(double precision, double precision, double precision, double precision) from public, anon;
revoke all on function public.cc_admin_delivery(uuid, text, uuid)       from public, anon;
revoke all on function public.cc_list_drivers()                         from public, anon;
revoke all on function public.cc_prep_deliveries()                      from public, anon;
revoke all on function public.cc_delivery_report(date, date)            from public, anon;
revoke all on function public.cc_order_delivery_of(uuid)                from public, anon;
grant execute on function public.cc_set_phone(uuid, text)               to authenticated;
grant execute on function public.cc_list_phones()                       to authenticated;
grant execute on function public.cc_driver_orders()                     to authenticated;
grant execute on function public.cc_driver_take()                       to authenticated;
grant execute on function public.cc_assign_driver(uuid, uuid)           to authenticated;
grant execute on function public.cc_driver_delivered(uuid, text, double precision, double precision, double precision) to authenticated;
grant execute on function public.cc_driver_returned(double precision, double precision, double precision) to authenticated;
grant execute on function public.cc_branch_place()                      to authenticated;
grant execute on function public.cc_set_branch_place(double precision, double precision) to authenticated;
grant execute on function public.cc_admin_drivers()                     to authenticated;
grant execute on function public.cc_new_driver_link(uuid)               to authenticated;
grant execute on function public.cc_admin_update_driver(uuid, text, text, boolean) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.cc_driver_setup(uuid, text, text) to service_role';
    execute 'grant execute on function public.cc_driver_by_link(text) to service_role';
    execute 'grant execute on function public.cc_new_driver_link(uuid) to service_role';
  end if;
end $$;
grant execute on function public.cc_admin_delivery(uuid, text, uuid)    to authenticated;
grant execute on function public.cc_list_drivers()                      to authenticated;
grant execute on function public.cc_prep_deliveries()                   to authenticated;
grant execute on function public.cc_delivery_report(date, date)         to authenticated;
grant execute on function public.cc_order_delivery_of(uuid)             to authenticated;
