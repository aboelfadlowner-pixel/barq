-- نجم أبو الفضل — البيانات الأولية: حساب ops (رقم سري 0000 — غيّره أول دخول)، والإعدادات الافتراضية

-- ---------------------------------------------------------------- defaults
-- first login: username «ops», PIN «0000» → change it from the app (الإعدادات → الحسابات)
insert into public.najm_users(username, name, role, salt, pin_hash)
select 'ops', 'مدير التشغيل', 'ops', s, encode(sha256(convert_to(s || '0000', 'UTF8')), 'hex')
from (select md5('najm-ops' || random()::text) s) x
on conflict (username) do nothing;

insert into public.najm_private(id, data) values (1, '{"bonusAt100":0}') on conflict (id) do nothing;

insert into public.najm_settings(id, data) values (1, '{"freshDepts":["قسم البقاله"],"cards":{"yellow":-5,"red":-20,"green":5,"yellowsToRed":2},"captainMult":3}') on conflict (id) do nothing;
