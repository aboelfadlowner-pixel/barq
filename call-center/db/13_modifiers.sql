-- =====================================================================
--  Abu El Fadl Call Center — product add-ons, like Foodics (FOR REVIEW)
--
--  CONFIRMED: choosing a product that has add-ons (e.g. «ارز بلبن ابو الفضل»)
--  opens a list of its add-on groups with + / −, the price of each option and
--  the limit of each group (e.g. «اضافة مكسرات ايس كريم — لا تزيد عن 5»).
--  A group with a minimum must be chosen (e.g. the ice-cream flavour).
--
--    • cc_modifier_groups / cc_modifier_options : the add-ons and their prices,
--      imported from the Foodics export (الاضافات / خيارات الاضافات);
--    • cc_product_modifiers : which product shows which group, with min / max and
--      an option chosen in advance (like Foodics: Full Cream Milk, كوب 12 أونز) —
--      set by the admin in «الإعدادات ← إضافات الأصناف»;
--    • cc_order_items.modifiers : the add-ons of each order line (name, price,
--      quantity copied in, so a later price change never alters an order).
--
--  Prices of add-ons come from the database, never from the app. An add-on is
--  counted per piece: 2 × أرز بلبن with عسل ×1 = 2 × (product + عسل).
--  Editing an order keeps the price of an add-on that was already on the line.
--
--  CALL-CENTER ONLY. New cc_* tables, one new column on cc_order_items, and new
--  bodies for cc_place_order / cc_edit_order / cc_prep_orders (same names and
--  arguments). Needs 10_edit_order.sql and 11_driver.sql first. Nothing is
--  dropped or deleted; products_master is only read. Safe to re-run.
-- =====================================================================

create table if not exists public.cc_modifier_groups (
  id         uuid primary key,                       -- Foodics id
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.cc_modifier_options (
  id         uuid primary key,                       -- Foodics id
  group_id   uuid not null references public.cc_modifier_groups(id),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  sku        text,
  price      numeric(10,2) not null check (price >= 0),
  active     boolean not null default true,
  sort       integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists cc_modifier_options_group_idx on public.cc_modifier_options (group_id, sort);

create table if not exists public.cc_product_modifiers (
  sku        text not null,
  group_id   uuid not null references public.cc_modifier_groups(id),
  min_qty    integer not null default 0 check (min_qty between 0 and 20),
  max_qty    integer not null default 5 check (max_qty between 1 and 20),
  sort       integer not null default 0,
  default_option_id uuid references public.cc_modifier_options(id),   -- chosen in advance on the screen (can be changed)
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (sku, group_id),
  constraint cc_product_modifiers_min_max check (min_qty <= max_qty)
);

alter table public.cc_product_modifiers add column if not exists default_option_id uuid references public.cc_modifier_options(id);

-- [{id, group_id, group, name, price, qty}] per line; null = no add-ons.
alter table public.cc_order_items add column if not exists modifiers jsonb;

-- Read and written only through the functions below.
alter table public.cc_modifier_groups   enable row level security;
alter table public.cc_modifier_options  enable row level security;
alter table public.cc_product_modifiers enable row level security;
revoke all on public.cc_modifier_groups, public.cc_modifier_options, public.cc_product_modifiers from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- Add-ons for the order screen: active groups with their options, and the
-- product links. One call, loaded with the products.
-- ---------------------------------------------------------------------
create or replace function public.cc_list_modifiers()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'options', o.list) order by g.name)
        from public.cc_modifier_groups g
        cross join lateral (
          select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'price', x.price) order by x.sort, x.name), '[]'::jsonb) list
            from public.cc_modifier_options x where x.group_id = g.id and x.active) o
       where g.active and jsonb_array_length(o.list) > 0), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object('sku', l.sku, 'group_id', l.group_id, 'min', l.min_qty, 'max', l.max_qty,
                                          'default', l.default_option_id) order by l.sku, l.sort)
        from public.cc_product_modifiers l
        join public.cc_modifier_groups g on g.id = l.group_id and g.active), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: the add-on groups of one product (replaces its list).
--   p_links : [{"group_id": uuid, "min": int, "max": int, "default"?: option uuid}, ...] in display order; [] = none.
-- ---------------------------------------------------------------------
create or replace function public.cc_save_product_modifiers(p_sku text, p_links jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_link jsonb;
  v_n    integer := 0;
  v_min  integer;
  v_max  integer;
begin
  if not public.cc_is_admin() then
    raise exception 'للمسؤول فقط' using errcode = '42501';
  end if;
  if not exists (select 1 from public.products_master p where p.sku = p_sku) then
    raise exception 'صنف غير موجود: %', p_sku using errcode = 'P0002', hint = 'sku';
  end if;
  if jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links) > 15 then
    raise exception 'قائمة الإضافات غير صحيحة' using errcode = '22023', hint = 'links';
  end if;

  delete from public.cc_product_modifiers where sku = p_sku;
  for v_link in select value from jsonb_array_elements(p_links) loop
    v_n := v_n + 1;
    if coalesce(v_link->>'min', '0') !~ '^[0-9]+$' or coalesce(v_link->>'max', '') !~ '^[0-9]+$' then
      raise exception 'الحد الأدنى والأقصى لازم يكونوا أرقام' using errcode = '22023', hint = 'links';
    end if;
    v_min := coalesce((v_link->>'min')::int, 0);
    v_max := (v_link->>'max')::int;
    if v_max not between 1 and 20 or v_min > v_max then
      raise exception 'الحد الأقصى من 1 إلى 20 ولا يقل عن الحد الأدنى' using errcode = '22023', hint = 'links';
    end if;
    if not exists (select 1 from public.cc_modifier_groups g where g.id::text = v_link->>'group_id' and g.active) then
      raise exception 'مجموعة إضافات غير موجودة' using errcode = 'P0002', hint = 'links';
    end if;
    if nullif(v_link->>'default', '') is not null and not exists (
         select 1 from public.cc_modifier_options o
          where o.id::text = v_link->>'default' and o.group_id::text = v_link->>'group_id' and o.active) then
      raise exception 'الاختيار الجاهز لازم يكون من نفس المجموعة' using errcode = '22023', hint = 'links';
    end if;
    begin
      insert into public.cc_product_modifiers (sku, group_id, min_qty, max_qty, sort, default_option_id, updated_by)
      values (p_sku, (v_link->>'group_id')::uuid, v_min, v_max, v_n, nullif(v_link->>'default', '')::uuid, auth.uid());
    exception when unique_violation then
      raise exception 'المجموعة مكررة لنفس الصنف' using errcode = '23505', hint = 'links';
    end;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Price and check the add-ons of one order line (used by cc_place_order and
-- cc_edit_order; not callable from the app).
--   p_mods : [{"id": option uuid, "qty": int}, ...] or null
--   p_mult : pieces on the line (1 for a line sold by weight)
--   p_old  : add-ons already on this product in the order (their price is kept)
-- Returns {"items": [...snapshot...], "total": add-ons × pieces}.
-- ---------------------------------------------------------------------
create or replace function public.cc_price_modifiers(p_sku text, p_mods jsonb, p_mult integer, p_old jsonb default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_m     jsonb;
  v_opt   record;
  v_link  record;
  v_qty   integer;
  v_price numeric(10,2);
  v_sum   integer;
  v_items jsonb := '[]'::jsonb;
  v_total numeric(12,2) := 0;
  v_pname text;
begin
  if p_mods is null or jsonb_typeof(p_mods) = 'null' then
    p_mods := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_mods) <> 'array' or jsonb_array_length(p_mods) > 40 then
    raise exception 'الإضافات غير صحيحة' using errcode = '22023', hint = 'items';
  end if;
  select min(p.name) into v_pname from public.products_master p where p.sku = p_sku;

  for v_m in select value from jsonb_array_elements(p_mods) loop
    if coalesce(v_m->>'qty', '') !~ '^[0-9]+$' or (v_m->>'qty')::int not between 1 and 20 then
      raise exception 'عدد الإضافة غير صحيح في «%»', v_pname using errcode = '22023', hint = 'items';
    end if;
    v_qty := (v_m->>'qty')::int;
    select o.id, o.name, o.price, g.id as group_id, g.name as group_name into v_opt
      from public.cc_modifier_options o
      join public.cc_modifier_groups g on g.id = o.group_id
     where o.id::text = v_m->>'id' and o.active and g.active
       and exists (select 1 from public.cc_product_modifiers l where l.sku = p_sku and l.group_id = g.id);
    if not found then
      raise exception 'إضافة غير متاحة لـ«%» — حدّث الصفحة واختر مرة أخرى', v_pname using errcode = 'P0002', hint = 'items';
    end if;
    if exists (select 1 from jsonb_array_elements(v_items) x where x->>'id' = v_opt.id::text) then
      raise exception 'الإضافة «%» مكررة في «%»', v_opt.name, v_pname using errcode = '22023', hint = 'items';
    end if;
    select (x->>'price')::numeric(10,2) into v_price
      from jsonb_array_elements(case when jsonb_typeof(p_old) = 'array' then p_old else '[]'::jsonb end) x
     where x->>'id' = v_opt.id::text limit 1;
    v_price := coalesce(v_price, v_opt.price);
    v_items := v_items || jsonb_build_object('id', v_opt.id, 'group_id', v_opt.group_id, 'group', v_opt.group_name,
                                             'name', v_opt.name, 'price', v_price, 'qty', v_qty);
    v_total := v_total + v_price * v_qty;
  end loop;

  -- Limits of every group linked to the product.
  for v_link in
    select l.group_id, l.min_qty, l.max_qty, g.name
      from public.cc_product_modifiers l join public.cc_modifier_groups g on g.id = l.group_id and g.active
     where l.sku = p_sku
  loop
    select coalesce(sum((x->>'qty')::int), 0) into v_sum
      from jsonb_array_elements(v_items) x where x->>'group_id' = v_link.group_id::text;
    if v_sum < v_link.min_qty then
      raise exception 'اختر % على الأقل من «%» في «%»', v_link.min_qty, v_link.name, v_pname using errcode = '22023', hint = 'items';
    end if;
    if v_sum > v_link.max_qty then
      raise exception '«%» لا تزيد عن % في «%»', v_link.name, v_link.max_qty, v_pname using errcode = '22023', hint = 'items';
    end if;
  end loop;

  return jsonb_build_object('items', v_items, 'total', round(v_total * greatest(coalesce(p_mult, 1), 1), 2));
end;
$$;

-- ---------------------------------------------------------------------
-- Create an order as an employee (same as 04_agents.sql) + the add-ons of
-- each line: p_items[i].modifiers = [{"id", "qty"}]. cc_create_order ignores
-- that key; the add-ons are priced here, added to the line and order totals,
-- in the same transaction. Sending the same draft again changes nothing.
-- ---------------------------------------------------------------------
create or replace function public.cc_place_order(
  p_agent_id          uuid,
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
  v_agent public.cc_agents;
  v_order public.cc_orders;
  v_row   record;
  v_line  public.cc_order_items;
  v_mods  jsonb;
  v_add   numeric(12,2) := 0;
begin
  if not public.cc_is_staff() then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  v_agent := public.cc_require_agent(p_agent_id);
  v_order := public.cc_create_order(p_client_request_id, p_customer, p_address, p_items, p_note);
  if v_order.agent_id is null then
    -- A new order (a repeated draft already has its employee and add-ons).
    for v_row in select value as item, ordinality as n from jsonb_array_elements(p_items) with ordinality loop
      select * into v_line from public.cc_order_items where order_id = v_order.id and line_no = v_row.n;
      v_mods := public.cc_price_modifiers(v_line.sku, v_row.item->'modifiers', coalesce(v_line.qty, 1), null);
      if jsonb_array_length(v_mods->'items') > 0 then
        update public.cc_order_items
           set modifiers = v_mods->'items', line_total = line_total + (v_mods->>'total')::numeric
         where id = v_line.id;
        v_add := v_add + (v_mods->>'total')::numeric;
      end if;
    end loop;
    update public.cc_orders
       set agent_id = v_agent.id, agent_name = v_agent.name,
           subtotal = subtotal + v_add, total = total + v_add
     where id = v_order.id
    returning * into v_order;
    update public.cc_order_events set by_name = v_agent.name
     where order_id = v_order.id and status = 'new';
  end if;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- Edit an order: same as 10_edit_order.sql, plus each line's add-ons.
-- A change in add-ons only shows on the preparation screen as «الإضافات».
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
  v_old_mods jsonb;
  v_mods     jsonb;
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
  insert into public.cc_order_items (order_id, line_no, sku, product_name, unit_price, qty, weight_grams, line_total, note, modifiers)
  select p_order_id, l.line_no, l.sku, l.product_name, l.unit_price, l.qty, l.weight_grams, l.line_total, l.note, l.modifiers
    from jsonb_to_recordset(v_lines) as l(line_no int, sku text, product_name text, unit_price numeric, qty int,
                                          weight_grams int, line_total numeric, note text, modifiers jsonb);

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

-- The preparation list also carries each line's add-ons (same as 11 plus modifiers).
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
      'driver', o.driver,
      'customer_name', o.customer_name, 'customer_phone', o.customer_phone, 'customer_phone2', o.customer_phone2,
      'area_name', o.area_name, 'address_label', o.address_label, 'street', o.street,
      'housing_type', o.housing_type, 'address_notes', o.address_notes,
      'note', o.note, 'agent_name', coalesce(o.agent_name, o.created_by_name),
      'edited_at', o.edited_at, 'edit_count', o.edit_count, 'edit_changes', o.edit_changes, 'edit_seen_at', o.edit_seen_at,
      'items', coalesce((select jsonb_agg(jsonb_build_object(
                  'name', i.product_name, 'qty', i.qty, 'weight_grams', i.weight_grams, 'note', i.note,
                  'modifiers', i.modifiers)
                  order by i.line_no)
                from public.cc_order_items i where i.order_id = o.id), '[]'::jsonb))
      from public.cc_orders o
     where o.created_at >= v_day_start
        or (o.status <> 'cancelled' and o.stage <> 'out' and o.created_at > now() - interval '3 days')
     order by o.created_at;
end;
$$;

revoke all on function public.cc_list_modifiers()                              from public, anon;
revoke all on function public.cc_save_product_modifiers(text, jsonb)           from public, anon;
revoke all on function public.cc_price_modifiers(text, jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.cc_list_modifiers()                    to authenticated;
grant execute on function public.cc_save_product_modifiers(text, jsonb) to authenticated;
