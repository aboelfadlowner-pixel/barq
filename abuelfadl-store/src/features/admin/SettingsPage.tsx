"use client";

import { useEffect, useState } from "react";
import { noticeText } from "@/lib/settings";
import type { StoreSettings } from "@/types/settings";
import { api, AdminApiError } from "./api";
import { Field, useToast } from "./ui";

interface FormState {
  minOrder: string;
  notice: string;
  whatsapp: string;
  closedMessage: string;
}

const toForm = (s: StoreSettings): FormState => ({ minOrder: String(s.minOrder), notice: s.notice, whatsapp: s.whatsapp, closedMessage: s.closedMessage });

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

  if (!settings || !form) return message ? <div className="alert">{message}</div> : <div className="empty">جاري التحميل…</div>;

  const set = (key: keyof FormState, value: string) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const preview = noticeText({ ...settings, ...form, minOrder: Number(form.minOrder) || 0 });
  const changed = JSON.stringify(form) !== JSON.stringify(toForm(settings));

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>الإعدادات</h1>
          <p>اللي بتغيّره هنا بيظهر في المتجر على طول</p>
        </div>
      </div>

      <div className="stack" style={{ maxWidth: 720 }}>
        <div className={`card card-pad orders-switch ${settings.ordersOpen ? "open" : "paused"}`}>
          <div>
            <h2>استقبال الطلبات</h2>
            <p className="muted">
              {settings.ordersOpen
                ? "شغال: العملاء يقدروا يطلبوا من الموقع."
                : "متوقف: الموقع شغال للتصفح بس، ومفيش طلبات بتتقبل لحد ما تشغّله."}
            </p>
          </div>
          <button
            className={settings.ordersOpen ? "btn btn-danger" : "btn btn-primary"}
            type="button"
            disabled={busy}
            onClick={() => {
              if (settings.ordersOpen && !confirm("هتوقف استقبال الطلبات من الموقع. متأكد؟")) return;
              save({ ordersOpen: !settings.ordersOpen }, settings.ordersOpen ? "استقبال الطلبات اتوقف" : "استقبال الطلبات اشتغل");
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
            save({ ...form, minOrder: Number(form.minOrder) }, "الإعدادات اتحفظت");
          }}
        >
          <h2>المتجر</h2>
          <Field label="الحد الأدنى للطلب (ج.م)" error={errors.minOrder} hint="0 = من غير حد أدنى">
            <input className="input num" inputMode="decimal" dir="ltr" value={form.minOrder} onChange={(e) => set("minOrder", e.target.value)} />
          </Field>
          <Field label="جملة الشريط اللي فوق" error={errors.notice} hint="الحد الأدنى بيتكتب بعدها لوحده">
            <input className="input" value={form.notice} onChange={(e) => set("notice", e.target.value)} />
          </Field>
          <Field label="رسالة وقت إيقاف الطلبات" error={errors.closedMessage} hint="بتظهر في الشريط وفي السلة لما الطلبات تتوقف">
            <input className="input" value={form.closedMessage} onChange={(e) => set("closedMessage", e.target.value)} />
          </Field>
          <Field label="رقم واتساب خدمة العملاء" error={errors.whatsapp} hint="بيظهر زرار واتساب في آخر الموقع. سيبه فاضي لو مش عايزه">
            <input className="input num" inputMode="tel" dir="ltr" placeholder="01000000000" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </Field>
          <div className="settings-preview">
            <small className="muted">الشريط هيظهر كده:</small>
            <div className={settings.ordersOpen ? "" : "paused"}>{preview || "(مش هيظهر شريط)"}</div>
          </div>
          <div className="row">
            <button className="btn btn-primary" disabled={busy || !changed}>
              {busy ? "جاري الحفظ…" : "حفظ"}
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
