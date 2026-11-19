-- نجم أبو الفضل — مكان الصور والفيديوهات: قراءة عامة، والرفع بتوكن من مدير

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('najm-media', 'najm-media', true, 31457280,
        array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

drop policy if exists najm_media_read on storage.objects;

create policy najm_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'najm-media');

drop policy if exists najm_media_upload on storage.objects;

create policy najm_media_upload on storage.objects for insert to anon, authenticated with check (bucket_id = 'najm-media' and public.najm_upload_ok(name));
