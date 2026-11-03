-- =====================================================================
--  26 — Which phone opened a driver's link: an ALERT for the admin when
--       the link is opened on another phone (nothing is blocked).
--
--  CONFIRMED: the driver's screen sends a random id kept in that phone's
--  browser and the phone type (e.g. «Android – SM-A515F – Chrome»,
--  «iPhone – Safari»). The first phone that opens the CURRENT link is his
--  main phone. Any other phone on the same link keeps working, and the admin
--  sees «⚠️ اتفتح من جهاز تاني» with its type and times until she taps
--  «تمام، شفته». A new link starts over (its first phone is the main one).
--  A website cannot know the phone number or its owner; an iPhone shows as
--  «iPhone» only (Apple hides the model).
--
--  CALL-CENTER ONLY: one new table, three new functions. Nothing is dropped,
--  deleted or changed elsewhere. Safe to re-run.
-- =====================================================================

create table if not exists public.cc_driver_devices (
  user_id     uuid not null references auth.users(id),
  link_hash   text not null,                 -- the link it came with (cc_staff.login_token_hash at the time)
  device_id   text not null check (char_length(device_id) between 8 and 64),
  label       text not null default '' check (char_length(label) <= 120),
  first_seen  timestamptz not null default clock_timestamp(),
  last_seen   timestamptz not null default clock_timestamp(),
  opens       integer not null default 1,
  seen_by_admin_at timestamptz,              -- «تمام، شفته»
  primary key (user_id, link_hash, device_id)
);
create index if not exists cc_driver_devices_user_idx on public.cc_driver_devices (user_id, link_hash, first_seen);
alter table public.cc_driver_devices enable row level security;
revoke all on public.cc_driver_devices from anon, authenticated, public;

-- The driver's screen, each time it opens: «this phone, this type».
create or replace function public.cc_driver_device(p_device_id text, p_label text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.cc_staff := public.cc_require_driver();
  v_id text := btrim(coalesce(p_device_id, ''));
  v_label text := left(btrim(coalesce(p_label, '')), 120);
begin
  if char_length(v_id) not between 8 and 64 or v_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'جهاز غير معروف' using errcode = '22023';
  end if;
  if v_me.login_token_hash is null then
    return false;                          -- no personal link (stopped): nothing to record
  end if;
  insert into public.cc_driver_devices (user_id, link_hash, device_id, label)
  values (v_me.user_id, v_me.login_token_hash, v_id, v_label)
  on conflict (user_id, link_hash, device_id) do update
     set last_seen = clock_timestamp(), opens = public.cc_driver_devices.opens + 1,
         label = case when excluded.label <> '' then excluded.label else public.cc_driver_devices.label end;
  return true;
end;
$$;

-- For the admin: each driver whose CURRENT link was opened on another phone (not yet «شفته»).
create or replace function public.cc_driver_device_alerts()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id', s.user_id, 'name', s.display_name,
             'main', jsonb_build_object('label', m.label, 'first_seen', m.first_seen, 'last_seen', m.last_seen),
             'others', (select jsonb_agg(jsonb_build_object('device_id', d.device_id, 'label', d.label,
                                 'first_seen', d.first_seen, 'last_seen', d.last_seen, 'opens', d.opens) order by d.first_seen)
                          from public.cc_driver_devices d
                         where d.user_id = s.user_id and d.link_hash = s.login_token_hash
                           and d.device_id <> m.device_id and d.seen_by_admin_at is null))
           order by s.display_name)
      from public.cc_staff s
      cross join lateral (select * from public.cc_driver_devices m0
                           where m0.user_id = s.user_id and m0.link_hash = s.login_token_hash
                           order by m0.first_seen, m0.device_id limit 1) m
     where s.role = 'driver' and s.active and s.login_token_hash is not null
       and exists (select 1 from public.cc_driver_devices d
                    where d.user_id = s.user_id and d.link_hash = s.login_token_hash
                      and d.device_id <> m.device_id and d.seen_by_admin_at is null)), '[]'::jsonb);
end;
$$;

-- «تمام، شفته»: hide this driver's current alerts (a phone that is new after this alerts again).
create or replace function public.cc_driver_device_seen(p_user_id uuid)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  update public.cc_driver_devices d set seen_by_admin_at = now()
    from public.cc_staff s
   where s.user_id = p_user_id and d.user_id = s.user_id and d.link_hash = s.login_token_hash
     and d.seen_by_admin_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.cc_driver_device(text, text)     from public, anon;
revoke all on function public.cc_driver_device_alerts()        from public, anon;
revoke all on function public.cc_driver_device_seen(uuid)      from public, anon;
grant execute on function public.cc_driver_device(text, text)   to authenticated;
grant execute on function public.cc_driver_device_alerts()      to authenticated;
grant execute on function public.cc_driver_device_seen(uuid)    to authenticated;
