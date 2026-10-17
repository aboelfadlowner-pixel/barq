-- =====================================================================
--  Abu El Fadl Call Center — "sold by weight" from the products sheet (FOR REVIEW)
--
--  CONFIRMED: the call center takes "by weight or by unit" from the products
--  sheet column is_sold_by_weight (same setting as Foodics). Products not in
--  that list fall back to the storage unit (dc_stock_levels: كيلو = weight).
--
--  ADDITIVE / CALL-CENTER ONLY:
--    • new table cc_product_sale_unit (sku → sold_by_weight), filled by the
--      call-center edge function cc-sale-unit from the same public products
--      file the data-center sync reads (read only);
--    • new table cc_sync_status (last run of that sync, for throttling and
--      for showing when it last worked);
--    • cc_sold_by (a call-center function) now checks the new table first.
--  Nothing is dropped or deleted. dc-sync, products_master, dc_products and
--  dc_stock_levels are not changed. Safe to re-run.
-- =====================================================================

create table if not exists public.cc_product_sale_unit (
  sku            text primary key,
  sold_by_weight boolean not null,
  updated_at     timestamptz not null default now()
);

create table if not exists public.cc_sync_status (
  name        text primary key,          -- 'sale_unit'
  started_at  timestamptz,
  finished_at timestamptz,
  ok          boolean,
  rows_total  integer,
  rows_changed integer,
  message     text
);

-- Only the edge function (service role) writes these; the app never reads them directly.
alter table public.cc_product_sale_unit enable row level security;
alter table public.cc_sync_status       enable row level security;
revoke all on public.cc_product_sale_unit, public.cc_sync_status from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- How a product is sold: the products sheet first (is_sold_by_weight),
-- then the storage unit (كيلو = weight), otherwise by unit.
-- Same signature as before, so cc_list_products / cc_create_order use it as is.
-- ---------------------------------------------------------------------
create or replace function public.cc_sold_by(p_sku text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select case when u.sold_by_weight then 'weight' else 'unit' end
       from public.cc_product_sale_unit u where u.sku = p_sku),
    (select case when bool_and(btrim(s.unit) = 'كيلو') then 'weight' else 'unit' end
       from public.dc_stock_levels s where s.sku = p_sku having count(*) > 0),
    'unit')
$$;
revoke all on function public.cc_sold_by(text) from public, anon, authenticated;

-- When the products sheet sync last worked (shown to the call center if it gets old).
create or replace function public.cc_sale_unit_status()
returns table (finished_at timestamptz, ok boolean, rows_total integer, message text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return query
    select s.finished_at, s.ok, s.rows_total, s.message
      from public.cc_sync_status s where s.name = 'sale_unit';
end;
$$;
revoke all on function public.cc_sale_unit_status() from public, anon;
grant execute on function public.cc_sale_unit_status() to authenticated;
