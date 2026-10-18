"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { normalizeArabic } from "@/lib/arabic";
import { isValidSku, normalizeSku } from "@/lib/sku";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";
import { api, AdminApiError, egp } from "./api";
import { Ic, useToast } from "./ui";

/** How many rows to render at once (621+ products); "show more" adds the next page. */
const PAGE = 60;

/**
 * Products table: search, category and stock filters, and quick edits (price, in stock) without opening the form.
 * The whole list is loaded once and filtered in the browser, so typing is instant.
 */
export function ProductsList() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
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
          <option value="">متوفر وغير متوفر</option>
          <option value="in">متوفر</option>
          <option value="out">خلصان</option>
        </select>
        <select className="select" value={linked} onChange={(e) => setFilter("linked", e.target.value)} aria-label="الربط بشيت Foodics">
          <option value="">مربوط وغير مربوط</option>
          <option value="yes">مربوط بالشيت ({linkedCount})</option>
          <option value="no">مش مربوط ({(products?.length ?? 0) - linkedCount})</option>
        </select>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <div className="card">
        {products === null ? (
          <div className="empty">جاري التحميل…</div>
        ) : visible.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
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
                  <tr key={product.id} className={product.inStock ? undefined : "off"}>
                    <td>
                      {product.imageUrl ? <img className="thumb" src={product.imageUrl} alt="" loading="lazy" /> : <span className="thumb none">لا صورة</span>}
                    </td>
                    <td>
                      <Link href={`/admin/products/${product.id}`}>
                        <b style={{ fontWeight: 500 }}>{product.name}</b>
                      </Link>
                      <div className="row" style={{ gap: 6, marginTop: 2 }}>
                        <small className="muted num">كود {product.id}</small>
                        {product.weighed ? <span className="badge">بالوزن</span> : null}
                        {product.bestseller ? <span className="badge gold">الأكثر مبيعًا</span> : null}
                      </div>
                    </td>
                    <td className="muted">{categoryName.get(product.categoryId) ?? product.categoryId}</td>
                    <td>
                      <SkuCell
                        product={product}
                        onSave={(sku) => quickSave(product, { sku }, sku ? `اتربط بـ ${sku}` : "اتشال الربط")}
                      />
                    </td>
                    <td>
                      <PriceCell product={product} onSave={(price) => quickSave(product, { price }, `السعر اتغيّر لـ ${egp(price)}`)} />
                    </td>
                    <td>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={product.inStock}
                          onChange={(e) => quickSave(product, { inStock: e.target.checked }, e.target.checked ? "بقى متوفر" : "اتعلّم خلصان")}
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
          <div className="empty">مفيش منتجات مطابقة</div>
        )}
      </div>
    </>
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
        title={bad ? "الشكل الصح: sk-1234" : product.sku ? "مربوط بشيت Foodics" : "مش مربوط"}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      />
      {!product.sku ? <span className="badge red">مش مربوط</span> : null}
    </div>
  );
}
