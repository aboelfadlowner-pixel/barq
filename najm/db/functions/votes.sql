-- نجم أبو الفضل — تصويت الموظفين لأحسن مدير — النسخة الحالية من كل دالة (create or replace)

-- الموظف بيصوّت بكوده + رقمه السري (صوت واحد لكل كود ولكل جهاز في الشهر)
drop function if exists public.najm_vote(text, text, text);
create or replace function public.najm_vote(p_code text, p_pin text, p_device text, p_manager text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e najm_employees; u najm_users; m text := to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM');
  ip text := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
begin
  -- التصويت بكود البصمة بس: صوت واحد لكل كود في الشهر (ولكل جهاز)، ومش بيتغيّر بعد ما يتسجل
  select * into e from najm_employees where code = trim(coalesce(p_code, '')) and active
    and not exists (select 1 from najm_users x where x.active and x.emp_code = trim(coalesce(p_code, '')));
  if e.code is null then return jsonb_build_object('ok', false, 'error', 'pin'); end if;
  if coalesce(length(p_device),0) < 16 then return jsonb_build_object('ok', false, 'error', 'device'); end if;
  select * into u from najm_users where username = p_manager and active and role in ('branch', 'shift', 'fresh') and (branch is null or branch = e.branch or e.branch = any(coalesce(branches, '{}')));   -- التصويت لمدير الفرع والشيفت والفريش فود بس
  if u.username is null then return jsonb_build_object('ok', false, 'error', 'manager'); end if;
  if u.emp_code = e.code then return jsonb_build_object('ok', false, 'error', 'self'); end if;
  if exists (select 1 from najm_votes where month = m and voter_code = e.code) then return jsonb_build_object('ok', false, 'error', 'voted'); end if;
  if exists (select 1 from najm_votes where month = m and device_id = p_device) then return jsonb_build_object('ok', false, 'error', 'device_used'); end if;
  insert into najm_votes(month, voter_code, device_id, ip, manager) values (m, e.code, p_device, nullif(ip,''), u.username);
  return jsonb_build_object('ok', true, 'month', m);
end $$;

grant execute on function public.najm_vote(text, text, text, text) to anon, authenticated;

create or replace function public.najm_vote_counts(p_month text)
returns table(username text, votes int, ips int)
language sql stable security definer set search_path = public as $$
  select manager, count(*)::int, count(distinct ip)::int from najm_votes where month = p_month group by manager;
$$;

grant execute on function public.najm_vote_counts(text) to anon, authenticated;
