-- =====================================================================
--  Abu El Fadl Call Center — delivery photos storage (FOR REVIEW)
--
--  A PRIVATE storage bucket for the drivers' «سلّمت» photos:
--   • a driver uploads only into his own folder (<his user id>/...)
--   • only the admin can see the photos (the driver can see his own)
--   • photos older than 30 days are removed by the cc-photo-cleanup function
--     (call-center/supabase/functions/cc-photo-cleanup), once a day
--  CALL-CENTER ONLY: one new bucket and three policies on that bucket only.
--  Nothing else in storage is touched. Safe to re-run.
--  (Not part of apply_cc.sql: the local test database has no storage schema.)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cc-delivery-photos', 'cc-delivery-photos', false, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

drop policy if exists cc_delivery_photos_driver_insert on storage.objects;
create policy cc_delivery_photos_driver_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cc-delivery-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.cc_my_role()) in ('driver', 'admin'));

drop policy if exists cc_delivery_photos_own_read on storage.objects;
create policy cc_delivery_photos_own_read on storage.objects for select to authenticated
  using (bucket_id = 'cc-delivery-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists cc_delivery_photos_admin_read on storage.objects;
create policy cc_delivery_photos_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'cc-delivery-photos' and (select public.cc_is_admin()));
