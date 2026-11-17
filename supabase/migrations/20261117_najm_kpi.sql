-- نجم أبو الفضل (najm.html): KPI targets, man of the day, employee of the month, employee files.
--
-- Access model
--   * Employees open the app with no login. They read: employees (name/photo/video), daily STAR TOTALS
--     (najm_public_scores), winners, targets, sales, KPI values, settings.
--   * Managers log in with username + PIN (najm_users). Raw rating criteria, complaints and notes are
--     returned only to a valid manager login (najm_full_scores / najm_files).
--   * Every write goes through najm_save(user, pin, kind, key, data), which checks the role and the
--     manager's scope (branch / shift / departments). Tables have no write policies.
--   * Stars are computed in ONE place: najm_score() below. The app shows what the database computes.

-- ---------------------------------------------------------------- tables
create table if not exists public.najm_employees (
  code text primary key,
  name text not null,
  branch text, dept text, job text, shift text,
  active boolean not null default true,
  photo text,           -- public URL (storage bucket najm-media)
  video text,           -- public URL (storage bucket najm-media)
  updated_at timestamptz not null default now()
);
create table if not exists public.najm_users (
  username text primary key,
  name text not null,
  role text not null check (role in ('ops','branch','shift','fresh')),
  branch text,          -- null = all branches (ops / fresh across branches)
  shift text,           -- shift managers only
  depts text[],         -- fresh food manager: departments he rates
  active boolean not null default true,
  salt text not null,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.najm_ratings (
  day date not null, code text not null,
  att text, att_time text,
  br smallint[],        -- branch manager (5 criteria, 0..2)
  sh smallint[],        -- shift manager
  fr smallint[],        -- fresh food manager (fresh departments only)
  ops smallint[],       -- operations manager
  bonus numeric, bonus_note text,
  updated_at timestamptz not null default now(),
  primary key (day, code)
);
create table if not exists public.najm_winners (
  day date not null, gkey text not null, codes text[] not null,
  updated_at timestamptz not null default now(),
  primary key (day, gkey)
);
create table if not exists public.najm_targets (
  month text not null, dkey text not null, cfg jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (month, dkey)
);
create table if not exists public.najm_sales (
  day date not null, branch text not null, items jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (day, branch)
);
create table if not exists public.najm_base_sales (
  month text not null, branch text not null, items jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (month, branch)
);
create table if not exists public.najm_kpi_vals (
  day date not null, dkey text not null, vals jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (day, dkey)
);
create table if not exists public.najm_complaints (
  id text primary key, day date not null, code text not null, note text, by_user text,
  created_at timestamptz not null default now()
);
create table if not exists public.najm_notes (
  id text primary key, day date not null, code text not null, body text, by_user text,
  created_at timestamptz not null default now()
);
create table if not exists public.najm_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.najm_private (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
-- cards: yellow −5 / red −20 / green +5 on the monthly score (values in settings.cards).
-- yellow & green count immediately; red counts only after the operations manager approves it.
create table if not exists public.najm_cards (
  id text primary key, day date not null, code text not null,
  color text not null check (color in ('yellow','red','green')),
  reason text, by_user text,
  approved boolean not null default false, approved_by text,
  created_at timestamptz not null default now()
);
-- captain = personal extra target: each salesperson / chef gets one or more products (kilos sold by the branch
-- in the Foodics product-sales sheet), points × settings.captainMult
create table if not exists public.najm_captains (
  month text not null, code text not null, sku text not null,
  name text, target numeric not null default 0, active boolean not null default true, by_user text,
  updated_at timestamptz not null default now(),
  primary key (month, code, sku)
);
create index if not exists najm_cards_day_idx on public.najm_cards (day);

create index if not exists najm_ratings_day_idx on public.najm_ratings (day);
create index if not exists najm_kpi_vals_day_idx on public.najm_kpi_vals (day);
create index if not exists najm_complaints_code_idx on public.najm_complaints (code);
create index if not exists najm_notes_code_idx on public.najm_notes (code);

do $$
declare t text;
begin
  foreach t in array array['najm_employees','najm_users','najm_ratings','najm_winners','najm_targets','najm_sales',
    'najm_base_sales','najm_kpi_vals','najm_complaints','najm_notes','najm_settings','najm_private',
    'najm_cards','najm_captains']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists najm_read on public.%I', t);
  end loop;
  -- public read (no ratings, users, complaints, notes, private)
  foreach t in array array['najm_employees','najm_winners','najm_targets','najm_sales',
    'najm_base_sales','najm_kpi_vals','najm_settings','najm_captains']
  loop
    execute format('create policy najm_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- scoring (single source of truth)
create or replace function public.najm_crit(a smallint[])
returns numeric language sql immutable set search_path = public as $$
  select case when a is null or coalesce(array_length(a,1),0) < 5 or array_position(a, null) is not null then null
              else round((select sum(x) from unnest(a) x)::numeric / 10 * 4) / 4 end;
$$;

-- returns {att, att_star, mgr_star, ops_star, bonus, total, complete}
create or replace function public.najm_score(r public.najm_ratings, p_dept text, p_settings jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  fresh boolean := p_dept = any (array(select jsonb_array_elements_text(coalesce(p_settings->'freshDepts','["قسم البقاله"]'::jsonb))));
  a numeric; b numeric := public.najm_crit(r.br); s numeric := public.najm_crit(r.sh);
  f numeric := public.najm_crit(r.fr); o numeric := public.najm_crit(r.ops);
  m numeric; mc boolean; tot numeric; anyv boolean;
begin
  a := case when r.att is null or r.att = 'off' then null
            else coalesce((p_settings->'att'->>r.att)::numeric,
                          case r.att when 'on' then 2.5 when 'late' then 1.5 when 'vlate' then 0.5 else 0 end) end;
  if fresh then
    m := case when b is null and s is null and f is null then null
              else round((coalesce(b,0) + coalesce(s,0) + coalesce(f,0)) / 3 * 4) / 4 end;
    mc := b is not null and s is not null and f is not null;
  else
    m := case when b is null and s is null then null
              else round((coalesce(b,0) + coalesce(s,0)) / 2 * 4) / 4 end;
    mc := b is not null and s is not null;
  end if;
  anyv := a is not null or m is not null or o is not null or coalesce(r.bonus,0) > 0;
  tot := case when anyv then least(5, coalesce(a,0) + coalesce(m,0) + coalesce(o,0) + coalesce(r.bonus,0)) end;
  return jsonb_build_object('att', r.att, 'att_star', a, 'mgr_star', m, 'ops_star', o, 'bonus', coalesce(r.bonus,0),
    'total', tot, 'complete', a is not null and mc and o is not null,
    'parts', jsonb_build_object('br', b, 'sh', s, 'fr', f), 'fresh', fresh);
end $$;

-- public: totals only (no criteria, no notes)
create or replace function public.najm_public_scores(p_from date, p_to date)
returns table(day date, code text, att text, total numeric, complete boolean, has_bonus boolean)
language sql stable security definer set search_path = public as $$
  with st as (select data from najm_settings where id = 1)
  select r.day, r.code, r.att, (x.sc->>'total')::numeric, (x.sc->>'complete')::boolean, coalesce(r.bonus,0) > 0
  from najm_ratings r
  left join najm_employees e on e.code = r.code
  cross join st
  cross join lateral (select public.najm_score(r, e.dept, st.data) sc) x
  where r.day between p_from and p_to;
$$;

-- ---------------------------------------------------------------- auth helpers
create or replace function public.najm_auth(p_user text, p_pin text)
returns public.najm_users language sql stable security definer set search_path = public as $$
  select u.* from najm_users u
  where u.username = lower(trim(p_user)) and u.active
    and u.pin_hash = encode(sha256(convert_to(u.salt || coalesce(p_pin,''), 'UTF8')), 'hex');
$$;

create or replace function public.najm_login(p_user text, p_pin text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then return null; end if;
  return jsonb_build_object('username', u.username, 'name', u.name, 'role', u.role, 'branch', u.branch,
                            'shift', u.shift, 'depts', to_jsonb(u.depts));
end $$;

-- is employee p_code inside manager u's scope?
create or replace function public.najm_in_scope(u public.najm_users, p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when u.role = 'ops' then true
    else exists (select 1 from najm_employees e where e.code = p_code
      and (u.branch is null or e.branch = u.branch)
      and (u.role <> 'shift' or e.shift = u.shift)
      and (u.role <> 'fresh' or e.dept = any (coalesce(u.depts, array[]::text[]))))
  end;
$$;

-- managers: full detail
create or replace function public.najm_full_scores(p_user text, p_pin text, p_from date, p_to date)
returns table(day date, code text, att text, att_time text, br smallint[], sh smallint[], fr smallint[], ops smallint[],
              bonus numeric, bonus_note text, score jsonb)
language plpgsql stable security definer set search_path = public as $$
declare u najm_users; st jsonb;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then raise exception 'najm: login required' using errcode = '28000'; end if;
  select data into st from najm_settings where id = 1;
  return query
    select r.day, r.code, r.att, r.att_time, r.br, r.sh, r.fr, r.ops, r.bonus, r.bonus_note,
           public.najm_score(r, e.dept, st)
    from najm_ratings r left join najm_employees e on e.code = r.code
    where r.day between p_from and p_to and public.najm_in_scope(u, r.code);
end $$;

create or replace function public.najm_files(p_user text, p_pin text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then raise exception 'najm: login required' using errcode = '28000'; end if;
  return jsonb_build_object(
    'complaints', coalesce((select jsonb_agg(to_jsonb(c)) from najm_complaints c where public.najm_in_scope(u, c.code)), '[]'),
    'notes',      coalesce((select jsonb_agg(to_jsonb(n)) from najm_notes n where public.najm_in_scope(u, n.code)), '[]'),
    'private',    case when u.role = 'ops' then (select data from najm_private where id = 1) end,
    'cards',      coalesce((select jsonb_agg(to_jsonb(k)) from najm_cards k where public.najm_in_scope(u, k.code)), '[]'),
    'users',      case when u.role = 'ops' then (select jsonb_agg(jsonb_build_object('username',x.username,'name',x.name,'role',x.role,
                    'branch',x.branch,'shift',x.shift,'depts',x.depts,'active',x.active) order by x.role, x.username) from najm_users x) end);
end $$;

-- public: approved card counts only (no reasons)
create or replace function public.najm_public_cards(p_from date, p_to date)
returns table(code text, yellow int, red int, green int)
language sql stable security definer set search_path = public as $$
  select code,
         count(*) filter (where color = 'yellow')::int,
         count(*) filter (where color = 'red')::int,
         count(*) filter (where color = 'green')::int
  from najm_cards where approved and day between p_from and p_to
  group by code;
$$;

-- ---------------------------------------------------------------- the single write entry point
create or replace function public.najm_save(p_user text, p_pin text, p_kind text, p_key jsonb, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u najm_users;
  k_day date := nullif(p_key->>'day','')::date;
  k_code text := p_key->>'code';
  del boolean := p_data is null or p_data = 'null'::jsonb;
  arr smallint[];
  r najm_ratings; st jsonb; dpt text; s text;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then raise exception 'najm: wrong username or PIN' using errcode = '28000'; end if;

  if p_kind in ('winners','target','base_sales','complaint','employee','media','settings','private','user','card_approve')
     and u.role <> 'ops' then
    raise exception 'najm: operations manager only' using errcode = '42501';
  end if;
  if p_kind in ('att','rate','bonus','note','card','captain') and not public.najm_in_scope(u, k_code) then
    raise exception 'najm: employee outside your scope' using errcode = '42501';
  end if;
  if p_kind = 'att' and u.role = 'fresh' then
    raise exception 'najm: attendance is entered by branch/shift managers' using errcode = '42501';
  end if;
  if p_kind in ('sales','kpi') and u.role <> 'ops' and u.branch is not null and u.branch <> p_key->>'branch' then
    raise exception 'najm: other branch' using errcode = '42501';
  end if;

  if p_kind = 'att' then
    insert into najm_ratings(day, code, att, att_time)
      values (k_day, k_code, case when del then null else p_data->>'st' end, case when del then null else p_data->>'time' end)
    on conflict (day, code) do update set att = excluded.att, att_time = excluded.att_time, updated_at = now();
  elsif p_kind = 'rate' then
    arr := case when del then null else array(select (case when v = 'null'::jsonb then null else v::text::smallint end)
                                             from jsonb_array_elements(p_data) v) end;
    if u.role = 'branch' then
      insert into najm_ratings(day, code, br) values (k_day, k_code, arr)
      on conflict (day, code) do update set br = excluded.br, updated_at = now();
    elsif u.role = 'shift' then
      insert into najm_ratings(day, code, sh) values (k_day, k_code, arr)
      on conflict (day, code) do update set sh = excluded.sh, updated_at = now();
    elsif u.role = 'fresh' then
      insert into najm_ratings(day, code, fr) values (k_day, k_code, arr)
      on conflict (day, code) do update set fr = excluded.fr, updated_at = now();
    else
      insert into najm_ratings(day, code, ops) values (k_day, k_code, arr)
      on conflict (day, code) do update set ops = excluded.ops, updated_at = now();
    end if;
  elsif p_kind = 'bonus' then
    insert into najm_ratings(day, code, bonus, bonus_note)
      values (k_day, k_code, case when del then null else least(0.5, (p_data->>'v')::numeric) end,
              case when del then null else p_data->>'note' end)
    on conflict (day, code) do update set bonus = excluded.bonus, bonus_note = excluded.bonus_note, updated_at = now();
  elsif p_kind = 'winners' then
    if del then delete from najm_winners where day = k_day and gkey = p_key->>'gkey';
    else insert into najm_winners(day, gkey, codes) values (k_day, p_key->>'gkey', array(select jsonb_array_elements_text(p_data)))
      on conflict (day, gkey) do update set codes = excluded.codes, updated_at = now(); end if;
  elsif p_kind = 'target' then
    if del then delete from najm_targets where month = p_key->>'month' and dkey = p_key->>'dkey';
    else insert into najm_targets(month, dkey, cfg) values (p_key->>'month', p_key->>'dkey', p_data)
      on conflict (month, dkey) do update set cfg = excluded.cfg, updated_at = now(); end if;
  elsif p_kind = 'sales' then
    insert into najm_sales(day, branch, items) values (k_day, p_key->>'branch', p_data)
    on conflict (day, branch) do update set items = excluded.items, updated_at = now();
  elsif p_kind = 'base_sales' then
    insert into najm_base_sales(month, branch, items) values (p_key->>'month', p_key->>'branch', p_data)
    on conflict (month, branch) do update set items = excluded.items, updated_at = now();
  elsif p_kind = 'kpi' then
    insert into najm_kpi_vals(day, dkey, vals) values (k_day, p_key->>'dkey', p_data)
    on conflict (day, dkey) do update set vals = excluded.vals, updated_at = now();
  elsif p_kind = 'complaint' then
    if del then delete from najm_complaints where id = p_key->>'id';
    else insert into najm_complaints(id, day, code, note, by_user)
      values (p_key->>'id', (p_data->>'date')::date, p_data->>'code', p_data->>'note', u.username)
      on conflict (id) do nothing; end if;
  elsif p_kind = 'note' then
    insert into najm_notes(id, day, code, body, by_user)
      values (p_key->>'id', (p_data->>'date')::date, k_code, p_data->>'text', u.username)
    on conflict (id) do nothing;
  elsif p_kind = 'employee' then
    insert into najm_employees(code, name, branch, dept, job, shift, active)
      values (k_code, p_data->>'name', p_data->>'branch', p_data->>'dept', p_data->>'job', p_data->>'shift',
              coalesce((p_data->>'active')::boolean, true))
    on conflict (code) do update set name = excluded.name, branch = excluded.branch, dept = excluded.dept, job = excluded.job,
      shift = excluded.shift, active = excluded.active, updated_at = now();
  elsif p_kind = 'media' then
    update najm_employees set
      photo = case when p_data ? 'photo' then nullif(p_data->>'photo','') else photo end,
      video = case when p_data ? 'video' then nullif(p_data->>'video','') else video end,
      updated_at = now()
    where code = k_code;
  elsif p_kind = 'card' then
    if del then
      delete from najm_cards where id = p_key->>'id' and code = k_code
        and (u.role = 'ops' or (by_user = u.username and not approved));
    else
      if p_data->>'color' not in ('yellow','red','green') then raise exception 'najm: bad card color'; end if;
      insert into najm_cards(id, day, code, color, reason, by_user, approved, approved_by)
        values (p_key->>'id', (p_data->>'date')::date, k_code, p_data->>'color', p_data->>'reason', u.username,
                (p_data->>'color') <> 'red' or u.role = 'ops', case when u.role = 'ops' then u.username end)
      on conflict (id) do nothing;
    end if;
  elsif p_kind = 'card_approve' then
    if coalesce((p_data->>'approved')::boolean, false) then
      update najm_cards set approved = true, approved_by = u.username where id = p_key->>'id';
    else
      delete from najm_cards where id = p_key->>'id';
    end if;
  elsif p_kind = 'captain' then
    if del then delete from najm_captains where month = p_key->>'month' and code = k_code and sku = p_key->>'sku';
    else insert into najm_captains(month, code, sku, name, target, active, by_user)
      values (p_key->>'month', k_code, p_key->>'sku', p_data->>'name', coalesce((p_data->>'target')::numeric, 0),
              coalesce((p_data->>'active')::boolean, true), u.username)
      on conflict (month, code, sku) do update set name = excluded.name, target = excluded.target, active = excluded.active,
        by_user = excluded.by_user, updated_at = now(); end if;
  elsif p_kind = 'settings' then
    insert into najm_settings(id, data) values (1, p_data)
    on conflict (id) do update set data = excluded.data, updated_at = now();
  elsif p_kind = 'private' then
    insert into najm_private(id, data) values (1, p_data) on conflict (id) do update set data = excluded.data;
  elsif p_kind = 'user' then
    s := lower(trim(p_key->>'username'));
    if s is null or s = '' then raise exception 'najm: username required'; end if;
    if del then
      if s = u.username then raise exception 'najm: cannot delete yourself'; end if;
      delete from najm_users where username = s;
    else
      insert into najm_users(username, name, role, branch, shift, depts, active, salt, pin_hash)
        values (s, coalesce(p_data->>'name', s), p_data->>'role', nullif(p_data->>'branch',''), nullif(p_data->>'shift',''),
                case when p_data ? 'depts' then array(select jsonb_array_elements_text(p_data->'depts')) end,
                coalesce((p_data->>'active')::boolean, true), md5(random()::text), '!')
      on conflict (username) do update set name = excluded.name, role = excluded.role, branch = excluded.branch,
        shift = excluded.shift, depts = excluded.depts, active = excluded.active, updated_at = now();
      if coalesce(p_data->>'pin','') <> '' then
        update najm_users set salt = md5(random()::text) where username = s;
        update najm_users set pin_hash = encode(sha256(convert_to(salt || (p_data->>'pin'), 'UTF8')), 'hex') where username = s;
      elsif (select pin_hash from najm_users where username = s) = '!' then
        raise exception 'najm: PIN required for a new user';
      end if;
    end if;
  else
    raise exception 'najm: unknown kind %', p_kind;
  end if;

  -- return the fresh score for rating writes so the app shows exactly what the database computes
  if p_kind in ('att','rate','bonus') then
    select * into r from najm_ratings where day = k_day and code = k_code;
    select dept into dpt from najm_employees where code = k_code;
    select data into st from najm_settings where id = 1;
    return jsonb_build_object('row', jsonb_build_object('att', r.att, 'att_time', r.att_time, 'br', r.br, 'sh', r.sh,
      'fr', r.fr, 'ops', r.ops, 'bonus', r.bonus, 'bonus_note', r.bonus_note), 'score', public.najm_score(r, dpt, st));
  end if;
  return null;
end $$;

revoke all on function public.najm_auth(text, text) from public, anon, authenticated;
revoke all on function public.najm_in_scope(public.najm_users, text) from public, anon, authenticated;
revoke all on function public.najm_score(public.najm_ratings, text, jsonb) from public, anon, authenticated;
grant execute on function public.najm_login(text, text) to anon, authenticated;
grant execute on function public.najm_public_scores(date, date) to anon, authenticated;
grant execute on function public.najm_full_scores(text, text, date, date) to anon, authenticated;
grant execute on function public.najm_files(text, text) to anon, authenticated;
grant execute on function public.najm_save(text, text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.najm_public_cards(date, date) to anon, authenticated;

-- ---------------------------------------------------------------- storage for photos / videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('najm-media', 'najm-media', true, 31457280,
        array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;
drop policy if exists najm_media_read on storage.objects;
create policy najm_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'najm-media');
drop policy if exists najm_media_upload on storage.objects;
create policy najm_media_upload on storage.objects for insert to anon, authenticated with check (bucket_id = 'najm-media');

-- ---------------------------------------------------------------- defaults
-- first login: username «ops», PIN «0000» → change it from the app (الإعدادات → الحسابات)
insert into public.najm_users(username, name, role, salt, pin_hash)
select 'ops', 'مدير التشغيل', 'ops', s, encode(sha256(convert_to(s || '0000', 'UTF8')), 'hex')
from (select md5('najm-ops' || random()::text) s) x
on conflict (username) do nothing;
insert into public.najm_private(id, data) values (1, '{"bonusAt100":0}') on conflict (id) do nothing;
insert into public.najm_settings(id, data) values (1, '{"freshDepts":["قسم البقاله"],"cards":{"yellow":-5,"red":-20,"green":5,"yellowsToRed":2},"captainMult":3}') on conflict (id) do nothing;
