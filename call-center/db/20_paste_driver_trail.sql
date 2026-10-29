-- Paste into Supabase → SQL Editor → Run. Same as 20_driver_trail.sql (call-center only: one new table for the drivers' trail, the place function keeps a point, an admin function shows the lines). The only removal: trail points older than 7 days.
-- =====================================================================

create table if not exists public.cc_driver_track (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id),
  lat        double precision not null,
  lng        double precision not null,
  accuracy_m double precision,
  at         timestamptz not null default now()
);
create index if not exists cc_driver_track_user_at_idx on public.cc_driver_track (user_id, at);
create index if not exists cc_driver_track_at_idx on public.cc_driver_track (at);
alter table public.cc_driver_track enable row level security;
revoke all on public.cc_driver_track from anon, authenticated, public;

-- The driver's screen: his place now (last place + a point of the trail). Ignored when not out.
create or replace function public.cc_driver_ping(p_lat double precision, p_lng double precision, p_accuracy double precision)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.cc_staff := public.cc_require_driver();
  v_n  int;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return false;
  end if;
  if not exists (select 1 from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
                  where o.driver_user_id = v_me.user_id and o.stage = 'out' and d.returned_at is null
                    and o.out_at > now() - interval '1 day') then
    return false;                                   -- not on a trip: his place is not kept
  end if;
  insert into public.cc_driver_location (user_id, lat, lng, accuracy_m, at)
  values (v_me.user_id, p_lat, p_lng, p_accuracy, now())
  on conflict (user_id) do update
     set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, at = excluded.at
   where public.cc_driver_location.at < now() - interval '15 seconds';   -- at most every 15 s
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.cc_driver_track (user_id, lat, lng, accuracy_m) values (v_me.user_id, p_lat, p_lng, p_accuracy);
    -- CONFIRMED: the trail is kept 7 days
    delete from public.cc_driver_track where at < now() - interval '7 days';
  end if;
  return true;
end;
$$;

-- Admin: the line of each driver out now, since he left (oldest first), and where he delivered.
create or replace function public.cc_drivers_trails()
returns table (user_id uuid, points jsonb, stops jsonb)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  return query
    with out_now as (
      select o.driver_user_id as uid, min(o.out_at) as since
        from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
       where o.stage = 'out' and o.status <> 'cancelled' and d.returned_at is null
         and o.driver_user_id is not null and o.out_at > now() - interval '1 day'
       group by o.driver_user_id)
    select n.uid,
           coalesce((select jsonb_agg(jsonb_build_array(t.lat, t.lng, t.at) order by t.at)
                       from public.cc_driver_track t
                      where t.user_id = n.uid and t.at >= n.since), '[]'::jsonb),
           coalesce((select jsonb_agg(jsonb_build_object('order_no', o.order_no, 'lat', d.lat, 'lng', d.lng,
                                                         'at', d.delivered_at) order by d.delivered_at)
                       from public.cc_orders o join public.cc_order_delivery d on d.order_id = o.id
                      where o.driver_user_id = n.uid and o.stage = 'out' and d.returned_at is null
                        and d.delivered_at is not null and d.lat is not null and o.out_at >= n.since), '[]'::jsonb)
      from out_now n;
end;
$$;

revoke all on function public.cc_driver_ping(double precision, double precision, double precision) from public, anon;
revoke all on function public.cc_drivers_trails()                       from public, anon;
grant execute on function public.cc_driver_ping(double precision, double precision, double precision) to authenticated;
grant execute on function public.cc_drivers_trails()                    to authenticated;
