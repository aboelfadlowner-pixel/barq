-- نجم أبو الفضل — قفل الجداول (RLS): القراءة العامة للبيانات غير الحساسة بس، والكتابة من خلال الدوال

do $$
declare t text;
begin
  foreach t in array array['najm_employees','najm_users','najm_ratings','najm_winners','najm_targets','najm_sales',
    'najm_base_sales','najm_kpi_vals','najm_complaints','najm_notes','najm_settings','najm_private',
    'najm_cards','najm_captains']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists najm_read on public.%I', t);
  end loop;
  -- public read (no ratings, users, complaints, notes, private)
  foreach t in array array['najm_employees','najm_winners','najm_targets','najm_sales',
    'najm_base_sales','najm_kpi_vals','najm_settings','najm_captains']
  loop
    execute format('create policy najm_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

alter table public.najm_upload_tokens enable row level security;

alter table public.najm_mgr_ratings enable row level security;

alter table public.najm_mgr_ledger enable row level security;

alter table public.najm_market enable row level security;

alter table public.najm_offers enable row level security;

drop policy if exists najm_read on public.najm_mgr_ledger;

create policy najm_read on public.najm_mgr_ledger for select to anon, authenticated using (true);

drop policy if exists najm_read on public.najm_offers;

create policy najm_read on public.najm_offers for select to anon, authenticated using (true);

alter table public.najm_login_fails enable row level security;

alter table public.najm_payouts enable row level security;

alter table public.najm_votes enable row level security;
