-- نجم أبو الفضل — مدير الشيفت على أكتر من شيفت (اختياري): shift = الشيفت الأساسي، وshifts = كل الشيفتات لما يبقوا أكتر من واحد
alter table public.najm_users add column if not exists shifts text[];
