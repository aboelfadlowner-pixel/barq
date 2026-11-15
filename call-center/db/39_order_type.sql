-- =====================================================================
--  39 — «نوع الطلب»: توصيل أو استلام من الفرع (like Foodics).
--
--  CONFIRMED: the call center picks the order type when making the order, and can
--  change it from the side panel («تغيير نوع الطلب») and while editing the order
--  (until «على الكاشير»):
--    • توصيل: an address is required; the delivery fee is the area's;
--    • استلام من الفرع: no address; the delivery fee is 0; nothing is added to the
--      customer's address book.
--  At the cashier a pickup order shows «العميل هيستلم من الفرع» by itself (no driver
--  to pick), and «العميل استلم» ends it (36_pickup.sql). A pickup order with no address
--  cannot be given to a driver — the call center changes it to توصيل first.
--  The prep screen's own «العميل هيستلم من الفرع» (36) is unchanged (fee kept, for now).
--
--  CALL-CENTER ONLY. cc_orders gets one column (order_type, every existing order =
--  'delivery') and area_id may be empty for a pickup order only. cc_create_order and
--  cc_edit_order get new bodies (same names, arguments and grants; delivery orders
--  work exactly as before). One new trigger on cc_orders. Nothing is deleted.
--  Safe to re-run.
-- =====================================================================

alter table public.cc_orders add column if not exists order_type text not null default 'delivery';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cc_orders_order_type_check') then
    alter table public.cc_orders add constraint cc_orders_order_type_check check (order_type in ('delivery', 'pickup'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cc_orders_area_unless_pickup') then
    alter table public.cc_orders add constraint cc_orders_area_unless_pickup check (order_type = 'pickup' or area_id is not null);
  end if;
end $$;
alter table public.cc_orders alter column area_id drop not null;

-- cc_create_order: same as in 02_functions.sql + «استلام من الفرع».
create or replace function public.cc_create_order(
  p_client_request_id uuid,
  p_customer          jsonb,
  p_address           jsonb,
  p_items             jsonb,
  p_note              text default null
)
returns public.cc_orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_staff    public.cc_staff;
  v_order    public.cc_orders;
  v_customer public.cc_customers;
  v_address  public.cc_addresses;
  v_area     public.cc_delivery_areas;
  v_phone    text;
  v_phone2   text;
  v_addr_set boolean;
  v_housing  text;
  v_item     jsonb;
  v_prod     record;
  v_qty      int;
  v_grams    int;
  v_sold_by  text;
  v_total    numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_est      boolean := false;
  v_lines    jsonb := '[]'::jsonb;
  v_line_no  int := 0;
  v_pickup   boolean := coalesce(p_address->>'pickup', '') = 'true';   -- 39: «استلام من الفرع» — no address, no fee
begin
  select * into v_staff from public.cc_staff where user_id = v_uid and active;
  if not found then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;

  if p_client_request_id is null then
    raise exception 'client_request_id مطلوب' using errcode = '22023';
  end if;

  -- M2: serialize requests that carry the same draft id. A second request that
  -- arrives at the same moment waits here until the first one commits, then the
  -- check below finds the finished order and returns it — no second customer,
  -- address or order is created. The lock is released at transaction end.
  perform pg_advisory_xact_lock(hashtextextended('cc_create_order:' || p_client_request_id::text, 0));

  -- Idempotency: same draft submitted again → return the existing order.
  select * into v_order from public.cc_orders where client_request_id = p_client_request_id;
  if found then
    return v_order;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'السلة فارغة أو غير صحيحة' using errcode = '22023', hint = 'items';
  end if;
  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'السلة فارغة أو غير صحيحة' using errcode = '22023', hint = 'items';
  end if;

  -- Second number (optional), same format as the main one.
  v_phone2 := nullif(btrim(p_customer->>'phone2'), '');
  if v_phone2 is not null and v_phone2 !~ '^0[0-9]{8,10}$' then
    raise exception 'الرقم الإضافي غير صحيح' using errcode = '22023', hint = 'phone2';
  end if;

  -- Customer: existing by id, or new.
  if p_customer ? 'id' then
    select * into v_customer from public.cc_customers where id = (p_customer->>'id')::uuid;
    if not found then
      raise exception 'العميل غير موجود' using errcode = 'P0002', hint = 'customer';
    end if;
    v_phone := coalesce(nullif(p_customer->>'order_phone', ''), v_customer.phone);
    if v_phone not in (v_customer.phone, coalesce(v_customer.phone2, '')) then
      raise exception 'رقم التواصل لا يخص هذا العميل' using errcode = '22023', hint = 'order_phone';
    end if;
    -- A second number typed for a customer who has none is saved on the customer.
    if v_phone2 is not null and v_customer.phone2 is null and v_phone2 <> v_customer.phone then
      update public.cc_customers set phone2 = v_phone2 where id = v_customer.id
      returning * into v_customer;
    end if;
  else
    if char_length(coalesce(btrim(p_customer->>'name'), '')) not between 1 and 120 then
      raise exception 'اسم العميل مطلوب وبحد أقصى 120 حرف' using errcode = '22023', hint = 'name';
    end if;
    if coalesce(p_customer->>'phone', '') !~ '^0[0-9]{8,10}$' then
      raise exception 'رقم الموبايل غير صحيح — مثال: 01012345678' using errcode = '22023', hint = 'phone';
    end if;
    begin
      insert into public.cc_customers (name, phone, phone2, created_by)
      values (btrim(p_customer->>'name'), p_customer->>'phone', v_phone2, v_uid)
      returning * into v_customer;
    exception when unique_violation then
      raise exception 'رقم الموبايل مسجل لعميل آخر — اختاره من نتائج البحث' using errcode = '23505', hint = 'phone';
    end;
    v_phone := v_customer.phone;
  end if;

  -- Address (L5 limits): saved as is, saved + edited, or new. The fields of a
  -- new or edited address are checked here, with HINT = the form field name.
  if not v_pickup then
  v_addr_set := not (p_address ? 'id') or (p_address ? 'street');
  if v_addr_set then
    if char_length(coalesce(btrim(p_address->>'label'), '')) not between 1 and 40 then
      raise exception 'اسم العنوان مطلوب وبحد أقصى 40 حرف' using errcode = '22023', hint = 'label';
    end if;
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
  end if;

  if p_address ? 'id' then
    select * into v_address from public.cc_addresses
     where id = (p_address->>'id')::uuid and customer_id = v_customer.id
       for update;
    if not found then
      raise exception 'العنوان غير موجود لهذا العميل' using errcode = 'P0002', hint = 'address';
    end if;
    if v_addr_set then
      update public.cc_addresses
         set label = btrim(p_address->>'label'), area_id = (p_address->>'area_id')::uuid,
             street = btrim(p_address->>'street'), housing_type = v_housing,
             notes = nullif(btrim(p_address->>'notes'), ''), updated_at = now(), updated_by = v_uid
       where id = v_address.id
      returning * into v_address;
    end if;
  else
    insert into public.cc_addresses (customer_id, label, area_id, street, housing_type, notes, created_by)
    values (v_customer.id, btrim(p_address->>'label'), (p_address->>'area_id')::uuid, btrim(p_address->>'street'),
            v_housing, nullif(btrim(p_address->>'notes'), ''), v_uid)
    returning * into v_address;
  end if;

  -- Delivery fee comes from the area table, never from the app.
  select * into v_area from public.cc_delivery_areas where id = v_address.area_id;
  if not found or not v_area.active then
    raise exception 'منطقة التوصيل غير متاحة — اختر عنواناً آخر' using errcode = '22023', hint = 'areaId';
  end if;

  end if;   -- not v_pickup

  -- Lines: price from products_master; weight lines = price-per-kg × grams / 1000.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line_no := v_line_no + 1;

    -- M4: STRICT — exactly one row per sku, otherwise stop (never pick an arbitrary price).
    begin
      select p.sku, p.name, coalesce(p.price, 0)::numeric(12,2) as price
        into strict v_prod
        from public.products_master p
       where p.sku = v_item->>'sku';
    exception
      when no_data_found then
        raise exception 'صنف غير موجود: %', v_item->>'sku' using errcode = 'P0002', hint = 'items';
      when too_many_rows then
        raise exception 'كود الصنف % مكرر في شيت المنتجات — لازم يتصلح في الشيت الأول', v_item->>'sku'
          using errcode = 'P0003', hint = 'items';
    end;

    -- Quantity must be a whole number (checked before casting, so 1.5 gets a clear message).
    if v_item ? 'qty' and coalesce(v_item->>'qty', '') !~ '^[0-9]+$' then
      if v_item->>'qty' ~ '^[0-9]*[.][0-9]+$' then
        raise exception 'لا يمكن أن تحتوي الكمية على أرقام عشرية في المنتجات التي يتم بيعها بالوحدة. (السطر %)', v_line_no
          using errcode = '22023', hint = 'items';
      end if;
      raise exception 'الكمية غير صحيحة في السطر %', v_line_no using errcode = '22023', hint = 'items';
    end if;
    if v_item ? 'weight_grams' and coalesce(v_item->>'weight_grams', '') !~ '^[0-9]+$' then
      raise exception 'الوزن غير صحيح في السطر %', v_line_no using errcode = '22023', hint = 'items';
    end if;
    v_qty   := (v_item->>'qty')::int;
    v_grams := (v_item->>'weight_grams')::int;
    if (v_qty is null) = (v_grams is null) then
      raise exception 'السطر % لازم يكون بالكمية أو بالوزن', v_line_no using errcode = '22023', hint = 'items';
    end if;

    -- The line must match how the product is sold.
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

    if v_grams is not null then
      v_total := round(v_prod.price * v_grams / 1000.0, 2);
      v_est := true;
    else
      v_total := round(v_prod.price * v_qty, 2);
    end if;
    v_subtotal := v_subtotal + v_total;

    v_lines := v_lines || jsonb_build_object(
      'line_no', v_line_no, 'sku', v_prod.sku, 'product_name', v_prod.name,
      'unit_price', v_prod.price, 'qty', v_qty, 'weight_grams', v_grams,
      'line_total', v_total, 'note', left(nullif(btrim(v_item->>'note'), ''), 120));
  end loop;

  insert into public.cc_orders (
    client_request_id, created_by, created_by_name,
    customer_id, customer_name, customer_phone, customer_phone2,
    address_id, address_label, area_id, area_name, street, housing_type, address_notes,
    delivery_fee, subtotal, total, is_estimated, note, order_type)
  values (
    p_client_request_id, v_uid, v_staff.display_name,
    v_customer.id, v_customer.name, v_phone, nullif(coalesce(v_phone2, v_customer.phone2), v_phone),
    case when v_pickup then null else v_address.id end,
    case when v_pickup then 'استلام من الفرع' else v_address.label end,
    case when v_pickup then null else v_area.id end,
    case when v_pickup then 'استلام من الفرع' else v_area.name end,
    case when v_pickup then 'استلام من الفرع' else v_address.street end,
    case when v_pickup then null else v_address.housing_type end,
    case when v_pickup then null else v_address.notes end,
    case when v_pickup then 0 else v_area.fee end, v_subtotal,
    v_subtotal + case when v_pickup then 0 else v_area.fee end, v_est, left(nullif(btrim(p_note), ''), 300),
    case when v_pickup then 'pickup' else 'delivery' end)
  returning * into v_order;

  insert into public.cc_order_items (order_id, line_no, sku, product_name, unit_price, qty, weight_grams, line_total, note)
  select v_order.id, l.line_no, l.sku, l.product_name, l.unit_price, l.qty, l.weight_grams, l.line_total, l.note
    from jsonb_to_recordset(v_lines) as l(
      line_no int, sku text, product_name text, unit_price numeric, qty int,
      weight_grams int, line_total numeric, note text);

  insert into public.cc_order_events (order_id, status, by, by_name)
  values (v_order.id, 'new', v_uid, v_staff.display_name);

  return v_order;
end;
$$;

-- cc_edit_order: same as in 13_modifiers.sql + «نوع الطلب».
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
  v_old_mods jsonb;
  v_mods     jsonb;
  v_was_pickup boolean;
  v_pickup     boolean;
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

  -- 39: «استلام من الفرع» ⇄ «توصيل». p_address {"pickup": true} → pickup; an address → delivery;
  -- null → the order keeps its type (and its address).
  v_was_pickup := v_order.order_type = 'pickup';
  v_pickup := coalesce(p_address->>'pickup', '') = 'true' or (v_was_pickup and p_address is null);
  if v_pickup then p_address := null; end if;

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
    if (p_address->>'area_id')::uuid is distinct from v_order.area_id then
      select * into v_area from public.cc_delivery_areas where id = (p_address->>'area_id')::uuid;
      if not found or not v_area.active then
        raise exception 'منطقة التوصيل غير متاحة' using errcode = '22023', hint = 'areaId';
      end if;
    end if;
  end if;

  -- Old lines (to keep their prices and to show what changed).
  select coalesce(jsonb_agg(jsonb_build_object('sku', i.sku, 'name', i.product_name, 'unit_price', i.unit_price,
           'qty', i.qty, 'weight_grams', i.weight_grams, 'note', i.note, 'line_total', i.line_total,
           'modifiers', i.modifiers) order by i.line_no), '[]'::jsonb)
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
    -- Add-ons: an add-on that was already on this product keeps its original price.
    select jsonb_agg(m) into v_old_mods
      from jsonb_array_elements(v_old) o,
           jsonb_array_elements(case when jsonb_typeof(o->'modifiers') = 'array' then o->'modifiers' else '[]'::jsonb end) m
     where o->>'sku' = v_prod.sku;
    v_mods := public.cc_price_modifiers(v_prod.sku, v_item->'modifiers', coalesce(v_qty, 1), v_old_mods);
    v_total := v_total + (v_mods->>'total')::numeric;
    v_subtotal := v_subtotal + v_total;
    v_lines := v_lines || jsonb_build_object('line_no', v_line_no, 'sku', v_prod.sku, 'product_name', v_prod.name,
      'unit_price', v_price, 'qty', v_qty, 'weight_grams', v_grams, 'line_total', v_total,
      'note', left(nullif(btrim(v_item->>'note'), ''), 120),
      'modifiers', case when jsonb_array_length(v_mods->'items') > 0 then v_mods->'items' end);
  end loop;

  -- What changed, per product (added / removed / amount / note), then address and note.
  select coalesce(jsonb_agg(c order by c->>'name'), '[]'::jsonb) into v_changes from (
    select case
             when o.sku is null then jsonb_build_object('kind', 'added', 'name', n.name, 'to', n.amount)
             when n.sku is null then jsonb_build_object('kind', 'removed', 'name', o.name, 'from', o.amount)
             when o.amount <> n.amount then jsonb_build_object('kind', 'amount', 'name', n.name, 'from', o.amount, 'to', n.amount)
             when o.mods <> n.mods then jsonb_build_object('kind', 'modifiers', 'name', n.name, 'from', o.mods, 'to', n.mods)
             else jsonb_build_object('kind', 'note', 'name', n.name, 'to', coalesce(n.note, ''))
           end as c
      from (select x->>'sku' sku, min(x->>'name') name, jsonb_build_object('qty', sum((x->>'qty')::int), 'grams', sum((x->>'weight_grams')::int)) amount,
                   string_agg(x->>'note', ' · ') note,
                   coalesce(string_agg((select string_agg((m->>'name') || ' ×' || (m->>'qty'), '، ')
                     from jsonb_array_elements(case when jsonb_typeof(x->'modifiers') = 'array' then x->'modifiers' else '[]'::jsonb end) m), ' · '), '') mods
              from jsonb_array_elements(v_old) x group by x->>'sku') o
      full join (select x->>'sku' sku, min(x->>'product_name') name, jsonb_build_object('qty', sum((x->>'qty')::int), 'grams', sum((x->>'weight_grams')::int)) amount,
                   string_agg(x->>'note', ' · ') note,
                   coalesce(string_agg((select string_agg((m->>'name') || ' ×' || (m->>'qty'), '، ')
                     from jsonb_array_elements(case when jsonb_typeof(x->'modifiers') = 'array' then x->'modifiers' else '[]'::jsonb end) m), ' · '), '') mods
              from jsonb_array_elements(v_lines) x group by x->>'sku') n on n.sku = o.sku
     where o.sku is null or n.sku is null or o.amount <> n.amount or o.mods <> n.mods or o.note is distinct from n.note) t;

  v_old_addr := jsonb_build_object('area', v_order.area_name, 'street', v_order.street, 'housing_type', v_order.housing_type, 'notes', v_order.address_notes);
  v_new_addr := jsonb_build_object('area', v_area.name, 'street', v_street, 'housing_type', v_housing, 'notes', v_notes);
  -- Same area → the fee the customer was told stays; another area → that area's fee today.
  v_fee := case when v_pickup then 0 when v_area.id = v_order.area_id then v_order.delivery_fee else v_area.fee end;
  if v_area.id = v_order.area_id then v_new_addr := v_new_addr || jsonb_build_object('area', v_order.area_name); end if;
  if v_pickup then
    v_new_addr := jsonb_build_object('area', 'استلام من الفرع', 'street', 'استلام من الفرع', 'housing_type', null, 'notes', null);
  end if;
  if v_pickup is distinct from v_was_pickup then
    v_changes := v_changes || jsonb_build_object('kind', 'order_type', 'name', 'نوع الطلب',
                                                 'to', case when v_pickup then 'استلام من الفرع' else 'توصيل' end);
  end if;
  if v_new_addr <> v_old_addr and not v_pickup then
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
  insert into public.cc_order_items (order_id, line_no, sku, product_name, unit_price, qty, weight_grams, line_total, note, modifiers)
  select p_order_id, l.line_no, l.sku, l.product_name, l.unit_price, l.qty, l.weight_grams, l.line_total, l.note, l.modifiers
    from jsonb_to_recordset(v_lines) as l(line_no int, sku text, product_name text, unit_price numeric, qty int,
                                          weight_grams int, line_total numeric, note text, modifiers jsonb);

  update public.cc_orders
     set area_id = case when v_pickup then null else v_area.id end,
         area_name = case when v_pickup then 'استلام من الفرع' when v_area.id = v_order.area_id then v_order.area_name else v_area.name end,
         street = case when v_pickup then 'استلام من الفرع' else v_street end,
         housing_type = case when v_pickup then null else v_housing end,
         address_notes = case when v_pickup then null else v_notes end,
         address_label = case when v_pickup then 'استلام من الفرع'
                              when v_was_pickup then coalesce(nullif(btrim(p_address->>'label'), ''), 'العنوان') else address_label end,
         address_id = case when v_pickup then null else address_id end,
         order_type = case when v_pickup then 'pickup' else 'delivery' end,
         delivery_fee = v_fee, subtotal = v_subtotal, total = v_subtotal + v_fee, is_estimated = v_est,
         note = v_note, edited_at = now(), edit_count = edit_count + 1, edited_by_name = v_agent.name,
         edit_changes = v_changes, edit_seen_at = null
   where id = p_order_id
  returning * into v_order;
  return v_order;
end;
$$;

-- At the cashier a pickup order waits for the customer by itself; it cannot be given to a
-- driver while it has no address.
create or replace function public.cc_order_type_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.order_type = 'pickup' then
    if new.driver_user_id is not null and new.area_id is null then
      raise exception 'الطلب ده «استلام من الفرع» ومن غير عنوان — الكول سنتر يغيّره لـ «توصيل» الأول'
        using errcode = '22023', hint = 'pickup';
    end if;
    if new.stage = 'at_cashier' and new.status <> 'cancelled' and new.driver_user_id is null
       and new.driver is distinct from 'استلام من الفرع' then
      new.driver := 'استلام من الفرع';
      new.assigned_at := coalesce(new.assigned_at, clock_timestamp());
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.cc_order_type_guard() from public, anon, authenticated;
drop trigger if exists cc_order_type_guard on public.cc_orders;
create trigger cc_order_type_guard before update on public.cc_orders
  for each row execute function public.cc_order_type_guard();
