-- =====================================================================
--  Abu El Fadl Call Center — «لوحة الطيارين» (admin dashboard)
--
--  CONFIRMED: per driver and per area — orders, the money of the orders (total and the
--  delivery fee), the estimated kilometres (from the branch to each delivery place and back,
--  worked out on the page), and the delivery speed.
--  CALL-CENTER ONLY, READ ONLY: the delivery report also returns each order's total and
--  delivery fee. No table changes. Safe to re-run.
-- =====================================================================

create or replace function public.cc_delivery_report(p_from date, p_to date)
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_from timestamptz := (p_from::timestamp) at time zone 'Africa/Cairo';
  v_to   timestamptz := ((p_to + 1)::timestamp) at time zone 'Africa/Cairo';
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'اختار فترة لحد شهرين' using errcode = '22023', hint = 'period';
  end if;
  return query
    select jsonb_build_object(
      'id', o.id, 'order_no', o.order_no, 'created_at', o.created_at, 'area_name', o.area_name,
      'at_cashier_at', o.at_cashier_at, 'assigned_at', o.assigned_at, 'out_at', o.out_at, 'out_by_admin', o.out_by_admin,
      'driver_user_id', o.driver_user_id, 'driver', o.driver,
      'trip_id', o.trip_id, 'trip_seq', o.trip_seq, 'trip_size', o.trip_size,
      'delivered_at', d.delivered_at, 'delivered_admin', coalesce(d.delivered_admin, false),
      'photo_path', d.photo_path, 'lat', d.lat, 'lng', d.lng, 'accuracy_m', d.accuracy_m,
      'returned_at', d.returned_at, 'returned_admin', coalesce(d.returned_admin, false), 'returned_by_name', d.returned_by_name,
      'returned_lat', d.returned_lat, 'returned_lng', d.returned_lng, 'returned_distance_m', d.returned_distance_m,
      'returned_far', d.returned_far,
      'total', o.total, 'delivery_fee', o.delivery_fee)
      from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
     where o.out_at >= v_from and o.out_at < v_to and o.status <> 'cancelled'
     order by o.out_at desc, o.trip_seq;
end;
$$;
revoke all on function public.cc_delivery_report(date, date) from public, anon;
grant execute on function public.cc_delivery_report(date, date) to authenticated;
