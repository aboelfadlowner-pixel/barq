"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cairoToday, discountPercent, isOfferActive } from "@/lib/pricing";
import { DEFAULT_MAX_WEIGHT, DEFAULT_WEIGHT_STEP } from "@/lib/quantity";
import { isValidSku, normalizeSku } from "@/lib/sku";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";
import { api, AdminApiError } from "./api";
import { ImagePicker } from "./ImagePicker";
import { Field, Ic, useToast } from "./ui";

interface FormState {
  name: string;
  categoryId: string;
  price: string;
  weighed: boolean;
  weightStep: string;
  minWeight: string;
  maxWeight: string;
  sku: string;
  inStock: boolean;
  bestseller: boolean;
  offer: boolean;
  salePrice: string;
  offerStart: string;
  offerEnd: string;
  description: string;
  imageUrl: string;
}

const EMPTY: FormState = {
  name: "",
  categoryId: "",
  price: "",
  weighed: false,
  weightStep: String(DEFAULT_WEIGHT_STEP),
  minWeight: String(DEFAULT_WEIGHT_STEP),
  maxWeight: String(DEFAULT_MAX_WEIGHT),
  sku: "",
  inStock: true,
  bestseller: false,
  offer: false,
  salePrice: "",
  offerStart: "",
  offerEnd: "",
  description: "",
  imageUrl: "",
};

const toForm = (p: Product): FormState => ({
  name: p.name,
  categoryId: p.categoryId,
  price: String(p.price),
  weighed: p.weighed,
  weightStep: String(p.weightStep ?? DEFAULT_WEIGHT_STEP),
  minWeight: String(p.minWeight ?? p.weightStep ?? DEFAULT_WEIGHT_STEP),
  maxWeight: String(p.maxWeight ?? DEFAULT_MAX_WEIGHT),
  sku: p.sku ?? "",
  inStock: p.inStock,
  bestseller: p.bestseller,
  offer: p.offer,
  salePrice: p.salePrice === undefined ? "" : String(p.salePrice),
  offerStart: p.offerStart ?? "",
  offerEnd: p.offerEnd ?? "",
  description: p.description ?? "",
  imageUrl: p.imageUrl ?? "",
});

/** Add (no `id`) or edit a product. Field errors come from the API, so the rules live in one place (`src/server/catalog.ts`). */
export function ProductForm({ id }: { id?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(!id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Category[]>("/api/admin/categories").then(setCategories, (err: Error) => setMessage(err.message));
    if (id) {
      api<Product>(`/api/admin/products/${id}`).then(
        (product) => {
          setForm(toForm(product));
          setLoaded(true);
        },
        (err: Error) => setMessage(err.message),
      );
    }
  }, [id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage("");
    const body = {
      ...form,
      price: Number(form.price),
      weightStep: Number(form.weightStep),
      minWeight: Number(form.minWeight),
      maxWeight: Number(form.maxWeight),
      sku: normalizeSku(form.sku),
      salePrice: form.salePrice.trim() === "" ? "" : Number(form.salePrice),
    };
    try {
      const saved = await api<Product>(id ? `/api/admin/products/${id}` : "/api/admin/products", { method: id ? "PATCH" : "POST", body });
      toast(id ? "التعديلات اتحفظت" : `المنتج اتضاف برقم ${saved.id}`);
      router.push("/admin/products");
    } catch (err) {
      if (err instanceof AdminApiError) {
        setErrors(err.fields);
        setMessage(err.message);
      }
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !confirm(`متأكد إنك عايز تمسح «${form.name}»؟ مش هينفع ترجّعه.`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/products/${id}`, { method: "DELETE" });
      toast("المنتج اتمسح");
      router.push("/admin/products");
    } catch (err) {
      setMessage((err as Error).message);
      setBusy(false);
    }
  };

  if (!loaded) return message ? <div className="alert">{message}</div> : <div className="empty">جاري التحميل…</div>;

  return (
    <form onSubmit={submit} noValidate>
      <div className="adm-head">
        <div className="row">
          <Link className="btn btn-sm btn-ghost" href="/admin/products" aria-label="رجوع">
            <Ic name="back" />
          </Link>
          <div>
            <h1>{id ? "تعديل منتج" : "منتج جديد"}</h1>
            {id ? <p className="num">كود {id}</p> : null}
          </div>
        </div>
        <div className="row">
          {id ? (
            <button className="btn btn-danger" type="button" onClick={remove} disabled={busy}>
              <Ic name="trash" />
              مسح
            </button>
          ) : null}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "جاري الحفظ…" : "حفظ"}
          </button>
        </div>
      </div>

      {message ? <div className="alert" style={{ marginBottom: 14 }}>{message}</div> : null}

      <div className="order-grid">
        <div className="card card-pad stack">
          <Field label="اسم المنتج" error={errors.name}>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: جبنة رومي قديمة" />
          </Field>
          <div className="grid2">
            <Field label="القسم" error={errors.categoryId}>
              <select className="select" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">اختار القسم</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={form.weighed ? "سعر الكيلو (ج.م)" : "السعر (ج.م)"} error={errors.price}>
              <input className="input num" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0" />
            </Field>
          </div>
          <Field
            label="SKU (من شيت Foodics)"
            error={errors.sku || (form.sku && !isValidSku(normalizeSku(form.sku)) ? "الشكل الصح: sk-1234" : undefined)}
            hint={form.sku ? "مربوط: السعر هيتحدّث من شيت المنتجات" : "اكتب الـ SKU عشان المنتج يتربط بالشيت والسعر يتحدّث لوحده"}
          >
            <input className="input num" dir="ltr" placeholder="sk-0000" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
          </Field>
          <Field label="الوصف" error={errors.description} hint="اختياري">
            <textarea className="textarea" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="صورة المنتج" error={errors.imageUrl}>
            <ImagePicker value={form.imageUrl} onChange={(url) => set("imageUrl", url)} />
          </Field>
        </div>

        <div className="card card-pad stack">
          <h2>الحالة والبيع</h2>
          <label className="check">
            <input type="checkbox" checked={form.inStock} onChange={(e) => set("inStock", e.target.checked)} />
            متوفر للبيع
          </label>
          <label className="check">
            <input type="checkbox" checked={form.bestseller} onChange={(e) => set("bestseller", e.target.checked)} />
            يظهر عليه «الأكثر مبيعًا»
          </label>
          <label className="check">
            <input type="checkbox" checked={form.offer} onChange={(e) => set("offer", e.target.checked)} />
            عليه عرض
          </label>
          {form.offer ? (
            <div className="weight-box stack">
              <h3>العرض</h3>
              <Field label={form.weighed ? "سعر الكيلو في العرض (ج.م)" : "سعر العرض (ج.م)"} error={errors.salePrice} hint="لازم يكون أقل من السعر الأصلي">
                <input className="input num" inputMode="decimal" dir="ltr" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
              </Field>
              <div className="grid2">
                <Field label="من يوم" error={errors.offerStart} hint="فاضي = من النهارده">
                  <input className="input num" type="date" value={form.offerStart} onChange={(e) => set("offerStart", e.target.value)} />
                </Field>
                <Field label="لحد يوم" error={errors.offerEnd} hint="فاضي = لحد ما تشيله">
                  <input className="input num" type="date" value={form.offerEnd} onChange={(e) => set("offerEnd", e.target.value)} />
                </Field>
              </div>
              <OfferPreview form={form} />
            </div>
          ) : null}
          <label className="check">
            <input type="checkbox" checked={form.weighed} onChange={(e) => set("weighed", e.target.checked)} />
            بيتباع بالوزن (كيلو)
          </label>
          {form.weighed ? (
            <div className="weight-box stack">
              <h3>البيع بالوزن</h3>
              <Field label="وحدة الوزن">
                <select className="select" value="kg" disabled>
                  <option value="kg">كيلو (kg)</option>
                </select>
              </Field>
              <Field label="أقل وزن (كجم)" error={errors.minWeight} hint="يبدأ من كام، مثلاً 0.125 = تُمن كيلو">
                <input className="input num" inputMode="decimal" dir="ltr" value={form.minWeight} onChange={(e) => set("minWeight", e.target.value)} />
              </Field>
              <Field label="الزيادة (كجم)" error={errors.weightStep} hint="بيزوّد كام كل مرة، مثلاً 0.25 = ربع كيلو">
                <input className="input num" inputMode="decimal" dir="ltr" value={form.weightStep} onChange={(e) => set("weightStep", e.target.value)} />
              </Field>
              <Field label="أقصى وزن (كجم)" error={errors.maxWeight} hint="أكبر كمية في الطلب الواحد">
                <input className="input num" inputMode="decimal" dir="ltr" value={form.maxWeight} onChange={(e) => set("maxWeight", e.target.value)} />
              </Field>
              <WeightPreview min={Number(form.minWeight)} step={Number(form.weightStep)} max={Number(form.maxWeight)} price={Number(form.price)} />
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/** One line under the offer fields: the discount and whether it shows in the store today. */
function OfferPreview({ form }: { form: FormState }) {
  const price = Number(form.price);
  const salePrice = Number(form.salePrice);
  if (!(price > 0 && salePrice > 0 && salePrice < price)) return <small className="muted">اكتب سعر العرض عشان يظهر في المتجر.</small>;
  const today = cairoToday();
  const live = isOfferActive({ price, salePrice, offer: true, offerStart: form.offerStart || undefined, offerEnd: form.offerEnd || undefined }, today);
  return (
    <small className="muted">
      خصم {discountPercent(price, salePrice)}% (توفير {Math.round((price - salePrice) * 100) / 100} ج.م) ·{" "}
      {live ? <b style={{ color: "var(--brand)" }}>ظاهر في المتجر دلوقتي</b> : form.offerEnd && form.offerEnd < today ? "العرض خلص" : "هيظهر من يوم البداية"}
    </small>
  );
}

/** Shows what the customer will be able to choose with the current settings, e.g. "125 جم، 250 جم، 375 جم … لحد 10 كيلو". */
function WeightPreview({ min, step, max, price }: { min: number; step: number; max: number; price: number }) {
  if (!(min > 0 && step > 0 && max >= min)) return null;
  const options: number[] = [];
  for (let kg = min; kg <= max + 1e-9 && options.length < 4; kg = Math.round((kg + step) * 1000) / 1000) options.push(kg);
  const label = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)} جم` : `${kg} كيلو`);
  return (
    <small className="muted">
      العميل هيختار: {options.map(label).join("، ")}
      {options.at(-1)! < max ? ` … لحد ${label(max)}` : ""}
      {price > 0 ? ` (أقل طلب = ${Math.round(price * min * 100) / 100} ج.م)` : ""}
    </small>
  );
}
