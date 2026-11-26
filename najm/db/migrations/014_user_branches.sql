-- نجم أبو الفضل — حساب المدير على أكتر من فرع (اختياري): مثلاً الهايجين بيدور على فرعين
-- branch = الفرع الأساسي (أول واحد)، وbranches = كل الفروع لما يبقوا أكتر من واحد. branch فاضي = كل الفروع.
alter table public.najm_users add column if not exists branches text[];
