-- نجم أبو الفضل — وسام برق: مدير التشغيل يديه لأي موظف أو مدير، وأي عدد في الشهر (كل وسام +100 نقطة من الإعدادات)
-- كان مفتاح الجدول (الكود + الشهر) يعني وسام واحد في الشهر. دلوقتي لكل وسام رقم. وسام المدير بيتسجل بكود «m:اسم-الدخول».
alter table public.najm_medals add column if not exists id bigserial;
alter table public.najm_medals drop constraint if exists najm_medals_pkey;
alter table public.najm_medals add primary key (id);
create index if not exists najm_medals_code_idx on public.najm_medals (code, month);
