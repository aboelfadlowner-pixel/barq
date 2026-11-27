-- نجم أبو الفضل — اعتراض الموظف على يوم غياب: بيوصل لمدير التشغيل، قبوله بيحوّل اليوم لإجازة (ومابيتغيّرش بالتحديث)، ورفضه بيسيبه غياب
create table if not exists public.najm_att_appeals (
  id bigserial primary key,
  code text not null,
  day date not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create unique index if not exists najm_att_appeals_open on public.najm_att_appeals (code, day) where status = 'pending';
alter table public.najm_att_appeals enable row level security;
