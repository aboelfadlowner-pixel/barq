// website-feed: API للموقع (Laravel) يسحب منه السعر والتوافر.
// السعر من products_master، والرصيد من dc_stock_levels_by_branch لفرع البيطاش.
//
// Secret المطلوب: WEBSITE_API_KEY
// الاستخدام: GET /functions/v1/website-feed   + header  x-api-key: <WEBSITE_API_KEY>
//   ?sku=sk-1,sk-2      → أصناف معينة بس (بالكود أو الباركود)
//   ?include_inactive=1 → يرجّع الأصناف الموقوفة كمان
import { createClient } from "jsr:@supabase/supabase-js@2";

const BRANCH = "البيطاش";
const PAGE = 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

async function fetchAll<T>(sb: any, table: string, cols: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(cols).order("sku").range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
  const key = Deno.env.get("WEBSITE_API_KEY");
  if (!key || req.headers.get("x-api-key") !== key) return json({ ok: false, error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const wanted = new Set(
    (url.searchParams.get("sku") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  const includeInactive = url.searchParams.get("include_inactive") === "1";

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const [products, dc, stock] = await Promise.all([
      fetchAll<{ sku: string; name: string; barcode: string | null; category: string | null; price: number | null; updated_at: string | null }>(
        sb, "products_master", "sku,name,barcode,category,price,updated_at"),
      fetchAll<{ sku: string; is_active: boolean | null; unit: string | null }>(sb, "dc_products", "sku,is_active,unit"),
      fetchAll<{ sku: string; qty: number; updated_at: string | null }>(
        sb, "dc_stock_levels_by_branch", "sku,qty,updated_at", (q) => q.eq("branch", BRANCH)),
    ]);
    const dcBySku = new Map(dc.map((d) => [d.sku, d]));
    const stockBySku = new Map(stock.map((s) => [s.sku, s]));

    const items = [];
    for (const p of products) {
      if (wanted.size && !wanted.has(p.sku.toLowerCase()) && !wanted.has((p.barcode || "").trim().toLowerCase())) continue;
      const d = dcBySku.get(p.sku);
      const active = d?.is_active !== false;
      if (!active && !includeInactive) continue;
      const price = p.price == null ? null : Number(p.price);
      if (!price || price <= 0) continue;
      const s = stockBySku.get(p.sku);
      const qty = s ? Number(s.qty) : null;
      items.push({
        sku: p.sku,
        barcode: p.barcode || null,
        name: p.name,
        category: p.category,
        unit: d?.unit ?? null,
        price,
        qty,
        // مفيش رصيد مسجل للصنف في الفرع = نعتبره مش متاح
        available: active && qty != null && qty > 0,
        active,
        price_updated_at: p.updated_at,
        stock_updated_at: s?.updated_at ?? null,
      });
    }

    await sb.from("website_sync_log").insert({ trigger: "feed", sent: items.length, ok: true });
    return json({ ok: true, branch: BRANCH, generated_at: new Date().toISOString(), count: items.length, items });
  } catch (e) {
    const error = String((e as Error).message || e);
    await sb.from("website_sync_log").insert({ trigger: "feed", ok: false, error }).then(() => {}, () => {});
    return json({ ok: false, error }, 500);
  }
});
