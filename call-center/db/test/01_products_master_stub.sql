-- TEST PROJECT / LOCAL SANDBOX ONLY — NEVER RUN ON THE REAL DATABASE.
-- Same columns as the real products_master, with fictional rows.
create table if not exists public.products_master (
  sku text primary key, name text, barcode text,
  cost numeric default 0, price numeric default 0, margin numeric default 22,
  updated_at timestamptz default now(), system_qty numeric default 0,
  system_qty_updated_at timestamptz, expiry_tracked boolean default false, category text
);
insert into public.products_master (sku, name, barcode, cost, price) values
  ('T-101', 'جبنة رومي قديمة (تجريبي)', '6220000000101', 300, 420),
  ('T-104', 'جبنة إسطنبولي (تجريبي)',   '6220000000104', 110, 160),
  ('T-201', 'لبن كامل الدسم (تجريبي)',  '6220000000201',  30,  42),
  ('T-203', 'زبادي طبيعي (تجريبي)',     '6220000000203',   6,   9),
  ('T-900', 'صنف بدون سعر (تجريبي)',    null,              0,   0)
on conflict (sku) do nothing;
