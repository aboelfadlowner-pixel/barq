-- =====================================================================
--  30 — «الشات» between the call center and the drivers, ready messages,
--       automatic messages, and «اتصل بـ…» numbers for the drivers.
--
--  CONFIRMED:
--   • One conversation per driver. Each driver sees ONLY his own; the call
--     center and the admin see every driver's (the branch/prep does not).
--   • A message can be about one of his orders (it carries the order number).
--   • Ready messages are plain text chosen on the screen (one tap); typing is
--     allowed too (500 characters at most, 20 messages a minute at most).
--   • Automatic messages (written by the system, not by a person):
--       «🛵 خرج بـ …»            when he taps «خرجت» (one line per trip),
--       «✅ سلّم …»               when he taps «سلّمت»,
--       «↩️ رجع الفرع»           when he taps «رجعت الفرع» (once),
--       «⚠️ … اتلغى — رجّعه للفرع» when an order with him is cancelled (he is alerted).
--     They never stop the order itself: any problem writing one is ignored.
--   • «اتصل بـ…»: numbers the admin keeps (e.g. «الكول سنتر», «أ. حسن») — the
--     driver taps one and his phone calls it.
--
--  CALL-CENTER ONLY: three new tables and new functions, plus two triggers
--  that only ADD chat lines (on cc_orders and cc_order_delivery). Nothing is
--  dropped, deleted or changed in existing data. Safe to re-run.
-- =====================================================================

create table if not exists public.cc_chat_messages (
  id          bigint generated always as identity primary key,
  driver_id   uuid not null references auth.users(id),           -- whose conversation
  sender_id   uuid references auth.users(id),                    -- null for automatic lines
  sender_role text not null check (sender_role in ('driver', 'staff', 'system')),
  sender_name text,
  order_id    uuid references public.cc_orders(id) on delete set null,
  order_no    text,
  body        text not null check (char_length(btrim(body)) between 1 and 500),
  notify      boolean not null default false,                    -- an automatic line the driver must see
  trip_id     uuid,                                              -- «خرج بـ …»: one line per trip
  kind        text not null default 'text' check (kind in ('text', 'out', 'delivered', 'returned', 'cancelled')),
  created_at  timestamptz not null default clock_timestamp()
);
create index if not exists cc_chat_messages_driver_idx on public.cc_chat_messages (driver_id, id);
create index if not exists cc_chat_messages_sender_idx on public.cc_chat_messages (sender_id, created_at);

-- What each side has read (the call center reads as one: any employee marks it read).
create table if not exists public.cc_chat_reads (
  driver_id    uuid not null references auth.users(id),
  side         text not null check (side in ('staff', 'driver')),
  last_read_id bigint not null default 0,
  primary key (driver_id, side)
);

create table if not exists public.cc_contact_numbers (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (char_length(btrim(label)) between 1 and 40),
  phone      text not null check (phone ~ '^[0-9+]{3,20}$'),
  sort       integer not null default 0,
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.cc_chat_messages   enable row level security;
alter table public.cc_chat_reads      enable row level security;
alter table public.cc_contact_numbers enable row level security;
revoke all on public.cc_chat_messages, public.cc_chat_reads, public.cc_contact_numbers from anon, authenticated, public;

-- One message as the screens read it.
create or replace function public.cc_chat_json(m public.cc_chat_messages)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('id', m.id, 'driver_id', m.driver_id, 'from', m.sender_role, 'name', m.sender_name,
    'order_id', m.order_id, 'order_no', m.order_no, 'body', m.body, 'kind', m.kind, 'notify', m.notify, 'at', m.created_at,
    'mine', m.sender_id is not null and m.sender_id = auth.uid())
$$;
revoke all on function public.cc_chat_json(public.cc_chat_messages) from public, anon, authenticated;

-- Send. A driver writes in his own conversation (p_driver is ignored); the call center / admin
-- write to the driver they choose. p_order: one of HIS orders (optional).
create or replace function public.cc_chat_send(p_driver uuid, p_body text, p_order uuid default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role text := public.cc_my_role();
  v_driver uuid;
  v_name text;
  v_no text;
  v_body text := btrim(coalesce(p_body, ''));
  v_msg public.cc_chat_messages;
begin
  if v_role = 'driver' then
    perform public.cc_require_driver();
    v_driver := auth.uid();
    v_name := (select nullif(btrim(display_name), '') from public.cc_staff where user_id = auth.uid());
  elsif v_role in ('call_center', 'admin') then
    if not exists (select 1 from public.cc_staff where user_id = p_driver and role = 'driver') then
      raise exception 'الطيار غير موجود' using errcode = 'P0002';
    end if;
    v_driver := p_driver;
    v_name := coalesce((select a.name from public.cc_staff s join public.cc_agents a on a.id = s.agent_id where s.user_id = auth.uid()),
                       (select nullif(btrim(display_name), '') from public.cc_staff where user_id = auth.uid()), 'الكول سنتر');
  else
    raise exception 'الشات للكول سنتر والطيارين بس' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 500 then
    raise exception 'اكتب الرسالة (لحد 500 حرف)' using errcode = '22023', hint = 'body';
  end if;
  if (select count(*) from public.cc_chat_messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'رسايل كتير ورا بعض — استنى دقيقة' using errcode = '22023', hint = 'rate';
  end if;
  if p_order is not null then
    select order_no into v_no from public.cc_orders where id = p_order and driver_user_id = v_driver;
    if v_no is null then
      raise exception 'الطلب ده مش مع الطيار ده' using errcode = '22023', hint = 'order';
    end if;
  end if;
  insert into public.cc_chat_messages (driver_id, sender_id, sender_role, sender_name, order_id, order_no, body)
  values (v_driver, auth.uid(), case when v_role = 'driver' then 'driver' else 'staff' end, v_name, p_order, v_no, v_body)
  returning * into v_msg;
  -- what I write I have read
  insert into public.cc_chat_reads (driver_id, side, last_read_id)
  values (v_driver, case when v_role = 'driver' then 'driver' else 'staff' end, v_msg.id)
  on conflict (driver_id, side) do update set last_read_id = greatest(public.cc_chat_reads.last_read_id, excluded.last_read_id);
  return public.cc_chat_json(v_msg);
end;
$$;

-- One conversation (the newest 200, or those after p_after). Reading marks it read for my side.
create or replace function public.cc_chat_thread(p_driver uuid default null, p_after bigint default 0)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role text := public.cc_my_role();
  v_driver uuid;
  v_side text;
  v_last bigint;
  v_list jsonb;
begin
  if v_role = 'driver' then
    perform public.cc_require_driver();
    v_driver := auth.uid(); v_side := 'driver';
  elsif v_role in ('call_center', 'admin') then
    v_driver := p_driver; v_side := 'staff';
    if not exists (select 1 from public.cc_staff where user_id = v_driver and role = 'driver') then
      raise exception 'الطيار غير موجود' using errcode = 'P0002';
    end if;
  else
    raise exception 'الشات للكول سنتر والطيارين بس' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(public.cc_chat_json(m) order by m.id), '[]'::jsonb), max(m.id) into v_list, v_last
    from (select * from public.cc_chat_messages
           where driver_id = v_driver and id > coalesce(p_after, 0)
           order by id desc limit 200) m;
  if v_last is not null then
    insert into public.cc_chat_reads (driver_id, side, last_read_id) values (v_driver, v_side, v_last)
    on conflict (driver_id, side) do update set last_read_id = greatest(public.cc_chat_reads.last_read_id, excluded.last_read_id);
  end if;
  return jsonb_build_object('driver_id', v_driver, 'messages', v_list);
end;
$$;

-- What is new. Driver: how many messages for him he has not read.
-- Call center / admin: per driver (name, last line, unread), the total, the newest unread
-- message (for the alert), and the orders with an unread driver message (💬 on the board).
create or replace function public.cc_chat_unread()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role text := public.cc_my_role();
  v_read bigint;
begin
  if v_role = 'driver' then
    perform public.cc_require_driver();
    v_read := coalesce((select last_read_id from public.cc_chat_reads where driver_id = auth.uid() and side = 'driver'), 0);
    return jsonb_build_object('unread', (select count(*) from public.cc_chat_messages
             where driver_id = auth.uid() and id > v_read and (sender_role = 'staff' or notify)));
  elsif v_role not in ('call_center', 'admin') then
    raise exception 'الشات للكول سنتر والطيارين بس' using errcode = '42501';
  end if;
  return (
    with d as (
      select s.user_id, coalesce(nullif(btrim(s.display_name), ''), 'طيار') as name, s.phone, s.active,
             coalesce(r.last_read_id, 0) as read_id
        from public.cc_staff s left join public.cc_chat_reads r on r.driver_id = s.user_id and r.side = 'staff'
       where s.role = 'driver'
    ), u as (
      select m.* from public.cc_chat_messages m join d on d.user_id = m.driver_id
       where m.sender_role = 'driver' and m.id > d.read_id
    )
    select jsonb_build_object(
      'unread', (select count(*) from u),
      'newest', (select public.cc_chat_json(x) || jsonb_build_object('driver_name', (select name from d where d.user_id = x.driver_id))
                   from public.cc_chat_messages x where x.id = (select max(id) from u)),
      'orders', coalesce((select jsonb_agg(distinct order_id) from u where order_id is not null), '[]'::jsonb),
      'drivers', coalesce((select jsonb_agg(jsonb_build_object(
                   'id', d.user_id, 'name', d.name, 'phone', d.phone, 'active', d.active,
                   'unread', (select count(*) from u where u.driver_id = d.user_id),
                   'last', (select public.cc_chat_json(l) from public.cc_chat_messages l where l.driver_id = d.user_id order by l.id desc limit 1))
                 order by (select max(id) from public.cc_chat_messages l where l.driver_id = d.user_id) desc nulls last, d.name)
                 from d where d.active or exists (select 1 from public.cc_chat_messages l where l.driver_id = d.user_id)), '[]'::jsonb))
  );
end;
$$;

-- «اتصل بـ…» numbers. Drivers and the call center read the active ones; the admin reads all.
create or replace function public.cc_contact_numbers()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_role text := public.cc_my_role();
begin
  if coalesce(v_role, '') not in ('driver', 'call_center', 'admin') then
    raise exception 'غير مسموح' using errcode = '42501';
  end if;
  if v_role = 'driver' then perform public.cc_require_driver(); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'phone', phone, 'sort', sort, 'active', active) order by sort, label)
                     from public.cc_contact_numbers where active or v_role = 'admin'), '[]'::jsonb);
end;
$$;

-- Admin: add (p_id null) or change a number; «stop» with p_active = false (nothing is deleted).
create or replace function public.cc_save_contact_number(p_id uuid, p_label text, p_phone text, p_active boolean default true, p_sort integer default 0)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  v_row public.cc_contact_numbers;
begin
  if not public.cc_is_admin() then
    raise exception 'الأرقام للأدمن بس' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_label, ''))) not between 1 and 40 then
    raise exception 'اكتب الاسم (لحد 40 حرف)' using errcode = '22023', hint = 'label';
  end if;
  if v_phone !~ '^[0-9+]{3,20}$' then
    raise exception 'رقم غير صحيح' using errcode = '22023', hint = 'phone';
  end if;
  if p_id is null then
    insert into public.cc_contact_numbers (label, phone, sort, active, updated_by)
    values (btrim(p_label), v_phone, coalesce(p_sort, 0), coalesce(p_active, true), auth.uid()) returning * into v_row;
  else
    update public.cc_contact_numbers set label = btrim(p_label), phone = v_phone, sort = coalesce(p_sort, sort),
           active = coalesce(p_active, active), updated_at = now(), updated_by = auth.uid()
     where id = p_id returning * into v_row;
    if not found then raise exception 'الرقم غير موجود' using errcode = 'P0002'; end if;
  end if;
  return jsonb_build_object('id', v_row.id, 'label', v_row.label, 'phone', v_row.phone, 'sort', v_row.sort, 'active', v_row.active);
end;
$$;

-- ---------------------------------------------------------------------
-- Automatic lines. They only ADD a chat line and never stop the order.
-- ---------------------------------------------------------------------
create or replace function public.cc_chat_auto_order()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_nos text;
  v_n int;
begin
  begin
    -- «خرجت»: one line per trip, listing its orders
    if new.stage = 'out' and old.stage is distinct from 'out' and new.driver_user_id is not null and new.status <> 'cancelled' then
      select id into v_id from public.cc_chat_messages
       where driver_id = new.driver_user_id and kind = 'out' and trip_id is not distinct from new.trip_id
         and new.trip_id is not null and created_at > now() - interval '1 hour'
       order by id desc limit 1;
      if v_id is null then
        insert into public.cc_chat_messages (driver_id, sender_role, sender_name, order_id, order_no, body, kind, trip_id)
        values (new.driver_user_id, 'system', 'السيستم', new.id, new.order_no, '🛵 خرج بـ ' || new.order_no, 'out', new.trip_id);
      else
        select string_agg(order_no, '، ' order by trip_seq nulls last, order_no), count(*) into v_nos, v_n
          from public.cc_orders where trip_id = new.trip_id and stage = 'out';
        update public.cc_chat_messages
           set body = '🛵 خرج بـ ' || v_n || ' طلبات: ' || v_nos, order_id = null, order_no = null
         where id = v_id;
      end if;
    end if;
    -- cancelled while the driver has it: he is alerted
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.driver_user_id is not null
       and new.stage in ('at_cashier', 'out') then
      insert into public.cc_chat_messages (driver_id, sender_role, sender_name, order_id, order_no, body, kind, notify)
      values (new.driver_user_id, 'system', 'السيستم', new.id, new.order_no,
              '⚠️ ' || new.order_no || ' اتلغى' || case when new.stage = 'out' then ' — رجّعه للفرع' else '' end, 'cancelled', true);
    end if;
  exception when others then
    null;   -- never stop the order because of the chat
  end;
  return new;
end;
$$;

create or replace function public.cc_chat_auto_delivery()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o public.cc_orders;
begin
  begin
    select * into v_o from public.cc_orders where id = new.order_id;
    if v_o.driver_user_id is null then return new; end if;
    if new.delivered_at is not null and (tg_op = 'INSERT' or old.delivered_at is null) then
      insert into public.cc_chat_messages (driver_id, sender_role, sender_name, order_id, order_no, body, kind)
      values (v_o.driver_user_id, 'system', 'السيستم', v_o.id, v_o.order_no, '✅ سلّم ' || v_o.order_no, 'delivered');
    end if;
    if new.returned_at is not null and (tg_op = 'INSERT' or old.returned_at is null)
       and not exists (select 1 from public.cc_chat_messages where driver_id = v_o.driver_user_id and kind = 'returned'
                        and created_at > now() - interval '2 minutes') then
      insert into public.cc_chat_messages (driver_id, sender_role, sender_name, body, kind)
      values (v_o.driver_user_id, 'system', 'السيستم', '↩️ رجع الفرع', 'returned');
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace trigger cc_chat_auto_order after update of stage, status on public.cc_orders
  for each row execute function public.cc_chat_auto_order();
create or replace trigger cc_chat_auto_delivery after insert or update of delivered_at, returned_at on public.cc_order_delivery
  for each row execute function public.cc_chat_auto_delivery();

revoke all on function public.cc_chat_auto_order()    from public, anon, authenticated;
revoke all on function public.cc_chat_auto_delivery() from public, anon, authenticated;
revoke all on function public.cc_chat_send(uuid, text, uuid)                              from public, anon;
revoke all on function public.cc_chat_thread(uuid, bigint)                                from public, anon;
revoke all on function public.cc_chat_unread()                                            from public, anon;
revoke all on function public.cc_contact_numbers()                                        from public, anon;
revoke all on function public.cc_save_contact_number(uuid, text, text, boolean, integer) from public, anon;
grant execute on function public.cc_chat_send(uuid, text, uuid)                              to authenticated;
grant execute on function public.cc_chat_thread(uuid, bigint)                                to authenticated;
grant execute on function public.cc_chat_unread()                                            to authenticated;
grant execute on function public.cc_contact_numbers()                                        to authenticated;
grant execute on function public.cc_save_contact_number(uuid, text, text, boolean, integer) to authenticated;
