-- =====================================================================
--  Abu El Fadl Call Center — customers page, like the Foodics customer page (FOR REVIEW)
--
--  CONFIRMED: a «العملاء» page (admin and call center) with a list of customers
--  (search, sort by most orders / most spent / latest order) and a customer page:
--  orders, total paid, average order, last order, favourite products and
--  add-ons, usual area, cancelled orders, and the Foodics order count / last
--  order from the Foodics customers export.
--
--  CALL-CENTER ONLY. Additive: two columns on cc_customers (from the Foodics
--  export, filled separately) and two read-only functions. Nothing is dropped
--  or deleted. Safe to re-run.
-- =====================================================================

alter table public.cc_customers add column if not exists foodics_total_orders integer;
alter table public.cc_customers add column if not exists foodics_last_order_at timestamptz;

-- ---------------------------------------------------------------------
-- Customers with their call-center totals (list page).
--   p_q    : name or phone (part of it); empty = everyone
--   p_sort : 'orders' | 'total' | 'last' (default) | 'name'
-- ---------------------------------------------------------------------
create or replace function public.cc_list_customers(p_q text default null, p_sort text default 'last',
                                                    p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, phone text, phone2 text, orders bigint, total numeric,
               last_order_at timestamptz, foodics_total_orders integer, foodics_last_order_at timestamptz, full_count bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_digits text := nullif(regexp_replace(coalesce(p_q, ''), '\D', '', 'g'), '');
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return query
    with s as (
      select o.customer_id, count(*) as n, sum(o.total) as t, max(o.created_at) as last_at
        from public.cc_orders o where o.status <> 'cancelled' group by o.customer_id
    )
    select c.id, c.name, c.phone, c.phone2, coalesce(s.n, 0), coalesce(s.t, 0)::numeric,
           s.last_at, c.foodics_total_orders, c.foodics_last_order_at, count(*) over ()
      from public.cc_customers c
      left join s on s.customer_id = c.id
     where v_q is null
        or c.name ilike '%' || v_q || '%'
        or (v_digits is not null and char_length(v_digits) >= 3
            and (c.phone like '%' || v_digits || '%' or coalesce(c.phone2, '') like '%' || v_digits || '%'))
     order by
       case when p_sort = 'orders' then coalesce(s.n, 0) end desc nulls last,
       case when p_sort = 'total'  then coalesce(s.t, 0) end desc nulls last,
       case when p_sort = 'name'   then c.name end asc,
       greatest(s.last_at, c.foodics_last_order_at) desc nulls last,
       c.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------
-- One customer's numbers (customer page and the hint on the order screen).
-- ---------------------------------------------------------------------
create or replace function public.cc_customer_stats(p_customer_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_c public.cc_customers;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  select * into v_c from public.cc_customers where id = p_customer_id;
  if not found then
    raise exception 'العميل غير موجود' using errcode = 'P0002';
  end if;
  return (
    with o as (select * from public.cc_orders where customer_id = p_customer_id),
    ok as (select * from o where status <> 'cancelled'),
    items as (select i.* from public.cc_order_items i join ok on ok.id = i.order_id)
    select jsonb_build_object(
      'orders',          (select count(*) from ok),
      'cancelled',       (select count(*) from o where status = 'cancelled'),
      'total',           (select coalesce(sum(total), 0) from ok),
      'average',         (select coalesce(round(avg(total), 2), 0) from ok),
      'first_order_at',  (select min(created_at) from ok),
      'last_order_at',   (select max(created_at) from ok),
      'foodics_total_orders',  v_c.foodics_total_orders,
      'foodics_last_order_at', v_c.foodics_last_order_at,
      -- favourite products: in how many orders, then how many pieces / grams
      'top_products', coalesce((select jsonb_agg(x order by x->>'orders' desc) from (
          select jsonb_build_object('sku', i.sku, 'name', min(i.product_name), 'orders', count(distinct i.order_id),
                                    'qty', sum(i.qty), 'grams', sum(i.weight_grams)) as x
            from items i group by i.sku
           order by count(distinct i.order_id) desc, sum(coalesce(i.qty, 1)) desc limit 3) t), '[]'::jsonb),
      'top_modifiers', coalesce((select jsonb_agg(x) from (
          select jsonb_build_object('name', m->>'name', 'times', count(*)) as x
            from items i, jsonb_array_elements(case when jsonb_typeof(i.modifiers) = 'array' then i.modifiers else '[]'::jsonb end) m
           group by m->>'name' order by count(*) desc limit 3) t), '[]'::jsonb),
      'top_area', (select jsonb_build_object('name', area_name, 'orders', count(*))
                     from ok group by area_name order by count(*) desc limit 1)
    )
  );
end;
$$;

revoke all on function public.cc_list_customers(text, text, integer, integer) from public, anon;
revoke all on function public.cc_customer_stats(uuid)                         from public, anon;
grant execute on function public.cc_list_customers(text, text, integer, integer) to authenticated;
grant execute on function public.cc_customer_stats(uuid)                         to authenticated;
