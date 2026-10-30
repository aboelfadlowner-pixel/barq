-- Cover picture at the top of a category page, uploaded from the dashboard (replaces the built-in animated cover).
alter table store.categories add column cover_url text;
