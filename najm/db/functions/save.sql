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
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then raise exception 'najm: wrong username or PIN' using errcode = '28000'; end if;

  if u.role = 'hygiene' and p_kind <> 'rate' then
    raise exception 'najm: hygiene rates only' using errcode = '42501';
  end if;
  if p_kind in ('winners','target','base_sales','complaint','employee','media','settings','private','user','card_approve')
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
               where w.day = k_day and w.gkey = e.branch || '|' || e.shift)) then
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
    if del then
      delete from najm_cards where id = p_key->>'id' and code = k_code
        and (u.role = 'ops' or (by_user = u.username and not approved));
    else
      if p_data->>'color' not in ('yellow','red','green') then raise exception 'najm: bad card color'; end if;
      insert into najm_cards(id, day, code, color, reason, by_user, approved, approved_by)
        values (p_key->>'id', (p_data->>'date')::date, k_code, p_data->>'color', p_data->>'reason', u.username,
                (p_data->>'color') <> 'red' or u.role = 'ops', case when u.role = 'ops' then u.username end)
      on conflict (id) do nothing;
    end if;
  elsif p_kind = 'card_approve' then
    if coalesce((p_data->>'approved')::boolean, false) then
      update najm_cards set approved = true, approved_by = u.username where id = p_key->>'id';
    else
      delete from najm_cards where id = p_key->>'id';
    end if;
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

  if p_kind in ('att','rate','bonus') then
    select * into r from najm_ratings where day = k_day and code = k_code;
    select dept into dpt from najm_employees where code = k_code;
    select data into st from najm_settings where id = 1;
    return jsonb_build_object('row', jsonb_build_object('att', r.att, 'att_time', r.att_time, 'br', r.br, 'sh', r.sh,
      'fr', r.fr, 'ops', r.ops, 'hy', r.hy, 'bonus', r.bonus, 'bonus_note', r.bonus_note), 'score', public.najm_score(r, dpt, st));
  end if;
  return null;
end $$;

grant execute on function public.najm_save(text, text, text, jsonb, jsonb) to anon, authenticated;

create or replace function public.najm_files(p_user text, p_pin text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then raise exception 'najm: login required' using errcode = '28000'; end if;
  return jsonb_build_object(
    'complaints', coalesce((select jsonb_agg(to_jsonb(c)) from najm_complaints c where public.najm_in_scope(u, c.code)), '[]'),
    'notes',      coalesce((select jsonb_agg(to_jsonb(n)) from najm_notes n where public.najm_in_scope(u, n.code)), '[]'),
    'private',    case when u.role = 'ops' then (select data from najm_private where id = 1) end,
    'cards',      coalesce((select jsonb_agg(to_jsonb(k)) from najm_cards k where public.najm_in_scope(u, k.code)), '[]'),
    'users',      case when u.role = 'ops' then (select jsonb_agg(jsonb_build_object('username',x.username,'name',x.name,'role',x.role,
                    'branch',x.branch,'shift',x.shift,'depts',x.depts,'active',x.active) order by x.role, x.username) from najm_users x) end);
end $$;

grant execute on function public.najm_files(text, text) to anon, authenticated;

alter function public.najm_files(text, text) volatile;
