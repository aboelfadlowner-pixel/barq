import { categories as seedCategories } from "../data/categories";
import { products as seedProducts } from "../data/products";
import { productSkus } from "../data/skus";
import type { StoreData } from "./db";

/** First contents of the data store: the v29 catalog with the Foodics SKUs from the WooCommerce export. */
export function seedStore(): StoreData {
  return {
    categories: structuredClone(seedCategories),
    products: seedProducts.map((product) => (productSkus[product.id] ? { ...product, sku: productSkus[product.id] } : { ...product })),
    orders: [],
    orderSeq: 0,
    syncLog: [],
    unlinkedSkus: [],
  };
}

/**
 * Brings a store saved by an older version up to date (missing fields are added, nothing is removed).
 * - SKU linking: products get their SKU from the WooCommerce export the first time.
 */
export function upgradeStore(data: StoreData): StoreData {
  if (!data.syncLog) {
    data.syncLog = [];
    data.unlinkedSkus = [];
    for (const product of data.products) {
      if (!product.sku && productSkus[product.id]) product.sku = productSkus[product.id];
    }
  }
  return data;
}
