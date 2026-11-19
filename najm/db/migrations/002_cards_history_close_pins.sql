-- نجم أبو الفضل — المرحلة الأولى: حالة الكروت والاعتراضات، السجل (History)، إغلاق اليوم، الرقم السري للموظف

-- ---------------------------------------------------------------- الكروت: مفيش كارت بيتمسح، كل كارت ليه حالة
-- pending = أحمر مستني التشغيل · approved = محسوب · rejected = التشغيل رفضه · cancelled = اتلغى · overturned = اتلغى بعد اعتراض
alter table public.najm_cards add column if not exists status text;
update public.najm_cards set status = case when approved then 'approved' else 'pending' end where status is null;
alter table public.najm_cards alter column status set default 'approved';
alter table public.najm_cards alter column status set not null;
alter table public.najm_cards drop constraint if exists najm_cards_status_check;
alter table public.najm_cards add constraint najm_cards_status_check check (status in ('pending','approved','rejected','cancelled','overturned'));
alter table public.najm_cards add column if not exists decided_by text;
alter table public.najm_cards add column if not exists decided_at timestamptz;
create index if not exists najm_cards_code_idx on public.najm_cards (code);

-- ---------------------------------------------------------------- اعتراض الموظف على كارت
create table if not exists public.najm_card_appeals (
  id text primary key default md5(random()::text || clock_timestamp()::text),
  card_id text not null references public.najm_cards(id),
  code text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  decided_by text, decided_at timestamptz, decision_note text,
  created_at timestamptz not null default now()
);
create unique index if not exists najm_card_appeals_one_open on public.najm_card_appeals (card_id) where status = 'pending';
create index if not exists najm_card_appeals_code_idx on public.najm_card_appeals (code);

-- ---------------------------------------------------------------- السجل: كل تقييم، كارت، اعتراض، إغلاق يوم، ...
create table if not exists public.najm_history (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text not null,              -- username of the manager, or emp:<code> for an employee, or system
  kind text not null,
  code text, day date, gkey text,
  data jsonb
);
create index if not exists najm_history_code_idx on public.najm_history (code, at);
create index if not exists najm_history_actor_idx on public.najm_history (actor, at);

-- ---------------------------------------------------------------- إغلاق اليوم لكل فرع وشيفت (Between مع الليل)
create table if not exists public.najm_day_closes (
  day date not null, gkey text not null,          -- gkey = <branch>|Morning or <branch>|Night
  deadline timestamptz not null,
  closed_by text, closed_at timestamptz,          -- null = لسه محدش قفله
  late_minutes int not null default 0,
  penalty numeric not null default 0,
  responsible text[],                             -- المديرين اللي اتخصم منهم
  primary key (day, gkey)
);

-- ---------------------------------------------------------------- الرقم السري للموظف (مع كود البصمة)
create table if not exists public.najm_emp_pins (
  code text primary key references public.najm_employees(code),
  salt text not null, pin_hash text not null,
  must_change boolean not null default true,       -- أول دخول برقم من مدير التشغيل ← لازم يغيّره
  updated_at timestamptz not null default now()
);
