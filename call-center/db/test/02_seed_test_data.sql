-- TEST PROJECT / LOCAL SANDBOX ONLY — NEVER RUN ON THE REAL DATABASE.
-- Requires three Auth users: agent@cc.test, supervisor@cc.test, outsider@cc.test
-- (outsider is signed in but is NOT staff).
insert into public.cc_staff (user_id, display_name, role)
select id, 'موظف الكول سنتر', 'agent' from auth.users where email = 'agent@cc.test'
on conflict (user_id) do nothing;
insert into public.cc_staff (user_id, display_name, role)
select id, 'المشرف', 'supervisor' from auth.users where email = 'supervisor@cc.test'
on conflict (user_id) do nothing;

insert into public.cc_delivery_areas (name, fee, active) values
  ('منطقة اختبار 1', 20, true),
  ('منطقة موقوفة (اختبار)', 30, false)
on conflict (name) do nothing;
