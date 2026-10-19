import { categories as seedCategories } from "../data/categories";
import { DEFAULT_SETTINGS, OLD_NOTICE } from "../lib/settings";
import { products as seedProducts } from "../data/products";
import { productSkus } from "../data/skus";
import type { Category } from "../types/category";
import type { StoreData } from "./db";

/** Photos of the categories that already have one: home-page card (4:5) and, when different, the small round icon. */
const CATEGORY_IMAGES: Record<string, string> = {
  sandwich: "/covers/sandwich/tile.webp",
  juice: "/covers/juice/tile.webp",
  dairy: "/covers/dairy/tile.webp",
};
const CATEGORY_ICONS: Record<string, string> = {
  dairy: "/covers/dairy/icon.webp",
};

const withImages = (category: Category): Category => ({
  ...category,
  ...(CATEGORY_IMAGES[category.id] ? { imageUrl: CATEGORY_IMAGES[category.id] } : {}),
  ...(CATEGORY_ICONS[category.id] ? { iconUrl: CATEGORY_ICONS[category.id] } : {}),
});

/** First contents of the data store: the v29 catalog with the Foodics SKUs from the WooCommerce export. */
/**
 * The old static «العروض» category (28 products) from the WooCommerce store, removed at the owner's request: offers now
 * come from the offer price of each product (the «العروض» section, /category/deals). `src/data` keeps it for verify:data.
 */
const REMOVED_CATEGORY = "offers";

export function seedStore(): StoreData {
  return {
    categories: seedCategories.filter((category) => category.id !== REMOVED_CATEGORY).map(withImages),
    products: seedProducts
      .filter((product) => product.categoryId !== REMOVED_CATEGORY)
      .map((product) => (productSkus[product.id] ? { ...product, sku: productSkus[product.id] } : { ...product })),
    orders: [],
    orderSeq: 0,
    syncLog: [],
    unlinkedSkus: [],
    schema: SCHEMA,
  };
}

/** Version of the stored data; `upgradeStore` brings older versions up to it. */
const SCHEMA = 6;

/**
 * Brings a store saved by an older version up to date (missing fields are added, nothing is removed).
 * - SKU linking: products get their SKU from the WooCommerce export the first time.
 * - Schema 2: categories get the photos they already had (sandwiches, fresh juices).
 * - Schema 3: dairy gets its card photo and icon (from the dairy group photo), unless already set.
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
  if ((data.schema ?? 1) < 3) {
    for (const category of data.categories) {
      if (category.id !== "dairy") continue;
      if (!category.imageUrl) category.imageUrl = CATEGORY_IMAGES.dairy;
      if (!category.iconUrl) category.iconUrl = CATEGORY_ICONS.dairy;
    }
  }
  if ((data.schema ?? 1) < 4) {
    // Map link of the main branch, for settings saved before it was known.
    for (const branch of data.settings?.branches ?? []) {
      if (!branch.mapUrl && branch.address.includes("السماليهي")) branch.mapUrl = DEFAULT_SETTINGS.branches[0].mapUrl;
    }
  }
  if ((data.schema ?? 1) < 5) {
    data.categories = data.categories.filter((category) => category.id !== REMOVED_CATEGORY);
    data.products = data.products.filter((product) => product.categoryId !== REMOVED_CATEGORY);
  }
  if ((data.schema ?? 1) < 6 && data.settings?.notice === OLD_NOTICE) {
    data.settings.notice = DEFAULT_SETTINGS.notice; // delivery now covers more areas than البيطاش
  }
  data.schema = SCHEMA;
  return data;
}
