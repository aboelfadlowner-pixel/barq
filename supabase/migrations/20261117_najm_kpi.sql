-- نجم أبو الفضل (najm.html): KPI targets, man of the day, employee of the month, employee files.
-- Reads: open to the app (anon). Writes: ONLY through najm_save(pin, …) which checks the role PIN.
-- PINs and the money setting live in tables with no policies (not readable from the app).

create table if not exists public.najm_employees (
  code text primary key,
  name text not null,
  branch text, dept text, job text, shift text,
  active boolean not null default true,
  photo text,
  updated_at timestamptz not null default now()
);
create table if not exists public.najm_ratings (
  day date not null, code text not null,
  att text, att_time text,
  mgr smallint[], ops smallint[],
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
  id text primary key, day date not null, code text not null, note text,
  created_at timestamptz not null default now()
);
create table if not exists public.najm_notes (
  id text primary key, day date not null, code text not null, body text, by_role text,
  created_at timestamptz not null default now()
);
create table if not exists public.najm_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- private (no policies → not readable by the app)
create table if not exists public.najm_secrets (
  role text primary key, salt text not null, pin_hash text not null
);
create table if not exists public.najm_private (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

create index if not exists najm_ratings_day_idx on public.najm_ratings (day);
create index if not exists najm_kpi_vals_day_idx on public.najm_kpi_vals (day);
create index if not exists najm_complaints_code_idx on public.najm_complaints (code);
create index if not exists najm_notes_code_idx on public.najm_notes (code);

do $$
declare t text;
begin
  foreach t in array array['najm_employees','najm_ratings','najm_winners','najm_targets','najm_sales',
    'najm_base_sales','najm_kpi_vals','najm_complaints','najm_notes','najm_settings','najm_secrets','najm_private']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array['najm_employees','najm_ratings','najm_winners','najm_targets','najm_sales',
    'najm_base_sales','najm_kpi_vals','najm_complaints','najm_notes','najm_settings']
  loop
    execute format('drop policy if exists najm_read on public.%I', t);
    execute format('create policy najm_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- role from PIN ('ops' | 'manager' | null)
create or replace function public.najm_role(p_pin text)
returns text language sql stable security definer set search_path = public as $$
  select role from public.najm_secrets
  where pin_hash = encode(sha256(convert_to(salt || coalesce(p_pin,''), 'UTF8')), 'hex')
  order by case role when 'ops' then 0 else 1 end
  limit 1;
$$;

create or replace function public.najm_login(p_pin text)
returns text language sql stable security definer set search_path = public as $$
  select public.najm_role(p_pin);
$$;

create or replace function public.najm_get_private(p_pin text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public.najm_role(p_pin) is distinct from 'ops' then return null; end if;
  return (select data from public.najm_private where id = 1);
end $$;

-- single write entry point
create or replace function public.najm_save(p_pin text, p_kind text, p_key jsonb, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  r text := public.najm_role(p_pin);
  k_day date := nullif(p_key->>'day','')::date;
  k_code text := p_key->>'code';
  del boolean := p_data is null or p_data = 'null'::jsonb;
  s text;
begin
  if r is null then raise exception 'najm: wrong PIN' using errcode = '28000'; end if;
  if p_kind in ('ops','winners','target','base_sales','complaint','employee','settings','private','pins') and r <> 'ops' then
    raise exception 'najm: operations manager only' using errcode = '42501';
  end if;

  if p_kind = 'att' then
    insert into najm_ratings(day, code, att, att_time) values (k_day, k_code, p_data->>'st', p_data->>'time')
    on conflict (day, code) do update set att = excluded.att, att_time = excluded.att_time, updated_at = now();
  elsif p_kind in ('mgr','ops') then
    if p_kind = 'mgr' then
      insert into najm_ratings(day, code, mgr) values (k_day, k_code,
        case when del then null else array(select (case when v = 'null'::jsonb then null else v::text::smallint end) from jsonb_array_elements(p_data) v) end)
      on conflict (day, code) do update set mgr = excluded.mgr, updated_at = now();
    else
      insert into najm_ratings(day, code, ops) values (k_day, k_code,
        case when del then null else array(select (case when v = 'null'::jsonb then null else v::text::smallint end) from jsonb_array_elements(p_data) v) end)
      on conflict (day, code) do update set ops = excluded.ops, updated_at = now();
    end if;
  elsif p_kind = 'bonus' then
    insert into najm_ratings(day, code, bonus, bonus_note)
      values (k_day, k_code, case when del then null else (p_data->>'v')::numeric end, case when del then null else p_data->>'note' end)
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
    else insert into najm_complaints(id, day, code, note) values (p_key->>'id', (p_data->>'date')::date, p_data->>'code', p_data->>'note')
      on conflict (id) do nothing; end if;
  elsif p_kind = 'note' then
    insert into najm_notes(id, day, code, body, by_role) values (p_key->>'id', (p_data->>'date')::date, p_data->>'code', p_data->>'text', r)
    on conflict (id) do nothing;
  elsif p_kind = 'employee' then
    insert into najm_employees(code, name, branch, dept, job, shift, active, photo)
      values (k_code, p_data->>'name', p_data->>'branch', p_data->>'dept', p_data->>'job', p_data->>'shift',
              coalesce((p_data->>'active')::boolean, true), p_data->>'photo')
    on conflict (code) do update set name = excluded.name, branch = excluded.branch, dept = excluded.dept, job = excluded.job,
      shift = excluded.shift, active = excluded.active, photo = excluded.photo, updated_at = now();
  elsif p_kind = 'settings' then
    insert into najm_settings(id, data) values (1, p_data)
    on conflict (id) do update set data = excluded.data, updated_at = now();
  elsif p_kind = 'private' then
    insert into najm_private(id, data) values (1, p_data) on conflict (id) do update set data = excluded.data;
  elsif p_kind = 'pins' then
    foreach s in array array['manager','ops'] loop
      if coalesce(p_data->>s, '') <> '' then
        update najm_secrets set salt = md5(random()::text), pin_hash = '' where role = s;
        update najm_secrets set pin_hash = encode(sha256(convert_to(salt || (p_data->>s), 'UTF8')), 'hex') where role = s;
      end if;
    end loop;
  else
    raise exception 'najm: unknown kind %', p_kind;
  end if;
end $$;

revoke all on function public.najm_role(text) from public, anon, authenticated;
grant execute on function public.najm_login(text) to anon, authenticated;
grant execute on function public.najm_get_private(text) to anon, authenticated;
grant execute on function public.najm_save(text, text, jsonb, jsonb) to anon, authenticated;

-- default PINs (change them from the app settings): manager 1234, ops 0000
insert into public.najm_secrets(role, salt, pin_hash)
select r, s, encode(sha256(convert_to(s || p, 'UTF8')), 'hex')
from (values ('manager', md5('najm-m' || random()::text), '1234'), ('ops', md5('najm-o' || random()::text), '0000')) v(r, s, p)
on conflict (role) do nothing;
insert into public.najm_private(id, data) values (1, '{"bonusAt100":0}') on conflict (id) do nothing;
insert into public.najm_settings(id, data) values (1, '{}') on conflict (id) do nothing;
