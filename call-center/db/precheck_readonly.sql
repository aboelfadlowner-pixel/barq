-- =====================================================================
--  READ-ONLY prechecks before applying apply_cc.sql (no writes, no DDL).
--  Run only with approval. Every query is a SELECT.
-- =====================================================================

-- 1) Is sku unique and never null in products_master? (M4) — expect 0 and 0.
select count(*) as duplicated_skus
  from (select sku from public.products_master where sku is not null group by sku having count(*) > 1) d;
select count(*) as null_skus from public.products_master where sku is null;

-- 2) Is there a unique/primary-key index on products_master(sku)? — expect true.
select exists (
  select 1 from pg_index i
  join pg_class t on t.oid = i.indrelid and t.relname = 'products_master'
  join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey)
  where i.indisunique and i.indnkeyatts = 1 and a.attname = 'sku'
) as sku_has_unique_index;

-- 3) Nothing named cc_* exists yet (first install) — expect no rows.
select n.nspname, c.relname, c.relkind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname like 'cc\_%';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'cc\_%';

-- 4) Required columns exist — expect 4.
select count(*) as required_columns
  from information_schema.columns
 where table_schema = 'public' and table_name = 'products_master'
   and column_name in ('sku', 'name', 'barcode', 'price');

-- 5) Storage Unit source for "sold by weight" — expect 2 columns, 0 duplicated skus,
--    and the unit counts (كيلو → weight, everything else → unit).
select count(*) as dc_stock_levels_columns from information_schema.columns
 where table_schema = 'public' and table_name = 'dc_stock_levels' and column_name in ('sku', 'unit');
select count(*) as dc_duplicated_skus
  from (select sku from public.dc_stock_levels group by sku having count(*) > 1) d;
select case when btrim(s.unit) = 'كيلو' then 'weight' else 'unit' end as sold_by, count(*) as products
  from public.products_master p left join public.dc_stock_levels s on s.sku = p.sku
 group by 1;

-- 6) Do existing tools sign people up through Supabase Auth? (before turning off sign-ups)
select count(*) as auth_users, max(created_at) as last_signup from auth.users;
