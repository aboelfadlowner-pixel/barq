-- =====================================================================
--  42 — «العملاء»: edit the customer like Foodics.
--
--  CONFIRMED: on the customer's page the call center can change
--    • the name, the main number and the second number — a number that belongs to
--      another customer is refused with that customer's name;
--    • the addresses: add one, edit one (name, area, street, type, notes), and
--      «شيل» one — it is only hidden (old orders keep it), it no longer shows when
--      making an order.
--  Orders already sent keep what they were sent with.
--
--  CALL-CENTER ONLY: one new EMPTY column on cc_addresses (hidden_at), its read rule
--  (03_security.sql) + «not hidden», and three new functions. Nothing is deleted. Safe to re-run.
-- =====================================================================

alter table public.cc_addresses add column if not exists hidden_at timestamptz;
-- A hidden address is not read by the screens any more (customer page, making an order).
-- Same policy as 03_security.sql + «not hidden»; orders keep their own copy of the address.
drop policy if exists cc_addresses_staff_read on public.cc_addresses;
create policy cc_addresses_staff_read on public.cc_addresses for select to authenticated
  using ((select public.cc_is_staff()) and hidden_at is null);

-- Name and numbers → { name, phone, phone2 }
create or replace function public.cc_customer_update(p_customer_id uuid, p_name text, p_phone text, p_phone2 text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name   text := btrim(coalesce(p_name, ''));
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone2 text := nullif(regexp_replace(coalesce(p_phone2, ''), '\D', '', 'g'), '');
  v_other  public.cc_customers;
  v_c      public.cc_customers;
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'تعديل العميل للكول سنتر بس' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'اكتب اسم العميل (لحد 120 حرف)' using errcode = '22023', hint = 'name';
  end if;
  if v_phone !~ '^0[0-9]{8,10}$' then
    raise exception 'رقم الموبايل غير صحيح — مثال: 01012345678' using errcode = '22023', hint = 'phone';
  end if;
  if v_phone2 is not null and v_phone2 !~ '^0[0-9]{8,10}$' then
    raise exception 'الرقم الإضافي غير صحيح' using errcode = '22023', hint = 'phone2';
  end if;
  if v_phone2 = v_phone then
    raise exception 'الرقم الإضافي هو نفس الرقم الأساسي' using errcode = '22023', hint = 'phone2';
  end if;
  select * into v_c from public.cc_customers where id = p_customer_id for update;
  if not found then
    raise exception 'العميل غير موجود' using errcode = 'P0002', hint = 'customer';
  end if;
  -- only a number that is new for this customer is checked (two customers that already share a number
  -- from before can still have their name or the other number corrected)
  select * into v_other from public.cc_customers o
   where o.id <> p_customer_id
     and exists (select 1 from unnest(array[v_phone, v_phone2]) n
                  where n is not null and n not in (v_c.phone, coalesce(v_c.phone2, '')) and n in (o.phone, coalesce(o.phone2, '')))
   limit 1;
  if found then
    raise exception 'الرقم ده متسجل للعميل «%» — مينفعش يتكرر', v_other.name using errcode = '23505', hint = 'phone';
  end if;
  begin
    update public.cc_customers set name = v_name, phone = v_phone, phone2 = v_phone2 where id = p_customer_id
    returning * into v_c;
  exception when unique_violation then
    raise exception 'الرقم ده متسجل لعميل تاني — مينفعش يتكرر' using errcode = '23505', hint = 'phone';
  end;
  return jsonb_build_object('name', v_c.name, 'phone', v_c.phone, 'phone2', v_c.phone2);
end;
$$;

-- Add (p_address_id null) or edit one of the customer's addresses → its id
create or replace function public.cc_customer_address_save(p_customer_id uuid, p_address_id uuid, p_label text, p_area_id uuid,
                                                           p_street text, p_housing_type text, p_notes text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_label   text := btrim(coalesce(p_label, ''));
  v_street  text := btrim(coalesce(p_street, ''));
  v_housing text := nullif(btrim(coalesce(p_housing_type, '')), '');
  v_notes   text := nullif(btrim(coalesce(p_notes, '')), '');
  v_id      uuid;
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'تعديل العميل للكول سنتر بس' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cc_customers where id = p_customer_id) then
    raise exception 'العميل غير موجود' using errcode = 'P0002', hint = 'customer';
  end if;
  if char_length(v_label) not between 1 and 40 then
    raise exception 'اسم العنوان مطلوب وبحد أقصى 40 حرف' using errcode = '22023', hint = 'label';
  end if;
  if p_area_id is null or not exists (select 1 from public.cc_delivery_areas where id = p_area_id and active) then
    raise exception 'اختر منطقة التوصيل' using errcode = '22023', hint = 'areaId';
  end if;
  if char_length(v_street) not between 1 and 150 then
    raise exception 'الشارع مطلوب وبحد أقصى 150 حرف' using errcode = '22023', hint = 'street';
  end if;
  if v_housing is not null and v_housing not in ('building', 'villa', 'office') then
    raise exception 'نوع السكن غير صحيح' using errcode = '22023', hint = 'housingType';
  end if;
  if char_length(coalesce(v_notes, '')) > 200 then
    raise exception 'المعلومات الإضافية بحد أقصى 200 حرف' using errcode = '22023', hint = 'notes';
  end if;
  if p_address_id is null then
    insert into public.cc_addresses (customer_id, label, area_id, street, housing_type, notes, created_by)
    values (p_customer_id, v_label, p_area_id, v_street, v_housing, v_notes, auth.uid())
    returning id into v_id;
  else
    update public.cc_addresses
       set label = v_label, area_id = p_area_id, street = v_street, housing_type = v_housing, notes = v_notes,
           updated_at = now(), updated_by = auth.uid()
     where id = p_address_id and customer_id = p_customer_id and hidden_at is null
    returning id into v_id;
    if v_id is null then
      raise exception 'العنوان غير موجود لهذا العميل' using errcode = 'P0002', hint = 'address';
    end if;
  end if;
  return v_id;
end;
$$;

-- «شيل العنوان»: hidden, not deleted (old orders keep it)
create or replace function public.cc_customer_address_hide(p_address_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'تعديل العميل للكول سنتر بس' using errcode = '42501';
  end if;
  update public.cc_addresses set hidden_at = now(), updated_at = now(), updated_by = auth.uid()
   where id = p_address_id and hidden_at is null;
  return found;
end;
$$;

revoke all on function public.cc_customer_update(uuid, text, text, text) from public, anon;
revoke all on function public.cc_customer_address_save(uuid, uuid, text, uuid, text, text, text) from public, anon;
revoke all on function public.cc_customer_address_hide(uuid) from public, anon;
grant execute on function public.cc_customer_update(uuid, text, text, text) to authenticated;
grant execute on function public.cc_customer_address_save(uuid, uuid, text, uuid, text, text, text) to authenticated;
grant execute on function public.cc_customer_address_hide(uuid) to authenticated;
