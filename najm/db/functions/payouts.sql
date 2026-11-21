-- نجم أبو الفضل — صرف الجوايز — النسخة الحالية من كل دالة (create or replace)

create or replace function public.najm_payouts_list(p_user text, p_pin text, p_month text)
returns setof public.najm_payouts language plpgsql security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  -- wrong PIN: return (not raise) so the failed attempt counted by najm_auth is kept (5 → 15-minute lock)
  if u.username is null then return; end if;
  if u.role <> 'ops' then raise exception 'najm: operations manager only' using errcode = '42501'; end if;
  return query select * from najm_payouts where month = p_month order by paid_at;
end $$;

grant execute on function public.najm_payouts_list(text, text, text) to anon, authenticated;

-- تسجيل الصرف، والتصحيح المالي: إلغاء صرف اتسجل لازم بسبب، والسجل بيحفظ الصرف القديم ومين ألغاه وليه
create or replace function public.najm_payout_save(p_user text, p_pin text, p_id text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare u najm_users; o najm_payouts;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  -- wrong PIN: return (not raise) so the failed attempt counted by najm_auth is kept (5 → 15-minute lock)
  if u.username is null then return; end if;
  if u.role <> 'ops' then raise exception 'najm: operations manager only' using errcode = '42501'; end if;
  if p_data is null or p_data = 'null'::jsonb or coalesce((p_data->>'undo')::boolean, false) then
    if coalesce(trim(p_data->>'reason'), '') = '' then raise exception 'najm: reason required to undo a payout'; end if;
    select * into o from najm_payouts where id = p_id;
    if o.id is null then raise exception 'najm: payout not found'; end if;
    delete from najm_payouts where id = p_id;
    insert into najm_history(actor, kind, code, data) values (u.username, 'payout_undo', o.code, jsonb_build_object('old', to_jsonb(o), 'reason', trim(p_data->>'reason')));
    return;
  end if;
  insert into najm_payouts(id, month, code, kind, ref, amount, by_user)
    values (p_id, p_data->>'month', p_data->>'code', p_data->>'kind', p_data->>'ref', (p_data->>'amount')::numeric, u.username)
    on conflict (id) do nothing;
  if found then
    insert into najm_history(actor, kind, code, data) values (u.username, 'payout', p_data->>'code', jsonb_build_object('id', p_id, 'data', p_data));
  end if;
end $$;

grant execute on function public.najm_payout_save(text, text, text, jsonb) to anon, authenticated;

-- سجل الصرف والتصحيحات المالية (لمدير التشغيل بس)
create or replace function public.najm_payout_log(p_user text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  if u.username is null then return jsonb_build_object('error', 'najm: login required'); end if;
  if u.role <> 'ops' then return jsonb_build_object('error', 'najm: operations manager only'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('at', h.at, 'actor', h.actor, 'actor_name', coalesce(x.name, h.actor), 'kind', h.kind, 'code', h.code, 'data', h.data) order by h.at desc)
    from (select * from najm_history where kind in ('payout', 'payout_undo') order by at desc limit 200) h
    left join najm_users x on x.username = h.actor), '[]'::jsonb);
end $$;
grant execute on function public.najm_payout_log(text, text) to anon, authenticated;
