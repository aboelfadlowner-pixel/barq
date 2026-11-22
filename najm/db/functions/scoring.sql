-- نجم أبو الفضل — الحسابات: نجوم اليوم، الدرجات، الكروت، المبيعات، تقرير الموظف — النسخة الحالية من كل دالة (create or replace)

-- ---------------------------------------------------------------- scoring (single source of truth)
create or replace function public.najm_crit(a smallint[])
returns numeric language sql immutable set search_path = public as $$
  select case when a is null or coalesce(array_length(a,1),0) < 5 or array_position(a, null) is not null then null
              else round((select sum(x) from unnest(a) x)::numeric / 10 * 4) / 4 end;
$$;

-- الهايجين (اللبس): −1 = البند مش مطلوب من الموظف ده (مسؤول الهايجين بيختار، والتيشرت إجباري). النجمة = مجموع البنود المطلوبة ÷ (2 × عددها)، لأقرب ربع
create or replace function public.najm_hy(a smallint[])
returns numeric language sql immutable set search_path = public as $$
  select case when a is null or coalesce(array_length(a,1),0) < 5 or array_position(a, null) is not null
                   or not exists (select 1 from unnest(a) x where x >= 0) then null
              else round((select sum(x) from unnest(a) x where x >= 0)::numeric
                         / (2 * (select count(*) from unnest(a) x where x >= 0)) * 4) / 4 end;
$$;

-- ---------------------------------------------------------------- تقييم المديرين كل 4 أيام (1، 5، 9، 13، 17، 21، 25، 29)
-- التقييم بيكمّل لوحده على الأيام اللي بعده لحد ما المدير يعدّله (البصمة والهايجين والبونص بيتغيروا كل يوم)
-- آخر تقييم للبند ده قبل اليوم (في آخر 40 يوم)
create or replace function public.najm_prev_rate(p_code text, p_day date, p_f text)
returns smallint[] language sql stable set search_path = public as $$
  select case p_f
    when 'br'  then (select br  from najm_ratings where code = p_code and day < p_day and day >= p_day - 40 and br  is not null order by day desc limit 1)
    when 'sh'  then (select sh  from najm_ratings where code = p_code and day < p_day and day >= p_day - 40 and sh  is not null order by day desc limit 1)
    when 'fr'  then (select fr  from najm_ratings where code = p_code and day < p_day and day >= p_day - 40 and fr  is not null order by day desc limit 1)
    when 'ops' then (select ops from najm_ratings where code = p_code and day < p_day and day >= p_day - 40 and ops is not null order by day desc limit 1)
  end;
$$;
revoke all on function public.najm_prev_rate(text, date, text) from public, anon, authenticated;

-- أي يوم جديد للموظف (من البصمة أو الهايجين أو أي حاجة) بياخد آخر تقييم للمديرين
create or replace function public.najm_carry_fill()
returns trigger language plpgsql security definer set search_path = public as $$
declare v smallint[];
begin
  new.carry := coalesce(new.carry, '{}');
  if new.br is null then v := public.najm_prev_rate(new.code, new.day, 'br'); if v is not null then new.br := v; new.carry := array_append(array_remove(new.carry, 'br'), 'br'); end if; end if;
  if new.sh is null then v := public.najm_prev_rate(new.code, new.day, 'sh'); if v is not null then new.sh := v; new.carry := array_append(array_remove(new.carry, 'sh'), 'sh'); end if; end if;
  if new.fr is null then v := public.najm_prev_rate(new.code, new.day, 'fr'); if v is not null then new.fr := v; new.carry := array_append(array_remove(new.carry, 'fr'), 'fr'); end if; end if;
  if new.ops is null then v := public.najm_prev_rate(new.code, new.day, 'ops'); if v is not null then new.ops := v; new.carry := array_append(array_remove(new.carry, 'ops'), 'ops'); end if; end if;
  return new;
end $$;
create or replace trigger najm_carry_fill_trg before insert on public.najm_ratings for each row execute function public.najm_carry_fill();

-- المدير قيّم (أو عدّل أو مسح) بند في يوم ← الأيام اللي بعده اللي ماشية على التقييم القديم بتاخد الجديد، لحد أول يوم متقيّم بإيد
create or replace function public.najm_carry_forward(p_code text, p_day date, p_f text)
returns void language plpgsql security definer set search_path = public as $$
declare nxt date; v smallint[];
begin
  if p_f not in ('br', 'sh', 'fr', 'ops') then return; end if;
  execute format('select %1$I from najm_ratings where code = $1 and day = $2', p_f) into v using p_code, p_day;
  execute format('select min(day) from najm_ratings where code = $1 and day > $2 and %1$I is not null and not (%1$L = any(coalesce(carry, ''{}'')))', p_f)
    into nxt using p_code, p_day;
  execute format('update najm_ratings set %1$I = $3,
                    carry = array_remove(coalesce(carry, ''{}''), %1$L) || case when $3 is null then ''{}''::text[] else array[%1$L] end, updated_at = now()
                  where code = $1 and day > $2 and ($4::date is null or day < $4) and day <= $2 + 40
                    and (%1$I is null or %1$L = any(coalesce(carry, ''{}'')))', p_f)
    using p_code, p_day, v, nxt;
end $$;
revoke all on function public.najm_carry_forward(text, date, text) from public, anon, authenticated;

-- stars (max 5): fingerprint 2 + direct manager 1 + operations 1 + hygiene 1 + exemplary ½
create or replace function public.najm_score(r public.najm_ratings, p_dept text, p_settings jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  fresh boolean := p_dept = any (array(select jsonb_array_elements_text(coalesce(p_settings->'freshDepts','["قسم البقاله"]'::jsonb))));
  a numeric; b numeric := public.najm_crit(r.br); s numeric := public.najm_crit(r.sh);
  f numeric := public.najm_crit(r.fr); o numeric := public.najm_crit(r.ops); h numeric := public.najm_hy(r.hy);
  m numeric; mc boolean; tot numeric; anyv boolean;
begin
  -- يوم غياب أو راحة: مفيش نجوم مديرين (التقييم المكمّل من الأيام اللي قبله مبيتحسبش فيه)
  if r.att in ('abs', 'off') then b := null; s := null; f := null; o := null; end if;
  a := case when r.att is null or r.att = 'off' then null
            else coalesce((p_settings->'att'->>r.att)::numeric,
                          case r.att when 'on' then 2 when 'late' then 1.2 when 'vlate' then 0.4 else 0 end) end;
  if fresh then
    m := case when b is null and s is null and f is null then null
              else round((coalesce(b,0) + coalesce(s,0) + coalesce(f,0)) / 3 * 4) / 4 end;
    mc := b is not null and s is not null and f is not null;
  else
    m := case when b is null and s is null then null
              else round((coalesce(b,0) + coalesce(s,0)) / 2 * 4) / 4 end;
    mc := b is not null and s is not null;
  end if;
  anyv := a is not null or m is not null or o is not null or h is not null or coalesce(r.bonus,0) > 0;
  -- الأساسي من 5، والتصرف المثالي (½) Bonus منفصل فوقه
  tot := case when anyv then least(5, coalesce(a,0) + coalesce(m,0) + coalesce(o,0) + coalesce(h,0)) + coalesce(r.bonus,0) end;
  return jsonb_build_object('att', r.att, 'att_star', a, 'mgr_star', m, 'ops_star', o, 'hy_star', h, 'bonus', coalesce(r.bonus,0),
    'total', tot, 'base', case when anyv then least(5, coalesce(a,0) + coalesce(m,0) + coalesce(o,0) + coalesce(h,0)) end, 'complete', a is not null and mc and o is not null,
    'parts', jsonb_build_object('br', b, 'sh', s, 'fr', f), 'fresh', fresh, 'carry', to_jsonb(coalesce(r.carry, '{}')));
end $$;

revoke all on function public.najm_score(public.najm_ratings, text, jsonb) from public, anon, authenticated;

-- public: totals only (no criteria, no notes)
create or replace function public.najm_public_scores(p_from date, p_to date)
returns table(day date, code text, att text, total numeric, complete boolean, has_bonus boolean)
language sql stable security definer set search_path = public as $$
  with st as (select data from najm_settings where id = 1)
  select r.day, r.code, r.att, (x.sc->>'total')::numeric, (x.sc->>'complete')::boolean, coalesce(r.bonus,0) > 0
  from najm_ratings r
  left join najm_employees e on e.code = r.code
  cross join st
  cross join lateral (select public.najm_score(r, e.dept, st.data) sc) x
  where r.day between p_from and p_to;
$$;

grant execute on function public.najm_public_scores(date, date) to anon, authenticated;

create or replace function public.najm_full_scores(p_user text, p_pin text, p_from date, p_to date)
returns table(day date, code text, att text, att_time text, br smallint[], sh smallint[], fr smallint[], ops smallint[], hy smallint[],
              bonus numeric, bonus_note text, score jsonb)
-- volatile: التحقق من الرقم السري بيكتب في عدّاد المحاولات (الدوال الـ stable بتتنفذ «قراءة بس» وبتترفض)
language plpgsql volatile security definer set search_path = public as $$
declare u najm_users; st jsonb;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  -- wrong PIN: return (not raise) so the failed attempt counted by najm_auth is kept (5 → 15-minute lock)
  if u.username is null then return; end if;
  select data into st from najm_settings where id = 1;
  return query
    select r.day, r.code, r.att, r.att_time, r.br, r.sh, r.fr, r.ops, r.hy, r.bonus, r.bonus_note,
           public.najm_score(r, e.dept, st)
    from najm_ratings r left join najm_employees e on e.code = r.code
    where r.day between p_from and p_to and public.najm_in_scope(u, r.code);
end $$;

grant execute on function public.najm_full_scores(text, text, date, date) to anon, authenticated;


-- player card (FIFA-style) inputs per employee for a period — aggregates only, no per-manager detail
create or replace function public.najm_card_stats(p_from date, p_to date)
returns table(code text, on_n int, late_n int, vlate_n int, abs_n int, c1 numeric, c2 numeric, c3 numeric, c4 numeric, c5 numeric, bonus_n int)
language sql stable security definer set search_path = public as $$
  with r as (select * from najm_ratings where day between p_from and p_to),
  crit as (
    select r.code, a.arr from r cross join lateral (values (r.br, 'br'), (r.sh, 'sh'), (r.fr, 'fr'), (r.ops, 'ops')) a(arr, f)
    where a.arr is not null and array_position(a.arr, null) is null and array_length(a.arr, 1) = 5
      and not (a.f = any(coalesce(r.carry, '{}'))))
  select r.code,
    count(*) filter (where att = 'on')::int, count(*) filter (where att = 'late')::int,
    count(*) filter (where att = 'vlate')::int, count(*) filter (where att = 'abs')::int,
    (select avg(arr[1]) from crit where crit.code = r.code), (select avg(arr[2]) from crit where crit.code = r.code),
    (select avg(arr[3]) from crit where crit.code = r.code), (select avg(arr[4]) from crit where crit.code = r.code),
    (select avg(arr[5]) from crit where crit.code = r.code),
    count(*) filter (where coalesce(bonus, 0) > 0)::int
  from r group by r.code;
$$;

grant execute on function public.najm_card_stats(date, date) to anon, authenticated;

-- public: approved card counts only (no reasons)
create or replace function public.najm_public_cards(p_from date, p_to date)
returns table(code text, yellow int, red int, green int)
language sql stable security definer set search_path = public as $$
  select code,
         count(*) filter (where color = 'yellow')::int,
         count(*) filter (where color = 'red')::int,
         count(*) filter (where color = 'green')::int
  from najm_cards where approved and day between p_from and p_to
  group by code;
$$;

grant execute on function public.najm_public_cards(date, date) to anon, authenticated;

-- month-to-date sales per branch in one call (summing the daily Foodics sheets); returns {branch:{sku:{name,qty}}}
create or replace function public.najm_sales_sum(p_from date, p_to date)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_object_agg(branch, items), '{}'::jsonb) from (
    select branch, jsonb_object_agg(sku, jsonb_build_object('name', name, 'qty', qty)) items from (
      select s.branch, i.key sku, max(i.value->>'name') name, sum((i.value->>'qty')::numeric) qty
      from najm_sales s cross join lateral jsonb_each(s.items) i
      where s.day between p_from and p_to group by 1, 2) a
    group by branch) b;
$$;

grant execute on function public.najm_sales_sum(date, date) to anon, authenticated;

-- نقط الكروت في الشهر (الحساب في الداتابيز): الأخضر +10 · الأصفر −5 · الأحمر −20 · كل 3 صفر = أحمر (والصفر التلاتة نقطهم بتتلغي)
-- الكروت المحسوبة بس (status = approved). القيم من الإعدادات (cards).
create or replace function public.najm_card_points(p_from date, p_to date)
returns table(code text, yellow int, red int, green int, points numeric)
language sql stable security definer set search_path = public as $$
  with k as (
    select coalesce((d->'cards'->>'yellow')::numeric, -5) y, coalesce((d->'cards'->>'red')::numeric, -20) r,
           coalesce((d->'cards'->>'green')::numeric, 10) g, greatest(1, coalesce((d->'cards'->>'yellowsToRed')::int, 3)) n
    from (select (select data from najm_settings where id = 1) d) s),
  c as (
    select code, count(*) filter (where color = 'yellow')::int yellow, count(*) filter (where color = 'red')::int red,
           count(*) filter (where color = 'green')::int green
    from najm_cards where status = 'approved' and day between p_from and p_to group by code)
  select c.code, c.yellow, c.red, c.green,
         (c.red + c.yellow / k.n) * k.r + (c.yellow % k.n) * k.y + c.green * k.g
  from c, k;
$$;
grant execute on function public.najm_card_points(date, date) to anon, authenticated;

-- كروت كل يوم (عدد بس، من غير أسباب) — لرجل اليوم: مفيش أصفر أو أحمر يومها، والأخضر بيرفّع
create or replace function public.najm_public_day_cards(p_from date, p_to date)
returns table(day date, code text, yellow int, red int, green int)
language sql stable security definer set search_path = public as $$
  select day, code, count(*) filter (where color = 'yellow')::int, count(*) filter (where color = 'red')::int,
         count(*) filter (where color = 'green')::int
  from najm_cards where status = 'approved' and day between p_from and p_to and p_to - p_from <= 62
  group by day, code;
$$;
grant execute on function public.najm_public_day_cards(date, date) to anon, authenticated;

-- عدد شكاوى العملاء المثبتة على كل موظف (من غير تفاصيل) — عشان الترتيب يبقى واحد عند الكل
create or replace function public.najm_public_complaints(p_from date, p_to date)
returns table(code text, n int)
language sql stable security definer set search_path = public as $$
  select code, count(*)::int from najm_complaints where status = 'proven' and day between p_from and p_to and p_to - p_from <= 62 group by code;
$$;
grant execute on function public.najm_public_complaints(date, date) to anon, authenticated;

-- نقل الموظفين بين الأقسام والفروع (للتارجت في شهر النقل) — من غير بيانات حساسة
create or replace function public.najm_public_moves(p_from date, p_to date)
returns table(code text, day date, from_branch text, from_dept text, to_branch text, to_dept text)
language sql stable security definer set search_path = public as $$
  select code, day, from_branch, from_dept, to_branch, to_dept from najm_emp_moves
  where day between p_from and p_to and p_to - p_from <= 62 and (from_branch, from_dept) is distinct from (to_branch, to_dept)
  order by day, id;
$$;
grant execute on function public.najm_public_moves(date, date) to anon, authenticated;
