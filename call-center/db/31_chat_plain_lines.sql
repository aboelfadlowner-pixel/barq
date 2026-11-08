-- =====================================================================
--  31 — «الشات»: the system's automatic lines without emoji.
--
--  CONFIRMED: «خرج بـ CC-1003» / «خرج بـ 2 طلبات: …», «سلّم CC-1003»,
--  «رجع الفرع», «CC-1003 اتلغى — رجّعه للفرع» — plain words, no emoji.
--  Lines already written keep their text.
--
--  CALL-CENTER ONLY: new bodies for the two functions of 30_driver_chat.sql
--  (same names, same triggers). Nothing is dropped or deleted. Safe to re-run.
-- =====================================================================

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
        values (new.driver_user_id, 'system', 'السيستم', new.id, new.order_no, 'خرج بـ ' || new.order_no, 'out', new.trip_id);
      else
        select string_agg(order_no, '، ' order by trip_seq nulls last, order_no), count(*) into v_nos, v_n
          from public.cc_orders where trip_id = new.trip_id and stage = 'out';
        update public.cc_chat_messages
           set body = 'خرج بـ ' || v_n || ' طلبات: ' || v_nos, order_id = null, order_no = null
         where id = v_id;
      end if;
    end if;
    -- cancelled while the driver has it: he is alerted
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.driver_user_id is not null
       and new.stage in ('at_cashier', 'out') then
      insert into public.cc_chat_messages (driver_id, sender_role, sender_name, order_id, order_no, body, kind, notify)
      values (new.driver_user_id, 'system', 'السيستم', new.id, new.order_no,
              new.order_no || ' اتلغى' || case when new.stage = 'out' then ' — رجّعه للفرع' else '' end, 'cancelled', true);
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
      values (v_o.driver_user_id, 'system', 'السيستم', v_o.id, v_o.order_no, 'سلّم ' || v_o.order_no, 'delivered');
    end if;
    if new.returned_at is not null and (tg_op = 'INSERT' or old.returned_at is null)
       and not exists (select 1 from public.cc_chat_messages where driver_id = v_o.driver_user_id and kind = 'returned'
                        and created_at > now() - interval '2 minutes') then
      insert into public.cc_chat_messages (driver_id, sender_role, sender_name, body, kind)
      values (v_o.driver_user_id, 'system', 'السيستم', 'رجع الفرع', 'returned');
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function public.cc_chat_auto_order()    from public, anon, authenticated;
revoke all on function public.cc_chat_auto_delivery() from public, anon, authenticated;
