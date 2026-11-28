-- نجم أبو الفضل — مراجعة الأيام الفاضية: مدير الفرع (والتشغيل) يقرر يوم فاضي خارج جدول الراحات: راحة / إجازة / غياب
-- القرار بيتثبّت (att_src = manual) ومدير التشغيل بيشوف مين قرر وإمتى
create table if not exists public.najm_day_reviews (
  code text not null,
  day date not null,
  kind text not null check (kind in ('off', 'leave', 'abs')),
  reason text,
  by_user text not null,
  at timestamptz not null default now(),
  primary key (code, day)
);
alter table public.najm_day_reviews enable row level security;
