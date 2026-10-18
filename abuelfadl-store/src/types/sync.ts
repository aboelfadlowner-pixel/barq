import type { ProductId } from "./product";

/** One price that changed during an import of the Foodics products sheet. */
export interface PriceChange {
  productId: ProductId;
  name: string;
  sku: string;
  oldPrice: number;
  newPrice: number;
}

/** A SKU from the sheet that no store product uses yet (a product to add, or a product to link). */
export interface UnlinkedSku {
  sku: string;
  name: string;
  price: number;
  weighed: boolean;
}

/** Result of one import of the products sheet. */
export interface SyncRun {
  /** ISO timestamp. */
  at: string;
  /** Where the rows came from, e.g. "رفع يدوي: المنتجات.csv" (later: "Supabase"). */
  source: string;
  /** Rows with a valid SKU and price in the sheet. */
  rowsRead: number;
  /** Store products whose SKU was found in the sheet. */
  matched: number;
  /** Prices that changed. */
  changes: PriceChange[];
  /** Linked store products whose SKU is not in the sheet. */
  missingFromSheet: { productId: ProductId; name: string; sku: string }[];
  /** Number of active sheet SKUs that no store product uses (the list itself is kept for the latest run only). */
  unlinkedCount: number;
}
