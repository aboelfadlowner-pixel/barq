"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { normalizeArabic } from "@/lib/arabic";
import { cairoToday, discountPercent, isOfferActive } from "@/lib/pricing";
import { isValidSku, normalizeSku } from "@/lib/sku";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";
import { api, AdminApiError, egp } from "./api";
import { Ic, useToast } from "./ui";

/** How many rows to render at once (621+ products); "show more" adds the next page. */
const PAGE = 60;

/**
 * Products table: search, category and stock filters, quick edits (price, in stock) without opening the form,
 * and bulk edits on the ticked rows. The whole list is loaded once and filtered in the browser, so typing is instant.
 */
/** Why an offer that is switched on does not show in the store (tooltip of the «عرض غير ظاهر» badge). */
function offerHiddenReason(product: Product): string {
  const today = cairoToday();
  if (product.salePrice === undefined || product.salePrice <= 0) return "لا يوجد سعر عرض، افتح المنتج واكتبه";
  if (product.salePrice >= product.price) return "سعر العرض ليس أقل من السعر الأصلي";
  if (product.offerStart && product.offerStart > today) return `يبدأ العرض يوم ${product.offerStart}`;
  if (product.offerEnd && today > product.offerEnd) return `انتهى العرض يوم ${product.offerEnd}`;
  return "العرض غير مفعّل";
}

export function ProductsList() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const category = params.get("category") ?? "";
  const stock = params.get("stock") ?? "";
  const linked = params.get("linked") ?? "";

  useEffect(() => {
    Promise.all([api<Product[]>("/api/admin/products"), api<Category[]>("/api/admin/categories")]).then(
      ([list, cats]) => {
        setProducts(list);
        setCategories(cats);
      },
      (err: Error) => setError(err.message),
    );
  }, []);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setLimit(PAGE);
    router.replace(`/admin/products${next.size ? `?${next}` : ""}`);
  };

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const visible = useMemo(() => {
    const needle = normalizeArabic(search);
    return (products ?? []).filter(
      (p) =>
        (!category || p.categoryId === category) &&
        (!stock || p.inStock === (stock === "in")) &&
        (!linked || Boolean(p.sku) === (linked === "yes")) &&
        (!needle || normalizeArabic(`${p.name} ${p.id} ${p.sku ?? ""}`).includes(needle)),
    );
  }, [products, category, stock, linked, search]);

  /** Saves one field and updates the row in place. Returns false when the server refused it. */
  const quickSave = async (product: Product, patch: Partial<Product>, message: string): Promise<boolean> => {
    try {
      const saved = await api<Product>(`/api/admin/products/${product.id}`, { method: "PATCH", body: patch });
      setProducts((list) => list?.map((p) => (p.id === saved.id ? saved : p)) ?? null);
      toast(message);
      return true;
    } catch (err) {
      const fields = err instanceof AdminApiError ? err.fields : {};
      toast(Object.values(fields)[0] ?? (err as Error).message);
      return false;
    }
  };
  const linkedCount = (products ?? []).filter((p) => p.sku).length;

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((p) => p.id)));

  /** Sends one change for every ticked product and puts the saved rows back in the table. */
  const bulkSave = async (patch: Record<string, unknown>, message: string) => {
    try {
      const changed = await api<Product[]>("/api/admin/products/bulk", { method: "POST", body: { ids: [...selected], patch } });
      const byId = new Map(changed.map((p) => [p.id, p]));
      setProducts((list) => list?.map((p) => byId.get(p.id) ?? p) ?? null);
      toast(`${message} (${changed.length} منتج)`);
      setSelected(new Set());
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>المنتجات</h1>
          <p>
            <span className="num">{visible.length}</span> منتج
          </p>
        </div>
        <Link className="btn btn-primary" href="/admin/products/new">
          <Ic name="plus" />
          منتج جديد
        </Link>
      </div>
      <div className="toolbar">
        <input className="input" type="search" placeholder="ابحث بالاسم أو الكود أو الـ SKU" value={search} onChange={(e) => (setSearch(e.target.value), setLimit(PAGE))} />
        <select className="select" value={category} onChange={(e) => setFilter("category", e.target.value)} aria-label="القسم">
          <option value="">كل الأقسام</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="select" value={stock} onChange={(e) => setFilter("stock", e.target.value)} aria-label="المخزون">
          <option value="">كل الحالات</option>
          <option value="in">متوفر</option>
          <option value="out">غير متوفر</option>
        </select>
        <select className="select" value={linked} onChange={(e) => setFilter("linked", e.target.value)} aria-label="الربط بشيت Foodics">
          <option value="">المرتبط وغير المرتبط</option>
          <option value="yes">مرتبط بالشيت ({linkedCount})</option>
          <option value="no">غير مرتبط ({(products?.length ?? 0) - linkedCount})</option>
        </select>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <div className="card">
        {products === null ? (
          <div className="empty">جارٍ التحميل…</div>
        ) : visible.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="sel">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="تحديد كل المنتجات الظاهرة" title={`تحديد الكل (${visible.length})`} />
                  </th>
                  <th></th>
                  <th>المنتج</th>
                  <th>القسم</th>
                  <th>SKU</th>
                  <th>السعر (ج.م)</th>
                  <th>متوفر</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, limit).map((product) => (
                  <tr key={product.id} className={[product.inStock ? "" : "off", selected.has(product.id) ? "picked" : ""].join(" ").trim() || undefined}>
                    <td className="sel">
                      <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggle(product.id)} aria-label={`تحديد ${product.name}`} />
                    </td>
                    <td>
                      {product.imageUrl ? <img className="thumb" src={product.imageUrl} alt="" loading="lazy" /> : <span className="thumb none">لا صورة</span>}
                    </td>
                    <td>
                      <Link href={`/admin/products/${product.id}`}>
                        <b style={{ fontWeight: 500 }}>{product.name}</b>
                      </Link>
                      <div className="row" style={{ gap: 6, marginTop: 2 }}>
                        <small className="muted num">كود {product.id}</small>
                        {product.hidden ? <span className="badge red">مخفي من المتجر</span> : null}
                        {product.priceMissing ? <span className="badge red" title="لا يوجد سعر لهذا الـ SKU في شيت المنتجات">مخفي: بلا سعر</span> : null}
                        {product.weighed ? <span className="badge">بالوزن</span> : null}
                        {product.bestseller ? <span className="badge gold">الأكثر مبيعًا</span> : null}
                        {isOfferActive(product) ? (
                          <span className="badge red">عرض {discountPercent(product.price, product.salePrice!)}%</span>
                        ) : product.offer ? (
                          <span className="badge red">عرض غير ظاهر: {offerHiddenReason(product)}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="muted">{categoryName.get(product.categoryId) ?? product.categoryId}</td>
                    <td>
                      <SkuCell
                        product={product}
                        onSave={(sku) => quickSave(product, { sku }, sku ? `تم الربط بـ ${sku}` : "تمت إزالة الربط")}
                      />
                    </td>
                    <td>
                      <PriceCell product={product} onSave={(price) => quickSave(product, { price }, `تم تغيير السعر إلى ${egp(price)}`)} />
                    </td>
                    <td>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={product.inStock}
                          onChange={(e) => quickSave(product, { inStock: e.target.checked }, e.target.checked ? "أصبح متوفرًا" : "أصبح غير متوفر")}
                        />
                      </label>
                    </td>
                    <td>
                      <Link className="btn btn-sm" href={`/admin/products/${product.id}`}>
                        تعديل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length > limit ? (
              <div className="card-pad" style={{ textAlign: "center" }}>
                <button className="btn" type="button" onClick={() => setLimit((n) => n + PAGE)}>
                  عرض المزيد ({visible.length - limit})
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty">لا توجد منتجات مطابقة</div>
        )}
      </div>
      {selected.size ? <BulkBar count={selected.size} categories={categories} onApply={bulkSave} onClear={() => setSelected(new Set())} /> : null}
    </>
  );
}

/** Bar at the bottom of the screen while products are ticked: one change for all of them. */
function BulkBar({
  count,
  categories,
  onApply,
  onClear,
}: {
  count: number;
  categories: Category[];
  onApply: (patch: Record<string, unknown>, message: string) => Promise<void>;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [discount, setDiscount] = useState("");
  const [offerEnd, setOfferEnd] = useState("");
  const run = async (patch: Record<string, unknown>, message: string) => {
    setBusy(true);
    await onApply(patch, message);
    setBusy(false);
  };
  return (
    <div className="bulk-bar" role="region" aria-label="تعديل جماعي">
      <div className="row">
        <b className="num">{count} منتج محدد</b>
        <button className="btn btn-sm btn-ghost" type="button" onClick={onClear}>
          إلغاء التحديد
        </button>
      </div>
      <div className="row bulk-actions">
        <button className="btn btn-sm" type="button" disabled={busy} onClick={() => run({ inStock: true }, "أصبحت متوفرة")}>
          متوفر
        </button>
        <button className="btn btn-sm" type="button" disabled={busy} onClick={() => run({ inStock: false }, "أصبحت غير متوفرة")}>
          غير متوفر
        </button>
        <button className="btn btn-sm" type="button" disabled={busy} onClick={() => run({ bestseller: true }, "تم وضع علامة «الأكثر مبيعًا»")}>
          + الأكثر مبيعًا
        </button>
        <button className="btn btn-sm" type="button" disabled={busy} onClick={() => run({ bestseller: false }, "تمت إزالة علامة «الأكثر مبيعًا»")}>
          − الأكثر مبيعًا
        </button>
        <select
          className="select bulk-select"
          value=""
          disabled={busy}
          aria-label="نقل إلى قسم"
          onChange={(e) => {
            const target = categories.find((c) => c.id === e.target.value);
            if (target && confirm(`نقل ${count} منتج إلى قسم «${target.name}»؟`)) run({ categoryId: target.id }, `تم النقل إلى «${target.name}»`);
          }}
        >
          <option value="">نقل إلى قسم…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <form
        className="row bulk-actions"
        onSubmit={(e) => {
          e.preventDefault();
          run({ discountPercent: Number(discount), offerEnd }, `تم تطبيق خصم ${discount}%`);
        }}
      >
        <span className="muted">خصم</span>
        <input className="input bulk-num num" inputMode="numeric" placeholder="10" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} aria-label="نسبة الخصم" />
        <span className="muted">% حتى</span>
        <input className="input bulk-date num" type="date" value={offerEnd} onChange={(e) => setOfferEnd(e.target.value)} aria-label="آخر يوم في العرض (اختياري)" />
        <button className="btn btn-sm btn-primary" disabled={busy || !discount}>
          طبّق الخصم
        </button>
        <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={() => run({ offer: false }, "تمت إزالة العرض")}>
          إزالة العرض
        </button>
      </form>
    </div>
  );
}

/** Price input that saves on Enter or when leaving the field, only if the value changed. */
function PriceCell({ product, onSave }: { product: Product; onSave: (price: number) => void }) {
  const [value, setValue] = useState(String(product.price));
  useEffect(() => setValue(String(product.price)), [product.price]);
  const commit = () => {
    const price = Number(value);
    if (price === product.price) return;
    if (!Number.isFinite(price) || price <= 0) return setValue(String(product.price));
    onSave(price);
  };
  return (
    <input
      className="input price-input num"
      inputMode="decimal"
      value={value}
      aria-label={`سعر ${product.name}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

/**
 * SKU input in the table: type "sk-1234" and press Enter (or leave the field) to link the product to the Foodics sheet.
 * Empty it to unlink. Wrong format is shown right away; a SKU already used by another product is refused by the server.
 */
function SkuCell({ product, onSave }: { product: Product; onSave: (sku: string) => Promise<boolean> }) {
  const [value, setValue] = useState(product.sku ?? "");
  useEffect(() => setValue(product.sku ?? ""), [product.sku]);
  const clean = normalizeSku(value);
  const bad = clean !== "" && !isValidSku(clean);
  const commit = async () => {
    if (clean === (product.sku ?? "")) return setValue(product.sku ?? "");
    if (bad) return;
    if (!(await onSave(clean))) setValue(product.sku ?? "");
  };
  return (
    <div className="sku-cell">
      <input
        className={`input sku-input num${bad ? " bad" : ""}${product.sku ? " linked" : ""}`}
        dir="ltr"
        placeholder="sk-0000"
        value={value}
        aria-label={`SKU ${product.name}`}
        title={bad ? "الصيغة الصحيحة: sk-1234" : product.sku ? "مرتبط بشيت Foodics" : "غير مرتبط"}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      />
      {!product.sku ? <span className="badge red">غير مرتبط</span> : null}
    </div>
  );
}
