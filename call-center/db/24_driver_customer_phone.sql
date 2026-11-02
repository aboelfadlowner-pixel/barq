-- =====================================================================
--  24 — The driver sees the customer's number(s) while the order is with him.
--
--  CONFIRMED: on «معايا», each order that is out and NOT delivered yet shows the
--  customer's number (and the second number, if any); tapping it calls. After
--  «سلّمت», or if the order is cancelled, the numbers are no longer sent.
--  Orders still at the cashier («طلباتي — جاهزة تخرج») show no number.
--
--  CALL-CENTER ONLY: a new body for cc_driver_orders() (same name, no arguments,
--  same grants). Nothing is dropped or deleted. Safe to re-run.
-- =====================================================================

create or replace function public.cc_driver_orders()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.cc_staff := public.cc_require_driver();
  v_day_start timestamptz := (date_trunc('day', now() at time zone 'Africa/Cairo')) at time zone 'Africa/Cairo';
begin
  return jsonb_build_object(
    'phone', v_me.phone,
    -- picked for me by the branch, not out yet (no customer number yet)
    'ready', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_no', o.order_no, 'assigned_at', o.assigned_at,
        'area_name', o.area_name, 'address_label', o.address_label, 'street', o.street,
        'housing_type', o.housing_type, 'address_notes', o.address_notes) order by o.assigned_at, o.order_no)
      from public.cc_orders o
     where o.stage = 'at_cashier' and o.driver_user_id = auth.uid() and o.status <> 'cancelled'
       and o.created_at > now() - interval '1 day'), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_no', o.order_no, 'out_at', o.out_at, 'trip_id', o.trip_id, 'trip_seq', o.trip_seq,
        'trip_size', o.trip_size, 'cancelled', o.status = 'cancelled', 'delivered_at', d.delivered_at,
        'area_name', o.area_name, 'address_label', o.address_label, 'street', o.street,
        'housing_type', o.housing_type, 'address_notes', o.address_notes,
        -- the customer's numbers, only while the order is with him
        'phones', case when d.delivered_at is null and o.status <> 'cancelled'
                       then (select coalesce(jsonb_agg(p), '[]'::jsonb)
                               from unnest(array[o.customer_phone, nullif(o.customer_phone2, o.customer_phone)]) as p
                              where p is not null and p <> '')
                       else '[]'::jsonb end) order by o.out_at desc, o.trip_seq)
      from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
     where o.driver_user_id = auth.uid() and o.stage = 'out' and o.out_at >= v_day_start
       and d.returned_at is null), '[]'::jsonb));
end;
$$;

revoke all on function public.cc_driver_orders() from public, anon;
grant execute on function public.cc_driver_orders() to authenticated;
