-- نجم أبو الفضل — الدخول والصلاحيات ورفع الصور — النسخة الحالية من كل دالة (create or replace)

-- شيفت Between بيتحسب مع الليل (في التقييم ورجل اليوم وإغلاق اليوم)
create or replace function public.najm_shift_group(p_shift text)
returns text language sql immutable set search_path = public as $$
  select case when p_shift in ('Night', 'Between') then 'Night' else coalesce(nullif(p_shift, ''), 'Morning') end;
$$;
grant execute on function public.najm_shift_group(text) to anon, authenticated;

-- مجموعات شيفتات المدير (شيفت واحد، أو أكتر لو متحددين من الإعدادات)
create or replace function public.najm_user_shift_groups(p_shift text, p_shifts text[])
returns text[] language sql immutable set search_path = public as $$
  select coalesce((select array_agg(distinct public.najm_shift_group(s)) from unnest(case when coalesce(array_length(p_shifts, 1), 0) > 0 then p_shifts else array[p_shift] end) s), '{}'::text[]);
$$;
grant execute on function public.najm_user_shift_groups(text, text[]) to anon, authenticated;

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
  return jsonb_build_object('username', u.username, 'name', u.name, 'role', u.role, 'branch', u.branch, 'branches', to_jsonb(coalesce(u.branches, '{}')),
                            'shift', u.shift, 'shifts', to_jsonb(coalesce(u.shifts, '{}')), 'depts', to_jsonb(u.depts));
end $$;

grant execute on function public.najm_login(text, text) to anon, authenticated;

alter function public.najm_login(text, text) volatile;

-- is employee p_code inside manager u's scope?
create or replace function public.najm_in_scope(u public.najm_users, p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when u.role = 'ops' then true
    else exists (select 1 from najm_employees e where e.code = p_code
      and (u.branch is null or e.branch = u.branch or e.branch = any(coalesce(u.branches, '{}')))
      and (u.role <> 'shift' or public.najm_shift_group(e.shift) = any(public.najm_user_shift_groups(u.shift, u.shifts)))
      -- مدير الشيفت مالوش دعوة بقسم البقاله (الفريش فود): مسؤوله مدير الفرع ومدير الفريش بس
      and (u.role <> 'shift' or e.dept is null or e.dept <> all (array(select jsonb_array_elements_text(coalesce((select data->'freshDepts' from najm_settings where id = 1), '["قسم البقاله"]'::jsonb)))))
      -- هيد الكاشير: كاشيرات فرعه بس (قسم الكاشير)
      and (u.role <> 'headcashier' or e.dept = coalesce((select data->>'cashierDept' from najm_settings where id = 1), 'قسم الكاشير'))
      -- مدير الفريش: أقسامه من حسابه، ولو فاضية ← أقسام الفريش فود من الإعدادات (البقاله)
      and (u.role <> 'fresh' or e.dept = any (case when coalesce(array_length(u.depts, 1), 0) > 0 then u.depts
            else array(select jsonb_array_elements_text(coalesce((select data->'freshDepts' from najm_settings where id = 1), '["قسم البقاله"]'::jsonb))) end))) end;
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

-- شاشة دخول واحدة: كود البصمة (أو اسم الدخول) + الرقم السري.
-- لو الكود مربوط بحساب مدير ← بيدخل كمدير بصلاحياته بس (مش كموظف). غير كده ← موظف.
-- الغلط بيرجع {error} (مش exception) عشان المحاولة الغلط تفضل متحسوبة (5 ← قفل 15 دقيقة)
create or replace function public.najm_login_any(p_id text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare un text; u najm_users; r jsonb; i text := trim(coalesce(p_id, ''));
begin
  select username into un from najm_users where active and (username = lower(i) or (coalesce(emp_code, '') <> '' and emp_code = i))
    order by (username = lower(i)) desc limit 1;
  if un is not null then
    select * into u from public.najm_auth(un, p_pin);
    if u.username is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
    return jsonb_build_object('kind', 'mgr', 'username', u.username, 'name', u.name, 'role', u.role, 'branch', u.branch, 'branches', to_jsonb(coalesce(u.branches, '{}')),
                              'shift', u.shift, 'shifts', to_jsonb(coalesce(u.shifts, '{}')), 'depts', to_jsonb(u.depts), 'emp_code', u.emp_code);
  end if;
  r := public.najm_emp_login(i, p_pin);
  if r ? 'error' then return r; end if;
  return r || jsonb_build_object('kind', 'emp');
end $$;
grant execute on function public.najm_login_any(text, text) to anon, authenticated;

-- هل الكود (أو اسم الدخول) ده محتاج رقم سري؟ مدير ← أيوه، موظف ← بس لو مدير التشغيل حطله رقم. من غير ما ترجّع أي بيانات (شاشة الدخول بتظهر خانة الرقم السري بناءً عليها)
create or replace function public.najm_login_needs_pin(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from najm_users u where u.active and (u.username = lower(trim(coalesce(p_id, ''))) or (coalesce(u.emp_code, '') <> '' and u.emp_code = trim(coalesce(p_id, '')))))
      or exists (select 1 from najm_emp_pins p join najm_employees e on e.code = p.code and e.active where p.code = trim(coalesce(p_id, '')));
$$;
grant execute on function public.najm_login_needs_pin(text) to anon, authenticated;

-- المدير بيغيّر رقمه السري بنفسه (اختياري) — لازم الرقم القديم
create or replace function public.najm_my_pin(p_user text, p_pin text, p_new text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then return jsonb_build_object('error', 'najm: wrong username or PIN'); end if;
  if coalesce(p_new, '') !~ '^\d{4,6}$' then raise exception 'najm: PIN must be 4-6 digits'; end if;
  update najm_users set salt = md5(random()::text) where username = u.username;
  update najm_users set pin_hash = encode(sha256(convert_to(salt || p_new, 'UTF8')), 'hex'), updated_at = now() where username = u.username;
  insert into najm_history(actor, kind, data) values (u.username, 'my_pin', '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.najm_my_pin(text, text, text) to anon, authenticated;

-- تنبيهات مدير التشغيل (تغيير في شيت البصمة · موظف رجع يبصم) — اللي ماتشافتش + آخر 30 يوم
create or replace function public.najm_alerts_list(p_user text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then return jsonb_build_object('error', 'najm: wrong username or PIN'); end if;
  if u.role <> 'ops' then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from najm_alerts a
                   where a.seen_at is null or a.created_at > now() - interval '30 days'), '[]'::jsonb);
end $$;
grant execute on function public.najm_alerts_list(text, text) to anon, authenticated;

-- أحداث الكاشيرات بالتفصيل (هيد الكاشير في نطاقه + التشغيل)
create or replace function public.najm_cashier_events_list(p_user text, p_pin text, p_month text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then return jsonb_build_object('error', 'najm: wrong username or PIN'); end if;
  if u.role not in ('headcashier', 'ops') then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(v) order by v.day desc, v.created_at desc)
                   from najm_cashier_events v where to_char(v.day, 'YYYY-MM') = p_month and public.najm_in_scope(u, v.code)), '[]'::jsonb);
end $$;
grant execute on function public.najm_cashier_events_list(text, text, text) to anon, authenticated;
