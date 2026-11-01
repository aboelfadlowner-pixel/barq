-- =====================================================================
--  Abu El Fadl Call Center — automatic daily backup (FOR REVIEW)
--
--  CONFIRMED: every night the cc-daily function saves a copy of all the call-center data
--  (the same as «تنزيل نسخة احتياطية») in a PRIVATE storage folder, keeping the last 30 days;
--  the admin sees the list on the settings page and downloads any day as Excel.
--  CALL-CENTER ONLY: one private bucket (cc-backups) the admin can read; cc_backup_export may
--  also be called by the server itself (the nightly job). Nothing removed. Safe to re-run.
-- =====================================================================

-- Admin, or the server itself (the nightly job; no signed-in user): all the call-center data.
create or replace function public.cc_backup_export()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_admin()
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'service_role') <> 'service_role' then
    raise exception 'للأدمن بس' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'made_at', now(),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.cc_orders o), '[]'::jsonb),
    'order_items', coalesce((select jsonb_agg(to_jsonb(i)) from public.cc_order_items i), '[]'::jsonb),
    'order_events', coalesce((select jsonb_agg(to_jsonb(e)) from public.cc_order_events e), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.cc_customers c), '[]'::jsonb),
    'addresses', coalesce((select jsonb_agg(to_jsonb(a)) from public.cc_addresses a), '[]'::jsonb),
    'areas', coalesce((select jsonb_agg(to_jsonb(a)) from public.cc_delivery_areas a), '[]'::jsonb),
    'agents', coalesce((select jsonb_agg(to_jsonb(a)) from public.cc_agents a), '[]'::jsonb),
    'staff', coalesce((select jsonb_agg(to_jsonb(s) - 'login_token_hash') from public.cc_staff s), '[]'::jsonb),
    'blocked_phones', coalesce((select jsonb_agg(to_jsonb(b)) from public.cc_blocked_phones b), '[]'::jsonb),
    'deliveries', coalesce((select jsonb_agg(to_jsonb(d)) from public.cc_order_delivery d), '[]'::jsonb));
end;
$$;
revoke all on function public.cc_backup_export() from public, anon;
grant execute on function public.cc_backup_export() to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.cc_backup_export() to service_role';
  end if;
end $$;

-- The private folder for the nightly copies: only the admin can read them (the job writes with the server key).
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('cc-backups', 'cc-backups', false, 52428800, array['application/json'])
    on conflict (id) do nothing;
    if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'cc_backups_admin_read') then
      execute $p$create policy cc_backups_admin_read on storage.objects for select to authenticated
        using (bucket_id = 'cc-backups' and (select public.cc_is_admin()))$p$;
    end if;
  end if;
end $$;
