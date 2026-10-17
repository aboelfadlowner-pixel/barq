"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Art } from "@/components/ui/Art";
import { CATEGORY_ARTS } from "@/lib/category-art";
import type { Category } from "@/types/category";
import { api, AdminApiError } from "./api";
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
    if (!confirm(`مسح قسم «${category.name}»؟`)) return;
    try {
      await api(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      await load();
      toast("القسم اتمسح");
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>الأقسام</h1>
          <p>الترتيب هنا هو نفس ترتيبها في الصفحة الرئيسية للمتجر</p>
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
              toast("القسم اتضاف");
            }
          }}
        />
      ) : null}
      <div className="card">
        {categories === null ? (
          <div className="empty">جاري التحميل…</div>
        ) : (
          <div className="cat-list">
            {categories.map((category, index) => (
              <CategoryRow
                key={category.id}
                category={category}
                first={index === 0}
                last={index === categories.length - 1}
                onMove={(delta) => patch(category.id, { position: index + delta }, "الترتيب اتغيّر")}
                onSave={(body) => patch(category.id, body, "القسم اتحفظ")}
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
  const dirty = name !== category.name || art !== category.art || tint.toLowerCase() !== category.tint.toLowerCase();

  return (
    <div className="cat-item">
      <div className="row" style={{ flexDirection: "column", gap: 2 }}>
        <button className="btn btn-sm btn-ghost" type="button" disabled={first} onClick={() => onMove(-1)} aria-label="لفوق">
          <Ic name="up" />
        </button>
        <button className="btn btn-sm btn-ghost" type="button" disabled={last} onClick={() => onMove(1)} aria-label="لتحت">
          <Ic name="down" />
        </button>
      </div>
      <span className="swatch" style={{ background: tint }}>
        <Art id={art} />
      </span>
      <div className="grow">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم القسم" />
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          <small className="muted num">{category.id}</small>
          <Link className="badge" href={`/admin/products?category=${category.id}`}>
            {category.productCount} منتج
          </Link>
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
      <button className="btn btn-sm btn-primary" type="button" disabled={!dirty || name.trim().length < 2} onClick={() => onSave({ name, art, tint })}>
        حفظ
      </button>
      <button
        className="btn btn-sm btn-danger"
        type="button"
        onClick={onDelete}
        disabled={category.productCount > 0}
        title={category.productCount ? "القسم فيه منتجات، انقلها الأول" : undefined}
        aria-label="مسح"
      >
        <Ic name="trash" />
      </button>
    </div>
  );
}

function NewCategory({ onDone }: { onDone: (created: boolean) => void }) {
  const [form, setForm] = useState({ id: "", name: "", art: "a-bowl", tint: "#EEF6EC" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/categories", { method: "POST", body: form });
      onDone(true);
    } catch (err) {
      setErrors(err instanceof AdminApiError ? { ...err.fields, _: err.message } : { _: "حصل خطأ" });
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
        <Field label="الكود (بالإنجليزي)" error={errors.id} hint="بيظهر في رابط الصفحة ومش بيتغيّر بعد كده">
          <input className="input num" dir="ltr" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="frozen" />
        </Field>
        <Field label="الأيقونة واللون" error={errors.art || errors.tint}>
          <div className="row">
            <span className="swatch" style={{ background: form.tint }}>
              <Art id={form.art} />
            </span>
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
