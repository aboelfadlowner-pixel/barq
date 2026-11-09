-- =====================================================================
--  34 — «متسلّمش»: the driver marks an order the customer did not take.
--
--  CONFIRMED: on each order with him the driver has «سلّمت — صوّر الطلب» and
--  «متسلّمش». «متسلّمش» asks why (رفض يستلم / مش بيرد / مش موجود / العنوان غلط /
--  غيّر رأيه, or written) and records the time and his place. The call center
--  is told at once in the chat («متسلّمش CC-1005 — مش بيرد», with a ring and 💬
--  on the card); the order page shows it. He brings the order back to the branch.
--  If the customer then takes it after all, «سلّمت» still works (delivered wins).
--
--  CALL-CENTER ONLY: five new EMPTY columns on cc_order_delivery, one new
--  function, and new bodies for cc_driver_orders / cc_order_delivery_of (same
--  names, arguments and grants). Nothing is dropped or deleted. Safe to re-run.
-- =====================================================================

alter table public.cc_order_delivery add column if not exists refused_at       timestamptz;
alter table public.cc_order_delivery add column if not exists refused_reason   text;
alter table public.cc_order_delivery add column if not exists refused_lat      double precision;
alter table public.cc_order_delivery add column if not exists refused_lng      double precision;
alter table public.cc_order_delivery add column if not exists refused_accuracy_m double precision;

create or replace function public.cc_driver_refused(p_order_id uuid, p_reason text, p_lat double precision,
                                                    p_lng double precision, p_accuracy double precision)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me public.cc_staff := public.cc_require_driver();
  v_o  public.cc_orders;
  v_d  public.cc_order_delivery;
  v_reason text := left(btrim(coalesce(p_reason, '')), 200);
  v_at timestamptz := now();
begin
  select * into v_o from public.cc_orders where id = p_order_id for update;
  if not found or v_o.driver_user_id is distinct from v_me.user_id or v_o.stage <> 'out' then
    raise exception 'الطلب ده مش معاك' using errcode = '22023', hint = 'stale';
  end if;
  if v_o.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى — رجّعه للفرع' using errcode = '22023', hint = 'cancelled';
  end if;
  if v_reason = '' then
    raise exception 'اختار السبب' using errcode = '22023', hint = 'reason';
  end if;
  select * into v_d from public.cc_order_delivery where order_id = p_order_id;
  if v_d.delivered_at is not null then
    raise exception 'الطلب اتسجّل إنه اتسلّم' using errcode = '22023', hint = 'delivered';
  end if;
  if v_d.refused_at is not null then
    return v_d.refused_at;                                    -- double tap: nothing to do
  end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then
    p_lat := null; p_lng := null; p_accuracy := null;
  end if;
  insert into public.cc_order_delivery (order_id, refused_at, refused_reason, refused_lat, refused_lng, refused_accuracy_m)
  values (p_order_id, v_at, v_reason, p_lat, p_lng, p_accuracy)
  on conflict (order_id) do update
     set refused_at = excluded.refused_at, refused_reason = excluded.refused_reason,
         refused_lat = excluded.refused_lat, refused_lng = excluded.refused_lng, refused_accuracy_m = excluded.refused_accuracy_m;
  -- the call center is told at once (a message from him in the chat: ring + 💬 on the card)
  begin
    insert into public.cc_chat_messages (driver_id, sender_id, sender_role, sender_name, order_id, order_no, body)
    values (v_me.user_id, v_me.user_id, 'driver', nullif(btrim(v_me.display_name), ''), v_o.id, v_o.order_no,
            'متسلّمش — ' || v_reason);
  exception when others then
    null;                                                     -- the chat is optional: never stop the refusal
  end;
  return v_at;
end;
$$;
revoke all on function public.cc_driver_refused(uuid, text, double precision, double precision, double precision) from public, anon;
grant execute on function public.cc_driver_refused(uuid, text, double precision, double precision, double precision) to authenticated;

-- cc_driver_orders: same as in 28_work_day.sql + «متسلّمش».
create or replace function public.cc_driver_orders()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_me public.cc_staff := public.cc_require_driver();
  v_day_start timestamptz := public.cc_work_day_start();   -- 2 AM Cairo
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
        'refused_at', d.refused_at, 'refused_reason', d.refused_reason,
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
       and d.returned_at is null), '[]'::jsonb),
    -- «طلباتي»: every order he went out with today (also after «رجعت الفرع») — numbers and what happened, no customer data
    'today', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_no', o.order_no, 'out_at', o.out_at, 'trip_id', o.trip_id, 'trip_seq', o.trip_seq,
        'cancelled', o.status = 'cancelled', 'delivered_at', d.delivered_at, 'refused_at', d.refused_at,
        'refused_reason', d.refused_reason, 'returned_at', d.returned_at, 'area_name', o.area_name) order by o.out_at, o.trip_seq)
      from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
     where o.driver_user_id = auth.uid() and o.stage = 'out' and o.out_at >= v_day_start), '[]'::jsonb));
end;
$$;

-- cc_order_delivery_of: same as in 18_driver_tracking.sql + «متسلّمش».
create or replace function public.cc_order_delivery_of(p_order_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.cc_is_admin();
  v_r jsonb;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  select jsonb_build_object(
      'out_by_admin', o.out_by_admin, 'trip_seq', o.trip_seq, 'trip_size', o.trip_size, 'assigned_at', o.assigned_at,
      'delivered_at', d.delivered_at, 'delivered_admin', coalesce(d.delivered_admin, false),
      'returned_at', d.returned_at, 'returned_admin', coalesce(d.returned_admin, false),
      'refused_at', d.refused_at, 'refused_reason', d.refused_reason)
    || case when v_admin then jsonb_build_object('photo_path', d.photo_path, 'lat', d.lat, 'lng', d.lng, 'accuracy_m', d.accuracy_m,
                                                 'returned_lat', d.returned_lat, 'returned_lng', d.returned_lng,
                                                 'returned_distance_m', d.returned_distance_m, 'returned_far', d.returned_far,
                                                 'refused_lat', d.refused_lat, 'refused_lng', d.refused_lng)
            else '{}'::jsonb end
    into v_r
    from public.cc_orders o left join public.cc_order_delivery d on d.order_id = o.id
   where o.id = p_order_id;
  return v_r;
end;
$$;
