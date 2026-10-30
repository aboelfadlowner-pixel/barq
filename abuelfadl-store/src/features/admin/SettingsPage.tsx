"use client";

import { useEffect, useState } from "react";
import { noticeText } from "@/lib/settings";
import { outsideHoursMessage } from "@/lib/hours";
import type { Branch, DeliveryArea, HomeImages, OrderHours, StoreSettings } from "@/types/settings";
import { api, AdminApiError } from "./api";
import { ImagePicker } from "./ImagePicker";
import { Field, useToast } from "./ui";

interface FormState {
  minOrder: string;
  notice: string;
  whatsapp: string;
  closedMessage: string;
  phone: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  workHours: string;
  deliveryHours: string;
  offersTitle: string;
  offersKicker: string;
  branches: Branch[];
  /** Fees as typed (strings), turned into numbers when saving. */
  deliveryAreas: (Omit<DeliveryArea, "fee"> & { fee: string })[];
  orderHours: OrderHours;
  homeImages: HomeImages;
}

type TextField = Exclude<keyof FormState, "branches" | "deliveryAreas" | "orderHours" | "homeImages">;

const toForm = (s: StoreSettings): FormState => ({
  minOrder: String(s.minOrder),
  notice: s.notice,
  whatsapp: s.whatsapp,
  closedMessage: s.closedMessage,
  phone: s.phone,
  facebook: s.facebook,
  instagram: s.instagram,
  tiktok: s.tiktok,
  workHours: s.workHours,
  deliveryHours: s.deliveryHours,
  offersTitle: s.offersTitle,
  offersKicker: s.offersKicker,
  deliveryAreas: s.deliveryAreas.map((area) => ({ ...area, fee: String(area.fee) })),
  orderHours: s.orderHours,
  homeImages: s.homeImages,
  branches: s.branches,
});

/** Store settings: pause/resume orders (saved at once) and the texts and numbers the store shows (saved with "حفظ"). */
export function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<StoreSettings>("/api/admin/settings").then(
      (loaded) => {
        setSettings(loaded);
        setForm(toForm(loaded));
      },
      (err: Error) => setMessage(err.message),
    );
  }, []);

  const save = async (body: Partial<StoreSettings> | Record<string, unknown>, done: string) => {
    setBusy(true);
    setErrors({});
    setMessage("");
    try {
      const saved = await api<StoreSettings>("/api/admin/settings", { method: "PATCH", body });
      setSettings(saved);
      setForm(toForm(saved));
      toast(done);
    } catch (err) {
      if (err instanceof AdminApiError) setErrors(err.fields);
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!settings || !form) return message ? <div className="alert">{message}</div> : <div className="empty">جارٍ التحميل…</div>;

  const set = (key: TextField, value: string) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const setBranch = (index: number, patch: Partial<Branch>) =>
    setForm((f) => (f ? { ...f, branches: f.branches.map((b, i) => (i === index ? { ...b, ...patch } : b)) } : f));
  const addBranch = () => setForm((f) => (f ? { ...f, branches: [...f.branches, { name: "", address: "", mapUrl: "" }] } : f));
  const removeBranch = (index: number) => setForm((f) => (f ? { ...f, branches: f.branches.filter((_, i) => i !== index) } : f));
  const setArea = (index: number, patch: Partial<FormState["deliveryAreas"][number]>) =>
    setForm((f) => (f ? { ...f, deliveryAreas: f.deliveryAreas.map((a, i) => (i === index ? { ...a, ...patch } : a)) } : f));
  const addArea = () => setForm((f) => (f ? { ...f, deliveryAreas: [...f.deliveryAreas, { id: "", name: "", fee: "", active: true }] } : f));
  const removeArea = (index: number) => setForm((f) => (f ? { ...f, deliveryAreas: f.deliveryAreas.filter((_, i) => i !== index) } : f));
  const setHomeImage = (key: keyof HomeImages, url: string) => setForm((f) => (f ? { ...f, homeImages: { ...f.homeImages, [key]: url } } : f));
  const setHours = (patch: Partial<OrderHours>) => setForm((f) => (f ? { ...f, orderHours: { ...f.orderHours, ...patch } } : f));
  const preview = noticeText({ ...settings, notice: form.notice, closedMessage: form.closedMessage, minOrder: Number(form.minOrder) || 0 });
  const changed = JSON.stringify(form) !== JSON.stringify(toForm(settings));

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>الإعدادات</h1>
          <p>تظهر التعديلات في المتجر فورًا</p>
        </div>
      </div>

      <div className="stack" style={{ maxWidth: 720 }}>
        <div className={`card card-pad orders-switch ${settings.ordersOpen ? "open" : "paused"}`}>
          <div>
            <h2>استقبال الطلبات</h2>
            <p className="muted">
              {settings.ordersOpen
                ? "مفعّل: يمكن للعملاء الطلب من الموقع."
                : "متوقف: الموقع متاح للتصفح فقط، ولا تُقبل الطلبات حتى تعيد تشغيله."}
            </p>
          </div>
          <button
            className={settings.ordersOpen ? "btn btn-danger" : "btn btn-primary"}
            type="button"
            disabled={busy}
            onClick={() => {
              if (settings.ordersOpen && !confirm("سيتم إيقاف استقبال الطلبات من الموقع. هل أنت متأكد؟")) return;
              save({ ordersOpen: !settings.ordersOpen }, settings.ordersOpen ? "تم إيقاف استقبال الطلبات" : "تم تشغيل استقبال الطلبات");
            }}
          >
            {settings.ordersOpen ? "إيقاف الطلبات" : "تشغيل الطلبات"}
          </button>
        </div>

        {message ? <div className="alert">{message}</div> : null}

        <form
          className="card card-pad stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save({ ...form, minOrder: Number(form.minOrder), deliveryAreas: form.deliveryAreas.map((a) => ({ ...a, fee: a.fee.trim() === "" ? "" : Number(a.fee) })) }, "تم حفظ الإعدادات");
          }}
        >
          <h2>المتجر</h2>
          <Field label="الحد الأدنى للطلب (ج.م)" error={errors.minOrder} hint="0 = بدون حد أدنى">
            <input className="input num" inputMode="decimal" dir="ltr" value={form.minOrder} onChange={(e) => set("minOrder", e.target.value)} />
          </Field>
          <Field label="نص الشريط العلوي" error={errors.notice} hint="يُضاف الحد الأدنى بعدها تلقائيًا">
            <input className="input" value={form.notice} onChange={(e) => set("notice", e.target.value)} />
          </Field>
          <Field label="رسالة وقت إيقاف الطلبات" error={errors.closedMessage} hint="تظهر في الشريط وفي السلة عند إيقاف الطلبات">
            <input className="input" value={form.closedMessage} onChange={(e) => set("closedMessage", e.target.value)} />
          </Field>
          <div className="settings-preview">
            <small className="muted">سيظهر الشريط هكذا:</small>
            <div className={settings.ordersOpen ? "" : "paused"}>{preview || "(لن يظهر شريط)"}</div>
          </div>

          <h2 style={{ marginTop: 10 }}>مواعيد استقبال الطلبات</h2>
          <label className="check">
            <input type="checkbox" checked={form.orderHours.enabled} onChange={(e) => setHours({ enabled: e.target.checked })} />
            تُفتح الطلبات وتُغلق تلقائيًا في هذه المواعيد
          </label>
          <div className="grid2">
            <Field label="بداية استقبال الطلبات" error={errors.orderHours}>
              <input className="input num" type="time" value={form.orderHours.open} disabled={!form.orderHours.enabled} onChange={(e) => setHours({ open: e.target.value })} />
            </Field>
            <Field label="نهاية استقبال الطلبات" hint="إذا كان بعد منتصف الليل فاكتبه كالمعتاد (مثلًا 01:30)">
              <input className="input num" type="time" value={form.orderHours.close} disabled={!form.orderHours.enabled} onChange={(e) => setHours({ close: e.target.value })} />
            </Field>
          </div>
          {form.orderHours.enabled ? <small className="muted">خارج المواعيد سيعرض الموقع: «{outsideHoursMessage(form.orderHours)}»</small> : null}

          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>مناطق التوصيل</h2>
              <button className="btn btn-sm" type="button" onClick={addArea} disabled={form.deliveryAreas.length >= 20}>
                + منطقة
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
              يختار العميل منطقته أثناء الطلب، وتُضاف الرسوم إلى الإجمالي. أزل علامة «مفعّلة» لإيقاف منطقة بدون حذفها.
            </p>
            {errors.deliveryAreas ? <div className="alert">{errors.deliveryAreas}</div> : null}
            {form.deliveryAreas.map((area, index) => (
              <div key={area.id || `new-${index}`} className="area-row">
                <input className="input" placeholder="اسم المنطقة" value={area.name} onChange={(e) => setArea(index, { name: e.target.value })} aria-label="اسم المنطقة" />
                <div className="area-fee">
                  <input className="input num" inputMode="decimal" placeholder="0" value={area.fee} onChange={(e) => setArea(index, { fee: e.target.value })} aria-label={`رسوم ${area.name}`} />
                  <span className="muted">ج.م</span>
                </div>
                <label className="check">
                  <input type="checkbox" checked={area.active} onChange={(e) => setArea(index, { active: e.target.checked })} />
                  مفعّلة
                </label>
                <button className="btn btn-sm btn-danger" type="button" onClick={() => removeArea(index)} aria-label={`حذف ${area.name}`}>
                  حذف
                </button>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 10 }}>قسم العروض</h2>
          <Field label="اسم قسم العروض" error={errors.offersTitle} hint="مثلًا: عروض الخميس والجمعة. يظهر القسم في الموقع تلقائيًا عند وجود منتجات عليها عرض، ويختفي عند انتهائها">
            <input className="input" value={form.offersTitle} onChange={(e) => set("offersTitle", e.target.value)} />
          </Field>
          <Field label="النص الصغير أعلى الاسم" error={errors.offersKicker} hint="مثلًا: عروض لفترة محدودة. فارغ = لن يظهر">
            <input className="input" value={form.offersKicker} onChange={(e) => set("offersKicker", e.target.value)} />
          </Field>

          <h2 style={{ marginTop: 10 }}>صور الصفحة الرئيسية</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
            الصورتان بجانب «جودة نختارها بأنفسنا» و«طازج يومًا بيوم». المقاس 1600 × 1200 (أفقية 4:3)، وبدون صورة يظهر مكانها فارغًا
          </p>
          <div className="grid2">
            <Field label="جودة نختارها بأنفسنا" error={errors["homeImages.quality"]}>
              <ImagePicker value={form.homeImages.quality} onChange={(url) => setHomeImage("quality", url)} max={1600} shape="wide" />
            </Field>
            <Field label="طازج يومًا بيوم" error={errors["homeImages.fresh"]}>
              <ImagePicker value={form.homeImages.fresh} onChange={(url) => setHomeImage("fresh", url)} max={1600} shape="wide" />
            </Field>
          </div>

          <h2 style={{ marginTop: 10 }}>بيانات التواصل</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
            تظهر في صفحة «اتصل بنا» وفي أسفل الموقع
          </p>
          <div className="grid2">
            <Field label="رقم الهاتف (زر الاتصال)" error={errors.phone}>
              <input className="input num" inputMode="tel" dir="ltr" placeholder="01000000000" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="رقم الواتساب" error={errors.whatsapp} hint="فارغ = لن يظهر زر الواتساب">
              <input className="input num" inputMode="tel" dir="ltr" placeholder="01000000000" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </Field>
            <Field label="مواعيد العمل" error={errors.workHours}>
              <input className="input" value={form.workHours} onChange={(e) => set("workHours", e.target.value)} />
            </Field>
            <Field label="مواعيد التوصيل" error={errors.deliveryHours}>
              <input className="input" value={form.deliveryHours} onChange={(e) => set("deliveryHours", e.target.value)} />
            </Field>
          </div>
          <Field label="رابط فيسبوك" error={errors.facebook}>
            <input className="input num" dir="ltr" placeholder="https://www.facebook.com/..." value={form.facebook} onChange={(e) => set("facebook", e.target.value)} />
          </Field>
          <Field label="رابط إنستجرام" error={errors.instagram}>
            <input className="input num" dir="ltr" placeholder="https://www.instagram.com/..." value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
          </Field>
          <Field label="رابط تيك توك" error={errors.tiktok} hint="فارغ = لن يظهر">
            <input className="input num" dir="ltr" placeholder="https://www.tiktok.com/@..." value={form.tiktok} onChange={(e) => set("tiktok", e.target.value)} />
          </Field>

          <div className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>الفروع</b>
              <button className="btn btn-sm" type="button" onClick={addBranch} disabled={form.branches.length >= 20}>
                + فرع
              </button>
            </div>
            {errors.branches ? <div className="alert">{errors.branches}</div> : null}
            {form.branches.map((branch, index) => (
              <div key={index} className="branch-row">
                <input className="input" placeholder="اسم الفرع" value={branch.name} onChange={(e) => setBranch(index, { name: e.target.value })} aria-label="اسم الفرع" />
                <input className="input" placeholder="العنوان" value={branch.address} onChange={(e) => setBranch(index, { address: e.target.value })} aria-label="العنوان" />
                <input className="input num" dir="ltr" placeholder="رابط Google Maps (اختياري)" value={branch.mapUrl} onChange={(e) => setBranch(index, { mapUrl: e.target.value })} aria-label="رابط الخريطة" />
                <button className="btn btn-sm btn-danger" type="button" onClick={() => removeBranch(index)} aria-label={`حذف فرع ${branch.name}`}>
                  حذف
                </button>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-primary" disabled={busy || !changed}>
              {busy ? "جارٍ الحفظ…" : "حفظ"}
            </button>
            {changed ? (
              <button className="btn btn-ghost" type="button" onClick={() => (setForm(toForm(settings)), setErrors({}))}>
                إلغاء التعديل
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </>
  );
}
