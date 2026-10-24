-- =====================================================================
--  Abu El Fadl Call Center — edit an order until it reaches the cashier (FOR REVIEW)
--
--  CONFIRMED: the call center can change an order's items, quantities, delivery
--  address and note while it is «جديد» or «بيتجهز». From «على الكاشير» on, the
--  bill is already in Foodics, so changes go by phone with the branch.
--  The preparation screen marks the order «اتعدّل» with what changed, until the
--  person preparing taps «شُفت التعديل». The call center prints the ticket again.
--
--  Prices: lines that were already in the order keep their original price; a
--  newly added product takes today's price. Totals are computed here.
--  The customer's saved address book is not changed by an edit (only this order).
--
--  CALL-CENTER ONLY. Nothing from before is lost: every edit keeps the old and
--  new items, address and totals in cc_order_edits. Additive, plus:
--    • cc_prep_orders (09) also returns the edit mark;
--    • the old direct functions cc_create_order / cc_cancel_order are no longer
--      callable from the app (it uses cc_place_order / cc_cancel_order_as, which
--      check the role); they keep working inside those two.
--  Safe to re-run.
-- =====================================================================

alter table public.cc_orders add column if not exists edited_at      timestamptz;
alter table public.cc_orders add column if not exists edit_count     integer not null default 0;
alter table public.cc_orders add column if not exists edited_by_name text;
alter table public.cc_orders add column if not exists edit_changes   jsonb;        -- what changed in the last edit
alter table public.cc_orders add column if not exists edit_seen_at   timestamptz;  -- the branch saw the last edit

create table if not exists public.cc_order_edits (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.cc_orders(id),
  at          timestamptz not null default now(),
  by_user     uuid references auth.users(id),
  agent_name  text,
  old_items   jsonb not null,
  new_items   jsonb not null,
  old_address jsonb not null,
  new_address jsonb not null,
  old_note    text,
  new_note    text,
  old_total   numeric(12,2) not null,
  new_total   numeric(12,2) not null,
  changes     jsonb not null
);
create index if not exists cc_order_edits_order_idx on public.cc_order_edits (order_id, at);
alter table public.cc_order_edits enable row level security;
revoke all on public.cc_order_edits from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Edit an order.
--   p_address : null = keep · {"area_id", "street", "housing_type"?, "notes"?}
--   p_items   : same as when creating ([{sku, qty} | {sku, weight_grams}, note?])
--   p_note    : the order note (empty = none)
-- ---------------------------------------------------------------------
create or replace function public.cc_edit_order(p_agent_id uuid, p_order_id uuid, p_address jsonb, p_items jsonb, p_note text)
returns public.cc_orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_agent    public.cc_agents;
  v_order    public.cc_orders;
  v_area     public.cc_delivery_areas;
  v_housing  text;
  v_street   text;
  v_notes    text;
  v_item     jsonb;
  v_prod     record;
  v_qty      int;
  v_grams    int;
  v_sold_by  text;
  v_price    numeric(12,2);
  v_total    numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_est      boolean := false;
  v_lines    jsonb := '[]'::jsonb;
  v_line_no  int := 0;
  v_old      jsonb;
  v_changes  jsonb := '[]'::jsonb;
  v_note     text := left(nullif(btrim(p_note), ''), 300);
  v_old_addr jsonb;
  v_new_addr jsonb;
  v_fee      numeric(10,2);
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  v_agent := public.cc_require_agent(p_agent_id);

  select * into v_order from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'الطلب ده ملغي — مينفعش يتعدّل' using errcode = '22023', hint = 'status';
  end if;
  if v_order.stage not in ('new', 'preparing') then
    raise exception 'الطلب وصل الكاشير — أي تعديل يبقى بالتليفون مع الفرع' using errcode = '22023', hint = 'stage';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'السلة فارغة أو غير صحيحة' using errcode = '22023', hint = 'items';
  end if;

  -- Address on this order (the saved address book is not touched).
  v_area := null;
  select * into v_area from public.cc_delivery_areas where id = v_order.area_id;
  v_street := v_order.street; v_housing := v_order.housing_type; v_notes := v_order.address_notes;
  if p_address is not null then
    if nullif(p_address->>'area_id', '') is null then
      raise exception 'اختر منطقة التوصيل' using errcode = '22023', hint = 'areaId';
    end if;
    if char_length(coalesce(btrim(p_address->>'street'), '')) not between 1 and 150 then
      raise exception 'الشارع مطلوب وبحد أقصى 150 حرف' using errcode = '22023', hint = 'street';
    end if;
    v_housing := nullif(btrim(p_address->>'housing_type'), '');
    if v_housing is not null and v_housing not in ('building', 'villa', 'office') then
      raise exception 'نوع السكن غير صحيح' using errcode = '22023', hint = 'housingType';
    end if;
    if char_length(coalesce(p_address->>'notes', '')) > 200 then
      raise exception 'المعلومات الإضافية بحد أقصى 200 حرف' using errcode = '22023', hint = 'notes';
    end if;
    v_street := btrim(p_address->>'street');
    v_notes := nullif(btrim(p_address->>'notes'), '');
    if (p_address->>'area_id')::uuid <> v_order.area_id then
      select * into v_area from public.cc_delivery_areas where id = (p_address->>'area_id')::uuid;
      if not found or not v_area.active then
        raise exception 'منطقة التوصيل غير متاحة' using errcode = '22023', hint = 'areaId';
      end if;
    end if;
  end if;

  -- Old lines (to keep their prices and to show what changed).
  select coalesce(jsonb_agg(jsonb_build_object('sku', i.sku, 'name', i.product_name, 'unit_price', i.unit_price,
           'qty', i.qty, 'weight_grams', i.weight_grams, 'note', i.note, 'line_total', i.line_total) order by i.line_no), '[]'::jsonb)
    into v_old from public.cc_order_items i where i.order_id = p_order_id;

  -- New lines: same checks as a new order.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line_no := v_line_no + 1;
    begin
      select p.sku, p.name, coalesce(p.price, 0)::numeric(12,2) as price into strict v_prod
        from public.products_master p where p.sku = v_item->>'sku';
    exception
      when no_data_found then
        raise exception 'صنف غير موجود: %', v_item->>'sku' using errcode = 'P0002', hint = 'items';
      when too_many_rows then
        raise exception 'كود الصنف % مكرر في شيت المنتجات — لازم يتصلح في الشيت الأول', v_item->>'sku' using errcode = 'P0003', hint = 'items';
    end;
    if v_item ? 'qty' and coalesce(v_item->>'qty', '') !~ '^[0-9]+$' then
      if v_item->>'qty' ~ '^[0-9]*[.][0-9]+$' then
        raise exception 'لا يمكن أن تحتوي الكمية على أرقام عشرية في المنتجات التي يتم بيعها بالوحدة. (السطر %)', v_line_no using errcode = '22023', hint = 'items';
      end if;
      raise exception 'الكمية غير صحيحة في السطر %', v_line_no using errcode = '22023', hint = 'items';
    end if;
    if v_item ? 'weight_grams' and coalesce(v_item->>'weight_grams', '') !~ '^[0-9]+$' then
      raise exception 'الوزن غير صحيح في السطر %', v_line_no using errcode = '22023', hint = 'items';
    end if;
    v_qty := (v_item->>'qty')::int;
    v_grams := (v_item->>'weight_grams')::int;
    if (v_qty is null) = (v_grams is null) then
      raise exception 'السطر % لازم يكون بالكمية أو بالوزن', v_line_no using errcode = '22023', hint = 'items';
    end if;
    v_sold_by := coalesce(public.cc_sold_by(v_prod.sku), 'unit');
    if v_sold_by = 'unit' and v_grams is not null then
      raise exception 'الصنف «%» بيتباع بالوحدة — اكتب الكمية بالعدد', v_prod.name using errcode = '22023', hint = 'items';
    end if;
    if v_sold_by = 'weight' and v_qty is not null then
      raise exception 'الصنف «%» بيتباع بالوزن — اكتب الوزن بالكيلو', v_prod.name using errcode = '22023', hint = 'items';
    end if;
    if v_qty is not null and v_qty not between 1 and 999 then
      raise exception 'الكمية غير صحيحة في السطر %', v_line_no using errcode = '22023', hint = 'items';
    end if;
    if v_grams is not null and v_grams not between 10 and 20000 then
      raise exception 'الوزن غير صحيح في السطر %', v_line_no using errcode = '22023', hint = 'items';
    end if;

    -- A product that was already in the order keeps its original price.
    select (o->>'unit_price')::numeric(12,2) into v_price
      from jsonb_array_elements(v_old) o where o->>'sku' = v_prod.sku limit 1;
    v_price := coalesce(v_price, v_prod.price);
    if v_grams is not null then
      v_total := round(v_price * v_grams / 1000.0, 2); v_est := true;
    else
      v_total := round(v_price * v_qty, 2);
    end if;
    v_subtotal := v_subtotal + v_total;
    v_lines := v_lines || jsonb_build_object('line_no', v_line_no, 'sku', v_prod.sku, 'product_name', v_prod.name,
      'unit_price', v_price, 'qty', v_qty, 'weight_grams', v_grams, 'line_total', v_total,
      'note', left(nullif(btrim(v_item->>'note'), ''), 120));
  end loop;

  -- What changed, per product (added / removed / amount / note), then address and note.
  select coalesce(jsonb_agg(c order by c->>'name'), '[]'::jsonb) into v_changes from (
    select case
             when o.sku is null then jsonb_build_object('kind', 'added', 'name', n.name, 'to', n.amount)
             when n.sku is null then jsonb_build_object('kind', 'removed', 'name', o.name, 'from', o.amount)
             when o.amount <> n.amount then jsonb_build_object('kind', 'amount', 'name', n.name, 'from', o.amount, 'to', n.amount)
             else jsonb_build_object('kind', 'note', 'name', n.name, 'to', coalesce(n.note, ''))
           end as c
      from (select x->>'sku' sku, min(x->>'name') name, jsonb_build_object('qty', sum((x->>'qty')::int), 'grams', sum((x->>'weight_grams')::int)) amount,
                   string_agg(x->>'note', ' · ') note
              from jsonb_array_elements(v_old) x group by x->>'sku') o
      full join (select x->>'sku' sku, min(x->>'product_name') name, jsonb_build_object('qty', sum((x->>'qty')::int), 'grams', sum((x->>'weight_grams')::int)) amount,
                   string_agg(x->>'note', ' · ') note
              from jsonb_array_elements(v_lines) x group by x->>'sku') n on n.sku = o.sku
     where o.sku is null or n.sku is null or o.amount <> n.amount or o.note is distinct from n.note) t;

  v_old_addr := jsonb_build_object('area', v_order.area_name, 'street', v_order.street, 'housing_type', v_order.housing_type, 'notes', v_order.address_notes);
  v_new_addr := jsonb_build_object('area', v_area.name, 'street', v_street, 'housing_type', v_housing, 'notes', v_notes);
  -- Same area → the fee the customer was told stays; another area → that area's fee today.
  v_fee := case when v_area.id = v_order.area_id then v_order.delivery_fee else v_area.fee end;
  if v_area.id = v_order.area_id then v_new_addr := v_new_addr || jsonb_build_object('area', v_order.area_name); end if;
  if v_new_addr <> v_old_addr then
    v_changes := v_changes || jsonb_build_object('kind', 'address', 'name', 'العنوان', 'from', v_old_addr, 'to', v_new_addr);
  end if;
  if v_note is distinct from v_order.note then
    v_changes := v_changes || jsonb_build_object('kind', 'order_note', 'name', 'ملاحظات الطلب', 'to', coalesce(v_note, ''));
  end if;
  if jsonb_array_length(v_changes) = 0 then
    raise exception 'مفيش أي تغيير في الطلب' using errcode = '22023', hint = 'nochange';
  end if;

  insert into public.cc_order_edits (order_id, by_user, agent_name, old_items, new_items, old_address, new_address,
                                     old_note, new_note, old_total, new_total, changes)
  values (p_order_id, auth.uid(), v_agent.name, v_old, v_lines, v_old_addr, v_new_addr,
          v_order.note, v_note, v_order.total, v_subtotal + v_fee, v_changes);

  -- Replace the lines (the old ones are kept above in cc_order_edits).
  delete from public.cc_order_items where order_id = p_order_id;
  insert into public.cc_order_items (order_id, line_no, sku, product_name, unit_price, qty, weight_grams, line_total, note)
  select p_order_id, l.line_no, l.sku, l.product_name, l.unit_price, l.qty, l.weight_grams, l.line_total, l.note
    from jsonb_to_recordset(v_lines) as l(line_no int, sku text, product_name text, unit_price numeric, qty int,
                                          weight_grams int, line_total numeric, note text);

  update public.cc_orders
     set area_id = v_area.id, area_name = case when v_area.id = v_order.area_id then v_order.area_name else v_area.name end,
         street = v_street, housing_type = v_housing, address_notes = v_notes,
         delivery_fee = v_fee, subtotal = v_subtotal, total = v_subtotal + v_fee, is_estimated = v_est,
         note = v_note, edited_at = now(), edit_count = edit_count + 1, edited_by_name = v_agent.name,
         edit_changes = v_changes, edit_seen_at = null
   where id = p_order_id
  returning * into v_order;
  return v_order;
end;
$$;

-- The branch saw the last edit (the «اتعدّل» mark goes away).
create or replace function public.cc_ack_edit(p_order_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'للفرع بس' using errcode = '42501';
  end if;
  update public.cc_orders set edit_seen_at = now() where id = p_order_id and edited_at is not null;
  return found;
end;
$$;

-- The preparation list also carries the edit mark (same as 09 plus edited_* fields).
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
      'edited_at', o.edited_at, 'edit_count', o.edit_count, 'edit_changes', o.edit_changes, 'edit_seen_at', o.edit_seen_at,
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

revoke all on function public.cc_edit_order(uuid, uuid, jsonb, jsonb, text) from public, anon;
revoke all on function public.cc_ack_edit(uuid) from public, anon;
grant execute on function public.cc_edit_order(uuid, uuid, jsonb, jsonb, text) to authenticated;
grant execute on function public.cc_ack_edit(uuid) to authenticated;

-- Only the role-checked wrappers create and cancel orders from the app.
revoke execute on function public.cc_create_order(uuid, jsonb, jsonb, jsonb, text) from authenticated;
revoke execute on function public.cc_cancel_order(uuid, text) from authenticated;
