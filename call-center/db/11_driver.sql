-- =====================================================================
--  Abu El Fadl Call Center — the driver who took the order out (FOR REVIEW)
--
--  CONFIRMED: when the branch taps «خرج مع الطيار» it types the driver in ONE
--  field — the name with the number in brackets, e.g. «محمد (01012345678)».
--  The call center sees it on the board and in the order details.
--
--  CALL-CENTER ONLY, ADDITIVE: one new column on cc_orders and one new function
--  (cc_send_out = «خرج مع الطيار» with the driver). The preparation list (09/10)
--  also returns the driver. Nothing is dropped or deleted. Safe to re-run.
-- =====================================================================

alter table public.cc_orders add column if not exists driver text;    -- «الاسم (الرقم)» as typed

-- «خرج مع الطيار» with the driver: from «على الكاشير» only (same rules as cc_set_stage).
create or replace function public.cc_send_out(p_order_id uuid, p_driver text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_driver text := btrim(regexp_replace(coalesce(p_driver, ''), '\s+', ' ', 'g'));
  v_stage  text;
  v_res    jsonb;
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'تغيير حالة التجهيز للفرع بس' using errcode = '42501';
  end if;
  if char_length(v_driver) not between 2 and 80 then
    raise exception 'اكتب اسم الطيار ورقمه — مثال: محمد (01012345678)' using errcode = '22023', hint = 'driver';
  end if;
  select stage into v_stage from public.cc_orders where id = p_order_id;
  if v_stage = 'out' then
    raise exception 'الطلب خرج بالفعل' using errcode = '22023', hint = 'stale';
  end if;
  v_res := public.cc_set_stage(p_order_id, 'out');       -- checks cancelled / one step at a time, logs the tap
  update public.cc_orders set driver = v_driver where id = p_order_id;
  return v_res || jsonb_build_object('driver', v_driver);
end;
$$;
revoke all on function public.cc_send_out(uuid, text) from public, anon;
grant execute on function public.cc_send_out(uuid, text) to authenticated;

-- The preparation list also carries the driver (same as 10_edit_order.sql plus "driver").
create or replace function public.cc_prep_orders()
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz := (date_trunc('day', now() at time zone 'Africa/Cairo')) at time zone 'Africa/Cairo';
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
      'customer_name', o.customer_name, 'customer_phone', o.customer_phone, 'customer_phone2', o.customer_phone2,
      'area_name', o.area_name, 'address_label', o.address_label, 'street', o.street,
      'housing_type', o.housing_type, 'address_notes', o.address_notes,
      'note', o.note, 'agent_name', coalesce(o.agent_name, o.created_by_name),
      'edited_at', o.edited_at, 'edit_count', o.edit_count, 'edit_changes', o.edit_changes, 'edit_seen_at', o.edit_seen_at,
      'items', coalesce((select jsonb_agg(jsonb_build_object(
                  'name', i.product_name, 'qty', i.qty, 'weight_grams', i.weight_grams, 'note', i.note)
                  order by i.line_no)
                from public.cc_order_items i where i.order_id = o.id), '[]'::jsonb))
      from public.cc_orders o
     where o.created_at >= v_day_start
        or (o.status <> 'cancelled' and o.stage <> 'out' and o.created_at > now() - interval '3 days')
     order by o.created_at;
end;
$$;
