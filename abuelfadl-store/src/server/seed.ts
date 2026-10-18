import { categories as seedCategories } from "../data/categories";
import { products as seedProducts } from "../data/products";
import { productSkus } from "../data/skus";
import type { StoreData } from "./db";

/** Photos of the categories that already have one (the home-page tiles of the migration). */
const CATEGORY_IMAGES: Record<string, string> = {
  sandwich: "/covers/sandwich/tile.webp",
  juice: "/covers/juice/tile.webp",
};

/** First contents of the data store: the v29 catalog with the Foodics SKUs from the WooCommerce export. */
export function seedStore(): StoreData {
  return {
    categories: seedCategories.map((category) => (CATEGORY_IMAGES[category.id] ? { ...category, imageUrl: CATEGORY_IMAGES[category.id] } : { ...category })),
    products: seedProducts.map((product) => (productSkus[product.id] ? { ...product, sku: productSkus[product.id] } : { ...product })),
    orders: [],
    orderSeq: 0,
    syncLog: [],
    unlinkedSkus: [],
    schema: SCHEMA,
  };
}

/** Version of the stored data; `upgradeStore` brings older versions up to it. */
const SCHEMA = 2;

/**
 * Brings a store saved by an older version up to date (missing fields are added, nothing is removed).
 * - SKU linking: products get their SKU from the WooCommerce export the first time.
 * - Schema 2: categories get the photos they already had (sandwiches, fresh juices).
 */
export function upgradeStore(data: StoreData): StoreData {
  if (!data.syncLog) {
    data.syncLog = [];
    data.unlinkedSkus = [];
    for (const product of data.products) {
      if (!product.sku && productSkus[product.id]) product.sku = productSkus[product.id];
    }
  }
  if ((data.schema ?? 1) < 2) {
    for (const category of data.categories) {
      if (!category.imageUrl && CATEGORY_IMAGES[category.id]) category.imageUrl = CATEGORY_IMAGES[category.id];
    }
  }
  data.schema = SCHEMA;
  return data;
}
