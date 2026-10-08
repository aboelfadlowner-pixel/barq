-- =====================================================================
-- متجر أبو الفضل أونلاين (shop.html + shop-admin.html)
-- كل اللي الموقع محتاجه من Supabase. آمن إعادة تشغيله.
-- =====================================================================

-- ===== إعدادات المتجر (بتتعدل من لوحة الطلبات من غير كود) =====
create table if not exists public.shop_settings (
  id int primary key default 1 check (id = 1),
  store_open boolean not null default true,
  closed_message text default 'استقبال الطلبات متوقف مؤقتاً، نرجع قريب',
  branches jsonb not null default '[{"key":"البيطاش","label":"فرع البيطاش"},{"key":"عين شمس","label":"فرع عين شمس"}]',
  delivery_fee numeric not null default 0,
  free_delivery_over numeric,
  min_order numeric not null default 0,
  whatsapp text,
  phone text,
  hours text default 'يومياً من 9 صباحاً حتى 12 منتصف الليل',
  updated_at timestamptz default now()
);
insert into public.shop_settings (id) values (1) on conflict do nothing;
alter table public.shop_settings enable row level security;
drop policy if exists shop_settings_read on public.shop_settings;
create policy shop_settings_read on public.shop_settings for select to anon, authenticated using (true);

-- رمز دخول لوحة الطلبات (مفيش أي policy = محدش يقراه من برا)
create table if not exists public.shop_admin_secret (
  id int primary key default 1 check (id = 1),
  pin_hash text not null
);
alter table public.shop_admin_secret enable row level security;

-- ===== الطلبات =====
create sequence if not exists public.shop_order_no_seq start 1001;

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint not null unique default nextval('public.shop_order_no_seq'),
  client_ref uuid not null unique,
  branch text not null,
  fulfillment text not null default 'delivery' check (fulfillment in ('delivery','pickup')),
  customer_name text not null,
  phone text not null,
  address text,
  notes text,
  items_count int not null,
  subtotal numeric not null,
  delivery_fee numeric not null default 0,
  total numeric not null,
  status text not null default 'new'
    check (status in ('new','preparing','out_for_delivery','ready','delivered','cancelled')),
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_orders_created_idx on public.shop_orders (created_at desc);
create index if not exists shop_orders_phone_idx on public.shop_orders (phone, created_at desc);

create table if not exists public.shop_order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  sku text not null,
  name text not null,
  barcode text,
  price numeric not null,
  qty numeric not null check (qty > 0),
  line_total numeric not null
);
create index if not exists shop_order_items_order_idx on public.shop_order_items (order_id);

-- بيانات العملاء محمية: مفيش policies للعامة، الوصول بس من خلال الدوال تحت
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;

-- ===== كتالوج المنتجات =====
-- نفس منطق website-feed: السعر من products_master (الشيت اليومي)،
-- الرصيد من dc_stock_levels_by_branch، والصنف الموقوف في dc_products بيستبعد.
create or replace function public.shop_catalog(p_branch text default 'البيطاش')
returns table (sku text, name text, barcode text, price numeric, department text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.sku, trim(p.name), nullif(trim(p.barcode), ''), p.price,
         coalesce(sd.department, nullif(p.category, ''), 'منتجات أخرى'),
         greatest(p.updated_at, s.updated_at)
  from products_master p
  join dc_stock_levels_by_branch s on s.sku = p.sku and s.branch = p_branch and s.qty > 0
  left join dc_products d on d.sku = p.sku
  left join sku_departments sd on sd.sku = p.sku
  where p.price > 0 and coalesce(d.is_active, true) and coalesce(trim(p.name), '') <> ''
  order by p.name;
$$;

-- ===== تسجيل الطلب =====
-- السعر بيتحسب على السيرفر (العميل ميقدرش يغيّره)، ولو الطلب اتبعت مرتين
-- بنفس client_ref (النت فصل وعمل إعادة) بيرجع نفس الطلب من غير تكرار.
create or replace function public.shop_place_order(
  p_client_ref uuid, p_branch text, p_fulfillment text, p_name text, p_phone text,
  p_address text, p_notes text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s shop_settings%rowtype;
  v_phone text := regexp_replace(translate(coalesce(p_phone,''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
  v_existing shop_orders%rowtype;
  v_order shop_orders%rowtype;
  v_lines jsonb := '[]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_sub numeric := 0; v_fee numeric := 0; v_cnt int := 0;
  it record; c record;
begin
  select * into v_existing from shop_orders where client_ref = p_client_ref;
  if found then
    return jsonb_build_object('ok', true, 'order_no', v_existing.order_no, 'total', v_existing.total, 'duplicate', true);
  end if;

  select * into s from shop_settings where id = 1;
  if not s.store_open then
    return jsonb_build_object('ok', false, 'error', 'closed', 'message', s.closed_message);
  end if;
  if not exists (select 1 from jsonb_array_elements(s.branches) b where b->>'key' = p_branch) then
    return jsonb_build_object('ok', false, 'error', 'bad_branch', 'message', 'اختار الفرع');
  end if;
  if length(trim(coalesce(p_name,''))) < 2 then
    return jsonb_build_object('ok', false, 'error', 'bad_name', 'message', 'اكتب الاسم');
  end if;
  if v_phone ~ '^20' then v_phone := '0' || substr(v_phone, 3); end if;
  if v_phone !~ '^01[0125][0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_phone', 'message', 'رقم الموبايل غير صحيح');
  end if;
  if p_fulfillment is null or p_fulfillment not in ('delivery','pickup') then p_fulfillment := 'delivery'; end if;
  if p_fulfillment = 'delivery' and length(trim(coalesce(p_address,''))) < 5 then
    return jsonb_build_object('ok', false, 'error', 'bad_address', 'message', 'اكتب العنوان بالتفصيل');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 150 then
    return jsonb_build_object('ok', false, 'error', 'bad_items', 'message', 'السلة فاضية');
  end if;
  -- حماية من الإغراق: 5 طلبات بالكتير لنفس الرقم في الساعة
  if (select count(*) from shop_orders where phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited', 'message', 'طلبات كتير من نفس الرقم، كلمنا تليفونياً');
  end if;

  for it in
    select x.sku, sum(x.qty) qty from (
      select trim(e->>'sku') sku, (e->>'qty')::numeric qty from jsonb_array_elements(p_items) e
    ) x where x.sku <> '' and x.qty > 0 group by x.sku
  loop
    if it.qty > 100 then
      return jsonb_build_object('ok', false, 'error', 'bad_qty', 'message', 'الكمية كبيرة');
    end if;
    select * into c from shop_catalog(p_branch) k where k.sku = it.sku;
    if not found then
      v_missing := v_missing || to_jsonb(it.sku);
    else
      v_lines := v_lines || jsonb_build_object('sku', c.sku, 'name', c.name, 'barcode', c.barcode,
                                               'price', c.price, 'qty', round(it.qty, 3));
      v_sub := v_sub + round(c.price * round(it.qty, 3), 2);
      v_cnt := v_cnt + 1;
    end if;
  end loop;

  if jsonb_array_length(v_missing) > 0 then
    return jsonb_build_object('ok', false, 'error', 'unavailable', 'skus', v_missing,
      'message', 'فيه أصناف خلصت أو اتغيرت، راجع السلة');
  end if;
  if v_cnt = 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_items', 'message', 'السلة فاضية');
  end if;
  if v_sub < s.min_order then
    return jsonb_build_object('ok', false, 'error', 'min_order', 'message', 'الحد الأدنى للطلب ' || s.min_order || ' جنيه');
  end if;
  if p_fulfillment = 'delivery' and not (s.free_delivery_over is not null and v_sub >= s.free_delivery_over) then
    v_fee := s.delivery_fee;
  end if;

  insert into shop_orders (client_ref, branch, fulfillment, customer_name, phone, address, notes,
                           items_count, subtotal, delivery_fee, total)
  values (p_client_ref, p_branch, p_fulfillment, left(trim(p_name), 80), v_phone,
          case when p_fulfillment = 'delivery' then left(trim(p_address), 400) end,
          nullif(left(trim(coalesce(p_notes,'')), 500), ''), v_cnt, v_sub, v_fee, v_sub + v_fee)
  returning * into v_order;

  insert into shop_order_items (order_id, sku, name, barcode, price, qty, line_total)
  select v_order.id, l->>'sku', l->>'name', l->>'barcode', (l->>'price')::numeric, (l->>'qty')::numeric,
         round((l->>'price')::numeric * (l->>'qty')::numeric, 2)
  from jsonb_array_elements(v_lines) l;

  return jsonb_build_object('ok', true, 'order_no', v_order.order_no, 'subtotal', v_sub,
                            'delivery_fee', v_fee, 'total', v_order.total);
exception when unique_violation then
  select * into v_existing from shop_orders where client_ref = p_client_ref;
  return jsonb_build_object('ok', true, 'order_no', v_existing.order_no, 'total', v_existing.total, 'duplicate', true);
end $$;

-- ===== متابعة الطلب للعميل (لازم رقم الطلب + نفس الموبايل) =====
create or replace function public.shop_track_order(p_order_no bigint, p_phone text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'order_no', o.order_no, 'status', o.status, 'branch', o.branch,
    'fulfillment', o.fulfillment, 'total', o.total, 'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee,
    'created_at', o.created_at, 'updated_at', o.updated_at,
    'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'price', i.price,
                                                  'line_total', i.line_total) order by i.id)
              from shop_order_items i where i.order_id = o.id))
  from shop_orders o
  where o.order_no = p_order_no
    and o.phone = (select case when d ~ '^20' then '0' || substr(d, 3) else d end
                   from regexp_replace(translate(coalesce(p_phone,''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g') d);
$$;

-- ===== لوحة الموظفين (محمية برمز) =====
-- المحاولات الغلط بتتسجل: 10 غلط في 15 دقيقة = قفل مؤقت (ضد التخمين)
create table if not exists public.shop_admin_fails (at timestamptz not null default now());
alter table public.shop_admin_fails enable row level security;
revoke all on public.shop_admin_fails from anon, authenticated;

-- بيرجع null لو الرمز صح، أو رسالة الخطأ
create or replace function public._shop_pin_error(p_pin text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $f$
begin
  if (select count(*) from shop_admin_fails where at > now() - interval '15 minutes') >= 10 then
    return 'محاولات غلط كتير، استنى 15 دقيقة';
  end if;
  if exists (select 1 from shop_admin_secret where pin_hash = extensions.crypt(coalesce(p_pin,''), pin_hash)) then
    return null;
  end if;
  insert into shop_admin_fails default values;
  return 'رمز الدخول غلط';
end $f$;
revoke all on function public._shop_pin_error(text) from public, anon, authenticated;

create or replace function public.shop_admin_orders(p_pin text, p_since timestamptz default now() - interval '3 days')
returns jsonb language plpgsql volatile security definer set search_path = public as $f$
declare e text := _shop_pin_error(p_pin);
begin
  if e is not null then return jsonb_build_object('ok', false, 'error', 'auth', 'message', e); end if;
  return jsonb_build_object('ok', true, 'orders', coalesce((
    select jsonb_agg(to_jsonb(o) || jsonb_build_object('items',
      (select jsonb_agg(jsonb_build_object('sku', i.sku, 'name', i.name, 'barcode', i.barcode, 'qty', i.qty,
                                           'price', i.price, 'line_total', i.line_total) order by i.id)
       from shop_order_items i where i.order_id = o.id)) order by o.created_at desc)
    from shop_orders o
    where o.created_at >= p_since or o.status in ('new','preparing','out_for_delivery','ready')
  ), '[]'::jsonb));
end $f$;

create or replace function public.shop_admin_set_status(p_pin text, p_order_id uuid, p_status text, p_staff_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $f$
declare e text := _shop_pin_error(p_pin);
begin
  if e is not null then return jsonb_build_object('ok', false, 'error', 'auth', 'message', e); end if;
  if p_status not in ('new','preparing','out_for_delivery','ready','delivered','cancelled') then
    return jsonb_build_object('ok', false, 'error', 'bad_status', 'message', 'حالة غير معروفة');
  end if;
  update shop_orders set status = p_status, staff_note = coalesce(nullif(trim(p_staff_note), ''), staff_note), updated_at = now()
   where id = p_order_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'الطلب مش موجود'); end if;
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.shop_admin_update_settings(p_pin text, p_settings jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $f$
declare e text := _shop_pin_error(p_pin);
begin
  if e is not null then return jsonb_build_object('ok', false, 'error', 'auth', 'message', e); end if;
  update shop_settings set
    store_open = coalesce((p_settings->>'store_open')::boolean, store_open),
    closed_message = coalesce(p_settings->>'closed_message', closed_message),
    delivery_fee = coalesce((p_settings->>'delivery_fee')::numeric, delivery_fee),
    free_delivery_over = case when p_settings ? 'free_delivery_over'
                              then nullif(p_settings->>'free_delivery_over', '')::numeric else free_delivery_over end,
    min_order = coalesce((p_settings->>'min_order')::numeric, min_order),
    whatsapp = case when p_settings ? 'whatsapp' then nullif(p_settings->>'whatsapp', '') else whatsapp end,
    phone = case when p_settings ? 'phone' then nullif(p_settings->>'phone', '') else phone end,
    hours = coalesce(p_settings->>'hours', hours),
    updated_at = now()
  where id = 1;
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.shop_admin_change_pin(p_pin text, p_new_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $f$
declare e text := _shop_pin_error(p_pin);
begin
  if e is not null then return jsonb_build_object('ok', false, 'error', 'auth', 'message', e); end if;
  if length(coalesce(p_new_pin, '')) < 6 then
    return jsonb_build_object('ok', false, 'error', 'weak_pin', 'message', 'الرمز لازم 6 أرقام/حروف على الأقل');
  end if;
  update shop_admin_secret set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf')) where id = 1;
  return jsonb_build_object('ok', true);
end $f$;

revoke all on function public.shop_catalog(text), public.shop_place_order(uuid,text,text,text,text,text,text,jsonb),
  public.shop_track_order(bigint,text), public.shop_admin_orders(text,timestamptz),
  public.shop_admin_set_status(text,uuid,text,text), public.shop_admin_update_settings(text,jsonb),
  public.shop_admin_change_pin(text,text) from public;
grant execute on function public.shop_catalog(text), public.shop_place_order(uuid,text,text,text,text,text,text,jsonb),
  public.shop_track_order(bigint,text), public.shop_admin_orders(text,timestamptz),
  public.shop_admin_set_status(text,uuid,text,text), public.shop_admin_update_settings(text,jsonb),
  public.shop_admin_change_pin(text,text) to anon, authenticated;

-- الرمز المبدئي بيتحط مرة واحدة يدوياً (مش في الملف):
--   insert into shop_admin_secret (id, pin_hash) values (1, extensions.crypt('<PIN>', extensions.gen_salt('bf')));
-- وبعد كده يتغير من لوحة الطلبات.

-- دفاع إضافي: الجداول مقفولة تماماً على العامة (الوصول بس من الدوال)
revoke all on public.shop_orders, public.shop_order_items, public.shop_admin_secret from anon, authenticated;
revoke insert, update, delete on public.shop_settings from anon, authenticated;
