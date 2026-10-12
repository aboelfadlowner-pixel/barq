-- TEST PROJECT / LOCAL SANDBOX ONLY — NEVER RUN ON THE REAL DATABASE.
-- Requires two Auth users: staff@cc.test (the shared call-center account) and
-- outsider@cc.test (signed in but NOT staff).
-- Guard: runs only where products_master carries the CC_TEST_STUB tag.
begin;
do $$ begin
  if coalesce(obj_description(to_regclass('public.products_master'), 'pg_class'), '') not like 'CC_TEST_STUB%' then raise exception 'STOP: ده مش المشروع التجريبي (مفيش علامة CC_TEST_STUB). مفيش أي تغيير اتعمل.'; end if;
end $$;
insert into public.cc_staff (user_id, display_name)
select id, 'مركز الاتصال' from auth.users where email = 'staff@cc.test'
on conflict (user_id) do nothing;

insert into public.cc_delivery_areas (name, fee, active) values
  ('منطقة اختبار 1', 20, true),
  ('منطقة موقوفة (اختبار)', 30, false)
on conflict (name) do nothing;
commit;
