-- =====================================================================
--  TEST PROJECT / LOCAL SANDBOX ONLY — NEVER RUN ON THE REAL DATABASE.
--  Creates a products_master copy with fictional rows in an EMPTY project.
--
--  Safety: the guard below stops before any change if products_master
--  already exists or if any real Abu El Fadl table is present. Everything
--  runs in one transaction, so a stopped run changes nothing.
--  The table is tagged CC_TEST_STUB; the seed and test files refuse to run
--  unless that tag is present.
-- =====================================================================
begin;

do $$
begin
  if to_regclass('public.products_master') is not null then
    raise exception 'STOP: products_master موجود بالفعل — الملف ده للمشروع التجريبي الفاضي بس. مفيش أي تغيير اتعمل.';
  end if;
  if to_regclass('public.branch_orders') is not null or to_regclass('public.dc_products') is not null
     or to_regclass('public.pricing_requests_v3') is not null then
    raise exception 'STOP: فيه جداول من قاعدة البيانات الحقيقية — ده مش المشروع التجريبي. مفيش أي تغيير اتعمل.';
  end if;
end $$;

create table public.products_master (
  sku text primary key, name text, barcode text,
  cost numeric default 0, price numeric default 0, margin numeric default 22,
  updated_at timestamptz default now(), system_qty numeric default 0,
  system_qty_updated_at timestamptz, expiry_tracked boolean default false, category text
);
comment on table public.products_master is 'CC_TEST_STUB — fictional products for the call-center test project';

-- Same default as Supabase gives a new table, but RLS on and no policy: only
-- postgres and the cc_* security-definer functions can read it.
alter table public.products_master enable row level security;

insert into public.products_master (sku, name, barcode, cost, price) values
  ('T-101', 'جبنة رومي قديمة (تجريبي)', '6220000000101', 300, 420),
  ('T-104', 'جبنة إسطنبولي (تجريبي)',   '6220000000104', 110, 160),
  ('T-201', 'لبن كامل الدسم (تجريبي)',  '6220000000201',  30,  42),
  ('T-203', 'زبادي طبيعي (تجريبي)',     '6220000000203',   6,   9),
  ('T-900', 'صنف بدون سعر (تجريبي)',    null,              0,   0);

commit;
