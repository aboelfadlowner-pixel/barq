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

create or replace function public.najm_payout_save(p_user text, p_pin text, p_id text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare u najm_users;
begin
  select * into u from public.najm_auth(p_user, p_pin);
  -- wrong PIN: return (not raise) so the failed attempt counted by najm_auth is kept (5 → 15-minute lock)
  if u.username is null then return; end if;
  if u.role <> 'ops' then raise exception 'najm: operations manager only' using errcode = '42501'; end if;
  if p_data is null or p_data = 'null'::jsonb then delete from najm_payouts where id = p_id; return; end if;
  insert into najm_payouts(id, month, code, kind, ref, amount, by_user)
    values (p_id, p_data->>'month', p_data->>'code', p_data->>'kind', p_data->>'ref', (p_data->>'amount')::numeric, u.username)
    on conflict (id) do nothing;
end $$;

grant execute on function public.najm_payout_save(text, text, text, jsonb) to anon, authenticated;
