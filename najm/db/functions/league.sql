-- نجم أبو الفضل — دوري المديرين وسوق الانتقالات — النسخة الحالية من كل دالة (create or replace)

create function public.najm_public_users()
returns table(username text, name text, role text, branch text, shift text, depts text[], emp_code text)
language sql stable security definer set search_path = public as $$
  select username, name, role, branch, shift, depts, emp_code from najm_users where active order by role, username;
$$;

grant execute on function public.najm_public_users() to anon, authenticated;

create or replace function public.najm_mgr_points(p_from date, p_to date)
returns table(day date, username text, pts int)
language sql stable security definer set search_path = public as $$
  select day, username, (select coalesce(sum(x),0) from unnest(crit) x)::int from najm_mgr_ratings where day between p_from and p_to;
$$;

grant execute on function public.najm_mgr_points(date, date) to anon, authenticated;

create or replace function public.najm_market_list()
returns table(id text, month text, code text, wish jsonb, status text, chosen text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, month, code, wish, status, chosen, created_at from najm_market order by created_at desc limit 20;
$$;

grant execute on function public.najm_market_list() to anon, authenticated;

create or replace function public.najm_balance(p_user text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(points),0) from najm_mgr_ledger where username = p_user;
$$;

grant execute on function public.najm_balance(text) to anon, authenticated;

-- the player (employee of the month) acts with the one-time secret code
create or replace function public.najm_market_player(p_id text, p_secret text, p_action text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m najm_market;
begin
  select * into m from najm_market where id = p_id for update;
  if m.id is null then raise exception 'najm: market not found'; end if;
  if m.fails >= 10 then raise exception 'najm: market locked, ask operations'; end if;
  if m.secret_hash <> encode(sha256(convert_to(m.salt || coalesce(p_secret,''), 'UTF8')), 'hex') then
    update najm_market set fails = fails + 1 where id = p_id;
    return jsonb_build_object('ok', false, 'error', 'wrong code');
  end if;
  if p_action = 'wish' then
    if m.status not in ('open','listed') then raise exception 'najm: market already decided'; end if;
    update najm_market set wish = p_data, status = 'listed', updated_at = now() where id = p_id;
  elsif p_action = 'choose' then
    if m.status <> 'listed' then raise exception 'najm: market is not taking choices'; end if;
    if p_data->>'offer' <> 'stay' and not exists (select 1 from najm_offers where id = p_data->>'offer' and market_id = p_id) then
      raise exception 'najm: offer not found'; end if;
    update najm_market set chosen = p_data->>'offer', status = 'decided', updated_at = now() where id = p_id;
  elsif p_action <> 'view' then raise exception 'najm: unknown action';
  end if;
  update najm_market set fails = 0 where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.najm_market_player(text, text, text, jsonb) to anon, authenticated;

-- manager / operations actions on the market and the managers league
create or replace function public.najm_market_save(p_user text, p_pin text, p_kind text, p_key jsonb, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u najm_users; m najm_market; o najm_offers; s text; bal numeric; del boolean := p_data is null or p_data = 'null'::jsonb;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then raise exception 'najm: wrong username or PIN' using errcode = '28000'; end if;
  if p_kind in ('mgr_rate','ledger','market_open','market_approve','market_close','user_emp') and u.role <> 'ops' then
    raise exception 'najm: operations manager only' using errcode = '42501';
  end if;
  if p_kind = 'user_emp' then
    update najm_users set emp_code = nullif(p_data->>'emp_code',''), updated_at = now() where username = lower(trim(p_key->>'username'));
  elsif p_kind = 'mgr_rate' then
    if del then delete from najm_mgr_ratings where day = (p_key->>'day')::date and username = p_key->>'username';
    else insert into najm_mgr_ratings(day, username, crit)
      values ((p_key->>'day')::date, p_key->>'username', array(select (case when v = 'null'::jsonb then 0 else v::text::smallint end) from jsonb_array_elements(p_data) v))
      on conflict (day, username) do update set crit = excluded.crit, updated_at = now(); end if;
  elsif p_kind = 'ledger' then
    if del then delete from najm_mgr_ledger where id = p_key->>'id';
    else insert into najm_mgr_ledger(id, username, month, points, reason)
      values (p_key->>'id', p_data->>'username', p_data->>'month', (p_data->>'points')::numeric, p_data->>'reason')
      on conflict (id) do update set points = excluded.points, reason = excluded.reason; end if;
  elsif p_kind = 'market_open' then
    s := lpad((floor(random() * 1000000))::int::text, 6, '0');
    insert into najm_market(id, month, code, salt, secret_hash)
      values (p_key->>'id', p_data->>'month', p_data->>'code', md5(random()::text), '!')
      on conflict (id) do update set status = 'open', wish = null, chosen = null, fails = 0, updated_at = now();
    update najm_market set secret_hash = encode(sha256(convert_to(salt || s, 'UTF8')), 'hex') where id = p_key->>'id';
    return jsonb_build_object('secret', s);
  elsif p_kind = 'offer' then
    if u.role = 'ops' then raise exception 'najm: operations manager does not bid'; end if;
    select * into m from najm_market where id = p_key->>'market_id';
    if m.status <> 'listed' then raise exception 'najm: market is not taking offers'; end if;
    if now() > m.created_at + make_interval(days => coalesce(((select data from najm_settings where id = 1)->>'marketDays')::int, 5)) then
      raise exception 'najm: market deadline passed' using errcode = '42501'; end if;
    if del then delete from najm_offers where id = p_key->>'market_id' || '|' || u.username;
    else
      bal := public.najm_balance(u.username);
      if (p_data->>'points')::numeric > bal then raise exception 'najm: not enough points (balance %)', bal; end if;
      insert into najm_offers(id, market_id, username, points, branch, shift, note)
        values (p_key->>'market_id' || '|' || u.username, p_key->>'market_id', u.username, (p_data->>'points')::numeric,
                coalesce(u.branch, p_data->>'branch'), coalesce(u.shift, p_data->>'shift'), p_data->>'note')
        on conflict (id) do update set points = excluded.points, branch = excluded.branch, shift = excluded.shift, note = excluded.note, updated_at = now();
    end if;
  elsif p_kind = 'market_approve' then
    select * into m from najm_market where id = p_key->>'id' for update;
    if m.status <> 'decided' then raise exception 'najm: nothing to approve'; end if;
    if coalesce((p_data->>'approve')::boolean, false) then
      if m.chosen <> 'stay' then
        select * into o from najm_offers where id = m.chosen;
        insert into najm_mgr_ledger(id, username, month, points, reason)
          values ('transfer|' || m.id, o.username, m.month, -o.points, 'ضم ' || m.code)
          on conflict (id) do nothing;
        update najm_employees set branch = coalesce(o.branch, branch), shift = coalesce(o.shift, shift), updated_at = now() where code = m.code;
      end if;
      update najm_market set status = 'approved', updated_at = now() where id = m.id;
    else
      update najm_market set status = 'listed', chosen = null, updated_at = now() where id = m.id;
    end if;
  elsif p_kind = 'market_close' then
    update najm_market set status = 'closed', updated_at = now() where id = p_key->>'id';
  else raise exception 'najm: unknown kind %', p_kind;
  end if;
  return null;
end $$;

grant execute on function public.najm_market_save(text, text, text, jsonb, jsonb) to anon, authenticated;

-- operations reads the managers' daily criteria to edit them
create or replace function public.najm_mgr_ratings_full(p_user text, p_pin text, p_from date, p_to date)
returns table(day date, username text, crit smallint[])
language plpgsql stable security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then raise exception 'najm: login required' using errcode = '28000'; end if;
  return query select r.day, r.username, r.crit from najm_mgr_ratings r
    where r.day between p_from and p_to and (u.role = 'ops' or r.username = u.username);
end $$;

grant execute on function public.najm_mgr_ratings_full(text, text, date, date) to anon, authenticated;

alter function public.najm_mgr_ratings_full(text, text, date, date) volatile;
