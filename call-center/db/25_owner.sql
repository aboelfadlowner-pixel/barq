-- =====================================================================
--  25 — The owner's account («المالك»): no other admin can change it.
--
--  CONFIRMED: one account is the owner. Another admin can no longer change
--  its role, stop it, or rename / stop its name in «أسماء الموظفين». The
--  owner keeps every admin power as before (and still cannot change their
--  own role — unchanged). The settings screen shows the owner's row locked.
--
--  The owner is chosen once, by the project owner, in the SQL editor:
--    update public.cc_staff set is_owner = true where user_id = '<the owner''s user id>';
--  (only one account can be the owner).
--
--  CALL-CENTER ONLY: one new column on cc_staff (default false), a new small
--  function cc_owner_id(), and new bodies for cc_set_staff / cc_save_agent
--  (same names, arguments and grants). Nothing is dropped or deleted. Safe to re-run.
-- =====================================================================

alter table public.cc_staff add column if not exists is_owner boolean not null default false;
create unique index if not exists cc_staff_one_owner on public.cc_staff (is_owner) where is_owner;

-- Who the owner is (for the admin's settings screen, to lock that row).
create or replace function public.cc_owner_id()
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'الحسابات للأدمن بس' using errcode = '42501';
  end if;
  return (select user_id from public.cc_staff where is_owner limit 1);
end;
$$;

-- Change an account's role or stop/start it. Not your own account, and not the owner's.
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
  if exists (select 1 from public.cc_staff where user_id = p_user_id and is_owner) then
    raise exception 'ده حساب المالك — محدش يقدر يغيّر صلاحيته أو يوقفه' using errcode = '42501', hint = 'owner';
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

-- «أسماء الموظفين»: the owner's own name can only be changed by the owner.
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
  if p_id is not null and exists (select 1 from public.cc_staff s
                                   where s.is_owner and s.agent_id = p_id and s.user_id <> auth.uid()) then
    raise exception 'ده اسم المالك — محدش يقدر يغيّره أو يوقفه' using errcode = '42501', hint = 'owner';
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

revoke all on function public.cc_owner_id()                       from public, anon;
revoke all on function public.cc_set_staff(uuid, text, boolean)   from public, anon;
revoke all on function public.cc_save_agent(uuid, text, boolean)  from public, anon;
grant execute on function public.cc_owner_id()                      to authenticated;
grant execute on function public.cc_set_staff(uuid, text, boolean)  to authenticated;
grant execute on function public.cc_save_agent(uuid, text, boolean) to authenticated;
