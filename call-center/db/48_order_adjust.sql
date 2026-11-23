-- =====================================================================
--  48 — «خصم» و«بدون رسوم توصيل» on an order.
--
--  CONFIRMED:
--    • «بدون رسوم توصيل»: the delivery fee is taken off the order (kept in fee_removed so it can
--      come back); the branch sees «رسوم التوصيل متشالة»;
--    • «خصم»: a percent (10% / 15% / any) or an amount in جنيه — a percent is taken from the ITEMS
--      only, never from the delivery fee; never more than the items; the total follows at once,
--      also when the branch later corrects a weight (the percent follows the items);
--    • no reason is asked; who set it and when is kept; the call center and the admin, while the
--      order is «جديد» or «قيد التجهيز» (like editing the order);
--    • the branch's list says what was taken off (fee removed, discount amount).
--
--  CALL-CENTER ONLY: new columns on cc_orders (nothing existing is changed), a function that
--  computes the discount, a trigger that keeps «total» right, one new function, and a new body for
--  cc_prep_orders (32_prep_claim.sql) with 4 more fields. Orders already there are not touched.
--  Safe to re-run.
-- =====================================================================

alter table public.cc_orders add column if not exists discount_kind  text;
alter table public.cc_orders add column if not exists discount_value numeric(10,2);
alter table public.cc_orders add column if not exists fee_removed    numeric(10,2) not null default 0;
alter table public.cc_orders add column if not exists adjust_by      text;
alter table public.cc_orders add column if not exists adjust_at      timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cc_orders_discount_ck') then
    alter table public.cc_orders add constraint cc_orders_discount_ck check (
      (discount_kind is null and discount_value is null)
      or (discount_kind = 'percent' and discount_value > 0 and discount_value <= 100)
      or (discount_kind = 'amount' and discount_value > 0));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cc_orders_fee_removed_ck') then
    alter table public.cc_orders add constraint cc_orders_fee_removed_ck check (fee_removed >= 0);
  end if;
end $$;

-- The discount in جنيه for these items: a percent of them, or the amount — never more than the items.
create or replace function public.cc_discount_amount(p_subtotal numeric, p_kind text, p_value numeric)
returns numeric
language sql immutable security definer
set search_path = ''
as $$
  select case
    when p_kind is null or coalesce(p_value, 0) <= 0 then 0::numeric
    when p_kind = 'percent' then round(least(greatest(p_subtotal * p_value / 100, 0), p_subtotal), 2)
    else round(least(greatest(p_value, 0), p_subtotal), 2)
  end
$$;

-- «total» = items − discount + delivery fee, whichever function changes the items, the fee or the discount
-- (editing the order, the branch's weight correction, the pickup fee ...). Orders with no discount keep
-- the total the other functions wrote.
create or replace function public.cc_order_total_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.discount_kind is not null or (tg_op = 'UPDATE' and old.discount_kind is not null) then
    new.total := greatest(new.subtotal - public.cc_discount_amount(new.subtotal, new.discount_kind, new.discount_value)
                          + new.delivery_fee, 0);
  end if;
  return new;
end;
$$;
drop trigger if exists cc_order_total_guard on public.cc_orders;
create trigger cc_order_total_guard before insert or update on public.cc_orders
  for each row execute function public.cc_order_total_guard();

-- Set (or clear) the order's discount and «بدون رسوم توصيل». Safe to call again with the same values.
create or replace function public.cc_set_order_adjust(p_order_id uuid, p_no_fee boolean, p_kind text, p_value numeric)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o       public.cc_orders;
  v_kind    text := nullif(btrim(coalesce(p_kind, '')), '');
  v_value   numeric(10,2) := case when nullif(btrim(coalesce(p_kind, '')), '') is null then null else round(p_value, 2) end;
  v_fee     numeric(10,2);
  v_removed numeric(10,2);
  v_any     boolean;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  select * into v_o from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_o.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى' using errcode = '22023', hint = 'cancelled';
  end if;
  if coalesce(v_o.stage, 'new') not in ('new', 'preparing') then
    raise exception 'الطلب وصل الكاشير — الخصم قبل كده بس' using errcode = '22023', hint = 'stale';
  end if;
  if v_kind is not null and v_kind not in ('percent', 'amount') then
    raise exception 'نوع الخصم غير معروف' using errcode = '22023', hint = 'discount';
  end if;
  if v_kind is not null and (v_value is null or v_value <= 0) then
    v_kind := null; v_value := null;
  end if;
  if v_kind = 'percent' and v_value > 100 then
    raise exception 'نسبة الخصم من 1 لـ 100' using errcode = '22023', hint = 'discount';
  end if;
  if v_kind = 'amount' and v_value > v_o.subtotal then
    raise exception 'الخصم أكبر من أصناف الطلب' using errcode = '22023', hint = 'discount';
  end if;

  -- the delivery fee: taken off, or put back (a pickup order has none)
  v_fee := v_o.delivery_fee;
  v_removed := v_o.fee_removed;
  if coalesce(p_no_fee, false) and v_o.order_type = 'delivery' then
    if v_o.delivery_fee > 0 then v_removed := v_o.delivery_fee; end if;   -- the area's fee (also after the address changed)
    v_fee := 0;
  elsif v_removed > 0 then
    if v_o.order_type = 'delivery' then v_fee := v_removed; end if;
    v_removed := 0;
  end if;

  v_any := v_removed > 0 or v_kind is not null;
  if v_fee is distinct from v_o.delivery_fee or v_removed is distinct from v_o.fee_removed
     or v_kind is distinct from v_o.discount_kind or v_value is distinct from v_o.discount_value then
    update public.cc_orders
       set delivery_fee = v_fee, fee_removed = v_removed, discount_kind = v_kind, discount_value = v_value,
           adjust_by = case when v_any then public.cc_person_name(auth.uid()) end,
           adjust_at = case when v_any then clock_timestamp() end
     where id = p_order_id;
  end if;
  select * into v_o from public.cc_orders where id = p_order_id;
  return jsonb_build_object('subtotal', v_o.subtotal, 'delivery_fee', v_o.delivery_fee, 'fee_removed', v_o.fee_removed,
           'discount_kind', v_o.discount_kind, 'discount_value', v_o.discount_value,
           'discount_amount', public.cc_discount_amount(v_o.subtotal, v_o.discount_kind, v_o.discount_value),
           'total', v_o.total);
end;
$$;

-- cc_prep_orders: same as in 32_prep_claim.sql + fee_removed, discount_kind, discount_value, discount_amount.
create or replace function public.cc_prep_orders()
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz := public.cc_work_day_start();   -- 2 AM Cairo
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'شاشة التجهيز للفرع بس' using errcode = '42501';
  end if;
  return query
    select jsonb_build_object(
      'id', o.id, 'order_no', o.order_no, 'created_at', o.created_at,
      'status', o.status, 'cancel_reason', o.cancel_reason, 'cancelled_at', o.cancelled_at,
      'stage', o.stage, 'preparing_at', o.preparing_at, 'at_cashier_at', o.at_cashier_at, 'out_at', o.out_at,
      'driver', o.driver,
      'prep_user_id', o.prep_user_id, 'prep_name', o.prep_name, 'prep_claimed_at', o.prep_claimed_at,
      'prep_mine', o.prep_user_id = auth.uid(),
      'customer_name', o.customer_name, 'customer_phone', o.customer_phone, 'customer_phone2', o.customer_phone2,
      'area_name', o.area_name, 'address_label', o.address_label, 'street', o.street,
      'housing_type', o.housing_type, 'address_notes', o.address_notes,
      'note', o.note, 'agent_name', coalesce(o.agent_name, o.created_by_name),
      'edited_at', o.edited_at, 'edit_count', o.edit_count, 'edit_changes', o.edit_changes, 'edit_seen_at', o.edit_seen_at,
      'fee_removed', o.fee_removed, 'discount_kind', o.discount_kind, 'discount_value', o.discount_value,
      'discount_amount', public.cc_discount_amount(o.subtotal, o.discount_kind, o.discount_value),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
                  'name', i.product_name, 'qty', i.qty, 'weight_grams', i.weight_grams, 'note', i.note,
                  'modifiers', i.modifiers)
                  order by i.line_no)
                from public.cc_order_items i where i.order_id = o.id), '[]'::jsonb))
      from public.cc_orders o
     where o.created_at >= v_day_start
        or (o.status <> 'cancelled' and o.stage <> 'out' and o.created_at > now() - interval '3 days')
     order by o.created_at;
end;
$$;

revoke all on function public.cc_discount_amount(numeric, text, numeric)   from public, anon;
revoke all on function public.cc_order_total_guard()                       from public, anon, authenticated;
revoke all on function public.cc_set_order_adjust(uuid, boolean, text, numeric) from public, anon;
grant execute on function public.cc_discount_amount(numeric, text, numeric) to authenticated;
grant execute on function public.cc_set_order_adjust(uuid, boolean, text, numeric) to authenticated;
-- cc_prep_orders keeps its grants (create or replace does not change them)
