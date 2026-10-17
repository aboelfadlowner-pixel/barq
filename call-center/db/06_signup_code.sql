-- =====================================================================
--  Abu El Fadl Call Center — join with a registration code (FOR REVIEW)
--
--  CONFIRMED: a new device/person can create an account from the sign-in
--  screen; to see anything they type the registration code (set by someone
--  already signed in, from the settings screen). A correct code links the
--  account as the call-center account; after that the device stays signed in.
--
--  ADDITIVE / CALL-CENTER ONLY: two new tables and four new functions.
--  Nothing is dropped or deleted. Only cc_* tables are written.
--  The code is never stored as plain text (salted SHA-256).
--  Guessing is limited: 5 wrong tries per account per hour, and 30 wrong
--  tries in total per hour lock joining for everyone until the hour passes.
-- =====================================================================

create table if not exists public.cc_settings (
  key        text primary key,          -- 'signup_code'
  salt       text,
  value_hash text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.cc_join_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ok      boolean not null,
  at      timestamptz not null default now()
);
create index if not exists cc_join_attempts_at_idx on public.cc_join_attempts (at desc);

alter table public.cc_settings      enable row level security;
alter table public.cc_join_attempts enable row level security;
revoke all on public.cc_settings, public.cc_join_attempts from anon, authenticated, public;

-- Salted SHA-256 (built in; no extension needed).
create or replace function public.cc_code_hash(p_salt text, p_code text)
returns text
language sql immutable security definer
set search_path = ''
as $$
  select encode(pg_catalog.sha256(convert_to(p_salt || ':' || btrim(p_code), 'UTF8')), 'hex')
$$;
revoke all on function public.cc_code_hash(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Set or change the registration code (the active call-center account only).
-- ---------------------------------------------------------------------
create or replace function public.cc_set_signup_code(p_code text)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_salt text := md5(random()::text || clock_timestamp()::text);
  v_at   timestamptz := now();
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if p_code is null or char_length(btrim(p_code)) < 8 or char_length(btrim(p_code)) > 40 then
    raise exception 'الكود لازم يكون من 8 لـ 40 حرف/رقم' using errcode = '22023', hint = 'code';
  end if;
  insert into public.cc_settings (key, salt, value_hash, updated_at, updated_by)
  values ('signup_code', v_salt, public.cc_code_hash(v_salt, p_code), v_at, auth.uid())
  on conflict (key) do update
     set salt = excluded.salt, value_hash = excluded.value_hash,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return v_at;
end;
$$;

-- Is a code set, and since when (never the code itself).
create or replace function public.cc_signup_code_status()
returns table (is_set boolean, updated_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return query
    select (s.value_hash is not null), s.updated_at
      from public.cc_settings s where s.key = 'signup_code'
    union all
    select false, null::timestamptz
     where not exists (select 1 from public.cc_settings s where s.key = 'signup_code');
end;
$$;

-- ---------------------------------------------------------------------
-- A signed-in account that is not linked yet joins with the code.
-- Returns true when linked (or already linked), false for a wrong code.
-- (A wrong code returns false instead of raising, so the failed try is kept
--  and counts toward the limits.)
-- ---------------------------------------------------------------------
create or replace function public.cc_join_with_code(p_code text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_set   public.cc_settings;
  v_staff public.cc_staff;
begin
  if v_uid is null then
    raise exception 'سجّل دخول الأول' using errcode = '42501';
  end if;

  select * into v_staff from public.cc_staff where user_id = v_uid;
  if found then
    if v_staff.active then return true; end if;
    raise exception 'الأكونت ده متوقف — كلّم المسؤول' using errcode = '42501';
  end if;

  if (select count(*) from public.cc_join_attempts where not ok and user_id = v_uid and at > now() - interval '1 hour') >= 5 then
    raise exception 'محاولات كتير غلط — جرّب تاني بعد ساعة' using errcode = '54000', hint = 'code';
  end if;
  if (select count(*) from public.cc_join_attempts where not ok and at > now() - interval '1 hour') >= 30 then
    raise exception 'التسجيل متوقف مؤقتًا بسبب محاولات كتير غلط — جرّب تاني بعد ساعة' using errcode = '54000', hint = 'code';
  end if;

  select * into v_set from public.cc_settings where key = 'signup_code';
  if not found or v_set.value_hash is null then
    raise exception 'لسه مفيش كود تسجيل — اطلبه من المسؤول' using errcode = '22023', hint = 'code';
  end if;

  if p_code is null or public.cc_code_hash(v_set.salt, p_code) <> v_set.value_hash then
    insert into public.cc_join_attempts (user_id, ok) values (v_uid, false);
    return false;
  end if;

  insert into public.cc_staff (user_id, display_name) values (v_uid, 'مركز الاتصال')
  on conflict (user_id) do nothing;
  insert into public.cc_join_attempts (user_id, ok) values (v_uid, true);
  return true;
end;
$$;

revoke all on function public.cc_set_signup_code(text)    from public, anon;
revoke all on function public.cc_signup_code_status()     from public, anon;
revoke all on function public.cc_join_with_code(text)     from public, anon;
grant execute on function public.cc_set_signup_code(text) to authenticated;
grant execute on function public.cc_signup_code_status()  to authenticated;
grant execute on function public.cc_join_with_code(text)  to authenticated;
