-- =====================================================================
--  36 — «العميل هيستلم من الفرع» (temporary, prep only).
--
--  CONFIRMED: at the cashier, «اختيار الطيار» also offers «🏬 العميل هيستلم من
--  الفرع». Picking it closes the list by itself; the card then waits for the
--  customer. When he takes it, the branch taps «✅ العميل استلم» and the order is
--  done (it leaves the prep screen like an order that went out). Until then the
--  branch can still pick a driver instead. The delivery fee is NOT changed here
--  (to be decided later).
--
--  How it is kept: no new column — the order's driver text is
--  'استلام من الفرع' with no driver account, so every screen and the delivery
--  page show it as its own line, and it is never counted on a driver.
--
--  CALL-CENTER ONLY: two new functions. Nothing existing is changed or deleted.
--  Safe to re-run.
-- =====================================================================

-- «🏬 العميل هيستلم من الفرع»: the order at the cashier waits for the customer.
create or replace function public.cc_set_pickup(p_order_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o public.cc_orders;
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
  return 'استلام من الفرع';
end;
$$;

-- «✅ العميل استلم»: the customer took it from the branch — the order is done.
create or replace function public.cc_pickup_done(p_order_id uuid)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o    public.cc_orders;
  v_at   timestamptz := now();
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
  if v_o.stage = 'out' and v_o.driver_user_id is null and v_o.driver = 'استلام من الفرع' then
    return v_o.out_at;                                        -- double tap: nothing to do
  end if;
  if v_o.stage <> 'at_cashier' or v_o.driver_user_id is not null or v_o.driver is distinct from 'استلام من الفرع' then
    raise exception 'الطلب ده مش متحدد إن العميل هيستلمه من الفرع — اعمل تحديث' using errcode = '22023', hint = 'stale';
  end if;
  v_name := public.cc_person_name(auth.uid());
  update public.cc_orders set stage = 'out', out_at = v_at, stage_by_name = v_name where id = p_order_id;
  insert into public.cc_order_stage_events (order_id, stage, by_user, by_name) values (p_order_id, 'out', auth.uid(), v_name);
  insert into public.cc_order_delivery (order_id, delivered_at, delivered_by)
  values (p_order_id, v_at, auth.uid())
  on conflict (order_id) do update set delivered_at = excluded.delivered_at, delivered_by = excluded.delivered_by;
  return v_at;
end;
$$;

revoke all on function public.cc_set_pickup(uuid)  from public, anon;
revoke all on function public.cc_pickup_done(uuid) from public, anon;
grant execute on function public.cc_set_pickup(uuid)  to authenticated;
grant execute on function public.cc_pickup_done(uuid) to authenticated;
