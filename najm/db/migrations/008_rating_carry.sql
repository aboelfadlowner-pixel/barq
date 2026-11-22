-- نجم أبو الفضل — تقييم المديرين كل 4 أيام: التقييم بيفضل مكمّل لوحده على الأيام اللي بعده لحد ما المدير يغيّره
-- carry = البنود اللي قيمتها جاية من تقييم قبل كده (مش متقيّمة في اليوم ده نفسه): br / sh / fr / ops
alter table public.najm_ratings add column if not exists carry text[];
