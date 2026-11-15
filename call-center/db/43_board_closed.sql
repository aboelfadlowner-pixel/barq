-- =====================================================================
--  43 — «الطلبات المغلقة» on the call-center board.
--
--  CONFIRMED: as soon as the driver taps «سلّمت» (or the branch taps «العميل
--  استلم» for a pickup), the order leaves «خرج مع الطيار» and shows in the board's
--  «الطلبات المغلقة» column (order number, customer, time, driver). For the call
--  center and the admin. (The board's «ملغي» column is removed — cancelled orders stay
--  in «الطلبات».)
--
--  CALL-CENTER ONLY: one new read-only function. Nothing else is changed. Safe to re-run.
-- =====================================================================

create or replace function public.cc_closed_orders()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('order_id', d.order_id, 'at', d.delivered_at) order by d.delivered_at desc)
      from public.cc_order_delivery d
      join public.cc_orders o on o.id = d.order_id
     where d.delivered_at is not null and o.status <> 'cancelled' and o.stage = 'out'
       and o.created_at >= public.cc_work_day_start()), '[]'::jsonb);
end;
$$;
revoke all on function public.cc_closed_orders() from public, anon;
grant execute on function public.cc_closed_orders() to authenticated;
