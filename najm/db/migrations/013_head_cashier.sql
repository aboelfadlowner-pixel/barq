-- نجم أبو الفضل — هيد الكاشير: بيسجّل أحداث الكاشيرات (باندات بنقط +/−) وبتتجمع على نقط التارجت بتاعتهم
-- نقط الكاشير للشهر (2600 مثلاً) بتتحدد من التارجت (نقط القسم)، ولو حقق 85% أو أكتر الباندات بتزيد وتنقص منها
alter table public.najm_users drop constraint if exists najm_users_role_check;
alter table public.najm_users add constraint najm_users_role_check check (role in ('ops','branch','shift','fresh','hygiene','cameras','headcashier'));

create table if not exists public.najm_cashier_events (
  id text primary key,
  day date not null,
  code text not null,
  band text not null,
  pts numeric not null,
  note text,
  by_user text not null,
  created_at timestamptz not null default now()
);
create index if not exists najm_cashier_events_idx on public.najm_cashier_events (code, day);
alter table public.najm_cashier_events enable row level security;
