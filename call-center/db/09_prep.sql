-- =====================================================================
--  Abu El Fadl Call Center — preparation stages (FOR REVIEW)
--
--  CONFIRMED: the person preparing orders at the branch (role "prep") sees the
--  orders sent by the call center and moves each one on with one tap:
--      new → preparing (استلم وبدأ) → at_cashier (على الكاشير) → out (خرج مع الطيار)
--  One step back is allowed (a wrong tap). The call center sees the stage and
--  its times. The call center prints the ticket; the preparation screen does not.
--
--  CALL-CENTER ONLY, ADDITIVE: new columns on cc_orders (stage + its times,
--  existing orders start at "new"), one new log table, two new functions.
--  Nothing is dropped or deleted; existing checks and functions are unchanged.
--  Safe to re-run.
-- =====================================================================

alter table public.cc_orders add column if not exists stage         text not null default 'new';
alter table public.cc_orders add column if not exists preparing_at  timestamptz;
alter table public.cc_orders add column if not exists at_cashier_at timestamptz;
alter table public.cc_orders add column if not exists out_at        timestamptz;
alter table public.cc_orders add column if not exists stage_by_name text;     -- account that made the last change
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cc_orders_stage_check') then
    alter table public.cc_orders add constraint cc_orders_stage_check
      check (stage in ('new', 'preparing', 'at_cashier', 'out'));
  end if;
end $$;
create index if not exists cc_orders_stage_idx on public.cc_orders (stage, created_at desc);

-- Every tap, for the record (who and when). Written only by cc_set_stage.
create table if not exists public.cc_order_stage_events (
  id        bigint generated always as identity primary key,
  order_id  uuid not null references public.cc_orders(id),
  stage     text not null check (stage in ('new', 'preparing', 'at_cashier', 'out')),
  at        timestamptz not null default now(),
  by_user   uuid references auth.users(id),
  by_name   text
);
create index if not exists cc_order_stage_events_order_idx on public.cc_order_stage_events (order_id, at);
alter table public.cc_order_stage_events enable row level security;
revoke all on public.cc_order_stage_events from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- The preparation list: today's orders (Cairo time), plus any older order
-- that is still not out. Only what preparing needs — no prices.
-- ---------------------------------------------------------------------
create or replace function public.cc_prep_orders()
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz := (date_trunc('day', now() at time zone 'Africa/Cairo')) at time zone 'Africa/Cairo';
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'شاشة التجهيز للفرع بس' using errcode = '42501';
  end if;
  return query
    select jsonb_build_object(
      'id', o.id, 'order_no', o.order_no, 'created_at', o.created_at,
      'status', o.status, 'cancel_reason', o.cancel_reason, 'cancelled_at', o.cancelled_at,
      'stage', o.stage, 'preparing_at', o.preparing_at, 'at_cashier_at', o.at_cashier_at, 'out_at', o.out_at,
      'customer_name', o.customer_name, 'customer_phone', o.customer_phone, 'customer_phone2', o.customer_phone2,
      'area_name', o.area_name, 'address_label', o.address_label, 'street', o.street,
      'housing_type', o.housing_type, 'address_notes', o.address_notes,
      'note', o.note, 'agent_name', coalesce(o.agent_name, o.created_by_name),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
                  'name', i.product_name, 'qty', i.qty, 'weight_grams', i.weight_grams, 'note', i.note)
                  order by i.line_no)
                from public.cc_order_items i where i.order_id = o.id), '[]'::jsonb))
      from public.cc_orders o
     where o.created_at >= v_day_start
        or (o.status <> 'cancelled' and o.stage <> 'out' and o.created_at > now() - interval '3 days')
     order by o.created_at;
end;
$$;

-- ---------------------------------------------------------------------
-- Move an order one step forward (or one step back after a wrong tap).
-- ---------------------------------------------------------------------
create or replace function public.cc_set_stage(p_order_id uuid, p_stage text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order  public.cc_orders;
  v_stages text[] := array['new', 'preparing', 'at_cashier', 'out'];
  v_from   int;
  v_to     int;
  v_name   text;
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'تغيير حالة التجهيز للفرع بس' using errcode = '42501';
  end if;
  v_to := array_position(v_stages, p_stage);
  if v_to is null then
    raise exception 'حالة غير معروفة' using errcode = '22023', hint = 'stage';
  end if;

  select * into v_order from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى — متكملش تجهيزه' using errcode = '22023', hint = 'cancelled';
  end if;
  v_from := array_position(v_stages, v_order.stage);
  if v_to = v_from then
    return jsonb_build_object('id', v_order.id, 'stage', v_order.stage);   -- double tap: nothing to do
  end if;
  if abs(v_to - v_from) <> 1 then
    raise exception 'الطلب اتغيرت حالته من جهاز تاني — اعمل تحديث' using errcode = '22023', hint = 'stale';
  end if;

  select u.email::text into v_name from auth.users u where u.id = auth.uid();
  update public.cc_orders
     set stage = p_stage,
         -- forward: stamp the new stage · back: clear the stage that was undone (earlier times stay)
         preparing_at  = case when v_to > v_from and p_stage = 'preparing'  then now() when v_to < 2 then null else preparing_at end,
         at_cashier_at = case when v_to > v_from and p_stage = 'at_cashier' then now() when v_to < 3 then null else at_cashier_at end,
         out_at        = case when v_to > v_from and p_stage = 'out'        then now() when v_to < 4 then null else out_at end,
         stage_by_name = v_name
   where id = p_order_id
  returning * into v_order;
  insert into public.cc_order_stage_events (order_id, stage, by_user, by_name) values (p_order_id, p_stage, auth.uid(), v_name);
  return jsonb_build_object('id', v_order.id, 'stage', v_order.stage, 'preparing_at', v_order.preparing_at,
    'at_cashier_at', v_order.at_cashier_at, 'out_at', v_order.out_at);
end;
$$;

revoke all on function public.cc_prep_orders()          from public, anon;
revoke all on function public.cc_set_stage(uuid, text)  from public, anon;
grant execute on function public.cc_prep_orders()         to authenticated;
grant execute on function public.cc_set_stage(uuid, text) to authenticated;
