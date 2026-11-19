-- نجم أبو الفضل — الدخول بكود البصمة للكل: كل حساب مدير مربوط بكود موظف واحد بس
create unique index if not exists najm_users_emp_code_uq on public.najm_users (emp_code) where coalesce(emp_code, '') <> '';
