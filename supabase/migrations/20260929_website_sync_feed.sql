-- Applied to project ojvbydnvywbsgyhqftap on 2026-09-29.
-- Feed of Semlehy-branch prices + availability for the online store (Laravel site)
create or replace view public.website_feed
with (security_invoker = on) as
select p.sku,
       p.name,
       p.price,
       coalesce(b.system_qty, 0)            as qty,
       coalesce(b.system_qty, 0) > 0        as available,
       greatest(p.updated_at, b.system_qty_updated_at) as updated_at
from public.products_master p
join public.branch_stock b
  on b.sku = p.sku and b.branch = 'السمليهي' and b.kind = 'product'
where p.price > 0;

revoke all on public.website_feed from anon, authenticated;

create table if not exists public.website_sync_log (
  id          bigserial primary key,
  run_at      timestamptz not null default now(),
  trigger     text,
  sent        int,
  updated     int,
  unchanged   int,
  not_found   int,
  not_found_skus jsonb,
  ok          boolean,
  error       text
);
alter table public.website_sync_log enable row level security;
create policy website_sync_log_read on public.website_sync_log for select to anon, authenticated using (true);

-- Hourly schedule — run ONLY after the Laravel endpoint is live and the secrets are set.
-- Requires the pg_net extension. Replace <SERVICE_ROLE_KEY> via Vault, never commit it.
--
-- create extension if not exists pg_net;
-- select cron.schedule('website-sync-hourly', '7 * * * *', $$
--   select net.http_post(
--     url := 'https://ojvbydnvywbsgyhqftap.supabase.co/functions/v1/website-sync?trigger=cron',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
--       'Content-Type', 'application/json'),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 60000);
-- $$);
