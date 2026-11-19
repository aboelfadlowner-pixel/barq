-- نجم أبو الفضل — إغلاق اليوم: كل مدير بيقفل شيفته، والتأخير بيتخصم منه تلقائي (من غير موافقة التشغيل)

-- آخر ميعاد لإغلاق اليوم = بداية الشيفت + عدد الساعات من الإعدادات (closeAfterHours، الافتراضي 10)، بتوقيت القاهرة
create or replace function public.najm_close_deadline(p_day date, p_gkey text)
returns timestamptz language sql stable security definer set search_path = public as $$
  select ((p_day + coalesce(st.data->'shiftStart'->>split_part(p_gkey, '|', 2),
                            case split_part(p_gkey, '|', 2) when 'Night' then '17:00' else '09:00' end)::time)
          + make_interval(hours => coalesce((st.data->>'closeAfterHours')::int, 10))) at time zone 'Africa/Cairo'
  from (select (select data from najm_settings where id = 1) as data) st;
$$;

-- المسؤول عن إغلاق شيفت: مديرين الشيفت ده في الفرع، ولو مفيش ← مدير الفرع
create or replace function public.najm_close_owners(p_gkey text)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(
    (select array_agg(username order by username) from najm_users
      where active and role = 'shift' and branch = split_part(p_gkey, '|', 1) and public.najm_shift_group(shift) = split_part(p_gkey, '|', 2)),
    (select array_agg(username order by username) from najm_users
      where active and role = 'branch' and branch = split_part(p_gkey, '|', 1)));
$$;

-- الخصم بيتسجل في رصيد المدير (najm_mgr_ledger) — مرة واحدة لكل يوم وشيفت ومدير
create or replace function public.najm_close_penalty(p_day date, p_gkey text, p_users text[], p_pen numeric)
returns void language sql security definer set search_path = public as $$
  insert into najm_mgr_ledger(id, username, month, points, reason)
  select 'late|' || p_day || '|' || p_gkey || '|' || x, x, to_char(p_day, 'YYYY-MM'), -p_pen,
         'تأخير إغلاق يوم ' || p_day || ' — ' || replace(p_gkey, '|', ' · ')
  from unnest(p_users) x
  where p_pen > 0
  on conflict (id) do nothing;
$$;

-- الأيام اللي عدّى ميعادها ومحدش قفلها ← خصم تلقائي. بتشتغل مع أي حفظ (مفيش حاجة محتاجة تتشغّل بإيد).
-- مبتشتغلش غير من تاريخ البداية اللي مدير التشغيل بيحدده (closeStart في الإعدادات)
create or replace function public.najm_apply_late_closes()
returns void language plpgsql security definer set search_path = public as $$
declare st jsonb; start date; pen numeric; g record; d date; dl timestamptz; own text[];
  today date := (now() at time zone 'Africa/Cairo')::date;
begin
  select data into st from najm_settings where id = 1;
  start := nullif(st->>'closeStart', '')::date;
  if start is null then return; end if;
  pen := coalesce((st->>'lateClosePenalty')::numeric, 5);
  for g in select distinct e.branch || '|' || public.najm_shift_group(e.shift) gkey
           from najm_employees e where e.active and coalesce(e.branch, '') <> '' loop
    own := public.najm_close_owners(g.gkey);
    continue when own is null;
    for d in select generate_series(greatest(start, today - 35), today, interval '1 day')::date loop
      continue when exists (select 1 from najm_day_closes c where c.day = d and c.gkey = g.gkey);
      dl := public.najm_close_deadline(d, g.gkey);
      continue when dl is null or now() <= dl;
      insert into najm_day_closes(day, gkey, deadline, late_minutes, penalty, responsible)
        values (d, g.gkey, dl, (extract(epoch from now() - dl) / 60)::int, pen, own)
        on conflict do nothing;
      perform public.najm_close_penalty(d, g.gkey, own, pen);
      insert into najm_history(actor, kind, day, gkey, data)
        values ('system', 'day_late', d, g.gkey, jsonb_build_object('deadline', dl, 'penalty', pen, 'responsible', own));
    end loop;
  end loop;
end $$;

revoke all on function public.najm_close_penalty(date, text, text[], numeric) from public, anon, authenticated;
revoke all on function public.najm_apply_late_closes() from public, anon, authenticated;
revoke all on function public.najm_close_owners(text) from public, anon, authenticated;
revoke all on function public.najm_close_deadline(date, text) from public, anon, authenticated;

-- حالة إغلاق الأيام (للشاشات): آخر 45 يوم
create or replace function public.najm_closes_list(p_from date, p_to date)
returns table(day date, gkey text, deadline timestamptz, closed_by text, closed_at timestamptz, late_minutes int, penalty numeric, responsible text[])
language sql stable security definer set search_path = public as $$
  select day, gkey, deadline, closed_by, closed_at, late_minutes, penalty, responsible
  from najm_day_closes where day between p_from and p_to and p_to - p_from <= 62;
$$;
grant execute on function public.najm_closes_list(date, date) to anon, authenticated;
