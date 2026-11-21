-- نجم أبو الفضل — البيانات الأولية: حساب ops (رقم سري 0000 — غيّره أول دخول)، والإعدادات الافتراضية

-- ---------------------------------------------------------------- defaults
-- first login: username «ops», PIN «0000» → change it from the app (الإعدادات → الحسابات)
insert into public.najm_users(username, name, role, salt, pin_hash)
select 'ops', 'مدير التشغيل', 'ops', s, encode(sha256(convert_to(s || '0000', 'UTF8')), 'hex')
from (select md5('najm-ops' || random()::text) s) x
on conflict (username) do nothing;

insert into public.najm_private(id, data) values (1, '{"bonusAt100":0}') on conflict (id) do nothing;

insert into public.najm_settings(id, data) values (1, '{"freshDepts":["قسم البقاله"],"cards":{"yellow":-5,"red":-20,"green":10,"yellowsToRed":3},"captainMult":3,"hyItems":{"قسم البقاله": [0, 1, 2, 3, 4], "قسم التصنيع": [0, 1, 2, 3, 4], "قسم المعمل": [0, 1, 2, 3, 4], "قسم الايس كريم": [0, 1, 2, 3, 4], "قسم التركي": [0, 1, 2, 3, 4], "bakery": [0, 1, 2, 3, 4], "قسم البيض": [0, 1, 2, 3, 4], "قسم الفاكهه": [0, 1, 2, 3, 4], "قسم الرنجه": [0, 1, 2, 3, 4], "انتاج معلبات": [0, 1, 2, 3, 4], "قسم الجوده": [0, 1, 2, 3, 4], "خدمه العملاء": [0, 2], "قسم الكاشير": [0, 2], "vip": [0, 2]},"winnersBy":{"البيطاش الرئيسي":{"Morning":2,"Night":2},"عين شمس":{"Morning":1,"Night":1},"المصنع":{"Morning":0,"Night":0}}}') on conflict (id) do nothing;
