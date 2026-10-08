// woo-sync: يبعت السعر والتوافر من Supabase لموقع WooCommerce.
// السعر من products_master، والرصيد من dc_stock_levels_by_branch لفرع البيطاش.
// الربط بالـ SKU في WooCommerce: يطابق كود الصنف (sk-xxxx) أو الباركود.
//
// Secrets المطلوبة: WOO_URL, WOO_CK, WOO_CS, SYNC_TOKEN
// التشغيل: POST /functions/v1/woo-sync  + header  x-sync-token: <SYNC_TOKEN>
//   ?dry=1  → يعرض التغييرات بس من غير ما يكتب على الموقع
import { createClient } from "jsr:@supabase/supabase-js@2";

const BRANCH = "البيطاش";
const PAGE = 1000;

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`missing secret ${k}`);
  return v;
};

type WooProduct = {
  id: number;
  sku: string;
  type: string;
  regular_price: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
};

async function fetchAll<T>(sb: any, table: string, cols: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(cols).range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

function wooClient() {
  const base = env("WOO_URL").replace(/\/+$/, "") + "/wp-json/wc/v3";
  const auth = "Basic " + btoa(`${env("WOO_CK")}:${env("WOO_CS")}`);
  return async (path: string, init: RequestInit = {}) => {
    const res = await fetch(base + path, {
      ...init,
      headers: { Authorization: auth, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Woo ${res.status} ${path}: ${JSON.stringify(body)?.slice(0, 300)}`);
    return { body, headers: res.headers };
  };
}

// الأصناف الموزونة رصيدها كسور؛ أي رصيد موجب يتحسب متاح (1 على الأقل).
const toStockQty = (qty: number) => (qty > 0 ? Math.max(1, Math.floor(qty)) : 0);
const samePrice = (a: string, b: number) => a !== "" && Number(a) === b;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const trigger = url.searchParams.get("trigger") || (dry ? "dry-run" : "manual");

  const token = Deno.env.get("SYNC_TOKEN");
  if (!token || req.headers.get("x-sync-token") !== token) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
  }

  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const log = async (row: Record<string, unknown>) => {
    if (!dry) await sb.from("website_sync_log").insert({ trigger, ...row });
  };

  try {
    // 1) بيانات برق
    const products = await fetchAll<{ sku: string; barcode: string | null; price: number | null }>(
      sb, "products_master", "sku,barcode,price");
    const stock = await fetchAll<{ sku: string; qty: number }>(
      sb, "dc_stock_levels_by_branch", "sku,qty", (q) => q.eq("branch", BRANCH));
    const qtyBySku = new Map(stock.map((s) => [s.sku, Number(s.qty)]));

    const byKey = new Map<string, { price: number | null; qty: number | undefined }>();
    for (const p of products) {
      const rec = { price: p.price == null ? null : Number(p.price), qty: qtyBySku.get(p.sku) };
      byKey.set(p.sku.trim().toLowerCase(), rec);
      if (p.barcode && !byKey.has(p.barcode.trim())) byKey.set(p.barcode.trim(), rec);
    }

    // 2) منتجات الموقع
    const woo = wooClient();
    const wooProducts: WooProduct[] = [];
    for (let page = 1; ; page++) {
      const { body, headers } = await woo(`/products?per_page=100&page=${page}&status=any`);
      wooProducts.push(...body);
      if (page >= Number(headers.get("x-wp-totalpages") || 1)) break;
    }

    // 3) حساب التغييرات
    const updates: Record<string, unknown>[] = [];
    const notFound: string[] = [];
    let matched = 0, unchanged = 0;
    for (const w of wooProducts) {
      if (!w.sku || w.type === "variable") continue;
      const rec = byKey.get(w.sku.trim().toLowerCase()) ?? byKey.get(w.sku.trim());
      if (!rec) { notFound.push(w.sku); continue; }
      matched++;

      const patch: Record<string, unknown> = {};
      if (rec.price != null && rec.price > 0 && !samePrice(w.regular_price, rec.price)) {
        patch.regular_price = String(rec.price);
      }
      if (rec.qty !== undefined) {
        if (w.manage_stock) {
          const q = toStockQty(rec.qty);
          if (w.stock_quantity !== q) patch.stock_quantity = q;
        } else {
          const status = rec.qty > 0 ? "instock" : "outofstock";
          if (w.stock_status !== status) patch.stock_status = status;
        }
      }
      if (Object.keys(patch).length) updates.push({ id: w.id, sku: w.sku, ...patch });
      else unchanged++;
    }

    // 4) الكتابة على الموقع (100 صنف في كل طلب)
    let updated = 0;
    if (!dry) {
      for (let i = 0; i < updates.length; i += 100) {
        const chunk = updates.slice(i, i + 100).map(({ sku: _s, ...u }) => u);
        const { body } = await woo("/products/batch", { method: "POST", body: JSON.stringify({ update: chunk }) });
        updated += (body?.update || []).filter((r: any) => !r.error).length;
      }
    }

    const summary = {
      ok: true, dry, branch: BRANCH,
      site_products: wooProducts.length, sent: matched,
      to_update: updates.length, updated, unchanged,
      not_found: notFound.length, not_found_skus: notFound.slice(0, 200),
    };
    await log({ sent: matched, updated, unchanged, not_found: notFound.length,
      not_found_skus: notFound.slice(0, 200), ok: true });
    return new Response(JSON.stringify(dry ? { ...summary, changes: updates.slice(0, 300) } : summary), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const error = String((e as Error).message || e);
    await log({ ok: false, error }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error }), { status: 500 });
  }
});
