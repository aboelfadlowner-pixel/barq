"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";
import { api, AdminApiError } from "./api";
import { Field, Ic, useToast } from "./ui";

interface FormState {
  name: string;
  categoryId: string;
  price: string;
  weighed: boolean;
  weightStep: string;
  inStock: boolean;
  bestseller: boolean;
  offer: boolean;
  description: string;
  imageUrl: string;
}

const EMPTY: FormState = {
  name: "",
  categoryId: "",
  price: "",
  weighed: false,
  weightStep: "0.25",
  inStock: true,
  bestseller: false,
  offer: false,
  description: "",
  imageUrl: "",
};

const toForm = (p: Product): FormState => ({
  name: p.name,
  categoryId: p.categoryId,
  price: String(p.price),
  weighed: p.weighed,
  weightStep: String(p.weightStep ?? 0.25),
  inStock: p.inStock,
  bestseller: p.bestseller,
  offer: p.offer,
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
          <Field label="الوصف" error={errors.description} hint="اختياري">
            <textarea className="textarea" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label="رابط الصورة" error={errors.imageUrl} hint="مثال: /products/13221.webp (رفع الصور هييجي مع قاعدة البيانات)">
            <input className="input num" dir="ltr" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
          </Field>
          {form.imageUrl ? <img src={form.imageUrl} alt="" style={{ width: 140, height: 140, objectFit: "contain", borderRadius: 12, border: "1px solid var(--line)" }} /> : null}
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
          <label className="check">
            <input type="checkbox" checked={form.weighed} onChange={(e) => set("weighed", e.target.checked)} />
            بيتباع بالوزن (كيلو)
          </label>
          {form.weighed ? (
            <Field label="أقل زيادة في الوزن (كجم)" error={errors.weightStep} hint="0.25 يعني ربع كيلو">
              <input className="input num" inputMode="decimal" value={form.weightStep} onChange={(e) => set("weightStep", e.target.value)} />
            </Field>
          ) : null}
        </div>
      </div>
    </form>
  );
}
