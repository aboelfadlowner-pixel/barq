-- =====================================================================
--  38 — the call center corrects a customer's name.
--
--  CONFIRMED: in the order's customer window (the ✏️ next to «اسم العميل»,
--  before starting the order or while in it) the name of a saved customer can be
--  corrected. It is saved on the customer, so his next orders show it; orders
--  already sent keep the name they were sent with.
--
--  CALL-CENTER ONLY: one new function. Nothing existing is changed or deleted.
--  Safe to re-run.
-- =====================================================================

create or replace function public.cc_set_customer_name(p_customer_id uuid, p_name text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if coalesce(public.cc_my_role(), '') not in ('call_center', 'admin') then
    raise exception 'تعديل العميل للكول سنتر بس' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'اكتب اسم العميل (لحد 120 حرف)' using errcode = '22023', hint = 'name';
  end if;
  update public.cc_customers set name = v_name where id = p_customer_id;
  if not found then
    raise exception 'العميل غير موجود' using errcode = 'P0002', hint = 'customer';
  end if;
  return v_name;
end;
$$;
revoke all on function public.cc_set_customer_name(uuid, text) from public, anon;
grant execute on function public.cc_set_customer_name(uuid, text) to authenticated;
