-- نجم أبو الفضل — الحفظ (نقطة الكتابة الوحيدة للمديرين) وملفات الموظفين — النسخة الحالية من كل دالة (create or replace)

create or replace function public.najm_save(p_user text, p_pin text, p_kind text, p_key jsonb, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u najm_users;
  k_day date := nullif(p_key->>'day','')::date;
  k_code text := p_key->>'code';
  del boolean := p_data is null or p_data = 'null'::jsonb;
  arr smallint[];
  r najm_ratings; st jsonb; dpt text; s text;
  gk text := p_key->>'gkey'; dl timestamptz; pen numeric; own text[]; ret jsonb; er record; a najm_card_appeals; k najm_cards;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  -- wrong PIN: return (not raise) so the failed attempt counted by najm_auth is kept (5 → 15-minute lock)
  if u.username is null then return jsonb_build_object('error', 'najm: wrong username or PIN'); end if;
  perform public.najm_apply_late_closes();     -- الأيام اللي عدّى ميعاد إغلاقها ← خصم تلقائي

  if u.role = 'hygiene' and p_kind <> 'rate' then
    raise exception 'najm: hygiene rates only' using errcode = '42501';
  end if;
  if p_kind in ('winners','target','base_sales','complaint','employee','media','settings','private','user','card_approve','emp_pin','emp_pins_generate')
     and u.role <> 'ops' then
    raise exception 'najm: operations manager only' using errcode = '42501';
  end if;
  if p_kind in ('att','rate','bonus','note','card','captain') and not public.najm_in_scope(u, k_code) then
    raise exception 'najm: employee outside your scope' using errcode = '42501';
  end if;
  if p_kind in ('att','rate','bonus') and u.role <> 'ops' and (
       k_day < (now() at time zone 'Africa/Cairo')::date - 1
    or k_day > (now() at time zone 'Africa/Cairo')::date
    or exists (select 1 from najm_winners w join najm_employees e on e.code = k_code
               where w.day = k_day and w.gkey in (e.branch || '|' || e.shift, e.branch || '|' || public.najm_shift_group(e.shift)))
    or exists (select 1 from najm_day_closes c join najm_employees e on e.code = k_code
               where c.day = k_day and c.gkey = e.branch || '|' || public.najm_shift_group(e.shift) and c.closed_by is not null)) then
    raise exception 'najm: day locked' using errcode = '42501';
  end if;
  if p_kind = 'att' and u.role = 'fresh' then
    raise exception 'najm: attendance is entered by branch/shift managers' using errcode = '42501';
  end if;
  if p_kind in ('sales','kpi') and u.role <> 'ops' and u.branch is not null and u.branch <> p_key->>'branch' then
    raise exception 'najm: other branch' using errcode = '42501';
  end if;

  if p_kind = 'att' then
    insert into najm_ratings(day, code, att, att_time)
      values (k_day, k_code, case when del then null else p_data->>'st' end, case when del then null else p_data->>'time' end)
    on conflict (day, code) do update set att = excluded.att, att_time = excluded.att_time, updated_at = now();
  elsif p_kind = 'rate' then
    arr := case when del then null else array(select (case when v = 'null'::jsonb then null else v::text::smallint end)
                                             from jsonb_array_elements(p_data) v) end;
    if u.role = 'branch' then
      insert into najm_ratings(day, code, br) values (k_day, k_code, arr)
      on conflict (day, code) do update set br = excluded.br, updated_at = now();
    elsif u.role = 'shift' then
      insert into najm_ratings(day, code, sh) values (k_day, k_code, arr)
      on conflict (day, code) do update set sh = excluded.sh, updated_at = now();
    elsif u.role = 'fresh' then
      insert into najm_ratings(day, code, fr) values (k_day, k_code, arr)
      on conflict (day, code) do update set fr = excluded.fr, updated_at = now();
    elsif u.role = 'hygiene' then
      insert into najm_ratings(day, code, hy) values (k_day, k_code, arr)
      on conflict (day, code) do update set hy = excluded.hy, updated_at = now();
    else
      insert into najm_ratings(day, code, ops) values (k_day, k_code, arr)
      on conflict (day, code) do update set ops = excluded.ops, updated_at = now();
    end if;
  elsif p_kind = 'bonus' then
    insert into najm_ratings(day, code, bonus, bonus_note)
      values (k_day, k_code, case when del then null else least(0.5, (p_data->>'v')::numeric) end,
              case when del then null else p_data->>'note' end)
    on conflict (day, code) do update set bonus = excluded.bonus, bonus_note = excluded.bonus_note, updated_at = now();
  elsif p_kind = 'winners' then
    if del then delete from najm_winners where day = k_day and gkey = p_key->>'gkey';
    else insert into najm_winners(day, gkey, codes) values (k_day, p_key->>'gkey', array(select jsonb_array_elements_text(p_data)))
      on conflict (day, gkey) do update set codes = excluded.codes, updated_at = now(); end if;
  elsif p_kind = 'target' then
    if del then delete from najm_targets where month = p_key->>'month' and dkey = p_key->>'dkey';
    else insert into najm_targets(month, dkey, cfg) values (p_key->>'month', p_key->>'dkey', p_data)
      on conflict (month, dkey) do update set cfg = excluded.cfg, updated_at = now(); end if;
  elsif p_kind = 'sales' then
    insert into najm_sales(day, branch, items) values (k_day, p_key->>'branch', p_data)
    on conflict (day, branch) do update set items = excluded.items, updated_at = now();
  elsif p_kind = 'base_sales' then
    insert into najm_base_sales(month, branch, items) values (p_key->>'month', p_key->>'branch', p_data)
    on conflict (month, branch) do update set items = excluded.items, updated_at = now();
  elsif p_kind = 'kpi' then
    insert into najm_kpi_vals(day, dkey, vals) values (k_day, p_key->>'dkey', p_data)
    on conflict (day, dkey) do update set vals = excluded.vals, updated_at = now();
  elsif p_kind = 'complaint' then
    if del then delete from najm_complaints where id = p_key->>'id';
    else insert into najm_complaints(id, day, code, note, by_user)
      values (p_key->>'id', (p_data->>'date')::date, p_data->>'code', p_data->>'note', u.username)
      on conflict (id) do nothing; end if;
  elsif p_kind = 'note' then
    insert into najm_notes(id, day, code, body, by_user)
      values (p_key->>'id', (p_data->>'date')::date, k_code, p_data->>'text', u.username)
    on conflict (id) do nothing;
  elsif p_kind = 'employee' then
    insert into najm_employees(code, name, branch, dept, job, shift, active)
      values (k_code, p_data->>'name', p_data->>'branch', p_data->>'dept', p_data->>'job', p_data->>'shift',
              coalesce((p_data->>'active')::boolean, true))
    on conflict (code) do update set name = excluded.name, branch = excluded.branch, dept = excluded.dept, job = excluded.job,
      shift = excluded.shift, active = excluded.active, updated_at = now();
  elsif p_kind = 'media' then
    update najm_employees set
      photo = case when p_data ? 'photo' then nullif(p_data->>'photo','') else photo end,
      video = case when p_data ? 'video' then nullif(p_data->>'video','') else video end,
      title = case when p_data ? 'title' then nullif(p_data->>'title','') else title end,
      updated_at = now()
    where code = k_code;
  elsif p_kind = 'card' then
    -- مفيش كارت بيتمسح: الإلغاء بيغيّر الحالة بس، والكارت بيفضل في السجل
    if del then
      update najm_cards set status = 'cancelled', approved = false, decided_by = u.username, decided_at = now()
        where id = p_key->>'id' and code = k_code and status in ('pending','approved')
          and (u.role = 'ops' or (by_user = u.username and status = 'pending'));
    else
      if p_data->>'color' not in ('yellow','red','green') then raise exception 'najm: bad card color'; end if;
      if coalesce(trim(p_data->>'reason'), '') = '' then raise exception 'najm: card reason required'; end if;
      -- الأصفر والأخضر محسوبين على طول، والأحمر مستني موافقة مدير التشغيل
      insert into najm_cards(id, day, code, color, reason, by_user, approved, approved_by, status)
        values (p_key->>'id', (p_data->>'date')::date, k_code, p_data->>'color', p_data->>'reason', u.username,
                (p_data->>'color') <> 'red' or u.role = 'ops', case when u.role = 'ops' then u.username end,
                case when (p_data->>'color') = 'red' and u.role <> 'ops' then 'pending' else 'approved' end)
      on conflict (id) do nothing;
    end if;
  elsif p_kind = 'card_approve' then
    if coalesce((p_data->>'approved')::boolean, false) then
      update najm_cards set approved = true, approved_by = u.username, status = 'approved', decided_by = u.username, decided_at = now()
        where id = p_key->>'id' and status = 'pending';
    else
      update najm_cards set approved = false, status = 'rejected', decided_by = u.username, decided_at = now()
        where id = p_key->>'id' and status = 'pending';
    end if;
  elsif p_kind = 'appeal_decide' then
    -- القرار للمدير اللي ادى الكارت أو مدير التشغيل. القبول بيلغي الكارت (overturned) وبيفضل في السجل
    select * into a from najm_card_appeals where id = p_key->>'id';
    select * into k from najm_cards where id = a.card_id;
    if a.id is null then raise exception 'najm: appeal not found'; end if;
    if a.status <> 'pending' then raise exception 'najm: appeal already decided'; end if;
    if not (u.role = 'ops' or k.by_user = u.username) then raise exception 'najm: only the card issuer or operations can decide' using errcode = '42501'; end if;
    update najm_card_appeals set status = case when coalesce((p_data->>'accept')::boolean, false) then 'accepted' else 'rejected' end,
      decided_by = u.username, decided_at = now(), decision_note = p_data->>'note' where id = a.id;
    if coalesce((p_data->>'accept')::boolean, false) then
      update najm_cards set status = 'overturned', approved = false, decided_by = u.username, decided_at = now() where id = k.id;
    end if;
    k_code := a.code; k_day := k.day;
  elsif p_kind = 'day_close' then
    -- إغلاق اليوم: مدير الشيفت (البين مع الليل) أو مدير الفرع أو التشغيل
    if gk is null or k_day is null then raise exception 'najm: day and shift required'; end if;
    if not (u.role = 'ops' or (u.role = 'branch' and u.branch = split_part(gk, '|', 1))
            or (u.role = 'shift' and u.branch = split_part(gk, '|', 1) and public.najm_shift_group(u.shift) = split_part(gk, '|', 2))) then
      raise exception 'najm: outside your scope' using errcode = '42501';
    end if;
    if k_day > (now() at time zone 'Africa/Cairo')::date then raise exception 'najm: cannot close a future day'; end if;
    if exists (select 1 from najm_day_closes where day = k_day and gkey = gk and closed_by is not null) then
      raise exception 'najm: day already closed'; end if;
    dl := public.najm_close_deadline(k_day, gk);
    if exists (select 1 from najm_day_closes where day = k_day and gkey = gk) then
      update najm_day_closes set closed_by = u.username, closed_at = now() where day = k_day and gkey = gk;  -- الخصم اتسجل قبل كده
    else
      select data into st from najm_settings where id = 1;
      pen := case when now() > dl and nullif(st->>'closeStart', '') is not null and k_day >= (st->>'closeStart')::date
                  then coalesce((st->>'lateClosePenalty')::numeric, 5) else 0 end;
      own := coalesce(public.najm_close_owners(gk), array[u.username]);
      insert into najm_day_closes(day, gkey, deadline, closed_by, closed_at, late_minutes, penalty, responsible)
        values (k_day, gk, dl, u.username, now(), greatest(0, (extract(epoch from now() - dl) / 60)::int), pen, case when pen > 0 then own end);
      perform public.najm_close_penalty(k_day, gk, own, pen);
    end if;
  elsif p_kind = 'emp_pin' then
    -- مدير التشغيل يحط / يغيّر الرقم السري لموظف (الموظف بيغيّره أول ما يدخل)
    if del then delete from najm_emp_pins where code = k_code;
    else
      if coalesce(p_data->>'pin', '') !~ '^\d{4,6}$' then raise exception 'najm: PIN must be 4-6 digits'; end if;
      s := md5(random()::text);
      insert into najm_emp_pins(code, salt, pin_hash, must_change)
        values (k_code, s, encode(sha256(convert_to(s || (p_data->>'pin'), 'UTF8')), 'hex'), true)
        on conflict (code) do update set salt = excluded.salt, pin_hash = excluded.pin_hash, must_change = true, updated_at = now();
      delete from najm_login_fails where username = 'emp:' || k_code;
    end if;
  elsif p_kind = 'emp_pins_generate' then
    -- أرقام سرية عشوائية (4 أرقام) للموظفين اللي ملهمش (أو للكل) — بترجع للتشغيل مرة واحدة عشان تتطبع وتتوزع
    ret := '{}'::jsonb;
    for er in select code from najm_employees where active
              and (coalesce((p_data->>'all')::boolean, false) or code not in (select code from najm_emp_pins)) loop
      s := lpad((floor(random() * 10000))::int::text, 4, '0');
      dpt := md5(random()::text);
      insert into najm_emp_pins(code, salt, pin_hash, must_change)
        values (er.code, dpt, encode(sha256(convert_to(dpt || s, 'UTF8')), 'hex'), true)
        on conflict (code) do update set salt = excluded.salt, pin_hash = excluded.pin_hash, must_change = true, updated_at = now();
      ret := ret || jsonb_build_object(er.code, s);
    end loop;
  elsif p_kind = 'captain' then
    if del then delete from najm_captains where month = p_key->>'month' and code = k_code and sku = p_key->>'sku';
    else insert into najm_captains(month, code, sku, name, target, pts, active, by_user)
      values (p_key->>'month', k_code, p_key->>'sku', p_data->>'name', coalesce((p_data->>'target')::numeric, 0),
              case when u.role = 'ops' then nullif(p_data->>'pts','')::numeric end,
              coalesce((p_data->>'active')::boolean, true), u.username)
      on conflict (month, code, sku) do update set name = excluded.name, target = excluded.target, active = excluded.active,
        pts = case when u.role = 'ops' then excluded.pts else najm_captains.pts end,
        by_user = excluded.by_user, updated_at = now(); end if;
  elsif p_kind = 'settings' then
    insert into najm_settings(id, data) values (1, p_data)
    on conflict (id) do update set data = excluded.data, updated_at = now();
  elsif p_kind = 'private' then
    insert into najm_private(id, data) values (1, p_data) on conflict (id) do update set data = excluded.data;
  elsif p_kind = 'user' then
    s := lower(trim(p_key->>'username'));
    if s is null or s = '' then raise exception 'najm: username required'; end if;
    if del then
      if s = u.username then raise exception 'najm: cannot delete yourself'; end if;
      delete from najm_users where username = s;
    else
      insert into najm_users(username, name, role, branch, shift, depts, active, salt, pin_hash)
        values (s, coalesce(p_data->>'name', s), p_data->>'role', nullif(p_data->>'branch',''), nullif(p_data->>'shift',''),
                case when p_data ? 'depts' then array(select jsonb_array_elements_text(p_data->'depts')) end,
                coalesce((p_data->>'active')::boolean, true), md5(random()::text), '!')
      on conflict (username) do update set name = excluded.name, role = excluded.role, branch = excluded.branch,
        shift = excluded.shift, depts = excluded.depts, active = excluded.active, updated_at = now();
      if coalesce(p_data->>'pin','') <> '' then
        update najm_users set salt = md5(random()::text) where username = s;
        update najm_users set pin_hash = encode(sha256(convert_to(salt || (p_data->>'pin'), 'UTF8')), 'hex') where username = s;
      elsif (select pin_hash from najm_users where username = s) = '!' then
        raise exception 'najm: PIN required for a new user';
      end if;
    end if;
  else
    raise exception 'najm: unknown kind %', p_kind;
  end if;

  -- السجل (History): كل عملية باللي عملها والوقت — من غير أرقام سرية
  insert into najm_history(actor, kind, code, day, gkey, data)
    values (u.username, p_kind, k_code, k_day, gk,
            case when p_kind in ('sales', 'base_sales', 'emp_pins_generate') then jsonb_build_object('key', p_key)
                 when p_kind in ('user', 'emp_pin') then jsonb_build_object('key', p_key, 'data', case when del then null else p_data - 'pin' end)
                 else jsonb_build_object('key', p_key, 'data', p_data) end);

  if p_kind in ('att','rate','bonus') then
    select * into r from najm_ratings where day = k_day and code = k_code;
    select dept into dpt from najm_employees where code = k_code;
    select data into st from najm_settings where id = 1;
    return jsonb_build_object('row', jsonb_build_object('att', r.att, 'att_time', r.att_time, 'br', r.br, 'sh', r.sh,
      'fr', r.fr, 'ops', r.ops, 'hy', r.hy, 'bonus', r.bonus, 'bonus_note', r.bonus_note), 'score', public.najm_score(r, dpt, st));
  end if;
  return ret;
end $$;

grant execute on function public.najm_save(text, text, text, jsonb, jsonb) to anon, authenticated;

create or replace function public.najm_files(p_user text, p_pin text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  -- wrong PIN: return (not raise) so the failed attempt counted by najm_auth is kept (5 → 15-minute lock)
  if u.username is null then return jsonb_build_object('error', 'najm: login required'); end if;
  return jsonb_build_object(
    'complaints', coalesce((select jsonb_agg(to_jsonb(c)) from najm_complaints c where public.najm_in_scope(u, c.code)), '[]'),
    'notes',      coalesce((select jsonb_agg(to_jsonb(n)) from najm_notes n where public.najm_in_scope(u, n.code)), '[]'),
    'private',    case when u.role = 'ops' then (select data from najm_private where id = 1) end,
    'cards',      coalesce((select jsonb_agg(to_jsonb(k)) from najm_cards k where public.najm_in_scope(u, k.code)), '[]'),
    'appeals',    coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('card_by', k.by_user, 'card_day', k.day, 'card_color', k.color, 'card_reason', k.reason)
                    order by a.created_at desc) from najm_card_appeals a join najm_cards k on k.id = a.card_id
                    where public.najm_in_scope(u, a.code) or k.by_user = u.username), '[]'),
    'pins',       case when u.role = 'ops' then (select jsonb_object_agg(code, must_change) from najm_emp_pins) end,
    'users',      case when u.role = 'ops' then (select jsonb_agg(jsonb_build_object('username',x.username,'name',x.name,'role',x.role,
                    'branch',x.branch,'shift',x.shift,'depts',x.depts,'active',x.active) order by x.role, x.username) from najm_users x) end);
end $$;

grant execute on function public.najm_files(text, text) to anon, authenticated;

alter function public.najm_files(text, text) volatile;
