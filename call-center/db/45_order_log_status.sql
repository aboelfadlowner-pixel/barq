-- =====================================================================
--  45 — «سجل الطلبات»: two more choices in «كل الحالات».
--
--  CONFIRMED: besides «جديد» and «ملغي» the status list has «خرج مع الطيار» (left
--  with the driver, not delivered yet) and «الطلبات المغلقة» (delivered, or taken by
--  the customer at the branch). The count and the total follow the filter.
--
--  CALL-CENTER ONLY: a new body for cc_order_log (22_order_log_backup.sql) — same name,
--  arguments and grants; the other choices work as before. Nothing else is changed.
-- =====================================================================

-- cc_order_log: same as in 22_order_log_backup.sql + p_status 'out' / 'closed'.
create or replace function public.cc_order_log(p_from timestamptz, p_to timestamptz, p_status text,
                                               p_agents text[], p_q text, p_limit integer, p_offset integer)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_q      text := nullif(btrim(coalesce(p_q, '')), '');
  v_digits text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
  v_like   text;
  v_r      jsonb;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if v_q is not null then
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  -- a phone is searched only when the text is a number (an order number like «CC-1006» is not a phone)
  if v_digits is not null and (length(v_digits) < 3 or v_q ~ '[^0-9 +()-]') then v_digits := null; end if;
  with f as (
    select o.id, o.created_at, o.status, o.total
      from public.cc_orders o
     where (p_from is null or o.created_at >= p_from)
       and (p_to is null or o.created_at < p_to)
       -- 45: «خرج مع الطيار» = out and not delivered yet; «الطلبات المغلقة» = delivered / taken by the customer
       and (case nullif(p_status, '')
              when 'out' then o.status <> 'cancelled' and o.stage = 'out'
                              and not exists (select 1 from public.cc_order_delivery d where d.order_id = o.id and d.delivered_at is not null)
              when 'closed' then o.status <> 'cancelled'
                              and exists (select 1 from public.cc_order_delivery d where d.order_id = o.id and d.delivered_at is not null)
              else nullif(p_status, '') is null or o.status = p_status
            end)
       and (coalesce(cardinality(p_agents), 0) = 0 or coalesce(o.agent_name, o.created_by_name) = any (p_agents))
       and (v_q is null or o.order_no ilike v_like or o.customer_name ilike v_like
            or (v_digits is not null and (o.customer_phone like '%' || v_digits || '%'
                                          or coalesce(o.customer_phone2, '') like '%' || v_digits || '%'))))
  select jsonb_build_object(
    'count', (select count(*) from f),
    'sum', coalesce((select sum(total) from f where status <> 'cancelled'), 0),
    'cancelled', (select count(*) from f where status = 'cancelled'),
    'ids', coalesce((select jsonb_agg(id order by created_at desc)
                       from (select id, created_at from f order by created_at desc
                              limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)) pg), '[]'::jsonb))
    into v_r;
  return v_r;
end;
$$;
