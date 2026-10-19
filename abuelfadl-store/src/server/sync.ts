import { parseCsv } from "../lib/csv";
import { round2 } from "../lib/quantity";
import { isValidSku, normalizeSku } from "../lib/sku";
import type { SyncRun, UnlinkedSku } from "../types/sync";
import { mutate, read } from "./db";
import { ApiError } from "./errors";

/** How many imports the log keeps. */
const LOG_SIZE = 30;

/** One usable row of the Foodics products sheet. */
interface SheetRow {
  sku: string;
  name: string;
  price: number;
  weighed: boolean;
  active: boolean;
}

/**
 * Reads the Foodics products export ("المنتجات.csv": id, name, sku, ..., is_sold_by_weight, is_active, price, ...).
 * Rows without a valid SKU ("sk-1234") or price are skipped. Prices of weighed products are per kg, like the store.
 */
export function readProductsSheet(csv: string): SheetRow[] {
  const rows = parseCsv(csv);
  if (!rows.length || !("sku" in rows[0]) || !("price" in rows[0])) {
    throw new ApiError(400, "هذا الملف ليس شيت المنتجات الخاص بـ Foodics: يجب أن يحتوي على العمودين sku و price");
  }
  return rows.flatMap((row) => {
    const sku = normalizeSku(row.sku);
    const price = Number(row.price);
    if (!isValidSku(sku) || !Number.isFinite(price) || price <= 0) return [];
    return [{ sku, name: row.name ?? "", price: round2(price), weighed: row.is_sold_by_weight === "Yes", active: row.is_active !== "No" }];
  });
}

/**
 * Updates store prices from sheet rows: every product whose SKU is in the sheet takes the sheet price.
 * Only the price changes; name, photo, category, description and availability stay as set in the dashboard.
 * The same function will be called by the Supabase sync later (with `source` = "Supabase").
 */
export function applyPrices(rows: SheetRow[], source: string): Promise<SyncRun> {
  if (!rows.length) throw new ApiError(400, "لا يوجد في الشيت أي صف يحتوي على SKU وسعر صحيح");
  return mutate((data) => {
    const bySku = new Map(rows.map((row) => [row.sku, row])); // a repeated SKU: the last row wins
    const run: SyncRun = {
      at: new Date().toISOString(),
      source,
      rowsRead: rows.length,
      matched: 0,
      changes: [],
      missingFromSheet: [],
      unlinkedCount: 0,
    };
    const used = new Set<string>();
    for (const product of data.products) {
      if (!product.sku) continue;
      used.add(product.sku);
      const row = bySku.get(product.sku);
      if (!row) {
        run.missingFromSheet.push({ productId: product.id, name: product.name, sku: product.sku });
        continue;
      }
      run.matched += 1;
      if (row.price !== product.price) {
        run.changes.push({ productId: product.id, name: product.name, sku: product.sku, oldPrice: product.price, newPrice: row.price });
        product.price = row.price;
      }
    }
    const unlinked: UnlinkedSku[] = [...bySku.values()]
      .filter((row) => row.active && !used.has(row.sku))
      .map(({ sku, name, price, weighed }) => ({ sku, name, price, weighed }));
    run.unlinkedCount = unlinked.length;
    data.unlinkedSkus = unlinked;
    data.syncLog = [...(data.syncLog ?? []), run].slice(-LOG_SIZE);
    return run;
  });
}

/** Import log for the dashboard: runs newest first, the unlinked sheet SKUs of the latest run, and link counts. */
export async function getSyncStatus() {
  const { syncLog = [], unlinkedSkus = [], products } = await read();
  return {
    runs: [...syncLog].reverse(),
    unlinkedSkus,
    linkedProducts: products.filter((product) => product.sku).length,
    unlinkedProducts: products.filter((product) => !product.sku).length,
  };
}

export type SyncStatus = Awaited<ReturnType<typeof getSyncStatus>>;
