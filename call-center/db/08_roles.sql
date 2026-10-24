-- =====================================================================
--  Abu El Fadl Call Center — three roles (FOR REVIEW)
--
--  CONFIRMED:
--    admin       — everything, plus «المناطق والموظفين» (areas/fees, employee
--                  names), the registration code and every account's role.
--    call_center — creates, follows and cancels orders. No settings.
--    prep        — the person preparing orders at the branch: only the
--                  preparation screen (comes in the next step). Sees nothing
--                  else and cannot create orders.
--  A new account that joins with the registration code is call_center.
--  The first time this runs, the active accounts that exist now become admin.
--
--  CALL-CENTER ONLY. Nothing is dropped or deleted. Changes to existing objects:
--    • cc_staff gets a "role" column (default call_center);
--    • cc_is_staff() now means "active admin or call_center" (prep sees no data);
--    • cc_save_area / cc_save_agent / cc_set_signup_code / cc_signup_code_status
--      now need an admin (same bodies, admin check instead of staff check).
--  Safe to re-run.
-- =====================================================================

alter table public.cc_staff add column if not exists role text not null default 'call_center';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cc_staff_role_check') then
    alter table public.cc_staff add constraint cc_staff_role_check check (role in ('admin', 'call_center', 'prep'));
  end if;
end $$;

-- First run only: the accounts in use today become admin (no admin yet → nothing else changes later).
update public.cc_staff set role = 'admin'
 where active and not exists (select 1 from public.cc_staff where role = 'admin');

-- ---------------------------------------------------------------------
-- Role of the signed-in account (null = not an active account).
-- ---------------------------------------------------------------------
create or replace function public.cc_my_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select s.role from public.cc_staff s where s.user_id = auth.uid() and s.active
$$;

create or replace function public.cc_is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.cc_my_role() = 'admin', false)
$$;

-- Reads customers/orders/areas (all existing policies use this): admin and call_center only.
create or replace function public.cc_is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.cc_my_role() in ('admin', 'call_center'), false)
$$;

-- ---------------------------------------------------------------------
-- Settings: admin only (same bodies as before).
-- ---------------------------------------------------------------------
create or replace function public.cc_save_area(p_id uuid, p_name text, p_fee numeric, p_active boolean)
returns public.cc_delivery_areas
language plpgsql security definer
set search_path = ''
as $$
declare
  v_area public.cc_delivery_areas;
begin
  if not public.cc_is_admin() then
    raise exception 'المناطق والرسوم للأدمن بس' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'اسم المنطقة مطلوب وبحد أقصى 80 حرف' using errcode = '22023', hint = 'name';
  end if;
  if p_fee is null or p_fee < 0 then
    raise exception 'الرسوم لازم تكون رقم صفر أو أكتر' using errcode = '22023', hint = 'fee';
  end if;

  begin
    if p_id is null then
      insert into public.cc_delivery_areas (name, fee, active, updated_by)
      values (btrim(p_name), round(p_fee, 2), coalesce(p_active, true), auth.uid())
      returning * into v_area;
    else
      update public.cc_delivery_areas
         set name = btrim(p_name), fee = round(p_fee, 2), active = coalesce(p_active, active),
             updated_at = now(), updated_by = auth.uid()
       where id = p_id
      returning * into v_area;
      if not found then
        raise exception 'المنطقة غير موجودة' using errcode = 'P0002';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'فيه منطقة بنفس الاسم' using errcode = '23505', hint = 'name';
  end;
  return v_area;
end;
$$;

create or replace function public.cc_save_agent(p_id uuid, p_name text, p_active boolean)
returns public.cc_agents
language plpgsql security definer
set search_path = ''
as $$
declare
  v_agent public.cc_agents;
begin
  if not public.cc_is_admin() then
    raise exception 'أسماء الموظفين للأدمن بس' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then
    raise exception 'اكتب الاسم (بحد أقصى 40 حرف)' using errcode = '22023', hint = 'name';
  end if;
  begin
    if p_id is null then
      insert into public.cc_agents (name, active, updated_by)
      values (btrim(p_name), coalesce(p_active, true), auth.uid())
      returning * into v_agent;
    else
      update public.cc_agents
         set name = btrim(p_name), active = coalesce(p_active, active), updated_at = now(), updated_by = auth.uid()
       where id = p_id
      returning * into v_agent;
      if not found then
        raise exception 'الاسم غير موجود' using errcode = 'P0002';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'الاسم ده موجود بالفعل في القايمة' using errcode = '23505', hint = 'name';
  end;
  return v_agent;
end;
$$;

create or replace function public.cc_set_signup_code(p_code text)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_salt text := md5(random()::text || clock_timestamp()::text);
  v_at   timestamptz := now();
begin
  if not public.cc_is_admin() then
    raise exception 'كود التسجيل للأدمن بس' using errcode = '42501';
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

create or replace function public.cc_signup_code_status()
returns table (is_set boolean, updated_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
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
-- Accounts and roles (admin only).
-- ---------------------------------------------------------------------
create or replace function public.cc_list_staff()
returns table (user_id uuid, email text, role text, active boolean, created_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'الحسابات للأدمن بس' using errcode = '42501';
  end if;
  return query
    select s.user_id, u.email::text, s.role, s.active, s.created_at
      from public.cc_staff s join auth.users u on u.id = s.user_id
     order by s.created_at;
end;
$$;

-- Change an account's role or stop/start it. An admin cannot change their own
-- account (so the last admin can never lock everyone out).
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
  if p_role is null or p_role not in ('admin', 'call_center', 'prep') then
    raise exception 'صلاحية غير معروفة' using errcode = '22023', hint = 'role';
  end if;
  update public.cc_staff set role = p_role, active = coalesce(p_active, active) where user_id = p_user_id;
  if not found then
    raise exception 'الأكونت غير موجود' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function public.cc_my_role()    from public, anon;
revoke all on function public.cc_is_admin()   from public, anon;
revoke all on function public.cc_list_staff() from public, anon;
revoke all on function public.cc_set_staff(uuid, text, boolean) from public, anon;
grant execute on function public.cc_my_role()    to authenticated;
grant execute on function public.cc_is_admin()   to authenticated;
grant execute on function public.cc_list_staff() to authenticated;
grant execute on function public.cc_set_staff(uuid, text, boolean) to authenticated;
