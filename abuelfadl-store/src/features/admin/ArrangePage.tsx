"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";
import { api, egp } from "./api";
import { Ic, useToast } from "./ui";

/**
 * «ترتيب المنتجات»: the order products show in on a category page. Move rows with the arrows, then «حفظ الترتيب».
 * The «الأكثر مبيعًا» label can be switched from here too (saved at once).
 */
export function ArrangePage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [order, setOrder] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api<Category[]>("/api/admin/categories"), api<Product[]>("/api/admin/products")]).then(
      ([cats, list]) => {
        setCategories(cats);
        setProducts(list);
        setCategoryId((current) => current || cats[0]?.id || "");
      },
      (err: Error) => setError(err.message),
    );
  }, []);

  const saved = useMemo(() => (products ?? []).filter((p) => p.categoryId === categoryId).map((p) => p.id), [products, categoryId]);
  useEffect(() => setOrder(saved), [saved]);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const changed = order.join() !== saved.join();

  const move = (from: number, to: number) =>
    setOrder((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [id] = next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });

  const bestsellersFirst = () => setOrder((list) => [...list.filter((id) => byId.get(id)?.bestseller), ...list.filter((id) => !byId.get(id)?.bestseller)]);
  const inStockFirst = () => setOrder((list) => [...list.filter((id) => byId.get(id)?.inStock), ...list.filter((id) => !byId.get(id)?.inStock)]);

  const save = async () => {
    setBusy(true);
    try {
      await api("/api/admin/products/reorder", { method: "POST", body: { categoryId, ids: order } });
      // Put the category's products in the new order inside the local list too.
      setProducts((list) => {
        if (!list) return list;
        const slots = list.flatMap((p, i) => (p.categoryId === categoryId ? [i] : []));
        const next = [...list];
        slots.forEach((slot, i) => (next[slot] = byId.get(order[i])!));
        return next;
      });
      toast("الترتيب اتحفظ وظاهر في المتجر");
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleBestseller = async (product: Product) => {
    try {
      const updated = await api<Product>(`/api/admin/products/${product.id}`, { method: "PATCH", body: { bestseller: !product.bestseller } });
      setProducts((list) => list?.map((p) => (p.id === updated.id ? updated : p)) ?? null);
      toast(updated.bestseller ? "اتعلّم «الأكثر مبيعًا»" : "اتشالت علامة «الأكثر مبيعًا»");
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const switchCategory = (next: string) => {
    if (changed && !confirm("فيه ترتيب مش محفوظ. تسيبه وتروح لقسم تاني؟")) return;
    setCategoryId(next);
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>ترتيب المنتجات</h1>
          <p>الترتيب اللي المنتجات بتظهر بيه في صفحة القسم</p>
        </div>
        <button className="btn btn-primary" type="button" disabled={!changed || busy} onClick={save}>
          {busy ? "جاري الحفظ…" : "حفظ الترتيب"}
        </button>
      </div>
      <div className="toolbar">
        <select className="select" value={categoryId} onChange={(e) => switchCategory(e.target.value)} aria-label="القسم">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" type="button" onClick={bestsellersFirst}>
          الأكثر مبيعًا الأول
        </button>
        <button className="btn btn-sm" type="button" onClick={inStockFirst}>
          المتوفر الأول
        </button>
        {changed ? (
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => setOrder(saved)}>
            رجّع زي ما كان
          </button>
        ) : null}
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <div className="card">
        {products === null ? (
          <div className="empty">جاري التحميل…</div>
        ) : order.length ? (
          <ol className="arrange">
            {order.map((id, index) => {
              const product = byId.get(id)!;
              return (
                <li key={id} className={product.inStock ? undefined : "off"}>
                  <span className="pos num">{index + 1}</span>
                  {product.imageUrl ? <img className="thumb" src={product.imageUrl} alt="" loading="lazy" /> : <span className="thumb none">لا صورة</span>}
                  <div className="grow">
                    <b>{product.name}</b>
                    <div className="row" style={{ gap: 6 }}>
                      <small className="muted num">{egp(product.price)}</small>
                      {!product.inStock ? <span className="badge red">خلصان</span> : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={product.bestseller ? "btn btn-sm best on" : "btn btn-sm best"}
                    onClick={() => toggleBestseller(product)}
                    aria-pressed={product.bestseller}
                    title="علامة «الأكثر مبيعًا» على صورة المنتج"
                  >
                    ★ الأكثر مبيعًا
                  </button>
                  <div className="moves">
                    <button type="button" className="btn btn-sm" disabled={index === 0} onClick={() => move(index, 0)} aria-label="أول القائمة" title="أول القائمة">
                      ⤒
                    </button>
                    <button type="button" className="btn btn-sm" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="لفوق">
                      <Ic name="up" />
                    </button>
                    <button type="button" className="btn btn-sm" disabled={index === order.length - 1} onClick={() => move(index, index + 1)} aria-label="لتحت">
                      <Ic name="down" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="empty">القسم ده مفيهوش منتجات</div>
        )}
      </div>
    </>
  );
}
