-- Several website products may share one SKU (e.g. three manakish sold under one sheet item «مناقيش»); they all take
-- that sheet row's price. The unique constraint becomes a plain index (the catalog view joins on sku).
alter table store.products drop constraint products_sku_key;
create index products_sku on store.products (sku);
