-- نجم أبو الفضل — سجل الملفات المرفوعة (المبيعات والبصمة): اسم الملف ورافعه وتاريخه والسجلات المقبولة والمرفوضة
-- ونفس الملف (نفس البصمة الرقمية) مبيترفعش مرتين — مدير التشغيل بس يقدر يرفعه تاني بقصد
create table if not exists public.najm_imports (
  id bigserial primary key,
  kind text not null check (kind in ('sales', 'base_sales', 'attendance')),
  file_name text, file_hash text not null,
  by_user text not null, at timestamptz not null default now(),
  branch text, day date, month text,
  rows_ok int not null default 0, rows_bad int not null default 0, rows_dup int not null default 0,
  note text
);
create unique index if not exists najm_imports_hash_uq on public.najm_imports (kind, file_hash);
alter table public.najm_imports enable row level security;
