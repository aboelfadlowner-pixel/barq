-- =====================================================================
--  Abu El Fadl Call Center — employee names on orders (FOR REVIEW)
--
--  CONFIRMED: one shared login; after signing in, the person picks their
--  name from a fixed list. The name is saved on each order and on cancel.
--
--  ADDITIVE ONLY: one new table (cc_agents), three new columns on cc_orders,
--  three new functions. Nothing is dropped or deleted, and no table outside
--  cc_* is touched. Safe to re-run.
--  The existing cc_create_order / cc_cancel_order stay as they are; the app
--  now calls cc_place_order / cc_cancel_order_as, which use them and then
--  record the employee.
-- =====================================================================

-- Employee names (managed from the app's settings screen).
create table if not exists public.cc_agents (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by uuid references auth.users(id)
);
-- "عمر" and "عمر " or "OMAR" and "omar" are the same person.
create unique index if not exists cc_agents_name_uq on public.cc_agents (lower(btrim(name)));

-- Who took the order / who cancelled it (copied in, so a later rename never changes old orders).
alter table public.cc_orders add column if not exists agent_id   uuid references public.cc_agents(id);
alter table public.cc_orders add column if not exists agent_name text;
alter table public.cc_orders add column if not exists cancelled_by_agent text;
create index if not exists cc_orders_agent_idx on public.cc_orders (agent_id, created_at desc);

-- Locked like the other cc_* tables: RLS on, staff read only, writes through functions.
alter table public.cc_agents enable row level security;
revoke all on public.cc_agents from anon, authenticated, public;
grant select on public.cc_agents to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cc_agents' and policyname = 'cc_agents_staff_read') then
    create policy cc_agents_staff_read on public.cc_agents for select to authenticated using ((select public.cc_is_staff()));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Add or edit an employee name. p_id null = new name.
-- ---------------------------------------------------------------------
create or replace function public.cc_save_agent(p_id uuid, p_name text, p_active boolean)
returns public.cc_agents
language plpgsql security definer
set search_path = ''
as $$
declare
  v_agent public.cc_agents;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
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

-- Active employee or a clear error (shared by the two functions below).
create or replace function public.cc_require_agent(p_agent_id uuid)
returns public.cc_agents
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_agent public.cc_agents;
begin
  select * into v_agent from public.cc_agents where id = p_agent_id and active;
  if not found then
    raise exception 'اختار اسمك من قايمة الموظفين الأول' using errcode = '22023', hint = 'agent';
  end if;
  return v_agent;
end;
$$;

-- ---------------------------------------------------------------------
-- Create an order as an employee: same rules as cc_create_order (prices,
-- fees, units, same-draft protection), plus the employee's name.
-- Sending the same draft again returns the same order and keeps the first name.
-- ---------------------------------------------------------------------
create or replace function public.cc_place_order(
  p_agent_id          uuid,
  p_client_request_id uuid,
  p_customer          jsonb,
  p_address           jsonb,
  p_items             jsonb,
  p_note              text default null
)
returns public.cc_orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_agent public.cc_agents;
  v_order public.cc_orders;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  v_agent := public.cc_require_agent(p_agent_id);
  v_order := public.cc_create_order(p_client_request_id, p_customer, p_address, p_items, p_note);
  if v_order.agent_id is null then
    update public.cc_orders set agent_id = v_agent.id, agent_name = v_agent.name
     where id = v_order.id
    returning * into v_order;
    update public.cc_order_events set by_name = v_agent.name
     where order_id = v_order.id and status = 'new';
  end if;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- Cancel as an employee: same rules as cc_cancel_order, plus the name.
-- ---------------------------------------------------------------------
create or replace function public.cc_cancel_order_as(p_agent_id uuid, p_order_id uuid, p_reason text)
returns public.cc_orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_agent public.cc_agents;
  v_order public.cc_orders;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  v_agent := public.cc_require_agent(p_agent_id);
  v_order := public.cc_cancel_order(p_order_id, p_reason);
  update public.cc_orders set cancelled_by_agent = v_agent.name
   where id = v_order.id
  returning * into v_order;
  update public.cc_order_events set by_name = v_agent.name
   where order_id = v_order.id and status = 'cancelled';
  return v_order;
end;
$$;

revoke all on function public.cc_save_agent(uuid, text, boolean)                         from public, anon;
revoke all on function public.cc_require_agent(uuid)                                     from public, anon, authenticated;
revoke all on function public.cc_place_order(uuid, uuid, jsonb, jsonb, jsonb, text)      from public, anon;
revoke all on function public.cc_cancel_order_as(uuid, uuid, text)                       from public, anon;
grant execute on function public.cc_save_agent(uuid, text, boolean)                      to authenticated;
grant execute on function public.cc_place_order(uuid, uuid, jsonb, jsonb, jsonb, text)   to authenticated;
grant execute on function public.cc_cancel_order_as(uuid, uuid, text)                    to authenticated;
