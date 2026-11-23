-- نجم أبو الفضل — تنبيهات مدير التشغيل من التحديث الدوري لشيت البصمة (7 و9 و11 بالليل و1 الفجر)
-- · sheet_changed: نتيجة أيام فاتت اتغيّرت عن آخر تحديث (الشيت اتعدّل بعد كده) ← يتواصل مع الـ HR
-- · comeback: موظف مابصمش 7 أيام أو أكتر وبعدها رجع يبصم
create table if not exists public.najm_alerts (
  id bigserial primary key,
  kind text not null,
  code text,
  day date not null,
  data jsonb,
  created_at timestamptz not null default now(),
  seen_by text,
  seen_at timestamptz
);
create unique index if not exists najm_alerts_once on public.najm_alerts (kind, coalesce(code, ''), day);
alter table public.najm_alerts enable row level security;

-- القيمة الخام من الشيت لكل يوم (دقايق التأخير / إجازة / من غير بصمة) — عشان نعرف لو الشيت نفسه اتغيّر
-- (مش الحكم: تغيير إعدادات التأخير بيغيّر الحكم من غير ما الشيت يتغيّر)
alter table public.najm_ratings add column if not exists att_raw text;
