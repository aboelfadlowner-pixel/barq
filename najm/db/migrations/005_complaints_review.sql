-- نجم أبو الفضل — شكاوى العملاء: المدير بيسجّل ← مدير التشغيل بيراجع (مثبتة / مش مثبتة) ← الخصم على المثبتة بس ← الموظف يقدر يعترض
-- الشكاوى اللي كانت متسجلة قبل كده كانت بتتخصم على طول، فبتتحسب «مثبتة»
alter table public.najm_complaints add column if not exists status text;
update public.najm_complaints set status = 'proven' where status is null;
alter table public.najm_complaints alter column status set default 'pending';
alter table public.najm_complaints alter column status set not null;
alter table public.najm_complaints drop constraint if exists najm_complaints_status_check;
alter table public.najm_complaints add constraint najm_complaints_status_check check (status in ('pending', 'proven', 'rejected'));
alter table public.najm_complaints add column if not exists decided_by text;
alter table public.najm_complaints add column if not exists decided_at timestamptz;
alter table public.najm_complaints add column if not exists decision_note text;
alter table public.najm_complaints add column if not exists appeal_body text;
alter table public.najm_complaints add column if not exists appeal_status text;
alter table public.najm_complaints drop constraint if exists najm_complaints_appeal_check;
alter table public.najm_complaints add constraint najm_complaints_appeal_check check (appeal_status is null or appeal_status in ('pending', 'accepted', 'rejected'));
alter table public.najm_complaints add column if not exists appeal_at timestamptz;
alter table public.najm_complaints add column if not exists appeal_note text;
alter table public.najm_complaints add column if not exists appeal_by text;
