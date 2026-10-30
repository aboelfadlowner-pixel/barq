"use client";

import { useEffect, useRef, useState } from "react";
import { useOverlay } from "@/components/layout/OverlayProvider";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/features/cart/CartProvider";
import { useSettings } from "@/features/settings/SettingsProvider";
import { CUSTOMER_STORAGE_KEY } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { isOrderNotDelivered } from "@/lib/orderErrors";
import { orderService } from "@/services/client";
import type { Order } from "@/types/order";

/** Random id for one checkout (crypto.randomUUID needs a secure page; the fallback is enough to tell retries apart). */
const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export const CHECKOUT_SHEET_ID = "co";

interface Errors {
  name?: string;
  phone?: string;
  address?: string;
  area?: string;
}

/** WhatsApp link with the whole order written out, for when the store cannot be reached. */
function whatsappOrderLink(number: string, order: { name: string; phone: string; area?: string; address: string; note: string; lines: { name: string; quantity: number; weighed: boolean; price: number }[]; delivery: number; total: number }) {
  const text = [
    "طلب جديد من الموقع (لم يصل للمتجر بسبب عطل):",
    `الاسم: ${order.name}`,
    `الموبايل: ${order.phone}`,
    ...(order.area ? [`المنطقة: ${order.area}`] : []),
    `العنوان: ${order.address}`,
    ...(order.note ? [`ملاحظات: ${order.note}`] : []),
    "",
    "الطلب:",
    ...order.lines.map((line) => `- ${line.name} × ${line.weighed ? `${line.quantity} كيلو` : line.quantity} = ${formatMoney(line.price * line.quantity)} ج.م`),
    ...(order.delivery ? [`التوصيل: ${formatMoney(order.delivery)} ج.م`] : []),
    `الإجمالي: ${formatMoney(order.total)} ج.م (الدفع عند الاستلام)`,
  ].join("\n");
  return `https://wa.me/2${number}?text=${encodeURIComponent(text)}`;
}

/** Egyptian mobile number: strips spaces and dashes and turns Arabic-Indic digits into 0-9 (v29 `submitOrder`). */
const cleanPhone = (value: string) =>
  value.replace(/[\s-]/g, "").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));

/**
 * Delivery details sheet (v29 `#co`): name, mobile, delivery area (fee from the dashboard settings), address, note,
 * payment (cash only), totals and confirm. Name, phone, area and address are remembered in localStorage
 * (`abuelfadl_customer`) for the next order.
 */
export function CheckoutSheet({ onPlaced }: { onPlaced: (order: Order) => void }) {
  const { lines, count, total, clear } = useCart();
  const { isOpen, close } = useOverlay();
  const open = isOpen(CHECKOUT_SHEET_ID);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [areaId, setAreaId] = useState("");
  const settings = useSettings();
  const areas = settings.deliveryAreas.filter((area) => area.active);
  const area = areas.find((a) => a.id === areaId);
  const deliveryFee = area?.fee ?? 0;
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  /** Set when the order could not reach the store: a WhatsApp link with the order written out. */
  const [fallback, setFallback] = useState("");
  /** One id per opening of the form: a retry after a lost answer is recognised by the server as the same order. */
  const requestId = useRef("");
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
      setAreaId((current) => current || saved.area || "");
    } catch {
      // unreadable storage: leave the fields empty
    }
    setErrors({});
    setBusy(false);
    setFallback("");
    requestId.current = newRequestId();
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
    if (trimmedName.length < 3) next.name = "من فضلك اكتب اسمك";
    if (!/^01[0125][0-9]{8}$/.test(mobile)) next.phone = "اكتب رقم موبايل مصري صحيح (11 رقمًا)";
    if (areas.length && !area) next.area = "اختر منطقة التوصيل";
    if (trimmedAddress.length < 8) next.address = "اكتب العنوان بالتفصيل (الشارع والعمارة والدور)";
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.phone) return phoneRef.current?.focus();
    if (next.area) return document.getElementById("coAreas")?.querySelector<HTMLInputElement>("input")?.focus();
    if (next.address) return addressRef.current?.focus();

    setBusy(true);
    try {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ name: trimmedName, phone: mobile, addr: trimmedAddress, area: areaId }));
    } catch {
      // storage blocked: the order still goes through
    }
    try {
      const placed = await orderService.submitOrder({
        customer: { name: trimmedName, phone: mobile, address: trimmedAddress, note: note.trim() },
        items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        areaId: area?.id,
        total: total + deliveryFee,
        paymentMethod: "cash",
        requestId: requestId.current,
      });
      clear();
      onPlaced(placed);
    } catch (error) {
      setBusy(false);
      const whatsapp = settings.whatsapp || settings.phone;
      if (isOrderNotDelivered(error) && whatsapp) {
        // The store could not be reached: the order is not lost, the customer sends it on WhatsApp in one tap.
        setErrors({});
        setFallback(
          whatsappOrderLink(whatsapp, {
            name: trimmedName,
            phone: mobile,
            area: area?.name,
            address: trimmedAddress,
            note: note.trim(),
            lines: lines.map(({ product, quantity }) => ({ name: product.name, quantity, weighed: product.weighed, price: product.price })),
            delivery: deliveryFee,
            total: total + deliveryFee,
          }),
        );
        return;
      }
      // The server explains what went wrong (e.g. a product just went out of stock).
      setErrors({ address: error instanceof Error && error.message ? error.message : "تعذّر إرسال الطلب، حاول مرة أخرى." });
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
        {areas.length ? (
          <fieldset className={errors.area ? "pay areas bad" : "pay areas"} id="coAreas">
            <legend>منطقة التوصيل</legend>
            {areas.map((option) => (
              <label key={option.id} className={option.id === areaId ? "po on" : "po"}>
                <input type="radio" name="area" value={option.id} checked={option.id === areaId} onChange={() => (setAreaId(option.id), setErrors((e) => ({ ...e, area: undefined })))} />
                <span className="pd">{option.name}</span>
                <b className="fee">{option.fee ? `${formatMoney(option.fee)} ج.م` : "مجانًا"}</b>
              </label>
            ))}
            <small className="err">{errors.area}</small>
          </fieldset>
        ) : null}
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
            <span className="pd">الدفع نقدًا عند الاستلام</span>
            <Icon id="i-check" />
          </label>
          <label className="po off">
            <input type="radio" name="pay" value="card" disabled />
            <span className="pd">
              بطاقة بنكية <small>قريبًا</small>
            </span>
          </label>
        </fieldset>
        {areas.length ? (
          <div className="co-lines">
            <div>
              <span>المنتجات</span>
              <span>{formatMoney(total)} ج.م</span>
            </div>
            <div>
              <span>التوصيل{area ? ` (${area.name})` : ""}</span>
              <span>{area ? `${formatMoney(deliveryFee)} ج.م` : "اختر المنطقة"}</span>
            </div>
          </div>
        ) : null}
        <div className="co-sum">
          <span>الإجمالي</span>
          <strong id="coTotal">{formatMoney(total + deliveryFee)} ج.م</strong>
        </div>
        {fallback ? (
          <div className="co-fallback" role="alert">
            <p>
              <b>لم يصل طلبك إلى المتجر بسبب عطل مؤقت.</b> لا تقلق، طلبك محفوظ: أرسله لنا على واتساب بضغطة واحدة وسنؤكده معك.
            </p>
            <a className="btn btn-primary" href={fallback} target="_blank" rel="noreferrer" style={{ width: "100%" }}>
              أرسل الطلب على واتساب
            </a>
            <button className="btn btn-ghost" type="button" style={{ width: "100%" }} disabled={busy} onClick={submit}>
              حاول الإرسال من الموقع مرة أخرى
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" type="button" id="coSubmit" style={{ width: "100%" }} disabled={busy} onClick={submit}>
            تأكيد الطلب
          </button>
        )}
      </form>
    </aside>
  );
}
