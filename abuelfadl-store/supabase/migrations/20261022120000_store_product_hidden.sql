-- Products hidden from the store (kept in the dashboard), e.g. duplicates of another product.
alter table store.products add column hidden boolean not null default false;

-- The view lists its columns explicitly: `p.*` was expanded when it was created, so the new column is added at the end.
create or replace view store.catalog as
  select p.id, p.sku, p.category_id, p.name, p.price, p.weighed, p.weight_step, p.min_weight, p.max_weight,
         p.in_stock, p.bestseller, p.offer, p.sale_price, p.offer_start, p.offer_end, p.description, p.image_url,
         p.position, p.created_at, p.updated_at,
         case when p.sku is null then p.price else nullif(m.price, 0) end as current_price,
         m.name       as master_name,
         m.updated_at as price_updated_at,
         (p.sku is not null and m.sku is null) as missing_from_sheet,
         p.hidden
  from store.products p
  left join store.master_prices m on m.sku = p.sku;

-- Duplicates of products already linked to the sheet (owner's decision): «تونه» = «تونة بالمايونيز» (sk-8594),
-- «مختوم فلسطيني» = «برطمان مختوم فلسطيني 425جم» (sk-9170).
update store.products set hidden = true where id in (51425, 51694) and sku is null;
