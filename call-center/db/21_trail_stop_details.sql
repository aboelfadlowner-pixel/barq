-- =====================================================================
--  Abu El Fadl Call Center — the ✓ on the live map shows the order's address
--
--  CONFIRMED: tapping a ✓ (where the driver tapped «سلّمت») shows the order's address, the
--  delivery time and the photo, so the admin can check he delivered at the right place.
--  CALL-CENTER ONLY, READ ONLY: cc_drivers_trails also returns each stop's address and photo.
--  No table changes, nothing removed. Safe to re-run.
-- =====================================================================

-- Admin: the line of each driver out now, since he left (oldest first), and where he delivered —
-- each ✓ with the order's address and photo, to check he delivered at the right place.
create or replace function public.cc_drivers_trails()
returns table (user_id uuid, points jsonb, stops jsonb)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  return query
    with out_now as (
      select o.driver_user_id as uid, min(o.out_at) as since
        from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
       where o.stage = 'out' and o.status <> 'cancelled' and d.returned_at is null
         and o.driver_user_id is not null and o.out_at > now() - interval '1 day'
       group by o.driver_user_id)
    select n.uid,
           coalesce((select jsonb_agg(jsonb_build_array(t.lat, t.lng, t.at) order by t.at)
                       from public.cc_driver_track t
                      where t.user_id = n.uid and t.at >= n.since), '[]'::jsonb),
           coalesce((select jsonb_agg(jsonb_build_object('order_no', o.order_no, 'lat', d.lat, 'lng', d.lng,
                                                         'at', d.delivered_at, 'id', o.id, 'photo_path', d.photo_path,
                                                         'area_name', o.area_name, 'address_label', o.address_label,
                                                         'street', o.street, 'housing_type', o.housing_type,
                                                         'address_notes', o.address_notes) order by d.delivered_at)
                       from public.cc_orders o join public.cc_order_delivery d on d.order_id = o.id
                      where o.driver_user_id = n.uid and o.stage = 'out' and d.returned_at is null
                        and d.delivered_at is not null and d.lat is not null and o.out_at >= n.since), '[]'::jsonb)
      from out_now n;
end;
$$;
revoke all on function public.cc_drivers_trails() from public, anon;
grant execute on function public.cc_drivers_trails() to authenticated;
