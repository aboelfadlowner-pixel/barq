// cc-sale-unit — core logic (no imports, so it can be tested outside Deno).
//
// Reads the products sheet (the same public Drive file the data-center sync
// reads — READ ONLY) and keeps cc_product_sale_unit in step with its
// is_sold_by_weight column. Also reads the Foodics categories export and the
// products' category_reference column into cc_categories / cc_product_categories.
// Writes ONLY call-center tables (cc_product_sale_unit, cc_categories,
// cc_product_categories, cc_sync_status). Never deletes anything.

// Same file id as dc-sync's FILES.products. If someone deletes the file on
// Drive and uploads a new one (instead of "upload new version"), the id
// changes and both syncs stop until this id is updated.
export const PRODUCTS_FILE_ID = "1ZAB1yWtR3siuhIDbT0Cll_WnRWDNbhKU";
// التصنيفات.csv (Foodics categories export: id, name, reference). Same rule:
// replace it with "Upload new version" so the id stays the same.
export const CATEGORIES_FILE_ID = "1uXM9Umg5HEyxBkLfTwQ5fyq4Wu7tGrUM";
export const THROTTLE_MINUTES = 10;
const STATUS_NAME = "sale_unit";

export async function fetchDriveCsv(id: string): Promise<string> {
  const res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`);
  if (!res.ok) throw new Error(`تعذّر تحميل شيت المنتجات من Drive (HTTP ${res.status})`);
  const text = await res.text();
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.includes("accounts.google.com") || head.includes("<!doctype html") || head.startsWith("<html")) {
    throw new Error("Drive رجّع صفحة بدل الملف — شيت المنتجات مش متاح بصلاحية \"Anyone with the link\" أو اتمسح واترفع من جديد");
  }
  return text;
}

// Simple CSV parser with "quoted" fields (same behaviour as dc-sync's).
export function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.length > 1 || r[0] !== "").map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
    return obj;
  });
}

// sku → sold by weight. Only clear Yes/No values are used; a later row wins.
export function toFlags(rows: Record<string, string>[]): Map<string, boolean> {
  if (!rows.length) throw new Error("شيت المنتجات فاضي");
  const cols = Object.keys(rows[0]);
  if (!cols.includes("sku") || !cols.includes("is_sold_by_weight")) {
    throw new Error(`شيت المنتجات مفيهوش عمود sku أو is_sold_by_weight — الأعمدة: [${cols.join(", ")}]`);
  }
  const flags = new Map<string, boolean>();
  for (const r of rows) {
    const sku = (r["sku"] || "").trim();
    const v = (r["is_sold_by_weight"] || "").trim().toLowerCase();
    if (!sku || (v !== "yes" && v !== "no")) continue;
    flags.set(sku, v === "yes");
  }
  return flags;
}

// Minimal client surface used here (supabase-js with the service role).
type Db = {
  from: (t: string) => any;
};

async function selectAll(sb: Db, table: string, columns: string, key = "sku"): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).order(key).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

async function writeStatus(sb: Db, patch: Record<string, unknown>, name = STATUS_NAME) {
  const { error } = await sb.from("cc_sync_status").upsert({ name, ...patch }, { onConflict: "name" });
  if (error) throw new Error(error.message);
}

export type SyncResult =
  | { status: "skipped"; last_started_at: string }
  | { status: "ok"; rows_total: number; rows_changed: number }
  | { status: "failed"; error: string };

export async function syncSaleUnits(
  sb: Db,
  loadCsv: () => Promise<string>,
  opts: { force?: boolean; now?: Date; minRows?: number } = {},
): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const minRows = opts.minRows ?? 100;   // the real sheet has 5,000+ products; fewer means a bad file

  // Throttle: at most one run every THROTTLE_MINUTES (the app triggers it on every open).
  const { data: last, error: lastErr } = await sb.from("cc_sync_status").select("started_at").eq("name", STATUS_NAME).maybeSingle();
  if (lastErr) throw new Error(lastErr.message);
  if (!opts.force && last?.started_at && now.getTime() - new Date(last.started_at).getTime() < THROTTLE_MINUTES * 60_000) {
    return { status: "skipped", last_started_at: last.started_at };
  }
  await writeStatus(sb, { started_at: now.toISOString() });

  try {
    const flags = toFlags(parseCsv(await loadCsv()));
    if (flags.size < minRows) {
      throw new Error(`شيت المنتجات فيه ${flags.size} صنف بس بعمود is_sold_by_weight — مش هنكمل عشان مايبقاش ملف ناقص`);
    }
    const existing = new Map((await selectAll(sb, "cc_product_sale_unit", "sku, sold_by_weight"))
      .map((r: any) => [r.sku, r.sold_by_weight]));
    const changed = [...flags].filter(([sku, w]) => existing.get(sku) !== w)
      .map(([sku, w]) => ({ sku, sold_by_weight: w, updated_at: now.toISOString() }));
    for (let i = 0; i < changed.length; i += 500) {
      const { error } = await sb.from("cc_product_sale_unit").upsert(changed.slice(i, i + 500), { onConflict: "sku" });
      if (error) throw new Error(error.message);
    }
    await writeStatus(sb, { finished_at: new Date().toISOString(), ok: true, rows_total: flags.size, rows_changed: changed.length, message: null });
    return { status: "ok", rows_total: flags.size, rows_changed: changed.length };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    await writeStatus(sb, { finished_at: new Date().toISOString(), ok: false, message: msg });
    return { status: "failed", error: msg };
  }
}

// ---------------------------------------------------------------------
// Categories (like Foodics): names from التصنيفات.csv, product → category
// from المنتجات.csv (category_reference). References are compared in lower case.
// ---------------------------------------------------------------------
const CATEGORIES_STATUS = "categories";

export function toCategories(rows: Record<string, string>[]): { reference: string; name: string; sort_order: number }[] {
  if (!rows.length) throw new Error("شيت التصنيفات فاضي");
  const cols = Object.keys(rows[0]);
  if (!cols.includes("name") || !cols.includes("reference")) {
    throw new Error(`شيت التصنيفات مفيهوش عمود name أو reference — الأعمدة: [${cols.join(", ")}]`);
  }
  const out = new Map<string, { reference: string; name: string; sort_order: number }>();
  rows.forEach((r, i) => {
    const reference = (r["reference"] || "").trim().toLowerCase();
    const name = (r["name"] || "").trim();
    if (reference && name && !out.has(reference)) out.set(reference, { reference, name, sort_order: i + 1 });
  });
  return [...out.values()];
}

export function toProductCategories(rows: Record<string, string>[]): Map<string, string | null> {
  if (!rows.length) throw new Error("شيت المنتجات فاضي");
  if (!Object.keys(rows[0]).includes("category_reference")) {
    throw new Error("شيت المنتجات مفيهوش عمود category_reference");
  }
  const map = new Map<string, string | null>();
  for (const r of rows) {
    const sku = (r["sku"] || "").trim();
    if (sku) map.set(sku, (r["category_reference"] || "").trim().toLowerCase() || null);
  }
  return map;
}

export type CategoriesResult =
  | { status: "skipped"; last_started_at: string }
  | { status: "ok"; categories: number; products_with_category: number; rows_changed: number }
  | { status: "failed"; error: string };

export async function syncCategories(
  sb: Db,
  loadProductsCsv: () => Promise<string>,
  loadCategoriesCsv: () => Promise<string>,
  opts: { force?: boolean; now?: Date; minRows?: number } = {},
): Promise<CategoriesResult> {
  const now = opts.now ?? new Date();
  const minRows = opts.minRows ?? 100;

  const { data: last, error: lastErr } = await sb.from("cc_sync_status").select("started_at").eq("name", CATEGORIES_STATUS).maybeSingle();
  if (lastErr) throw new Error(lastErr.message);
  if (!opts.force && last?.started_at && now.getTime() - new Date(last.started_at).getTime() < THROTTLE_MINUTES * 60_000) {
    return { status: "skipped", last_started_at: last.started_at };
  }
  await writeStatus(sb, { started_at: now.toISOString() }, CATEGORIES_STATUS);

  try {
    const [productsText, categoriesText] = await Promise.all([loadProductsCsv(), loadCategoriesCsv()]);
    const cats = toCategories(parseCsv(categoriesText));
    const links = toProductCategories(parseCsv(productsText));
    if (links.size < minRows) {
      throw new Error(`شيت المنتجات فيه ${links.size} صنف بس — مش هنكمل عشان مايبقاش ملف ناقص`);
    }
    if (!cats.length) throw new Error("شيت التصنيفات مفيهوش ولا تصنيف ليه رقم مرجعي");
    const ts = now.toISOString();

    // Categories: add/update the ones in the file; the ones that left the file become inactive (never deleted).
    const known = new Set(cats.map((c) => c.reference));
    const existingCats = await selectAll(sb, "cc_categories", "reference, name, sort_order, active", "reference");
    const catRows = [
      ...cats.map((c) => ({ ...c, active: true, updated_at: ts })),
      ...existingCats.filter((c: any) => !known.has(c.reference) && c.active)
        .map((c: any) => ({ reference: c.reference, name: c.name, sort_order: c.sort_order, active: false, updated_at: ts })),
    ];
    if (catRows.length) {
      const { error } = await sb.from("cc_categories").upsert(catRows, { onConflict: "reference" });
      if (error) throw new Error(error.message);
    }

    // Product → category: only changed rows (a product that lost its category gets null, not deleted).
    const existing = new Map((await selectAll(sb, "cc_product_categories", "sku, reference"))
      .map((r: any) => [r.sku, r.reference ?? null]));
    const changed = [...links].filter(([sku, ref]) => !existing.has(sku) ? ref !== null : existing.get(sku) !== ref)
      .map(([sku, reference]) => ({ sku, reference, updated_at: ts }));
    for (let i = 0; i < changed.length; i += 500) {
      const { error } = await sb.from("cc_product_categories").upsert(changed.slice(i, i + 500), { onConflict: "sku" });
      if (error) throw new Error(error.message);
    }
    const withCategory = [...links.values()].filter((r) => r && known.has(r)).length;
    await writeStatus(sb, { finished_at: new Date().toISOString(), ok: true, rows_total: links.size, rows_changed: changed.length, message: null }, CATEGORIES_STATUS);
    return { status: "ok", categories: cats.length, products_with_category: withCategory, rows_changed: changed.length };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    await writeStatus(sb, { finished_at: new Date().toISOString(), ok: false, message: msg }, CATEGORIES_STATUS);
    return { status: "failed", error: msg };
  }
}
