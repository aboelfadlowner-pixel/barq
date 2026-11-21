-- =====================================================================
--  47 — «الحضور»: the call center punches in and out; the admin sees it.
--
--  CONFIRMED:
--    • on the account itself (each call-center employee has his own) — «▶ بدء الشيفت» /
--      «⏹ إنهاء الشيفت» in the top bar; the time is the server's;
--    • for the call-center accounts only (not admin, prep or drivers);
--    • working without punching in is allowed — the admin sees «اشتغل من غير بصمة»
--      (orders made with no shift that day) and «طلب برا الشيفت»;
--    • a shift not ended closes by itself at the end of its working day (2 AM) — «مقفلش»;
--    • the admin's page «الحضور»: who is working now, and every shift of a period
--      (in, out, hours, orders made in it).
--
--  CALL-CENTER ONLY: one new table (cc_shifts) and new functions. Nothing existing is
--  changed or deleted. Safe to re-run.
-- =====================================================================

create table if not exists public.cc_shifts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id),
  start_at    timestamptz not null default clock_timestamp(),
  end_at      timestamptz,
  auto_closed boolean not null default false,          -- not ended: closed at the end of its working day
  check (end_at is null or end_at >= start_at)
);
create index if not exists cc_shifts_user_idx on public.cc_shifts (user_id, start_at);
create index if not exists cc_shifts_start_idx on public.cc_shifts (start_at);
-- one open shift per person
create unique index if not exists cc_shifts_one_open_uq on public.cc_shifts (user_id) where end_at is null;
alter table public.cc_shifts enable row level security;
revoke all on public.cc_shifts from anon, authenticated, public;

-- The working day (2 AM → 2 AM Cairo) a moment belongs to.
create or replace function public.cc_work_day_of(p_at timestamptz)
returns date
language sql stable security definer
set search_path = ''
as $$ select ((p_at at time zone 'Africa/Cairo') - interval '2 hours')::date $$;

-- A shift of an earlier working day that was never ended: closed at the end of that day.
create or replace function public.cc_shift_close_stale(p_user uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.cc_shifts
     set end_at = public.cc_work_day_from(public.cc_work_day_of(start_at) + 1), auto_closed = true
   where user_id = p_user and end_at is null and start_at < public.cc_work_day_start();
end;
$$;

create or replace function public.cc_shift_require()
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') <> 'call_center' then
    raise exception 'البصمة لموظفين الكول سنتر بس' using errcode = '42501';
  end if;
end;
$$;

-- The call-center account: its shift of today that is still open (null when not started).
create or replace function public.cc_shift_mine()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.cc_shift_require();
  return (select jsonb_build_object('start_at', s.start_at, 'end_at', s.end_at)
            from public.cc_shifts s
           where s.user_id = auth.uid() and s.end_at is null and s.start_at >= public.cc_work_day_start()
           order by s.start_at desc limit 1);
end;
$$;

-- «▶ بدء الشيفت» — a double tap gives back the same shift.
create or replace function public.cc_shift_start()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_s public.cc_shifts;
begin
  perform public.cc_shift_require();
  perform public.cc_shift_close_stale(auth.uid());
  select * into v_s from public.cc_shifts where user_id = auth.uid() and end_at is null;
  if not found then
    insert into public.cc_shifts (user_id) values (auth.uid()) returning * into v_s;
  end if;
  return jsonb_build_object('start_at', v_s.start_at, 'end_at', v_s.end_at);
end;
$$;

-- «⏹ إنهاء الشيفت»
create or replace function public.cc_shift_end()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_s public.cc_shifts;
begin
  perform public.cc_shift_require();
  perform public.cc_shift_close_stale(auth.uid());
  update public.cc_shifts set end_at = clock_timestamp()
   where user_id = auth.uid() and end_at is null
  returning * into v_s;
  if not found then
    raise exception 'مفيش شيفت مفتوح — دوس «بدء الشيفت» الأول' using errcode = '22023', hint = 'stale';
  end if;
  return jsonb_build_object('start_at', v_s.start_at, 'end_at', v_s.end_at);
end;
$$;

-- «الحضور» (admin): who is working now, and every shift of the working days p_from..p_to,
-- plus the days someone made orders with no shift («اشتغل من غير بصمة»).
create or replace function public.cc_attendance(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_today date := public.cc_work_day_of(now());
  v_r jsonb;
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'اختار فترة لحد 3 شهور' using errcode = '22023', hint = 'range';
  end if;
  with sh as (     -- shifts of the period; a forgotten one ends at the end of its day
    select s.id, s.user_id, s.start_at, public.cc_work_day_of(s.start_at) as day,
           coalesce(s.end_at, case when public.cc_work_day_of(s.start_at) < v_today
                                   then public.cc_work_day_from(public.cc_work_day_of(s.start_at) + 1) end) as eff_end,
           s.auto_closed or (s.end_at is null and public.cc_work_day_of(s.start_at) < v_today) as auto
      from public.cc_shifts s
     where s.start_at >= public.cc_work_day_from(p_from) and s.start_at < public.cc_work_day_from(p_to + 1)
  ),
  od as (          -- orders of the period, by the account that made them
    select o.id, o.created_by as user_id, o.created_at, public.cc_work_day_of(o.created_at) as day
      from public.cc_orders o
     where o.created_at >= public.cc_work_day_from(p_from) and o.created_at < public.cc_work_day_from(p_to + 1)
       and o.created_by is not null
  ),
  od_in as (       -- each order: inside one of its maker's shifts?
    select od.*, exists (select 1 from sh where sh.user_id = od.user_id
                           and od.created_at >= sh.start_at and od.created_at <= coalesce(sh.eff_end, now())) as inside
      from od
  ),
  first_of_day as (
    select distinct on (user_id, day) id, user_id, day from sh order by user_id, day, start_at
  ),
  att_rows as (
    select sh.day, sh.user_id, sh.start_at, sh.eff_end, sh.eff_end is null as open, sh.auto,
           round(extract(epoch from (coalesce(sh.eff_end, now()) - sh.start_at)) / 60)::int as minutes,
           (select count(*) from od where od.user_id = sh.user_id
               and od.created_at >= sh.start_at and od.created_at <= coalesce(sh.eff_end, now()))::int as orders,
           case when exists (select 1 from first_of_day f where f.id = sh.id)
                then (select count(*) from od_in x where x.user_id = sh.user_id and x.day = sh.day and not x.inside)::int
                else 0 end as outside,
           false as no_punch
      from sh
    union all
    select x.day, x.user_id, null, null, false, false, null, 0, count(*)::int, true
      from od_in x
     where not exists (select 1 from sh where sh.user_id = x.user_id and sh.day = x.day)
       and exists (select 1 from public.cc_staff st where st.user_id = x.user_id and st.role = 'call_center')
     group by x.day, x.user_id
  ),
  people as (
    select st.user_id from public.cc_staff st where st.role = 'call_center' and st.active
    union
    select distinct user_id from sh
  )
  select jsonb_build_object(
    'now', coalesce((select jsonb_agg(jsonb_build_object(
              'user_id', p.user_id, 'name', public.cc_person_name(p.user_id),
              'start_at', (select s.start_at from public.cc_shifts s where s.user_id = p.user_id and s.end_at is null
                             and s.start_at >= public.cc_work_day_start() order by s.start_at desc limit 1),
              'last_end', (select max(coalesce(s.end_at, public.cc_work_day_from(public.cc_work_day_of(s.start_at) + 1)))
                             from public.cc_shifts s where s.user_id = p.user_id
                              and (s.end_at is not null or s.start_at < public.cc_work_day_start())))
              order by public.cc_person_name(p.user_id))
            from people p), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
              'day', r.day, 'user_id', r.user_id, 'name', public.cc_person_name(r.user_id),
              'start_at', r.start_at, 'end_at', r.eff_end, 'open', r.open, 'auto_closed', r.auto,
              'minutes', r.minutes, 'orders', r.orders, 'outside', r.outside, 'no_punch', r.no_punch)
              order by r.day desc, r.start_at nulls first, public.cc_person_name(r.user_id))
            from att_rows r), '[]'::jsonb))
    into v_r;
  return v_r;
end;
$$;

revoke all on function public.cc_work_day_of(timestamptz)    from public, anon;
revoke all on function public.cc_shift_close_stale(uuid)     from public, anon, authenticated;
revoke all on function public.cc_shift_require()             from public, anon, authenticated;
revoke all on function public.cc_shift_mine()                from public, anon;
revoke all on function public.cc_shift_start()               from public, anon;
revoke all on function public.cc_shift_end()                 from public, anon;
revoke all on function public.cc_attendance(date, date)      from public, anon;
grant execute on function public.cc_work_day_of(timestamptz) to authenticated;
grant execute on function public.cc_shift_mine()             to authenticated;
grant execute on function public.cc_shift_start()            to authenticated;
grant execute on function public.cc_shift_end()              to authenticated;
grant execute on function public.cc_attendance(date, date)   to authenticated;
