"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Art } from "@/components/ui/Art";
import { CATEGORY_ARTS } from "@/lib/category-art";
import type { Category } from "@/types/category";
import { api, AdminApiError } from "./api";
import { ImagePicker } from "./ImagePicker";
import { Field, Ic, useToast } from "./ui";

type AdminCategory = Category & { productCount: number };

/** Categories in display order: rename, change icon/colour, reorder, add, and delete empty ones. */
export function CategoriesManager() {
  const toast = useToast();
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const load = () => api<AdminCategory[]>("/api/admin/categories").then(setCategories, (err: Error) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  const patch = async (id: string, body: Partial<Category> & { position?: number }, message: string) => {
    try {
      await api(`/api/admin/categories/${id}`, { method: "PATCH", body });
      await load();
      toast(message);
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const remove = async (category: AdminCategory) => {
    if (!confirm(`هل تريد حذف قسم «${category.name}»؟`)) return;
    try {
      await api(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      await load();
      toast("تم حذف القسم");
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>الأقسام</h1>
          <p>الترتيب هنا هو نفس ترتيبها في المتجر. لكل قسم صورة للكارت في الرئيسية، وأيقونة صغيرة مدوّرة.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setAdding(true)} hidden={adding}>
          <Ic name="plus" />
          قسم جديد
        </button>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      {adding ? (
        <NewCategory
          onDone={async (created) => {
            setAdding(false);
            if (created) {
              await load();
              toast("تمت إضافة القسم");
            }
          }}
        />
      ) : null}
      <div className="card">
        {categories === null ? (
          <div className="empty">جارٍ التحميل…</div>
        ) : (
          <div className="cat-list">
            {categories.map((category, index) => (
              <CategoryRow
                key={category.id}
                category={category}
                first={index === 0}
                last={index === categories.length - 1}
                onMove={(delta) => patch(category.id, { position: index + delta }, "تم تغيير الترتيب")}
                onSave={(body) => patch(category.id, body, "تم حفظ القسم")}
                onDelete={() => remove(category)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function CategoryRow({
  category,
  first,
  last,
  onMove,
  onSave,
  onDelete,
}: {
  category: AdminCategory;
  first: boolean;
  last: boolean;
  onMove: (delta: number) => void;
  onSave: (body: Partial<Category>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [art, setArt] = useState(category.art);
  const [tint, setTint] = useState(category.tint);
  const [imageUrl, setImageUrl] = useState(category.imageUrl ?? "");
  const [iconUrl, setIconUrl] = useState(category.iconUrl ?? "");
  const [tagline, setTagline] = useState(category.tagline ?? "");
  const dirty =
    tagline.trim() !== (category.tagline ?? "") ||
    name !== category.name || art !== category.art || tint.toLowerCase() !== category.tint.toLowerCase() ||
    imageUrl.trim() !== (category.imageUrl ?? "") ||
    iconUrl.trim() !== (category.iconUrl ?? "");

  return (
    <div className="cat-item">
      <div className="row" style={{ flexDirection: "column", gap: 2 }}>
        <button className="btn btn-sm btn-ghost" type="button" disabled={first} onClick={() => onMove(-1)} aria-label="إلى الأعلى">
          <Ic name="up" />
        </button>
        <button className="btn btn-sm btn-ghost" type="button" disabled={last} onClick={() => onMove(1)} aria-label="إلى الأسفل">
          <Ic name="down" />
        </button>
      </div>
      <CategoryThumb art={art} tint={tint} imageUrl={iconUrl || imageUrl} />
      <div className="grow">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم القسم" />
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          <small className="muted num">{category.id}</small>
          <Link className="badge" href={`/admin/products?category=${category.id}`}>
            {category.productCount} منتج
          </Link>
          {!imageUrl.trim() ? <span className="badge gold">بدون صورة</span> : null}
        </div>
        <small className="muted cat-tagline-label">جملة القسم (تحت اسمه في صفحته)</small>
        <input
          className="input cat-tagline"
          dir="auto"
          placeholder="اختياري، مثلًا: Fresh Dairy, Every Day"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          aria-label="جملة القسم تحت اسمه في صفحته"
          maxLength={80}
        />
        <div className="cat-images">
          <div>
            <small className="muted">صورة الكارت في الرئيسية (طولية 4:5)</small>
            <ImagePicker value={imageUrl} onChange={setImageUrl} shape="tall" compact />
          </div>
          <div>
            <small className="muted">الأيقونة الصغيرة (مربعة)</small>
            <ImagePicker value={iconUrl} onChange={setIconUrl} max={400} compact />
          </div>
        </div>
      </div>
      <select className="select" style={{ width: "auto" }} value={art} onChange={(e) => setArt(e.target.value)} aria-label="الأيقونة">
        {CATEGORY_ARTS.map((a) => (
          <option key={a} value={a}>
            {a.slice(2)}
          </option>
        ))}
      </select>
      <input className="color-input" type="color" value={tint} onChange={(e) => setTint(e.target.value.toUpperCase())} aria-label="لون الخلفية" />
      <button className="btn btn-sm btn-primary" type="button" disabled={!dirty || name.trim().length < 2} onClick={() => onSave({ name, art, tint, imageUrl: imageUrl.trim(), iconUrl: iconUrl.trim(), tagline: tagline.trim() })}>
        حفظ
      </button>
      <button
        className="btn btn-sm btn-danger"
        type="button"
        onClick={onDelete}
        disabled={category.productCount > 0}
        title={category.productCount ? "القسم يحتوي على منتجات، انقلها أولًا" : undefined}
        aria-label="حذف"
      >
        <Ic name="trash" />
      </button>
    </div>
  );
}

function NewCategory({ onDone }: { onDone: (created: boolean) => void }) {
  const [form, setForm] = useState({ id: "", name: "", art: "a-bowl", tint: "#EEF6EC", imageUrl: "", iconUrl: "", tagline: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/categories", { method: "POST", body: form });
      onDone(true);
    } catch (err) {
      setErrors(err instanceof AdminApiError ? { ...err.fields, _: err.message } : { _: "حدث خطأ" });
      setBusy(false);
    }
  };

  return (
    <form className="card card-pad stack" style={{ marginBottom: 16 }} onSubmit={submit} noValidate>
      <h2>قسم جديد</h2>
      <div className="grid2">
        <Field label="الاسم" error={errors.name}>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: مجمدات" autoFocus />
        </Field>
        <Field label="الكود (بالإنجليزي)" error={errors.id} hint="يظهر في رابط الصفحة ولا يمكن تغييره لاحقًا">
          <input className="input num" dir="ltr" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="frozen" />
        </Field>
        <Field label="الأيقونة واللون" error={errors.art || errors.tint}>
          <div className="row">
            <CategoryThumb art={form.art} tint={form.tint} imageUrl={form.iconUrl || form.imageUrl} />
            <select className="select" style={{ width: "auto" }} value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}>
              {CATEGORY_ARTS.map((a) => (
                <option key={a} value={a}>
                  {a.slice(2)}
                </option>
              ))}
            </select>
            <input className="color-input" type="color" value={form.tint} onChange={(e) => setForm({ ...form, tint: e.target.value.toUpperCase() })} />
          </div>
        </Field>
      </div>
      <Field label="جملة القسم" error={errors.tagline} hint="اختياري: تظهر تحت اسم القسم في صفحته، بالعربي أو بالإنجليزي.">
        <input className="input" dir="auto" value={form.tagline} maxLength={80} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="مثلًا: Fresh Dairy, Every Day" />
      </Field>
      <div className="grid2">
        <Field label="صورة الكارت في الرئيسية" error={errors.imageUrl} hint="اختياري: طولية 4:5، تظهر في «تسوّق حسب القسم».">
          <ImagePicker value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} shape="tall" compact />
        </Field>
        <Field label="الأيقونة الصغيرة" error={errors.iconUrl} hint="اختياري: مربعة، تظهر مدوّرة مكان الأيقونة. بدونها تظهر صورة الكارت أو الرسمة.">
          <ImagePicker value={form.iconUrl} onChange={(url) => setForm({ ...form, iconUrl: url })} max={400} compact />
        </Field>
      </div>
      {errors._ ? <div className="alert">{errors._}</div> : null}
      <div className="row">
        <button className="btn btn-primary" disabled={busy}>
          إضافة
        </button>
        <button className="btn" type="button" onClick={() => onDone(false)}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

/** What the store shows in place of the icon: the category photo (small and round) when there is one, else the icon on its colour. */
function CategoryThumb({ art, tint, imageUrl }: { art: string; tint: string; imageUrl: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [imageUrl]);
  const src = imageUrl.trim();
  const showPhoto = Boolean(src) && !broken;
  return (
    <span className={`swatch${showPhoto ? " photo" : ""}`} style={{ background: showPhoto ? "#fff" : tint }} title={broken ? "الصورة غير موجودة: راجع المسار" : undefined}>
      {showPhoto ? <img src={src} alt="" onError={() => setBroken(true)} /> : <Art id={art} />}
    </span>
  );
}
