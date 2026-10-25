-- الكول سنتر بس: «فك الحظر» للأدمن بس — بيبدّل دالة واحدة، مفيش مسح لأي داتا وقت التشغيل
begin;
set local lock_timeout = '5s';

create or replace function public.cc_set_blocked(p_phones text[], p_blocked boolean)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_phones text[];
  v_name   text;
  v_n      integer;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  select array_agg(distinct btrim(p)) into v_phones
    from unnest(coalesce(p_phones, '{}'::text[])) p where nullif(btrim(p), '') is not null;
  if v_phones is null then
    raise exception 'لا يوجد رقم' using errcode = '22023', hint = 'phone';
  end if;
  if exists (select 1 from unnest(v_phones) p where p !~ '^0[0-9]{8,10}$') then
    raise exception 'رقم غير صحيح' using errcode = '22023', hint = 'phone';
  end if;
  if not p_blocked and not public.cc_is_admin() then
    raise exception 'فك الحظر للأدمن بس' using errcode = '42501';
  end if;

  if p_blocked then
    select coalesce(a.name, u.email::text) into v_name
      from public.cc_staff s
      left join public.cc_agents a on a.id = s.agent_id
      left join auth.users u on u.id = s.user_id
     where s.user_id = auth.uid();
    insert into public.cc_blocked_phones (phone, source, blocked_by, blocked_by_name)
    select p, 'call_center', auth.uid(), v_name from unnest(v_phones) p
    on conflict (phone) do nothing;
  else
    delete from public.cc_blocked_phones where phone = any (v_phones);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.cc_set_blocked(text[], boolean) from public, anon;
grant execute on function public.cc_set_blocked(text[], boolean) to authenticated;
commit;

select count(*) as blocked_numbers from public.cc_blocked_phones;
