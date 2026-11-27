-- نجم أبو الفضل — جدول الراحات الشهري (من شيت الإجازات): لكل موظف أيام راحته المخططة
-- · اليوم الفاضي في شيت البصمة: لو مخطط ← راحة، لو لأ ← غياب (الموظف اللي مالوش جدول في الشهر بيفضل بالحساب القديم)
create table if not exists public.najm_leave_plan (
  code text not null,
  day date not null,
  n smallint,
  primary key (code, day)
);
alter table public.najm_leave_plan enable row level security;
