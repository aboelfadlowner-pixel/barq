-- نجم أبو الفضل — حساب الموظف: كود البصمة + رقم سري، تقريره، كروته، والاعتراض

-- داخلية: التأكد من الكود والرقم السري (5 محاولات غلط ← قفل 15 دقيقة، زي المديرين)
create or replace function public.najm_emp_auth(p_code text, p_pin text)
returns public.najm_employees language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees; p najm_emp_pins; f najm_login_fails; c text := trim(coalesce(p_code, '')); un text;
begin
  un := 'emp:' || c;
  select * into f from najm_login_fails where username = un;
  if f.locked_until is not null and f.locked_until > now() then return null; end if;
  select * into p from najm_emp_pins where code = c;
  select * into e from najm_employees where code = c and active;
  -- المدير بيدخل كمدير بس (مش كموظف)
  if e.code is not null and p.code is null and not exists (select 1 from najm_users where active and emp_code = c) then
    return e;   -- الموظف بيدخل بكود البصمة بس — الرقم السري للي مدير التشغيل حاطله رقم بس
  end if;
  if e.code is null or p.code is null or exists (select 1 from najm_users where active and emp_code = c)
     or p.pin_hash <> encode(sha256(convert_to(p.salt || coalesce(p_pin, ''), 'UTF8')), 'hex') then
    insert into najm_login_fails(username, fails) values (un, 1)
      on conflict (username) do update set fails = najm_login_fails.fails + 1,
        locked_until = case when najm_login_fails.fails + 1 >= 5 then now() + interval '15 minutes' end;
    update najm_login_fails set fails = 0 where username = un and locked_until is not null and fails >= 5;
    return null;
  end if;
  delete from najm_login_fails where username = un;
  return e;
end $$;
revoke all on function public.najm_emp_auth(text, text) from public, anon, authenticated;

-- التصويت والاعتراضات وتغيير الرقم: للموظف اللي ليه رقم سري بس (كود البصمة لوحده معروف لزمايله)
create or replace function public.najm_emp_has_pin(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from najm_emp_pins where code = trim(coalesce(p_code, '')));
$$;
revoke all on function public.najm_emp_has_pin(text) from public, anon, authenticated;

-- دخول الموظف. الغلط بيرجع {error} (مش exception) عشان المحاولة الغلط تفضل متحسوبة
create or replace function public.najm_emp_login(p_code text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees;
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  return jsonb_build_object('code', e.code, 'name', e.name, 'branch', e.branch, 'dept', e.dept,
    'must_change', coalesce((select must_change from najm_emp_pins where code = e.code), false), 'has_pin', public.najm_emp_has_pin(e.code));
end $$;
grant execute on function public.najm_emp_login(text, text) to anon, authenticated;

-- الموظف يغيّر رقمه السري (4 لـ 6 أرقام)
create or replace function public.najm_emp_set_pin(p_code text, p_pin text, p_new text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees; s text := md5(random()::text);
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  if not public.najm_emp_has_pin(e.code) then return jsonb_build_object('error', 'najm: PIN required'); end if;
  if coalesce(p_new, '') !~ '^\d{4,6}$' then return jsonb_build_object('error', 'najm: PIN must be 4-6 digits'); end if;
  if p_new = p_pin then return jsonb_build_object('error', 'najm: choose a different PIN'); end if;
  update najm_emp_pins set salt = s, pin_hash = encode(sha256(convert_to(s || p_new, 'UTF8')), 'hex'),
    must_change = false, updated_at = now() where code = e.code;
  insert into najm_history(actor, kind, code) values ('emp:' || e.code, 'emp_pin_change', e.code);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.najm_emp_set_pin(text, text, text) to anon, authenticated;

-- تقرير الموظف: تقييماته اليومية (لازم الكود + الرقم السري)
drop function if exists public.najm_my_ratings(text, date, date);
create or replace function public.najm_my_ratings(p_code text, p_pin text, p_from date, p_to date)
returns table(day date, att text, br smallint[], sh smallint[], fr smallint[], ops smallint[], hy smallint[], bonus numeric)
language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees;
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null or p_to - p_from > 31 then return; end if;
  return query select r.day, r.att, r.br, r.sh, r.fr, r.ops, r.hy, r.bonus from najm_ratings r
    where r.code = e.code and r.day between p_from and p_to;
end $$;
grant execute on function public.najm_my_ratings(text, text, date, date) to anon, authenticated;

-- كروت الموظف كلها (طول فترة شغله) بالسبب واسم المدير والحالة، ومعاها الاعتراضات
create or replace function public.najm_my_cards(p_code text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees;
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  return jsonb_build_object('cards', coalesce((
    select jsonb_agg(jsonb_build_object('id', k.id, 'day', k.day, 'color', k.color, 'reason', k.reason, 'status', k.status,
             'by', coalesce(u.name, k.by_user), 'appeal', (
               select jsonb_build_object('status', a.status, 'body', a.body, 'note', a.decision_note, 'at', a.created_at)
               from najm_card_appeals a where a.card_id = k.id order by a.created_at desc limit 1))
           order by k.day desc, k.created_at desc)
    from najm_cards k left join najm_users u on u.username = k.by_user
    where k.code = e.code), '[]'::jsonb));
end $$;
grant execute on function public.najm_my_cards(text, text) to anon, authenticated;

-- الموظف يعترض على كارت ليه (اعتراض واحد مفتوح لكل كارت)
create or replace function public.najm_emp_appeal(p_code text, p_pin text, p_card text, p_body text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees; k najm_cards; b text := trim(coalesce(p_body, ''));
begin
  -- الاعتراض بكود البصمة بس (من غير رقم سري)
  select * into e from najm_employees where code = trim(coalesce(p_code, '')) and active
    and not exists (select 1 from najm_users x where x.active and x.emp_code = trim(coalesce(p_code, '')));
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  select * into k from najm_cards where id = p_card and code = e.code;
  if k.id is null or k.status not in ('approved', 'pending') then return jsonb_build_object('error', 'najm: card cannot be appealed'); end if;
  if length(b) < 3 or length(b) > 500 then return jsonb_build_object('error', 'najm: write the reason (3-500 letters)'); end if;
  if exists (select 1 from najm_card_appeals where card_id = k.id and status = 'pending') then
    return jsonb_build_object('error', 'najm: appeal already open'); end if;
  insert into najm_card_appeals(card_id, code, body) values (k.id, e.code, b);
  insert into najm_history(actor, kind, code, day, data) values ('emp:' || e.code, 'appeal', e.code, k.day, jsonb_build_object('card', k.id, 'body', b));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.najm_emp_appeal(text, text, text, text) to anon, authenticated;

-- الموظف يعترض على يوم غياب متسجّل عليه (آخر 35 يوم، اعتراض واحد مفتوح لليوم) ← بيوصل لمدير التشغيل
create or replace function public.najm_emp_att_appeal(p_code text, p_pin text, p_day date, p_body text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees; b text := trim(coalesce(p_body, '')); today date := (now() at time zone 'Africa/Cairo')::date;
begin
  -- الاعتراض بكود البصمة بس (من غير رقم سري)
  select * into e from najm_employees where code = trim(coalesce(p_code, '')) and active
    and not exists (select 1 from najm_users x where x.active and x.emp_code = trim(coalesce(p_code, '')));
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  if p_day is null or p_day > today or p_day < today - 35 then return jsonb_build_object('error', 'najm: day out of range'); end if;
  if not exists (select 1 from najm_ratings where code = e.code and day = p_day and att = 'abs') then
    return jsonb_build_object('error', 'najm: day is not an absence'); end if;
  if length(b) < 3 or length(b) > 500 then return jsonb_build_object('error', 'najm: write the reason (3-500 letters)'); end if;
  if exists (select 1 from najm_att_appeals where code = e.code and day = p_day and status = 'pending') then
    return jsonb_build_object('error', 'najm: appeal already open'); end if;
  insert into najm_att_appeals(code, day, body) values (e.code, p_day, b);
  insert into najm_history(actor, kind, code, day, data) values ('emp:' || e.code, 'att_appeal', e.code, p_day, jsonb_build_object('body', b));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.najm_emp_att_appeal(text, text, date, text) to anon, authenticated;

-- اعتراضات الموظف على الغياب (بحالتها وقرار مدير التشغيل)
create or replace function public.najm_my_att_appeals(p_code text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees;
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  return jsonb_build_object('appeals', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'day', a.day, 'body', a.body, 'status', a.status, 'note', a.decision_note) order by a.day desc)
    from najm_att_appeals a where a.code = e.code), '[]'::jsonb));
end $$;
grant execute on function public.najm_my_att_appeals(text, text) to anon, authenticated;

-- سجل الموظف (History) للمديرين في نطاقهم: التقييمات، الكروت، الاعتراضات، ...
create or replace function public.najm_history_of(p_user text, p_pin text, p_code text)
returns table(at timestamptz, actor text, actor_name text, kind text, day date, data jsonb)
language plpgsql volatile security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null or not public.najm_in_scope(u, p_code) then return; end if;
  return query select h.at, h.actor, coalesce(x.name, h.actor), h.kind, h.day, h.data
    from najm_history h left join najm_users x on x.username = h.actor
    where h.code = p_code order by h.at desc limit 300;
end $$;
grant execute on function public.najm_history_of(text, text, text) to anon, authenticated;

-- شكاوى العملاء على الموظف (المثبتة واللي اتلغت بعد اعتراض) — مش بتظهر وهي لسه بتتراجع
create or replace function public.najm_my_complaints(p_code text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees;
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  return jsonb_build_object('complaints', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'day', c.day, 'note', c.note, 'status', c.status,
      'appeal_status', c.appeal_status, 'appeal_body', c.appeal_body, 'appeal_note', c.appeal_note) order by c.day desc)
    from najm_complaints c where c.code = e.code and (c.status = 'proven' or c.appeal_status is not null)), '[]'::jsonb));
end $$;
grant execute on function public.najm_my_complaints(text, text) to anon, authenticated;

-- الموظف يعترض على شكوى مثبتة عليه (مرة واحدة) ← بيوصل لمدير التشغيل
create or replace function public.najm_emp_complaint_appeal(p_code text, p_pin text, p_id text, p_body text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees; c najm_complaints; b text := trim(coalesce(p_body, ''));
begin
  -- الاعتراض بكود البصمة بس (من غير رقم سري)
  select * into e from najm_employees where code = trim(coalesce(p_code, '')) and active
    and not exists (select 1 from najm_users x where x.active and x.emp_code = trim(coalesce(p_code, '')));
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  select * into c from najm_complaints where id = p_id and code = e.code;
  if c.id is null or c.status <> 'proven' or c.appeal_status is not null then return jsonb_build_object('error', 'najm: complaint cannot be appealed'); end if;
  if length(b) < 3 or length(b) > 500 then return jsonb_build_object('error', 'najm: write the reason (3-500 letters)'); end if;
  update najm_complaints set appeal_body = b, appeal_status = 'pending', appeal_at = now() where id = c.id;
  insert into najm_history(actor, kind, code, day, data) values ('emp:' || e.code, 'complaint_appeal', e.code, c.day, jsonb_build_object('complaint', c.id, 'body', b));
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.najm_emp_complaint_appeal(text, text, text, text) to anon, authenticated;

-- تفاصيل تقييم الموظف هو بس (بكوده ورقمه السري) + الصلاة
create or replace function public.najm_my_ratings2(p_code text, p_pin text, p_from date, p_to date)
returns table(day date, att text, br smallint[], sh smallint[], fr smallint[], ops smallint[], hy smallint[], pray smallint, bonus numeric, carry text[])
language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees;
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null or p_to - p_from > 31 then return; end if;
  return query select r.day, r.att, r.br, r.sh, r.fr, r.ops, r.hy, r.pray, r.bonus, r.carry from najm_ratings r
    where r.code = e.code and r.day between p_from and p_to;
end $$;
grant execute on function public.najm_my_ratings2(text, text, date, date) to anon, authenticated;

-- تفاصيل تقييم الموظف هو بس + الصلاة والبريك (الكاميرات)
create or replace function public.najm_my_ratings3(p_code text, p_pin text, p_from date, p_to date)
returns table(day date, att text, br smallint[], sh smallint[], fr smallint[], hy smallint[], pray smallint, brk smallint, bonus numeric, carry text[])
language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees;
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null or p_to - p_from > 31 then return; end if;
  return query select r.day, r.att, r.br, r.sh, r.fr, r.hy, r.pray, r.brk, r.bonus, r.carry from najm_ratings r
    where r.code = e.code and r.day between p_from and p_to;
end $$;
grant execute on function public.najm_my_ratings3(text, text, date, date) to anon, authenticated;
