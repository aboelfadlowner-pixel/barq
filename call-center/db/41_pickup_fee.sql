-- =====================================================================
--  41 — the branch's «العميل هيستلم من الفرع» takes the delivery fee off.
--
--  CONFIRMED: when the prep screen picks «العميل هيستلم من الفرع» for a delivery
--  order, its delivery fee goes (total = what the customer pays at the branch), and
--  the call center gets the ring and the blue line like the branch's other
--  corrections (37). If a driver is picked after all, the same fee comes back.
--  (An order made «استلام من الفرع» by the call center has no fee already — 39.)
--
--  CALL-CENTER ONLY: new bodies for cc_set_pickup (36) and cc_order_type_guard (39),
--  same names and grants. Nothing else is changed; nothing is deleted. Safe to re-run.
-- =====================================================================

-- cc_set_pickup: same as in 36_pickup.sql + the delivery fee goes.
create or replace function public.cc_set_pickup(p_order_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o public.cc_orders;
  v_name text;
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'ده للفرع بس' using errcode = '42501';
  end if;
  select * into v_o from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_o.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى' using errcode = '22023', hint = 'cancelled';
  end if;
  if v_o.stage <> 'at_cashier' then
    raise exception 'الطلب لازم يكون على الكاشير' using errcode = '22023', hint = 'stale';
  end if;
  update public.cc_orders
     set driver_user_id = null, driver = 'استلام من الفرع', assigned_at = clock_timestamp()
   where id = p_order_id;
  -- 41: no delivery → no delivery fee. Kept in cc_order_edits (the amount comes back if a driver is picked),
  -- and the call center sees it like the branch's other corrections (37).
  if v_o.delivery_fee > 0 then
    v_name := public.cc_person_name(auth.uid());
    insert into public.cc_order_edits (order_id, by_user, agent_name, old_items, new_items, old_address, new_address,
                                       old_note, new_note, old_total, new_total, changes)
    select v_o.id, auth.uid(), v_name, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, v_o.note, v_o.note,
           v_o.total, v_o.total - v_o.delivery_fee,
           jsonb_build_array(jsonb_build_object('kind', 'pickup_fee', 'by', 'prep', 'name', 'رسوم التوصيل',
                                                'from', v_o.delivery_fee, 'to', 0));
    update public.cc_orders set delivery_fee = 0, total = total - v_o.delivery_fee where id = p_order_id;
  end if;
  return 'استلام من الفرع';
end;
$$;

-- cc_order_type_guard: same as in 39_order_type.sql + the fee comes back when a driver is picked.
create or replace function public.cc_order_type_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_fee numeric(10,2);
begin
  -- 41: a driver picked for an order the branch had made «استلام من الفرع»: its delivery fee comes back
  if tg_op = 'UPDATE' and new.driver_user_id is not null and old.driver_user_id is null
     and new.order_type = 'delivery' and new.delivery_fee = 0 then
    select (e.changes->0->>'from')::numeric into v_fee
      from public.cc_order_edits e
     where e.order_id = new.id and e.changes->0->>'kind' = 'pickup_fee'
     order by e.id desc limit 1;
    if v_fee is not null and v_fee > 0
       and (select (e.changes->0->>'to')::numeric from public.cc_order_edits e
             where e.order_id = new.id and e.changes->0->>'kind' = 'pickup_fee' order by e.id desc limit 1) = 0 then
      insert into public.cc_order_edits (order_id, by_user, agent_name, old_items, new_items, old_address, new_address,
                                         old_note, new_note, old_total, new_total, changes)
      values (new.id, auth.uid(), public.cc_person_name(auth.uid()), '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb,
              new.note, new.note, new.total, new.total + v_fee,
              jsonb_build_array(jsonb_build_object('kind', 'pickup_fee', 'by', 'prep', 'name', 'رسوم التوصيل', 'from', 0, 'to', v_fee)));
      new.delivery_fee := v_fee;
      new.total := new.total + v_fee;
    end if;
  end if;
  if new.order_type = 'pickup' then
    if new.driver_user_id is not null and new.area_id is null then
      raise exception 'الطلب ده «استلام من الفرع» ومن غير عنوان — الكول سنتر يغيّره لـ «توصيل» الأول'
        using errcode = '22023', hint = 'pickup';
    end if;
    if new.stage = 'at_cashier' and new.status <> 'cancelled' and new.driver_user_id is null
       and new.driver is distinct from 'استلام من الفرع' then
      new.driver := 'استلام من الفرع';
      new.assigned_at := coalesce(new.assigned_at, clock_timestamp());
    end if;
  end if;
  return new;
end;
$$;
