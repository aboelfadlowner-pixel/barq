-- =====================================================================
--  37 — the branch corrects an order while preparing it.
--
--  CONFIRMED: from «ابدأ التجهيز» until the driver leaves, the prep screen can:
--    • «⚖️ الوزن الفعلي» on a weighed product: the real weight (e.g. 500 → 540 g),
--      priced from the order's own price per kg (a warning first when it differs
--      by more than 20%);
--    • «🔄 تبديل» any product with another product from the products sheet (same
--      names and prices as the call center), with its quantity or weight;
--    • «❌ مش موجود»: take a product off the order (not the last one).
--  The order's total follows at once, so the cashier closes the day on the real
--  amounts. The call center is told (a ring and a line on the card); no reprint.
--  Every change is kept in cc_order_edits (old and new lines, who, when).
--
--  CALL-CENTER ONLY: two new functions. Nothing existing is changed or deleted.
--  Safe to re-run.
-- =====================================================================

create or replace function public.cc_prep_adjust(p_order_id uuid, p_line_no int, p_name text, p_action text,
                                                 p_grams int default null, p_sku text default null, p_qty int default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin   boolean := public.cc_is_admin();
  v_o       public.cc_orders;
  v_line    public.cc_order_items;
  v_prod    record;
  v_sold_by text;
  v_old     jsonb;
  v_new     jsonb;
  v_change  jsonb;
  v_total   numeric(12,2);
  v_sub     numeric(12,2);
  v_name    text;
  v_addr    jsonb;
begin
  if coalesce(public.cc_my_role(), '') not in ('prep', 'admin') then
    raise exception 'تعديل الطلب من التجهيز للفرع بس' using errcode = '42501';
  end if;
  if p_action not in ('weight', 'replace', 'remove') then
    raise exception 'نوع التعديل غير معروف' using errcode = '22023', hint = 'action';
  end if;
  select * into v_o from public.cc_orders where id = p_order_id for update;
  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0002';
  end if;
  if v_o.status = 'cancelled' then
    raise exception 'الطلب ده اتلغى' using errcode = '22023', hint = 'cancelled';
  end if;
  if v_o.stage not in ('preparing', 'at_cashier') then
    raise exception 'التعديل بيبدأ من «ابدأ التجهيز» لحد ما الطيار يخرج' using errcode = '22023', hint = 'stale';
  end if;
  if v_o.prep_user_id is not null and v_o.prep_user_id <> auth.uid() and not v_admin then
    raise exception 'الطلب ده مع % — دوس «خده مني» لو هتكمّله إنت', coalesce(v_o.prep_name, 'زميلك')
      using errcode = '22023', hint = 'taken';
  end if;
  select * into v_line from public.cc_order_items where order_id = p_order_id and line_no = p_line_no;
  if not found or v_line.product_name is distinct from p_name then
    raise exception 'الطلب اتغيّر من جهاز تاني — اعمل تحديث' using errcode = '22023', hint = 'stale';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('line_no', i.line_no, 'sku', i.sku, 'name', i.product_name, 'unit_price', i.unit_price,
           'qty', i.qty, 'weight_grams', i.weight_grams, 'line_total', i.line_total, 'note', i.note, 'modifiers', i.modifiers)
           order by i.line_no), '[]'::jsonb)
    into v_old from public.cc_order_items i where i.order_id = p_order_id;

  if p_action = 'weight' then
    if v_line.weight_grams is null then
      raise exception 'الصنف ده بالعدد مش بالوزن' using errcode = '22023', hint = 'items';
    end if;
    if p_grams is null or p_grams not between 10 and 20000 then
      raise exception 'الوزن غير صحيح (من 10 جم لـ 20 كيلو)' using errcode = '22023', hint = 'grams';
    end if;
    if p_grams = v_line.weight_grams then
      raise exception 'ده نفس الوزن' using errcode = '22023', hint = 'nochange';
    end if;
    -- only the weighed part changes; add-ons stay as they were
    v_total := v_line.line_total - round(v_line.unit_price * v_line.weight_grams / 1000.0, 2)
                                 + round(v_line.unit_price * p_grams / 1000.0, 2);
    update public.cc_order_items set weight_grams = p_grams, line_total = greatest(v_total, 0) where id = v_line.id;
    v_change := jsonb_build_object('kind', 'weight', 'by', 'prep', 'name', v_line.product_name,
                                   'from', jsonb_build_object('grams', v_line.weight_grams), 'to', jsonb_build_object('grams', p_grams));

  elsif p_action = 'remove' then
    if (select count(*) from public.cc_order_items where order_id = p_order_id) <= 1 then
      raise exception 'ده آخر صنف في الطلب — لو مفيش حاجة يبقى الطلب يتلغي من الكول سنتر' using errcode = '22023', hint = 'last';
    end if;
    delete from public.cc_order_items where id = v_line.id;
    -- keep the lines numbered 1..n (two steps: line numbers are unique per order)
    update public.cc_order_items set line_no = -line_no where order_id = p_order_id;
    update public.cc_order_items i set line_no = r.n
      from (select id, row_number() over (order by -line_no) as n from public.cc_order_items where order_id = p_order_id) r
     where i.id = r.id;
    v_change := jsonb_build_object('kind', 'removed', 'by', 'prep', 'name', v_line.product_name,
                                   'from', jsonb_build_object('qty', v_line.qty, 'grams', v_line.weight_grams));

  else  -- replace
    begin
      select p.sku, p.name, coalesce(p.price, 0)::numeric(12,2) as price into strict v_prod
        from public.products_master p where p.sku = p_sku;
    exception
      when no_data_found then
        raise exception 'الصنف مش موجود في شيت المنتجات' using errcode = 'P0002', hint = 'items';
      when too_many_rows then
        raise exception 'كود الصنف % مكرر في شيت المنتجات — لازم يتصلح في الشيت الأول', p_sku using errcode = 'P0003', hint = 'items';
    end;
    v_sold_by := coalesce(public.cc_sold_by(v_prod.sku), 'unit');
    if v_sold_by = 'weight' then
      if p_grams is null or p_grams not between 10 and 20000 then
        raise exception 'الصنف «%» بيتباع بالوزن — اكتب الوزن', v_prod.name using errcode = '22023', hint = 'grams';
      end if;
      v_total := round(v_prod.price * p_grams / 1000.0, 2);
    else
      if p_qty is null or p_qty not between 1 and 999 then
        raise exception 'الصنف «%» بيتباع بالعدد — اكتب الكمية', v_prod.name using errcode = '22023', hint = 'qty';
      end if;
      v_total := round(v_prod.price * p_qty, 2);
    end if;
    update public.cc_order_items
       set sku = v_prod.sku, product_name = v_prod.name, unit_price = v_prod.price,
           qty = case when v_sold_by = 'weight' then null else p_qty end,
           weight_grams = case when v_sold_by = 'weight' then p_grams else null end,
           line_total = v_total, modifiers = null
     where id = v_line.id;
    v_change := jsonb_build_object('kind', 'replaced', 'by', 'prep', 'name', v_line.product_name, 'to_name', v_prod.name,
                                   'from', jsonb_build_object('qty', v_line.qty, 'grams', v_line.weight_grams),
                                   'to', jsonb_build_object('qty', case when v_sold_by = 'weight' then null else p_qty end,
                                                            'grams', case when v_sold_by = 'weight' then p_grams end));
  end if;

  select coalesce(sum(line_total), 0) into v_sub from public.cc_order_items where order_id = p_order_id;
  select coalesce(jsonb_agg(jsonb_build_object('line_no', i.line_no, 'sku', i.sku, 'name', i.product_name, 'unit_price', i.unit_price,
           'qty', i.qty, 'weight_grams', i.weight_grams, 'line_total', i.line_total, 'note', i.note, 'modifiers', i.modifiers)
           order by i.line_no), '[]'::jsonb)
    into v_new from public.cc_order_items i where i.order_id = p_order_id;
  v_name := public.cc_person_name(auth.uid());
  v_addr := jsonb_build_object('area', v_o.area_name, 'street', v_o.street, 'housing_type', v_o.housing_type, 'notes', v_o.address_notes);
  insert into public.cc_order_edits (order_id, by_user, agent_name, old_items, new_items, old_address, new_address,
                                     old_note, new_note, old_total, new_total, changes)
  values (p_order_id, auth.uid(), v_name, v_old, v_new, v_addr, v_addr, v_o.note, v_o.note,
          v_o.total, v_sub + v_o.delivery_fee, jsonb_build_array(v_change));
  update public.cc_orders set subtotal = v_sub, total = v_sub + v_o.delivery_fee where id = p_order_id;
  return jsonb_build_object('old_total', v_o.total, 'new_total', v_sub + v_o.delivery_fee, 'change', v_change);
end;
$$;

-- The call center and the admin: the branch's corrections — of today (for the board),
-- or of one order (for its page). Newest last.
create or replace function public.cc_prep_adjustments(p_order_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'غير مصرح' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'order_id', e.order_id, 'order_no', o.order_no, 'at', e.at,
             'by', e.agent_name, 'change', e.changes->0, 'old_total', e.old_total, 'new_total', e.new_total) order by e.id)
      from public.cc_order_edits e join public.cc_orders o on o.id = e.order_id
     where e.changes->0->>'by' = 'prep'
       and (case when p_order_id is null then e.at >= public.cc_work_day_start() else e.order_id = p_order_id end)), '[]'::jsonb);
end;
$$;

revoke all on function public.cc_prep_adjust(uuid, int, text, text, int, text, int) from public, anon;
revoke all on function public.cc_prep_adjustments(uuid) from public, anon;
grant execute on function public.cc_prep_adjust(uuid, int, text, text, int, text, int) to authenticated;
grant execute on function public.cc_prep_adjustments(uuid) to authenticated;
