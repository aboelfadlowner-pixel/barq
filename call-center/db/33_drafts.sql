-- =====================================================================
--  33 — «مسودة» in the database: drafts are seen by the admin and kept
--       for the employee on any device; several drafts at a time.
--
--  CONFIRMED:
--   • The order being written is saved as a draft every few seconds (customer,
--     address, items, notes) under the draft's own id — the same id the order
--     gets when it is sent, so a sent draft disappears by itself.
--   • Each employee sees and continues HIS drafts (from any device); the admin
--     sees EVERYONE's drafts with the employee's name (to look at, not to edit).
--   • «إلغاء المسودة» removes it; a draft is forgotten after 12 hours.
--   • At most 20 open drafts per employee; a draft is at most 200 KB.
--
--  CALL-CENTER ONLY: one new table and three new functions. Nothing existing is
--  changed or deleted. Safe to re-run.
-- =====================================================================

create table if not exists public.cc_drafts (
  id          uuid primary key,                        -- = the order's client_request_id when sent
  user_id     uuid not null references auth.users(id), -- whose draft
  agent_name  text,                                    -- the employee name shown on the card
  data        jsonb not null,                          -- { customer, address, cart, orderNote }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cc_drafts_user_idx on public.cc_drafts (user_id, updated_at desc);
alter table public.cc_drafts enable row level security;
revoke all on public.cc_drafts from anon, authenticated, public;

-- Save (add or update) one of MY drafts.
create or replace function public.cc_draft_save(p_id uuid, p_data jsonb, p_agent_name text default null)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_at timestamptz := now();
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'المسودات للكول سنتر بس' using errcode = '42501';
  end if;
  if p_id is null or p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'مسودة غير صحيحة' using errcode = '22023';
  end if;
  if octet_length(p_data::text) > 200000 then
    raise exception 'المسودة كبيرة جدًا' using errcode = '22023';
  end if;
  if exists (select 1 from public.cc_orders where client_request_id = p_id) then
    return v_at;                                   -- already sent: nothing to keep
  end if;
  select user_id into v_owner from public.cc_drafts where id = p_id;
  if v_owner is not null and v_owner <> auth.uid() then
    raise exception 'المسودة دي بتاعة موظف تاني' using errcode = '42501';
  end if;
  if v_owner is null and (select count(*) from public.cc_drafts
                           where user_id = auth.uid() and updated_at > now() - interval '12 hours') >= 20 then
    raise exception 'عندك مسودات كتير مفتوحة — كمّل أو الغي القديمة الأول' using errcode = '22023', hint = 'too_many';
  end if;
  insert into public.cc_drafts (id, user_id, agent_name, data, updated_at)
  values (p_id, auth.uid(), left(btrim(coalesce(p_agent_name, '')), 60), p_data, v_at)
  on conflict (id) do update set data = excluded.data, agent_name = excluded.agent_name, updated_at = v_at;
  return v_at;
end;
$$;

-- Remove one of MY drafts («إلغاء المسودة», or after sending).
create or replace function public.cc_draft_delete(p_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'المسودات للكول سنتر بس' using errcode = '42501';
  end if;
  delete from public.cc_drafts where id = p_id and user_id = auth.uid();
  return found;
end;
$$;

-- The open drafts: mine (to continue) — and, for the admin, everyone's (to look at).
-- Not sent yet and changed in the last 12 hours, newest first.
create or replace function public.cc_draft_list()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.cc_is_admin();
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'المسودات للكول سنتر بس' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'mine', d.user_id = auth.uid(),
             'agent_name', coalesce(nullif(d.agent_name, ''), public.cc_person_name(d.user_id)),
             'data', d.data, 'created_at', d.created_at, 'updated_at', d.updated_at)
           order by d.updated_at desc)
      from public.cc_drafts d
     where (d.user_id = auth.uid() or v_admin)
       and d.updated_at > now() - interval '12 hours'
       and not exists (select 1 from public.cc_orders o where o.client_request_id = d.id)), '[]'::jsonb);
end;
$$;

revoke all on function public.cc_draft_save(uuid, jsonb, text) from public, anon;
revoke all on function public.cc_draft_delete(uuid)            from public, anon;
revoke all on function public.cc_draft_list()                  from public, anon;
grant execute on function public.cc_draft_save(uuid, jsonb, text) to authenticated;
grant execute on function public.cc_draft_delete(uuid)            to authenticated;
grant execute on function public.cc_draft_list()                  to authenticated;
