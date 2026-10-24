-- =====================================================================
--  Abu El Fadl Call Center — one account per person, with their name (FOR REVIEW)
--
--  CONFIRMED: each person creates their own account (Gmail + password) from
--  the sign-in screen and, with the registration code, writes their name once.
--  The account is saved with that name; the admin sets the role or stops it
--  from «المناطق والموظفين». Orders are saved with the account's own name, so
--  «اختر اسمك» is no longer needed for these accounts.
--  Accounts that exist already are asked for their name once.
--
--  CALL-CENTER ONLY. Additive: one column on cc_staff (agent_id → cc_agents),
--  three new functions, and new bodies (same signatures) for cc_require_agent.
--  The old cc_join_with_code(text) and cc_list_staff() stay as they are.
--  Nothing is dropped or deleted. Safe to re-run.
-- =====================================================================

alter table public.cc_staff add column if not exists agent_id uuid references public.cc_agents(id);
create unique index if not exists cc_staff_agent_uq on public.cc_staff (agent_id) where agent_id is not null;

-- ---------------------------------------------------------------------
-- Link the signed-in account to its name (internal). An existing name that no
-- account uses yet (added earlier from the names list) is taken over, so old
-- orders and the new account share it; a name already used by another account
-- is refused.
-- ---------------------------------------------------------------------
create or replace function public.cc_link_my_name(p_name text)
returns public.cc_agents
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_name  text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_agent public.cc_agents;
begin
  if char_length(v_name) not between 2 and 40 then
    raise exception 'اكتب اسمك (من 2 إلى 40 حرفًا)' using errcode = '22023', hint = 'name';
  end if;
  select * into v_agent from public.cc_agents where lower(btrim(name)) = lower(v_name);
  if found then
    if exists (select 1 from public.cc_staff s where s.agent_id = v_agent.id and s.user_id <> v_uid) then
      raise exception 'الاسم ده مسجل لحساب تاني — اكتب اسمك بالكامل' using errcode = '23505', hint = 'name';
    end if;
    update public.cc_agents set active = true, updated_at = now(), updated_by = v_uid
     where id = v_agent.id returning * into v_agent;
  else
    insert into public.cc_agents (name, active, updated_by) values (v_name, true, v_uid) returning * into v_agent;
  end if;
  update public.cc_staff set agent_id = v_agent.id, display_name = v_agent.name where user_id = v_uid;
  return v_agent;
end;
$$;
revoke all on function public.cc_link_my_name(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- A new account joins with the registration code AND its name.
-- Same rules as cc_join_with_code(text): wrong code → false (counted toward the
-- limits), right code → linked as call_center with that name.
-- ---------------------------------------------------------------------
create or replace function public.cc_join_with_code(p_code text, p_name text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_staff public.cc_staff;
begin
  if v_uid is null then
    raise exception 'سجّل دخول الأول' using errcode = '42501';
  end if;
  if char_length(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')) not between 2 and 40 then
    raise exception 'اكتب اسمك (من 2 إلى 40 حرفًا)' using errcode = '22023', hint = 'name';
  end if;
  select * into v_staff from public.cc_staff where user_id = v_uid;
  if found and not v_staff.active then
    raise exception 'الأكونت ده متوقف — كلّم المسؤول' using errcode = '42501';
  end if;
  if not found then
    if not public.cc_join_with_code(p_code) then
      return false;
    end if;
  end if;
  if (select agent_id from public.cc_staff where user_id = v_uid) is null then
    perform public.cc_link_my_name(p_name);
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- An account that exists already (no name yet) writes its name once.
-- ---------------------------------------------------------------------
create or replace function public.cc_set_my_name(p_name text)
returns public.cc_agents
language plpgsql security definer
set search_path = ''
as $$
declare
  v_staff public.cc_staff;
begin
  select * into v_staff from public.cc_staff where user_id = auth.uid() and active;
  if not found then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if v_staff.agent_id is not null then
    raise exception 'اسمك مسجل بالفعل — لتغييره كلّم المسؤول' using errcode = '22023', hint = 'name';
  end if;
  return public.cc_link_my_name(p_name);
end;
$$;

-- ---------------------------------------------------------------------
-- Accounts for the admin, with each person's name (cc_list_staff + name).
-- ---------------------------------------------------------------------
create or replace function public.cc_list_accounts()
returns table (user_id uuid, email text, name text, role text, active boolean, created_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'الحسابات للأدمن بس' using errcode = '42501';
  end if;
  return query
    select s.user_id, u.email::text, a.name, s.role, s.active, s.created_at
      from public.cc_staff s
      join auth.users u on u.id = s.user_id
      left join public.cc_agents a on a.id = s.agent_id
     order by s.created_at;
end;
$$;

-- ---------------------------------------------------------------------
-- The employee on an order: an account with its own name always uses that
-- name (nobody can send or cancel in another person's name); a shared account
-- without a name still picks from the list, as before.
-- ---------------------------------------------------------------------
create or replace function public.cc_require_agent(p_agent_id uuid)
returns public.cc_agents
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_agent public.cc_agents;
  v_own   uuid := (select s.agent_id from public.cc_staff s where s.user_id = auth.uid());
begin
  select * into v_agent from public.cc_agents where id = coalesce(v_own, p_agent_id) and active;
  if not found then
    raise exception 'اختار اسمك من قايمة الموظفين الأول' using errcode = '22023', hint = 'agent';
  end if;
  return v_agent;
end;
$$;
revoke all on function public.cc_require_agent(uuid) from public, anon, authenticated;

revoke all on function public.cc_join_with_code(text, text) from public, anon;
revoke all on function public.cc_set_my_name(text)          from public, anon;
revoke all on function public.cc_list_accounts()            from public, anon;
grant execute on function public.cc_join_with_code(text, text) to authenticated;
grant execute on function public.cc_set_my_name(text)          to authenticated;
grant execute on function public.cc_list_accounts()            to authenticated;
