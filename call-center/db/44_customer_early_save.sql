-- =====================================================================
--  44 — a new customer is saved as soon as his details are saved.
--
--  CONFIRMED: when the call center saves a NEW customer's details in the order's
--  customer window (name, number, address), the customer and the address are saved
--  in the database at once — even if he then decides not to order. He shows in
--  «العملاء» (0 orders) and comes up by his number next time. A new address added to
--  a saved customer is saved at once too (cc_customer_address_save, 42). Sending the
--  order later links it to the same customer — never a second one.
--  A number on the black list is refused, as when ordering.
--
--  CALL-CENTER ONLY: one new function. Nothing existing is changed or deleted. Safe to re-run.
-- =====================================================================

create or replace function public.cc_customer_create(p_name text, p_phone text, p_phone2 text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name   text := btrim(coalesce(p_name, ''));
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone2 text := nullif(regexp_replace(coalesce(p_phone2, ''), '\D', '', 'g'), '');
  v_c      public.cc_customers;
  v_block  text;
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'تسجيل العملاء للكول سنتر بس' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'اسم العميل مطلوب وبحد أقصى 120 حرف' using errcode = '22023', hint = 'name';
  end if;
  if v_phone !~ '^0[0-9]{8,10}$' then
    raise exception 'رقم الموبايل غير صحيح — مثال: 01012345678' using errcode = '22023', hint = 'phone';
  end if;
  if v_phone2 is not null and (v_phone2 !~ '^0[0-9]{8,10}$' or v_phone2 = v_phone) then
    raise exception 'الرقم الإضافي غير صحيح' using errcode = '22023', hint = 'phone2';
  end if;
  select b.phone into v_block from public.cc_blocked_phones b where b.phone in (v_phone, v_phone2) limit 1;
  if v_block is not null then
    raise exception 'الرقم % في القائمة السوداء — ممنوع من الطلب', v_block using errcode = '22023', hint = 'blocked';
  end if;
  -- already saved with this number (another screen just did it): that customer, not a second one
  select * into v_c from public.cc_customers where phone = v_phone;
  if not found then
    begin
      insert into public.cc_customers (name, phone, phone2, created_by)
      values (v_name, v_phone, v_phone2, auth.uid())
      returning * into v_c;
    exception when unique_violation then
      select * into v_c from public.cc_customers where phone = v_phone;
    end;
  end if;
  return jsonb_build_object('id', v_c.id, 'name', v_c.name, 'phone', v_c.phone, 'phone2', v_c.phone2);
end;
$$;
revoke all on function public.cc_customer_create(text, text, text) from public, anon;
grant execute on function public.cc_customer_create(text, text, text) to authenticated;
