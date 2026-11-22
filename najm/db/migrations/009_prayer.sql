-- نجم أبو الفضل — الصلاة نص نجمة لوحدها كل يوم (مدير الشيفت بيسجل صلّى / ماصلّاش) — 1 صلّى · 0 ماصلّاش
-- وطلعت من بنود تقييم المديرين (بقوا 4 بنود)، ومدير التشغيل بقى نص نجمة
alter table public.najm_ratings add column if not exists pray smallint;
do $$ begin
  alter table public.najm_ratings add constraint najm_ratings_pray_chk check (pray in (0, 1));
exception when duplicate_object then null; end $$;
