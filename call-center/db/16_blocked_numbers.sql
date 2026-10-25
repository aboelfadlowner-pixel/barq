-- =====================================================================
--  Abu El Fadl Call Center — blocked numbers, like the Foodics black list (FOR REVIEW)
--
--  CONFIRMED: a number blocked on Foodics (or by the call center) shows
--  «القائمة السوداء» as soon as it is typed, and no order can be sent for it.
--  The call center and the admin can block and unblock; who did it and when is
--  kept (no reason needed). The admin sees the list of blocked numbers.
--
--  CALL-CENTER ONLY. Additive: one new table, three functions, and
--  cc_place_order refuses a blocked number. Nothing is dropped or deleted.
--  Safe to re-run.
-- =====================================================================

create table if not exists public.cc_blocked_phones (
  phone           text primary key check (phone ~ '^0[0-9]{8,10}$'),
  source          text not null default 'call_center' check (source in ('call_center', 'foodics')),
  blocked_by      uuid,
  blocked_by_name text,
  blocked_at      timestamptz not null default now()
);
alter table public.cc_blocked_phones enable row level security;
revoke all on public.cc_blocked_phones from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Which of these numbers are blocked (the order screen and the customer page).
-- ---------------------------------------------------------------------
create or replace function public.cc_blocked_of(p_phones text[])
returns table (phone text, source text, blocked_by_name text, blocked_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return query
    select b.phone, b.source, b.blocked_by_name, b.blocked_at
      from public.cc_blocked_phones b
     where b.phone = any (coalesce(p_phones, '{}'::text[]));
end;
$$;

-- ---------------------------------------------------------------------
-- All blocked numbers, with the customer they belong to (if any).
-- ---------------------------------------------------------------------
create or replace function public.cc_list_blocked()
returns table (phone text, customer_id uuid, customer_name text, source text, blocked_by_name text, blocked_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return query
    select b.phone, c.id, c.name, b.source, b.blocked_by_name, b.blocked_at
      from public.cc_blocked_phones b
      left join lateral (
        select x.id, x.name from public.cc_customers x
         where x.phone = b.phone or x.phone2 = b.phone
         order by (x.phone = b.phone) desc, x.created_at limit 1) c on true
     order by b.blocked_at desc;
end;
$$;

-- ---------------------------------------------------------------------
-- Block or unblock numbers (a customer's main and second number together).
-- Returns how many numbers changed.
-- ---------------------------------------------------------------------
create or replace function public.cc_set_blocked(p_phones text[], p_blocked boolean)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_phones text[];
  v_name   text;
  v_n      integer;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  select array_agg(distinct btrim(p)) into v_phones
    from unnest(coalesce(p_phones, '{}'::text[])) p where nullif(btrim(p), '') is not null;
  if v_phones is null then
    raise exception 'لا يوجد رقم' using errcode = '22023', hint = 'phone';
  end if;
  if exists (select 1 from unnest(v_phones) p where p !~ '^0[0-9]{8,10}$') then
    raise exception 'رقم غير صحيح' using errcode = '22023', hint = 'phone';
  end if;

  if p_blocked then
    select coalesce(a.name, u.email::text) into v_name
      from public.cc_staff s
      left join public.cc_agents a on a.id = s.agent_id
      left join auth.users u on u.id = s.user_id
     where s.user_id = auth.uid();
    insert into public.cc_blocked_phones (phone, source, blocked_by, blocked_by_name)
    select p, 'call_center', auth.uid(), v_name from unnest(v_phones) p
    on conflict (phone) do nothing;
  else
    delete from public.cc_blocked_phones where phone = any (v_phones);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Create an order as an employee: same as 13_modifiers.sql, but a blocked
-- number (main, second or contact number) is refused. A draft that was
-- already sent comes back as before.
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
  v_row   record;
  v_line  public.cc_order_items;
  v_mods  jsonb;
  v_add   numeric(12,2) := 0;
  v_cust  public.cc_customers;
  v_block text;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  v_agent := public.cc_require_agent(p_agent_id);

  if not exists (select 1 from public.cc_orders where client_request_id = p_client_request_id) then
    if p_customer ? 'id' then
      select * into v_cust from public.cc_customers where id = (p_customer->>'id')::uuid;
    end if;
    select b.phone into v_block from public.cc_blocked_phones b
     where b.phone in (v_cust.phone, v_cust.phone2, nullif(p_customer->>'phone', ''),
                       nullif(p_customer->>'phone2', ''), nullif(p_customer->>'order_phone', ''))
     limit 1;
    if v_block is not null then
      raise exception 'الرقم % في القائمة السوداء — ممنوع من الطلب', v_block using errcode = '22023', hint = 'blocked';
    end if;
  end if;

  v_order := public.cc_create_order(p_client_request_id, p_customer, p_address, p_items, p_note);
  if v_order.agent_id is null then
    -- A new order (a repeated draft already has its employee and add-ons).
    for v_row in select value as item, ordinality as n from jsonb_array_elements(p_items) with ordinality loop
      select * into v_line from public.cc_order_items where order_id = v_order.id and line_no = v_row.n;
      v_mods := public.cc_price_modifiers(v_line.sku, v_row.item->'modifiers', coalesce(v_line.qty, 1), null);
      if jsonb_array_length(v_mods->'items') > 0 then
        update public.cc_order_items
           set modifiers = v_mods->'items', line_total = line_total + (v_mods->>'total')::numeric
         where id = v_line.id;
        v_add := v_add + (v_mods->>'total')::numeric;
      end if;
    end loop;
    update public.cc_orders
       set agent_id = v_agent.id, agent_name = v_agent.name,
           subtotal = subtotal + v_add, total = total + v_add
     where id = v_order.id
    returning * into v_order;
    update public.cc_order_events set by_name = v_agent.name
     where order_id = v_order.id and status = 'new';
  end if;
  return v_order;
end;
$$;

revoke all on function public.cc_blocked_of(text[])            from public, anon;
revoke all on function public.cc_list_blocked()                from public, anon;
revoke all on function public.cc_set_blocked(text[], boolean)  from public, anon;
grant execute on function public.cc_blocked_of(text[])           to authenticated;
grant execute on function public.cc_list_blocked()               to authenticated;
grant execute on function public.cc_set_blocked(text[], boolean) to authenticated;
