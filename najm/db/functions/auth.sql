-- نجم أبو الفضل — الدخول والصلاحيات ورفع الصور — النسخة الحالية من كل دالة (create or replace)

-- شيفت Between بيتحسب مع الليل (في التقييم ورجل اليوم وإغلاق اليوم)
create or replace function public.najm_shift_group(p_shift text)
returns text language sql immutable set search_path = public as $$
  select case when p_shift in ('Night', 'Between') then 'Night' else coalesce(nullif(p_shift, ''), 'Morning') end;
$$;
grant execute on function public.najm_shift_group(text) to anon, authenticated;

create or replace function public.najm_auth(p_user text, p_pin text)
returns public.najm_users language plpgsql volatile security definer set search_path = public as $$
declare u najm_users; f najm_login_fails; un text := lower(trim(p_user));
begin
  select * into f from najm_login_fails where username = un;
  if f.locked_until is not null and f.locked_until > now() then return null; end if;
  select * into u from najm_users x where x.username = un and x.active
    and x.pin_hash = encode(sha256(convert_to(x.salt || coalesce(p_pin,''), 'UTF8')), 'hex');
  if u.username is null then
    insert into najm_login_fails(username, fails) values (un, 1)
      on conflict (username) do update set fails = najm_login_fails.fails + 1,
        locked_until = case when najm_login_fails.fails + 1 >= 5 then now() + interval '15 minutes' end;
    update najm_login_fails set fails = 0 where username = un and locked_until is not null and fails >= 5;
    return null;
  end if;
  delete from najm_login_fails where username = un;
  return u;
end $$;

revoke all on function public.najm_auth(text, text) from public, anon, authenticated;

create or replace function public.najm_login(p_user text, p_pin text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then return null; end if;
  return jsonb_build_object('username', u.username, 'name', u.name, 'role', u.role, 'branch', u.branch,
                            'shift', u.shift, 'depts', to_jsonb(u.depts));
end $$;

grant execute on function public.najm_login(text, text) to anon, authenticated;

alter function public.najm_login(text, text) volatile;

-- is employee p_code inside manager u's scope?
create or replace function public.najm_in_scope(u public.najm_users, p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when u.role = 'ops' then true
    else exists (select 1 from najm_employees e where e.code = p_code
      and (u.branch is null or e.branch = u.branch)
      and (u.role <> 'shift' or public.najm_shift_group(e.shift) = public.najm_shift_group(u.shift))
      and (u.role <> 'fresh' or e.dept = any (coalesce(u.depts, array[]::text[])))) end;
$$;

revoke all on function public.najm_in_scope(public.najm_users, text) from public, anon, authenticated;

alter function public.najm_in_scope(public.najm_users, text) volatile;

create or replace function public.najm_upload_ok(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from najm_upload_tokens where token = split_part(p_name, '/', 1) and expires_at > now());
$$;

grant execute on function public.najm_upload_ok(text) to anon, authenticated;

-- 2) upload token (managers; operations for photos/videos)
create or replace function public.najm_upload_token(p_user text, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare u najm_users; t text := md5(random()::text || clock_timestamp()::text);
begin
  select * into u from public.najm_auth(p_user, p_pin);
  -- wrong PIN: return (not raise) so the failed attempt counted by najm_auth is kept (5 → 15-minute lock)
  if u.username is null then return null; end if;
  if u.role <> 'ops' then raise exception 'najm: operations manager only' using errcode = '42501'; end if;
  delete from najm_upload_tokens where expires_at < now();
  insert into najm_upload_tokens(token, username, expires_at) values (t, u.username, now() + interval '30 minutes');
  return t;
end $$;

grant execute on function public.najm_upload_token(text, text) to anon, authenticated;
