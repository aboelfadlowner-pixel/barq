-- نجم أبو الفضل — الجداول والأعمدة والفهارس (بالترتيب اللي اتعملت بيه — متتعدّلش بعد ما تتنفذ، أي تغيير جديد = ملف جديد برقم أكبر)

-- نجم أبو الفضل (najm.html): KPI targets, man of the day, employee of the month, employee files.
--
-- Access model
--   * Employees open the app with no login. They read: employees (name/photo/video), daily STAR TOTALS
--     (najm_public_scores), winners, targets, sales, KPI values, settings.
--   * Managers log in with username + PIN (najm_users). Raw rating criteria, complaints and notes are
--     returned only to a valid manager login (najm_full_scores / najm_files).
--   * Every write goes through najm_save(user, pin, kind, key, data), which checks the role and the
--     manager's scope (branch / shift / departments). Tables have no write policies.
--   * Stars are computed in ONE place: najm_score() below. The app shows what the database computes.
-- ---------------------------------------------------------------- tables
create table if not exists public.najm_employees (
  code text primary key,
  name text not null,
  branch text, dept text, job text, shift text,
  active boolean not null default true,
  photo text,           -- public URL (storage bucket najm-media)
  video text,           -- public URL (storage bucket najm-media)
  updated_at timestamptz not null default now()
);

alter table public.najm_employees add column if not exists title text;

  -- manual title (لقب) set by operations
create table if not exists public.najm_users (
  username text primary key,
  name text not null,
  role text not null check (role in ('ops','branch','shift','fresh')),
  branch text,          -- null = all branches (ops / fresh across branches)
  shift text,           -- shift managers only
  depts text[],         -- fresh food manager: departments he rates
  active boolean not null default true,
  salt text not null,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.najm_ratings (
  day date not null, code text not null,
  att text, att_time text,
  br smallint[],        -- branch manager (5 criteria, 0..2)
  sh smallint[],        -- shift manager
  fr smallint[],        -- fresh food manager (fresh departments only)
  ops smallint[],       -- operations manager
  bonus numeric, bonus_note text,
  updated_at timestamptz not null default now(),
  primary key (day, code)
);

create table if not exists public.najm_winners (
  day date not null, gkey text not null, codes text[] not null,
  updated_at timestamptz not null default now(),
  primary key (day, gkey)
);

create table if not exists public.najm_targets (
  month text not null, dkey text not null, cfg jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (month, dkey)
);

create table if not exists public.najm_sales (
  day date not null, branch text not null, items jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (day, branch)
);

create table if not exists public.najm_base_sales (
  month text not null, branch text not null, items jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (month, branch)
);

create table if not exists public.najm_kpi_vals (
  day date not null, dkey text not null, vals jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (day, dkey)
);

create table if not exists public.najm_complaints (
  id text primary key, day date not null, code text not null, note text, by_user text,
  created_at timestamptz not null default now()
);

create table if not exists public.najm_notes (
  id text primary key, day date not null, code text not null, body text, by_user text,
  created_at timestamptz not null default now()
);

create table if not exists public.najm_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.najm_private (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

-- cards: yellow −5 / red −20 / green +5 on the monthly score (values in settings.cards).
-- yellow & green count immediately; red counts only after the operations manager approves it.
create table if not exists public.najm_cards (
  id text primary key, day date not null, code text not null,
  color text not null check (color in ('yellow','red','green')),
  reason text, by_user text,
  approved boolean not null default false, approved_by text,
  created_at timestamptz not null default now()
);

-- captain = personal extra target: each salesperson / chef gets one or more products (kilos sold by the branch
-- in the Foodics product-sales sheet), points × settings.captainMult
create table if not exists public.najm_captains (
  month text not null, code text not null, sku text not null,
  name text, target numeric not null default 0, active boolean not null default true, by_user text,
  updated_at timestamptz not null default now(),
  primary key (month, code, sku)
);

create index if not exists najm_cards_day_idx on public.najm_cards (day);

create index if not exists najm_ratings_day_idx on public.najm_ratings (day);

create index if not exists najm_kpi_vals_day_idx on public.najm_kpi_vals (day);

create index if not exists najm_complaints_code_idx on public.najm_complaints (code);

create index if not exists najm_notes_code_idx on public.najm_notes (code);

-- ---------------------------------------------------------------- storage for photos / videos
-- uploads: a manager asks for a one-time token (PIN-checked), then uploads to <token>/<file>
create table if not exists public.najm_upload_tokens (
  token text primary key, username text not null, expires_at timestamptz not null
);

-- =========================================================================================
-- Managers league + transfer market
--   * operations manager rates each manager daily (5 criteria, 0..2 → up to 10 points)
--   * team points (man of the day, cups, red cards) are computed in the app from the shared data;
--     at month close the operations manager records each manager's month points in the ledger
--   * the ledger is the manager's wallet; offers in the market can't exceed it
--   * the employee of the month (#1) gets a one-time secret code to list himself and pick an offer
-- =========================================================================================
create table if not exists public.najm_mgr_ratings (
  day date not null, username text not null, crit smallint[] not null,
  updated_at timestamptz not null default now(), primary key (day, username)
);

create table if not exists public.najm_mgr_ledger (
  id text primary key, username text not null, month text not null, points numeric not null, reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.najm_market (
  id text primary key, month text not null, code text not null,
  salt text not null, secret_hash text not null, fails int not null default 0,
  wish jsonb, status text not null default 'open' check (status in ('open','listed','decided','approved','closed')),
  chosen text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.najm_offers (
  id text primary key, market_id text not null references public.najm_market(id) on delete cascade,
  username text not null, points numeric not null check (points > 0), branch text, shift text, note text,
  updated_at timestamptz not null default now()
);

-- public: managers (no PINs), daily manager points (sum only), market without the secret
alter table public.najm_users add column if not exists emp_code text;

-- =========================================================================================
-- Security & operations hardening
-- =========================================================================================
-- 1) lockout: 5 wrong PINs in a row lock the username for 15 minutes
create table if not exists public.najm_login_fails (
  username text primary key, fails int not null default 0, locked_until timestamptz
);

-- 3) prize payouts: operations marks what was actually paid
create table if not exists public.najm_payouts (
  id text primary key, month text not null, code text not null, kind text not null, ref text, amount numeric not null,
  paid_at timestamptz not null default now(), by_user text
);

-- =========================================================================================
-- Employees vote for the best manager (25% of the manager-of-the-month score)
--   one vote per employee code per month AND one vote per device per month; IP kept for review
-- =========================================================================================
create table if not exists public.najm_votes (
  month text not null, voter_code text not null, device_id text not null, ip text,
  manager text not null, created_at timestamptz not null default now(),
  primary key (month, voter_code)
);

create unique index if not exists najm_votes_device on public.najm_votes (month, device_id);

-- ===== hygiene rating + employee progress report (every 10 days)
alter table public.najm_ratings add column if not exists hy smallint[];

   -- hygiene officer (5 criteria, 0..2)
alter table public.najm_users drop constraint if exists najm_users_role_check;

alter table public.najm_users add constraint najm_users_role_check check (role in ('ops','branch','shift','fresh','hygiene'));

-- ===== manual target points: operations sets points per department (in the target cfg) and per captain
alter table public.najm_captains add column if not exists pts numeric;
