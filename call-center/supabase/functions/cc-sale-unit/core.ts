// cc-sale-unit — core logic (no imports, so it can be tested outside Deno).
//
// Reads the products sheet (the same public Drive file the data-center sync
// reads — READ ONLY) and keeps cc_product_sale_unit in step with its
// is_sold_by_weight column. Writes ONLY the call-center tables
// cc_product_sale_unit and cc_sync_status. Never deletes anything.

// Same file id as dc-sync's FILES.products. If someone deletes the file on
// Drive and uploads a new one (instead of "upload new version"), the id
// changes and both syncs stop until this id is updated.
export const PRODUCTS_FILE_ID = "1ZAB1yWtR3siuhIDbT0Cll_WnRWDNbhKU";
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

async function selectAll(sb: Db, table: string, columns: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(columns).order("sku").range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

async function writeStatus(sb: Db, patch: Record<string, unknown>) {
  const { error } = await sb.from("cc_sync_status").upsert({ name: STATUS_NAME, ...patch }, { onConflict: "name" });
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
