-- =====================================================================
--  Abu El Fadl Call Center — show only products Foodics shows (FOR REVIEW)
--
--  CONFIRMED: like Foodics, the call center lists only products that are
--    • in the current products sheet and active there (is_active not "No"), and
--    • priced above zero.
--  Inactive products, zero-price products and old rows that are no longer in the
--  products sheet are not shown (search, categories, repeat order).
--
--  CALL-CENTER ONLY: replaces the body of cc_list_products (same name, same
--  columns). The data-center table dc_products is only READ. No table is
--  changed, nothing is deleted. Safe to re-run.
-- =====================================================================

create or replace function public.cc_list_products(p_after_sku text default null, p_limit int default 1000)
returns table (sku text, name text, barcode text, price numeric, sold_by text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;

  if to_regclass('public.dc_products') is null then
    -- Test projects without the data-center tables: price rule only.
    return query
      select p.sku, p.name, p.barcode, p.price::numeric(12,2), coalesce(public.cc_sold_by(p.sku), 'unit')
        from public.products_master p
       where p.sku is not null and coalesce(p.price, 0) > 0
         and (p_after_sku is null or p.sku > p_after_sku)
         and not exists (select 1 from public.products_master d where d.sku = p.sku and d.ctid <> p.ctid)
       order by p.sku
       limit least(greatest(coalesce(p_limit, 1000), 1), 1000);
    return;
  end if;

  return query
    select p.sku, p.name, p.barcode, p.price::numeric(12,2), coalesce(public.cc_sold_by(p.sku), 'unit')
      from public.products_master p
     where p.sku is not null and coalesce(p.price, 0) > 0
       and (p_after_sku is null or p.sku > p_after_sku)
       and not exists (select 1 from public.products_master d where d.sku = p.sku and d.ctid <> p.ctid)
       -- in the current products sheet, and not marked inactive there
       and exists (select 1 from public.dc_products s where s.sku = p.sku and s.is_active is not false)
     order by p.sku
     limit least(greatest(coalesce(p_limit, 1000), 1), 1000);
end;
$$;

revoke all on function public.cc_list_products(text, int) from public, anon;
grant execute on function public.cc_list_products(text, int) to authenticated;
