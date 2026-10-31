-- =====================================================================
--  Abu El Fadl Call Center — «سجل الطلبات» page by page + «نسخة احتياطية» (FOR REVIEW)
--
--  CONFIRMED:
--   • The orders log shows 50 orders a page («التالي» / «السابق»); the search and the filters
--     run on the server, so any old order can be found; the totals cover the whole filter.
--   • The admin downloads a backup (Excel) of all the call-center data with one button.
--  CALL-CENTER ONLY, READ ONLY: two new functions. No table changes, nothing removed.
--  Safe to re-run.
-- =====================================================================

-- One page of the orders log: { count, sum (not cancelled), cancelled, ids (newest first) }.
-- p_q: order number, customer name or phone (digits). p_agents: employee names (empty = everyone).
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
  if v_digits is not null and length(v_digits) < 3 then v_digits := null; end if;
  with f as (
    select o.id, o.created_at, o.status, o.total
      from public.cc_orders o
     where (p_from is null or o.created_at >= p_from)
       and (p_to is null or o.created_at < p_to)
       and (nullif(p_status, '') is null or o.status = p_status)
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

-- Admin: everything of the call center, one list of rows per table (for the backup file).
-- Login secrets (link hashes) are never included.
create or replace function public.cc_backup_export()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin() then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'made_at', now(),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.cc_orders o), '[]'::jsonb),
    'order_items', coalesce((select jsonb_agg(to_jsonb(i)) from public.cc_order_items i), '[]'::jsonb),
    'order_events', coalesce((select jsonb_agg(to_jsonb(e)) from public.cc_order_events e), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.cc_customers c), '[]'::jsonb),
    'addresses', coalesce((select jsonb_agg(to_jsonb(a)) from public.cc_addresses a), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(to_jsonb(a)) from public.cc_delivery_areas a), '[]'::jsonb),
    'agents', coalesce((select jsonb_agg(to_jsonb(a)) from public.cc_agents a), '[]'::jsonb),
    'staff', coalesce((select jsonb_agg(to_jsonb(s) - 'login_token_hash') from public.cc_staff s), '[]'::jsonb),
    'blocked_phones', coalesce((select jsonb_agg(to_jsonb(b)) from public.cc_blocked_phones b), '[]'::jsonb),
    'deliveries', coalesce((select jsonb_agg(to_jsonb(d)) from public.cc_order_delivery d), '[]'::jsonb));
end;
$$;

revoke all on function public.cc_order_log(timestamptz, timestamptz, text, text[], text, integer, integer) from public, anon;
revoke all on function public.cc_backup_export() from public, anon;
grant execute on function public.cc_order_log(timestamptz, timestamptz, text, text[], text, integer, integer) to authenticated;
grant execute on function public.cc_backup_export() to authenticated;
