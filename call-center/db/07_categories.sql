-- =====================================================================
--  Abu El Fadl Call Center — product categories like Foodics (FOR REVIEW)
--
--  CONFIRMED: the order screen shows category cards (like Foodics). Names
--  come from the Foodics categories export (التصنيفات.csv: name, reference);
--  each product's category comes from the products export
--  (المنتجات.csv: category_reference).
--
--  ADDITIVE / CALL-CENTER ONLY: two new tables and one new function.
--  Filled by the call-center edge function cc-sale-unit (reads the two Drive
--  files, read only). Nothing is dropped or deleted; products_master and the
--  dc_* tables are not changed. Safe to re-run.
-- =====================================================================

create table if not exists public.cc_categories (
  reference  text primary key,               -- Foodics "الرقم المرجعي", lower case (c01 …)
  name       text not null,
  sort_order integer not null default 0,     -- row order in the Foodics export
  active     boolean not null default true,  -- false when it disappears from the export
  updated_at timestamptz not null default now()
);

create table if not exists public.cc_product_categories (
  sku        text primary key,
  reference  text,                           -- null = no category in the sheet
  updated_at timestamptz not null default now()
);

-- Only the edge function (service role) writes these; the app reads them through cc_list_categories().
alter table public.cc_categories         enable row level security;
alter table public.cc_product_categories enable row level security;
revoke all on public.cc_categories, public.cc_product_categories from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Categories with the codes (sku) of their products, in one call.
-- Categories with no products are left out.
-- ---------------------------------------------------------------------
create or replace function public.cc_list_categories()
returns table (reference text, name text, sort_order integer, skus text[])
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return query
    select c.reference, c.name, c.sort_order, array_agg(pc.sku order by pc.sku)
      from public.cc_categories c
      join public.cc_product_categories pc on pc.reference = c.reference
     where c.active
     group by c.reference, c.name, c.sort_order
     order by c.sort_order, c.name;
end;
$$;
revoke all on function public.cc_list_categories() from public, anon;
grant execute on function public.cc_list_categories() to authenticated;
