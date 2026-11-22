-- نجم أبو الفضل — البصمة من شيت الحضور الشهري (التحديث اليومي من الـ Drive)
-- الداخل: من كل موظف 4 حاجات بس لكل يوم {code, day, shift, in, leave} — مفيش أي فلوس أو جزاءات بتدخل هنا

-- وقت زي «8:00 AM» أو «8:00 ص» أو «17:30» ← دقايق من نص الليل
create or replace function public.najm_tmin(t text)
returns int language sql immutable set search_path = public as $$
  select case when m is null then null
              else (case when t ~* '(pm|م)' and m[1]::int < 12 then m[1]::int + 12
                         when t ~* '(am|ص)' and m[1]::int = 12 then 0 else m[1]::int end) * 60 + m[2]::int end
  from (select regexp_match(coalesce(t, ''), '(\d{1,2}):(\d{2})') m) x;
$$;

-- الحكم لكل يوم (نفس قواعد التطبيق): إجازة مكتوبة ← إجازة · بصمة ← في ميعاده / تأخير بسيط / كبير من ميعاد ورديته الحقيقي
-- (السماح والتأخير البسيط من الإعدادات) · من غير بصمة ولا إجازة ← أول يوم في الأسبوع (من السبت) راحة، والباقي غياب
-- الأيام اللي بعد آخر بصمة في الملف بتتشال · التعديل اليدوي (att_src = manual) مبيتكتبش فوقه
create or replace function public.najm_att_sync_rows(p_rows jsonb, p_file text, p_keep_time boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cfg jsonb; grace int; latemax int; vlatemax int; woff int; lastd date; n int; skipped int; unk text[]; d1 date;
  today date := (now() at time zone 'Africa/Cairo')::date;
begin
  select data into cfg from najm_settings where id = 1;
  grace := coalesce((cfg->>'graceMin')::int, 10);
  latemax := coalesce((cfg->>'lateMax')::int, 30);
  vlatemax := coalesce(nullif(cfg->>'vlateMax', '')::int, 60);   -- بعده: «فوق الحد» (حاضر من غير نجوم بصمة)
  woff := coalesce((cfg->'ruleVersions'->-1->'rules'->>'weeklyOff')::int, (cfg->>'weeklyOff')::int, 1);
  create temp table _r on commit drop as
    select x->>'code' as code, (x->>'day')::date as day, nullif(trim(x->>'shift'), '') as shift, nullif(trim(x->>'in'), '') as tin, nullif(trim(x->>'leave'), '') as leave
    from jsonb_array_elements(p_rows) x where (x->>'day') ~ '^\d{4}-\d{2}-\d{2}$';
  select least(max(day), today) into lastd from _r where public.najm_tmin(tin) is not null;
  if lastd is null then return jsonb_build_object('saved', 0, 'note', 'مفيش بصمات في الملف'); end if;
  select array_agg(distinct code) into unk from _r r where not exists (select 1 from najm_employees e where e.code = r.code and e.active)
    and (public.najm_tmin(r.tin) is not null or r.leave is not null);
  create temp table _s on commit drop as
    with r as (select * from _r where day <= lastd
                 and code in (select code from _r where day <= lastd and (public.najm_tmin(tin) is not null or leave is not null))
                 and code in (select code from najm_employees where active)),
    c as (select r.*, case when leave is not null then 'off'
                           when public.najm_tmin(tin) is not null and public.najm_tmin(shift) is not null then
                             (select case when dd <= grace then 'on' when dd <= latemax then 'late' when dd <= vlatemax then 'vlate' else 'xlate' end
                              from (select (public.najm_tmin(tin) - public.najm_tmin(shift) + 2160) % 1440 - 720 dd) z)
                           when tin is not null then null              -- وقت مش مقروء: بيتساب (مش غياب)
                           else 'noshow' end s,
                      row_number() over (partition by code, day - ((extract(dow from day)::int + 1) % 7),
                                         (leave is null and tin is null) order by day) rn
          from r)
    select code, day, case when s = 'noshow' then case when rn <= woff then 'off' else 'abs' end else s end st,
           case when p_keep_time and public.najm_tmin(tin) is not null then tin end tin
    from c where s is not null;
  select count(*) into skipped from _s s join najm_ratings x on x.day = s.day and x.code = s.code where x.att_src = 'manual';
  insert into najm_ratings(day, code, att, att_time, att_src)
    select day, code, st, tin, 'sheet' from _s
  on conflict (day, code) do update set att = excluded.att, att_time = excluded.att_time, att_src = 'sheet', updated_at = now()
    where najm_ratings.att_src is distinct from 'manual';
  get diagnostics n = row_count;
  select min(day) into d1 from _s;
  insert into najm_imports(kind, file_name, file_hash, by_user, day, rows_ok, rows_bad, note)
    values ('attendance', left(p_file, 200), 'drive-sync:' || md5(p_file || lastd || clock_timestamp()::text), 'system', lastd, n,
            coalesce(array_length(unk, 1), 0), 'تحديث يومي من الـ Drive ' || d1 || ' → ' || lastd || case when skipped > 0 then ' · ' || skipped || ' يوم متعدّل بإيد اتساب' else '' end);
  insert into najm_history(actor, kind, data)
    values ('system', 'att_sync', jsonb_build_object('file', p_file, 'from', d1, 'to', lastd, 'saved', n, 'manual_kept', skipped, 'unknown', to_jsonb(unk)));
  return jsonb_build_object('saved', n, 'manual_kept', skipped, 'from', d1, 'to', lastd, 'unknown', to_jsonb(coalesce(unk, '{}')),
    'on', (select count(*) from _s where st = 'on'), 'late', (select count(*) from _s where st in ('late', 'vlate', 'xlate')),
    'abs', (select count(*) from _s where st = 'abs'), 'off', (select count(*) from _s where st = 'off'));
end $$;
-- بتتنادى من التحديث اليومي بس (مش من المتصفح)
revoke all on function public.najm_att_sync_rows(jsonb, text, boolean) from public, anon, authenticated;

-- نفس الحساب، بأوقات الدخول (من tools/attendance-sync.js)
create or replace function public.najm_att_sync(p_rows jsonb, p_file text)
returns jsonb language sql security definer set search_path = public as $$
  select public.najm_att_sync_rows(p_rows, p_file, true);
$$;
revoke all on function public.najm_att_sync(jsonb, text) from public, anon, authenticated;
grant execute on function public.najm_att_sync(jsonb, text) to service_role;

-- الصيغة الصغيرة للتحديث اليومي (من tools/attendance-sheet.js --compact): «YYYY-MM|كود:يوم1,يوم2,...;...»
-- كل يوم: دقايق التأخير عن ميعاد الوردية · L إجازة · - من غير بصمة ولا إجازة · x مش مقروء · . مفيش
-- p_md5 لازم يطابق الـ payload — لو حصل أي غلط في النقل، مفيش حاجة بتتحفظ
create or replace function public.najm_att_sync_compact(p_payload text, p_md5 text, p_file text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m text := split_part(p_payload, '|', 1); rows jsonb;
begin
  if md5(p_payload) is distinct from p_md5 then raise exception 'najm: payload checksum mismatch'; end if;
  if m !~ '^\d{4}-\d{2}$' then raise exception 'najm: bad month'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('code', split_part(seg, ':', 1), 'day', ((m || '-01')::date + (t.i - 1)::int)::text,
           'shift', '0:00',
           'in', case when t.tok ~ '^\d+$' then (t.tok::int / 60)::text || ':' || lpad((t.tok::int % 60)::text, 2, '0') when t.tok = 'x' then 'x' else '' end,
           'leave', case when t.tok = 'L' then 'L' else '' end)), '[]'::jsonb)
    into rows
  from unnest(string_to_array(split_part(p_payload, '|', 2), ';')) seg,
       unnest(string_to_array(split_part(seg, ':', 2), ',')) with ordinality t(tok, i)
  where seg <> '' and t.tok <> '.';
  return public.najm_att_sync_rows(rows, p_file, false);
end $$;
revoke all on function public.najm_att_sync_compact(text, text, text) from public, anon, authenticated;
grant execute on function public.najm_att_sync_compact(text, text, text) to service_role;

-- الموظفين من نفس شيت البصمة (راس كل بلوك): الكود · الاسم · القسم · الوظيفة · الفرع — مفيش فلوس
-- موظف جديد بيتضاف (الشيفت من أكتر ميعاد وردية متكرر)، واللي اتغيّر اسمه أو قسمه أو وظيفته أو فرعه بيتعدّل (والنقل بيتسجل).
-- قيم زي «#N/A» أو «لا يوجد» أو فرع مش عندنا بتتساب وبترجع في التقرير. الموظف الموقوف مبيرجعش لوحده.
create or replace function public.najm_emp_sync(p_rows jsonb, p_file text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cfg jsonb; x jsonb; e najm_employees; c text; nm text; dp text; jb text; br text; sh text; t int;
  mo int; bf int; bt int; ni int; added jsonb := '[]'; upd jsonb := '[]'; skip jsonb := '[]'; ch jsonb;
  bad text[] := array['', '#N/A', '#REF!', '#VALUE!', 'لا يوجد', '-'];
begin
  select data into cfg from najm_settings where id = 1;
  mo := coalesce(public.najm_tmin(cfg->'shiftStart'->>'Morning'), 420);
  bf := coalesce(public.najm_tmin(cfg->'shiftStart'->>'Between'), 780);
  bt := coalesce(public.najm_tmin(cfg->>'betweenTo'), 960);
  ni := coalesce(public.najm_tmin(cfg->'shiftStart'->>'Night'), 1020);
  perform set_config('najm.actor', 'sheet', true);
  for x in select * from jsonb_array_elements(coalesce(p_rows, '[]')) loop
    c := trim(x->>'code'); nm := trim(coalesce(x->>'name', '')); dp := trim(coalesce(x->>'dept', ''));
    jb := trim(coalesce(x->>'job', '')); br := trim(coalesce(x->>'branch', ''));
    if c !~ '^\d+$' or nm = any(bad) then continue; end if;
    select * into e from najm_employees where code = c;
    if br <> all(bad) and br not in (select distinct branch from najm_employees where branch is not null) then
      skip := skip || jsonb_build_object('code', c, 'name', nm, 'why', 'فرع مش عندنا: ' || br); br := '';
      if e.code is null then continue; end if;
    end if;
    if e.code is null then
      if br = any(bad) then skip := skip || jsonb_build_object('code', c, 'name', nm, 'why', 'من غير فرع'); continue; end if;
      -- اللي مابصمش في آخر أسبوع مبيتضافش (غالبًا ساب) — بيرجع في التقرير
      if coalesce(nullif(x->>'lastIn', ''), '1900-01-01')::date < (now() at time zone 'Africa/Cairo')::date - 7 then
        skip := skip || jsonb_build_object('code', c, 'name', nm, 'why', 'مابصمش آخر أسبوع'); continue; end if;
      t := public.najm_tmin(x->>'shiftTime');
      sh := case when t is null then 'Morning' when t between bf and bt then 'Between'
                 when t >= ni or t < mo - 120 then 'Night' else 'Morning' end;
      insert into najm_employees(code, name, branch, dept, job, shift, active)
        values (c, nm, br, nullif(case when dp = any(bad) then '' else dp end, ''), nullif(case when jb = any(bad) then '' else jb end, ''), sh, true);
      added := added || jsonb_build_object('code', c, 'name', nm, 'branch', br, 'dept', dp, 'shift', sh);
    else
      ch := '{}';
      if nm <> coalesce(e.name, '') then ch := ch || jsonb_build_object('name', nm); end if;
      if dp <> all(bad) and dp <> coalesce(e.dept, '') then ch := ch || jsonb_build_object('dept', dp); end if;
      if jb <> all(bad) and jb <> coalesce(e.job, '') then ch := ch || jsonb_build_object('job', jb); end if;
      if br <> all(bad) and br <> coalesce(e.branch, '') then ch := ch || jsonb_build_object('branch', br); end if;
      if ch <> '{}' then
        update najm_employees set name = coalesce(ch->>'name', name), dept = coalesce(ch->>'dept', dept), job = coalesce(ch->>'job', job),
          branch = coalesce(ch->>'branch', branch), updated_at = now() where code = c;
        upd := upd || jsonb_build_object('code', c, 'changes', ch, 'active', e.active);
      end if;
    end if;
  end loop;
  insert into najm_history(actor, kind, data)
    values ('system', 'emp_sync', jsonb_build_object('file', p_file, 'added', added, 'updated', upd, 'skipped', skip));
  return jsonb_build_object('added', added, 'updated', upd, 'skipped', skip);
end $$;
revoke all on function public.najm_emp_sync(jsonb, text) from public, anon, authenticated;
grant execute on function public.najm_emp_sync(jsonb, text) to service_role;
