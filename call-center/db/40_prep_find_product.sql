-- =====================================================================
--  40 — «تبديل» on the prep screen: find the product by the last digits of its
--       barcode.
--
--  CONFIRMED: the branch types the barcode's last 3 to 5 digits (or more); the
--  products whose barcode ends with them come back (one → picked at once). Only the
--  products the call center can sell (same rules as cc_list_products). The prep
--  account still cannot read the whole products list — only these matches.
--
--  CALL-CENTER ONLY: one new read-only function. Nothing else is changed. Safe to re-run.
-- =====================================================================

create or replace function public.cc_prep_find_product(p_digits text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_d text := regexp_replace(coalesce(p_digits, ''), '\D', '', 'g');
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin', 'call_center') then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  if length(v_d) < 3 or length(v_d) > 14 then
    return '[]'::jsonb;
  end if;
  if to_regclass('public.dc_products') is null then
    -- test projects without the products-sheet table
    return coalesce((
      select jsonb_agg(jsonb_build_object('sku', p.sku, 'name', p.name, 'barcode', btrim(p.barcode), 'price', p.price::numeric(12,2),
                                          'sold_by', coalesce(public.cc_sold_by(p.sku), 'unit')) order by p.name)
        from public.products_master p
       where p.sku is not null and coalesce(p.price, 0) > 0 and btrim(p.barcode) like '%' || v_d
         and not exists (select 1 from public.products_master d where d.sku = p.sku and d.ctid <> p.ctid)), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.name)
      from (select p.name, jsonb_build_object('sku', p.sku, 'name', p.name, 'barcode', btrim(p.barcode), 'price', p.price::numeric(12,2),
                                               'sold_by', coalesce(public.cc_sold_by(p.sku), 'unit')) as j
              from public.products_master p
             where p.sku is not null and coalesce(p.price, 0) > 0 and btrim(p.barcode) like '%' || v_d
               and not exists (select 1 from public.products_master d where d.sku = p.sku and d.ctid <> p.ctid)
               -- in the current products sheet, and not marked inactive there
               and exists (select 1 from public.dc_products s where s.sku = p.sku and s.is_active is not false)
             limit 30) x), '[]'::jsonb);
end;
$$;
revoke all on function public.cc_prep_find_product(text) from public, anon;
grant execute on function public.cc_prep_find_product(text) to authenticated;
