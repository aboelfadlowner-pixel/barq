-- نجم أبو الفضل — الكاميرات + وسام برق
-- · دور جديد «مراقب الكاميرات»: كل يوم لكل موظف حاضر الصلاة (pray 1/0) والبريك (brk 1/0) = نص نجمة (¼ + ¼)
-- · مدير التشغيل مبقاش بيقيّم الموظفين (نصه راح للكاميرات) — بيقيّم المديرين بس، وبيدي «وسام برق» (+100 نقطة، مرة في الشهر)
-- · صلاة المدير (كل 4 أيام): البند الخامس في تقييم مدير الشيفت / الفرع — 2 ملتزم · 1 بيقطع · 0 مبيصليش (½ · ¼ · 0)
-- · التعارض بين الكاميرات والمدير في الصلاة بيروح لمدير التشغيل يعتمد (najm_pray_reviews)
-- · خصم من تارجت موظف الكاميرات: تلاعب (50%) يدوي، وموظف حاضر ماتقيّمش (تلقائي من الإعدادات)
alter table public.najm_users drop constraint if exists najm_users_role_check;
alter table public.najm_users add constraint najm_users_role_check check (role in ('ops','branch','shift','fresh','hygiene','cameras'));

alter table public.najm_ratings add column if not exists brk smallint;
do $$ begin
  alter table public.najm_ratings add constraint najm_ratings_brk_chk check (brk in (0, 1));
exception when duplicate_object then null; end $$;

create table if not exists public.najm_medals (
  code text not null,
  month text not null,
  day date not null,
  note text,
  by_user text not null,
  created_at timestamptz not null default now(),
  primary key (code, month)
);
alter table public.najm_medals enable row level security;

create table if not exists public.najm_tgt_penalties (
  id text primary key,
  code text not null,
  month text not null,
  pct numeric not null check (pct > 0 and pct <= 100),
  reason text not null,
  by_user text not null,
  created_at timestamptz not null default now()
);
alter table public.najm_tgt_penalties enable row level security;

create table if not exists public.najm_pray_reviews (
  code text not null,
  cycle date not null,
  decision text not null check (decision in ('cams', 'mgr')),
  level smallint check (level between 0 and 2),
  by_user text not null,
  created_at timestamptz not null default now(),
  primary key (code, cycle)
);
alter table public.najm_pray_reviews enable row level security;
