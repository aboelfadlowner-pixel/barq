"use client";

import { useEffect, useRef, useState } from "react";
import { useOverlay } from "@/components/layout/OverlayProvider";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/features/cart/CartProvider";
import { CUSTOMER_STORAGE_KEY } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { orderService } from "@/services";
import type { Order } from "@/types/order";

export const CHECKOUT_SHEET_ID = "co";

interface Errors {
  name?: string;
  phone?: string;
  address?: string;
}

/** Egyptian mobile number: strips spaces and dashes and turns Arabic-Indic digits into 0-9 (v29 `submitOrder`). */
const cleanPhone = (value: string) =>
  value.replace(/[\s-]/g, "").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));

/**
 * Delivery details sheet (v29 `#co`): name, mobile, address, note, payment (cash only), total and confirm.
 * Name, phone and address are remembered in localStorage (`abuelfadl_customer`) for the next order.
 */
export function CheckoutSheet({ onPlaced }: { onPlaced: (order: Order) => void }) {
  const { lines, count, total, clear } = useCart();
  const { isOpen, close } = useOverlay();
  const open = isOpen(CHECKOUT_SHEET_ID);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);

  // On open: fill empty fields from the remembered customer, clear old errors, focus the name (v29 `openCO`).
  useEffect(() => {
    if (!open) return;
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOMER_STORAGE_KEY) || "{}") as Record<string, string>;
      setName((current) => current || saved.name || "");
      setPhone((current) => current || saved.phone || "");
      setAddress((current) => current || saved.addr || "");
    } catch {
      // unreadable storage: leave the fields empty
    }
    setErrors({});
    setBusy(false);
    const focusName = () => nameRef.current?.focus({ preventScroll: true });
    // Second pass: the cart drawer restores focus to the header button while it closes.
    const timers = [setTimeout(focusName, 60), setTimeout(focusName, 380)];
    return () => timers.forEach(clearTimeout);
  }, [open]);

  const submit = async (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    if (busy) return;
    const trimmedName = name.trim();
    const mobile = cleanPhone(phone);
    const trimmedAddress = address.trim();
    const next: Errors = {};
    if (trimmedName.length < 3) next.name = "اكتب اسمك من فضلك";
    if (!/^01[0125][0-9]{8}$/.test(mobile)) next.phone = "اكتب رقم موبايل مصري صحيح من 11 رقم";
    if (trimmedAddress.length < 8) next.address = "اكتب العنوان بالتفصيل (الشارع والعمارة والدور)";
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.phone) return phoneRef.current?.focus();
    if (next.address) return addressRef.current?.focus();

    setBusy(true);
    try {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ name: trimmedName, phone: mobile, addr: trimmedAddress }));
    } catch {
      // storage blocked: the order still goes through
    }
    try {
      const placed = await orderService.submitOrder({
        customer: { name: trimmedName, phone: mobile, address: trimmedAddress, note: note.trim() },
        items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        total,
        paymentMethod: "cash",
      });
      clear();
      onPlaced(placed);
    } catch {
      setBusy(false);
      setErrors({ address: "تعذّر إرسال الطلب، حاول مرة أخرى." });
    }
  };

  const fieldClass = (key: keyof Errors) => (errors[key] ? "fld bad" : "fld");

  return (
    <aside className={open ? "sheet co open" : "sheet co"} id="co" role="dialog" aria-modal="true" aria-labelledby="coTitle" inert={!open}>
      <button className="circ sh-x" type="button" id="coClose" aria-label="إغلاق" onClick={() => close(CHECKOUT_SHEET_ID)}>
        <Icon id="i-x" />
      </button>
      <h2 id="coTitle" style={{ marginTop: 34 }}>
        بيانات التوصيل
      </h2>
      <p className="co-sub" id="coSub">
        {count} {count === 1 ? "منتج" : "منتجات"} في طلبك
      </p>
      <form id="coForm" noValidate onSubmit={submit}>
        <div className={fieldClass("name")}>
          <label htmlFor="coName">الاسم</label>
          <input id="coName" name="name" ref={nameRef} autoComplete="name" placeholder="اسمك الكامل" value={name} onChange={(e) => setName(e.target.value)} />
          <small className="err" id="eName">
            {errors.name}
          </small>
        </div>
        <div className={fieldClass("phone")}>
          <label htmlFor="coPhone">رقم الموبايل</label>
          <input
            id="coPhone"
            name="phone"
            ref={phoneRef}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            dir="ltr"
            placeholder="01XXXXXXXXX"
            style={{ textAlign: "right" }}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <small className="err" id="ePhone">
            {errors.phone}
          </small>
        </div>
        <div className={fieldClass("address")}>
          <label htmlFor="coAddr">العنوان</label>
          <textarea
            id="coAddr"
            name="addr"
            ref={addressRef}
            rows={2}
            autoComplete="street-address"
            placeholder="الشارع، رقم العمارة، الدور، الشقة"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <small className="err" id="eAddr">
            {errors.address}
          </small>
        </div>
        <div className="fld">
          <label htmlFor="coNote">
            ملاحظات للطلب <span>(اختياري)</span>
          </label>
          <input id="coNote" name="note" placeholder="علامة مميزة أو أي تعليمات" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <fieldset className="pay">
          <legend>طريقة الدفع</legend>
          <label className="po on">
            <input type="radio" name="pay" value="cash" defaultChecked />
            <span className="pd">كاش عند الاستلام</span>
            <Icon id="i-check" />
          </label>
          <label className="po off">
            <input type="radio" name="pay" value="card" disabled />
            <span className="pd">
              بطاقة بنكية <small>قريبًا</small>
            </span>
          </label>
        </fieldset>
        <div className="co-sum">
          <span>الإجمالي</span>
          <strong id="coTotal">{formatMoney(total)} ج.م</strong>
        </div>
        <button className="btn btn-primary" type="button" id="coSubmit" style={{ width: "100%" }} disabled={busy} onClick={submit}>
          تأكيد الطلب
        </button>
      </form>
    </aside>
  );
}
