-- نجم أبو الفضل — الحسابات: نجوم اليوم، الدرجات، الكروت، المبيعات، تقرير الموظف — النسخة الحالية من كل دالة (create or replace)

-- ---------------------------------------------------------------- scoring (single source of truth)
-- 4 بنود (0 لـ 2) ← نجمة لأقرب ربع. التقييمات القديمة اللي فيها 5 بنود (الخامس كان الصلاة) بتتحسب بأول 4 بس
create or replace function public.najm_crit(a smallint[])
returns numeric language sql immutable set search_path = public as $$
  select case when a is null or coalesce(array_length(a,1),0) < 4 or array_position(a[1:4], null) is not null then null
              else round((select sum(x) from unnest(a[1:4]) x)::numeric / 8 * 4) / 4 end;
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

-- stars (max 5): البصمة 2 + المدير المباشر 1 + الهايجين 1 + صلاة المدير ½ (كل 4 أيام) + الكاميرات ½ (الصلاة ¼ + البريك ¼ كل يوم)
-- + التصرف المثالي ½ Bonus فوق الـ 5. مدير التشغيل مبقاش بيقيّم الموظفين (بيدي «وسام برق» +100 نقطة في الشهر)
create or replace function public.najm_score(r public.najm_ratings, p_dept text, p_settings jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  fresh boolean := p_dept = any (array(select jsonb_array_elements_text(coalesce(p_settings->'freshDepts','["قسم البقاله"]'::jsonb))));
  a numeric; b numeric := public.najm_crit(r.br); s numeric := public.najm_crit(r.sh);
  f numeric := public.najm_crit(r.fr); h numeric := public.najm_hy(r.hy);
  m numeric; mc boolean; tot numeric; anyv boolean; lv smallint; pl numeric; cm numeric; off boolean := r.att in ('abs', 'off');
begin
  -- يوم غياب أو راحة: مفيش نجوم مديرين ولا صلاة ولا كاميرات
  if off then b := null; s := null; f := null; end if;
  -- صلاة المدير (البند الخامس عند مدير الشيفت، ولو مفيش ← مدير الفرع): 2 ملتزم ½ · 1 بيقطع ¼ · 0 مبيصليش
  -- ولو مدير التشغيل اعتمد رأي الكاميرات في الدورة دي (تعارض) ← قراره هو اللي بيتحسب
  select v.level into lv from najm_pray_reviews v
    where v.code = r.code and v.decision = 'cams' and v.cycle = r.day - ((extract(day from r.day)::int - 1) % 4);
  lv := coalesce(lv, r.sh[5], r.br[5]);
  pl := case when off or lv is null then null else lv * 0.25 end;
  -- الكاميرات: صلّى ¼ + التزم بالبريك ¼
  cm := case when off or (r.pray is null and r.brk is null) then null else coalesce(r.pray, 0) * 0.25 + coalesce(r.brk, 0) * 0.25 end;
  a := case when r.att is null or r.att = 'off' then null
            else coalesce((p_settings->'att'->>r.att)::numeric,
                          case r.att when 'on' then 2 when 'late' then 1.2 when 'vlate' then 0.4 else 0 end) end;   -- xlate (فوق الحد) = 0 إلا لو اتغيّر من الإعدادات
  if fresh then
    -- البقاله: مدير الفرع + مدير الفريش بس (مدير الشيفت مالوش دعوة)
    m := case when b is null and f is null then null
              else round((coalesce(b,0) + coalesce(f,0)) / 2 * 4) / 4 end;
    mc := b is not null and f is not null;
  else
    m := case when b is null and s is null then null
              else round((coalesce(b,0) + coalesce(s,0)) / 2 * 4) / 4 end;
    mc := b is not null and s is not null;
  end if;
  anyv := a is not null or m is not null or h is not null or pl is not null or cm is not null or coalesce(r.bonus,0) > 0;
  -- الأساسي من 5، والتصرف المثالي (½) Bonus منفصل فوقه
  tot := case when anyv then least(5, coalesce(a,0) + coalesce(m,0) + coalesce(h,0) + coalesce(pl,0) + coalesce(cm,0)) + coalesce(r.bonus,0) end;
  return jsonb_build_object('att', r.att, 'att_star', a, 'mgr_star', m, 'hy_star', h, 'bonus', coalesce(r.bonus,0),
    'total', tot, 'base', case when anyv then least(5, coalesce(a,0) + coalesce(m,0) + coalesce(h,0) + coalesce(pl,0) + coalesce(cm,0)) end,
    'complete', a is not null and mc and pl is not null and r.pray is not null and r.brk is not null,
    'pray_lvl', lv, 'pray_star', pl, 'pray', r.pray, 'brk', r.brk, 'cam_star', cm,
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
    where a.arr is not null and array_position(a.arr[1:4], null) is null and array_length(a.arr, 1) >= 4
      and not (a.f = any(coalesce(r.carry, '{}'))))
  select r.code,
    count(*) filter (where att = 'on')::int, count(*) filter (where att = 'late')::int,
    count(*) filter (where att in ('vlate', 'xlate'))::int, count(*) filter (where att = 'abs')::int,
    (select avg(arr[1]) from crit where crit.code = r.code), (select avg(arr[2]) from crit where crit.code = r.code),
    (select avg(arr[3]) from crit where crit.code = r.code), (select avg(arr[4]) from crit where crit.code = r.code),
    avg(r.pray) filter (where r.pray is not null) * 2,   -- c5 = الصلاة (0 لـ 2)
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

-- وسام برق (+نقط) — للكل: الكود واليوم بس
create or replace function public.najm_public_medals(p_month text)
returns table(code text, day date)
language sql stable security definer set search_path = public as $$
  select code, day from najm_medals where month = p_month;
$$;
grant execute on function public.najm_public_medals(text) to anon, authenticated;

-- خصومات التارجت (تلاعب في تقييم الكاميرات مثلاً) — للكل: الكود ومجموع النسبة بس (من غير السبب)
create or replace function public.najm_public_penalties(p_month text)
returns table(code text, pct numeric)
language sql stable security definer set search_path = public as $$
  select code, least(100, sum(pct)) from najm_tgt_penalties where month = p_month group by code;
$$;
grant execute on function public.najm_public_penalties(text) to anon, authenticated;

-- موظف الكاميرات: كام (موظف × يوم) حاضر في فرعه ماتقيّمش (الصلاة أو البريك فاضي) — لخصم التارجت
-- النهارده مبيتحسبش (لسه شغال)
create or replace function public.najm_cam_missing(p_month text)
returns table(code text, missed int)
language sql stable security definer set search_path = public as $$
  select u.emp_code, count(r.*)::int
  from najm_users u
  join najm_employees e on e.active and (u.branch is null or e.branch = u.branch or e.branch = any(coalesce(u.branches, '{}')))
  join najm_ratings r on r.code = e.code and to_char(r.day, 'YYYY-MM') = p_month
                     and r.day < (now() at time zone 'Africa/Cairo')::date
                     and r.att in ('on', 'late', 'vlate', 'xlate') and (r.pray is null or r.brk is null)
  where u.role = 'cameras' and u.active and coalesce(u.emp_code, '') <> ''
    and not exists (select 1 from najm_users x where x.active and x.emp_code = e.code and x.role <> 'headcashier')
  group by u.emp_code;
$$;
grant execute on function public.najm_cam_missing(text) to anon, authenticated;

-- قرارات مدير التشغيل في تعارض الصلاة (الكاميرات × المدير) — للكل (الكود والدورة والقرار بس)
create or replace function public.najm_public_pray_reviews(p_month text)
returns table(code text, cycle date, decision text, level smallint)
language sql stable security definer set search_path = public as $$
  select code, cycle, decision, level from najm_pray_reviews where to_char(cycle, 'YYYY-MM') = p_month;
$$;
grant execute on function public.najm_public_pray_reviews(text) to anon, authenticated;

-- نقط الكاشير (هيد الكاشير) للشهر: صافي الباندات لكل كاشير — للكل (الكود والنقط والعدد، من غير تفاصيل)
create or replace function public.najm_public_cashier_pts(p_month text)
returns table(code text, pts numeric, n int)
language sql stable security definer set search_path = public as $$
  select code, sum(pts), count(*)::int from najm_cashier_events where to_char(day, 'YYYY-MM') = p_month group by code;
$$;
grant execute on function public.najm_public_cashier_pts(text) to anon, authenticated;

-- الملف الكامل للموظف (طول فترة شغله): ملخص كل شهر (نجوم · KPI بالنقط · حضور وغياب · كروت · رجل اليوم · وسام · باندات الكاشير) + الكروت + النقل
-- من غير أي فلوس. داخلية — بتتنادى من najm_my_history (الموظف بكوده) و najm_emp_history (مدير التشغيل)
create or replace function public.najm_history_data(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb; e najm_employees; res jsonb;
  ky numeric; kr numeric; kg numeric; kn int; mpts numeric;
begin
  select * into e from najm_employees where code = p_code;
  if e.code is null then return null; end if;
  select data into cfg from najm_settings where id = 1;
  ky := coalesce((cfg->'cards'->>'yellow')::numeric, -5); kr := coalesce((cfg->'cards'->>'red')::numeric, -20);
  kg := coalesce((cfg->'cards'->>'green')::numeric, 10); kn := greatest(1, coalesce((cfg->'cards'->>'yellowsToRed')::int, 3));
  mpts := coalesce((cfg->>'medalPts')::numeric, 100);
  select jsonb_build_object(
    'emp', jsonb_build_object('code', e.code, 'name', e.name, 'branch', e.branch, 'dept', e.dept, 'job', e.job, 'shift', e.shift, 'active', e.active),
    'months', coalesce((select jsonb_agg(m order by m->>'month' desc) from (
      select jsonb_build_object('month', x.m, 'n', x.n, 'avg', case when x.n > 0 then round(x.sum / x.n, 2) end,
               'worked', x.worked, 'off', x.off, 'abs', x.abs, 'late', x.late,
               'yellow', c.y, 'red', c.r, 'green', c.g, 'card_pts', cp.v, 'medal', md.n > 0, 'medals_n', md.n, 'wins', coalesce(w.n, 0),
               'cashier', ca.p, 'complaints', coalesce(cm.n, 0),
               'kpi_pts', case when x.n > 0 or md.n > 0 then greatest(0, round(x.sum / 5 * r.dm + cp.v + md.n * mpts)) end,
               'month_score', case when (x.n + x.abs) > 0 and (x.n > 0 or md.n > 0)
                    then round(greatest(0, round(x.sum / 5 * r.dm + cp.v + md.n * mpts)) / (r.dm * (x.n + x.abs)) * 100) end) m
      from (select to_char(rt.day, 'YYYY-MM') m,
                   count(*) filter (where rt.tot is not null and rt.att is distinct from 'abs') n,
                   coalesce(sum(rt.tot) filter (where rt.att is distinct from 'abs'), 0) sum,
                   count(*) filter (where rt.att in ('on', 'late', 'vlate', 'xlate')) worked,
                   count(*) filter (where rt.att = 'off') off, count(*) filter (where rt.att = 'abs') abs,
                   count(*) filter (where rt.att in ('late', 'vlate', 'xlate')) late
            from (select r2.day, r2.att, (public.najm_score(r2, e.dept, cfg)->>'total')::numeric tot from najm_ratings r2 where r2.code = p_code) rt
            group by 1) x
      cross join lateral (select coalesce(nullif(coalesce((select v->'rules'->>'kpiPts' from jsonb_array_elements(coalesce(cfg->'ruleVersions', '[]'::jsonb)) v where v->>'from' <= x.m order by v->>'from' desc limit 1), cfg->>'kpiPts'), '')::numeric, 500)
                                 / coalesce(nullif(coalesce((select v->'rules'->>'kpiDays' from jsonb_array_elements(coalesce(cfg->'ruleVersions', '[]'::jsonb)) v where v->>'from' <= x.m order by v->>'from' desc limit 1), cfg->>'kpiDays'), '')::numeric, 26) dm) r
      cross join lateral (select count(*) filter (where k.color = 'yellow')::int y, count(*) filter (where k.color = 'red')::int r, count(*) filter (where k.color = 'green')::int g
                          from najm_cards k where k.code = p_code and k.status = 'approved' and to_char(k.day, 'YYYY-MM') = x.m) c
      cross join lateral (select (c.r + c.y / kn) * kr + (c.y % kn) * ky + c.g * kg v) cp
      cross join lateral (select count(*)::int n from najm_medals d where d.code = p_code and d.month = x.m) md
      left join lateral (select count(*)::int n from najm_winners z where p_code = any(z.codes) and to_char(z.day, 'YYYY-MM') = x.m) w on true
      left join lateral (select sum(v.pts) p from najm_cashier_events v where v.code = p_code and to_char(v.day, 'YYYY-MM') = x.m having count(*) > 0) ca on true
      left join lateral (select count(*)::int n from najm_complaints q where q.code = p_code and q.status = 'proven' and to_char(q.day, 'YYYY-MM') = x.m) cm on true
    ) q(m)), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'day', k.day, 'color', k.color, 'reason', k.reason, 'status', k.status, 'by', coalesce(u.name, k.by_user)) order by k.day desc)
                       from najm_cards k left join najm_users u on u.username = k.by_user where k.code = p_code and k.status = 'approved'), '[]'::jsonb),
    'wins', coalesce((select jsonb_agg(z.day order by z.day desc) from najm_winners z where p_code = any(z.codes)), '[]'::jsonb),
    'medals', coalesce((select jsonb_agg(d.month order by d.month desc) from najm_medals d where d.code = p_code), '[]'::jsonb),
    'moves', coalesce((select jsonb_agg(jsonb_build_object('day', v.day, 'from_branch', v.from_branch, 'from_dept', v.from_dept, 'to_branch', v.to_branch, 'to_dept', v.to_dept) order by v.day desc)
                       from najm_emp_moves v where v.code = p_code), '[]'::jsonb)
  ) into res;
  return res;
end $$;
revoke all on function public.najm_history_data(text) from public, anon, authenticated;

-- الموظف بيشوف ملفه هو بس (كود البصمة + الرقم السري لو متحط)
create or replace function public.najm_my_history(p_code text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees;
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  return public.najm_history_data(e.code);
end $$;
grant execute on function public.najm_my_history(text, text) to anon, authenticated;

-- مدير التشغيل بس بيشوف ملف أي موظف
create or replace function public.najm_emp_history(p_user text, p_pin text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then return jsonb_build_object('error', 'najm: wrong username or PIN'); end if;
  if u.role <> 'ops' then return jsonb_build_object('error', 'najm: operations manager only'); end if;
  return public.najm_history_data(p_code);
end $$;
grant execute on function public.najm_emp_history(text, text, text) to anon, authenticated;

-- النجوم اليومية للموظف في شهر (للملف الكامل): كل يوم بأجزاء النجمة + الكروت ورجل اليوم — من غير بنود التقييم الفردية ولا أسماء المديرين ولا فلوس
create or replace function public.najm_history_days_data(p_code text, p_month text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cfg jsonb; e najm_employees;
begin
  select * into e from najm_employees where code = p_code;
  if e.code is null or coalesce(p_month, '') !~ '^\d{4}-\d{2}$' then return '[]'::jsonb; end if;
  select data into cfg from najm_settings where id = 1;
  return coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'att', x.s->>'att', 'att_star', x.s->'att_star', 'mgr', x.s->'mgr_star', 'hy', x.s->'hy_star',
      'pray', x.s->'pray_star', 'cam', x.s->'cam_star', 'bonus', x.s->'bonus', 'total', x.s->'total',
      'green', (select count(*)::int from najm_cards k where k.code = p_code and k.day = r.day and k.status = 'approved' and k.color = 'green'),
      'yellow', (select count(*)::int from najm_cards k where k.code = p_code and k.day = r.day and k.status = 'approved' and k.color = 'yellow'),
      'red', (select count(*)::int from najm_cards k where k.code = p_code and k.day = r.day and k.status = 'approved' and k.color = 'red'),
      'win', exists (select 1 from najm_winners z where z.day = r.day and p_code = any(z.codes))) order by r.day)
    from najm_ratings r, lateral (select public.najm_score(r, e.dept, cfg) as s) x
    where r.code = p_code and to_char(r.day, 'YYYY-MM') = p_month), '[]'::jsonb);
end $$;
revoke all on function public.najm_history_days_data(text, text) from public, anon, authenticated;

create or replace function public.najm_my_history_days(p_code text, p_pin text, p_month text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e najm_employees;
begin
  select * into e from public.najm_emp_auth(p_code, p_pin);
  if e.code is null then return jsonb_build_object('error', 'najm: wrong code or PIN'); end if;
  return public.najm_history_days_data(e.code, p_month);
end $$;
grant execute on function public.najm_my_history_days(text, text, text) to anon, authenticated;

create or replace function public.najm_emp_history_days(p_user text, p_pin text, p_code text, p_month text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then return jsonb_build_object('error', 'najm: wrong username or PIN'); end if;
  if u.role <> 'ops' then return jsonb_build_object('error', 'najm: operations manager only'); end if;
  return public.najm_history_days_data(p_code, p_month);
end $$;
grant execute on function public.najm_emp_history_days(text, text, text, text) to anon, authenticated;
