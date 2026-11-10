-- =====================================================================
--  35 — «متسلّمش» on the board: a red line that stays on the order's card.
--
--  CONFIRMED: when the driver taps «متسلّمش» (34), the order's card on the
--  call-center board shows «❌ متسلّمش — السبب · الساعة» in red. It stays there
--  (not only until the chat is read) and goes away when the driver taps
--  «رجعت الفرع», or when the customer takes it after all («سلّمت»).
--  For the call center and the admin.
--
--  CALL-CENTER ONLY: one new read-only function. Nothing else is changed.
--  Safe to re-run.
-- =====================================================================

create or replace function public.cc_refused_orders()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('order_id', d.order_id, 'reason', d.refused_reason, 'at', d.refused_at) order by d.refused_at)
      from public.cc_order_delivery d
      join public.cc_orders o on o.id = d.order_id
     where d.refused_at >= public.cc_work_day_start()
       and d.delivered_at is null and d.returned_at is null
       and o.stage = 'out'), '[]'::jsonb);
end;
$$;
revoke all on function public.cc_refused_orders() from public, anon;
grant execute on function public.cc_refused_orders() to authenticated;
