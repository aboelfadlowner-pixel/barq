import { categories as seedCategories } from "../data/categories";
import { DEFAULT_SETTINGS, OLD_DEFAULT_TEXTS, OLD_NOTICE } from "../lib/settings";
import { products as seedProducts } from "../data/products";
import { productPhotoIds } from "../data/photos";
import { productSkus } from "../data/skus";
import type { Category } from "../types/category";
import type { Product } from "../types/product";
import type { StoreData } from "./db";

/** Photos of the categories that already have one: home-page card (4:5) and, when different, the small round icon. */
const CATEGORY_IMAGES: Record<string, string> = {
  sandwich: "/covers/sandwich/tile.webp",
  juice: "/covers/juice/tile.webp",
  dairy: "/covers/dairy/tile.webp",
  cheese: "/covers/cheese/tile.webp",
  kiri: "/covers/kiri/tile.webp",
  deli: "/covers/deli/tile.webp",
  syrian: "/covers/syrian/tile.webp",
  fresh: "/covers/fresh/tile.webp",
};
const CATEGORY_ICONS: Record<string, string> = {
  dairy: "/covers/dairy/icon.webp",
  cheese: "/covers/cheese/icon.webp",
  kiri: "/covers/kiri/icon.webp",
  deli: "/covers/deli/icon.webp",
  syrian: "/covers/syrian/icon.webp",
  fresh: "/covers/fresh/icon.webp",
};
/** Lines under the names of the categories that have a cover (editable from the dashboard). */
const CATEGORY_TAGLINES: Record<string, string> = {
  dairy: "Fresh Dairy, Every Day",
  sandwich: "Freshly Made, Generously Filled",
  juice: "100% Fresh, Nothing Added",
  imported: "Imported Cheese, Hand-Picked",
};

/** «تونه» (= «تونة بالمايونيز») and «مختوم فلسطيني» (= «برطمان مختوم فلسطيني 425جم»). */
const DUPLICATES = [51425, 51694];

/** Dates the store stopped selling for now (shown as unavailable). */
const DATES_PAUSED = [51698, 51701, 51727, 51709];

const DRINKS_NOTICE = "تنبيه: قسم العصائر والآيس كريم والقهوة للعرض فقط ولا يوجد طلب مباشر من هذا القسم.";

const withImages = (category: Category): Category => ({
  ...category,
  ...(CATEGORY_IMAGES[category.id] ? { imageUrl: CATEGORY_IMAGES[category.id] } : {}),
  ...(CATEGORY_ICONS[category.id] ? { iconUrl: CATEGORY_ICONS[category.id] } : {}),
  ...(CATEGORY_TAGLINES[category.id] ? { tagline: CATEGORY_TAGLINES[category.id] } : {}),
  ...(category.id === "drinks" ? { notice: DRINKS_NOTICE, displayOnly: true } : {}),
});

/** The product's photo in public/products when it has none yet. */
const withPhoto = (product: Product): Product =>
  product.imageUrl || !productPhotoIds.has(product.id) ? product : { ...product, imageUrl: `/products/${product.id}.webp` };

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
      .map((product) => (productSkus[product.id] ? { ...product, sku: productSkus[product.id] } : { ...product }))
      .map(withPhoto)
      .map((product) => (DUPLICATES.includes(product.id) && !product.sku ? { ...product, hidden: true } : product))
      .map((product) => (DATES_PAUSED.includes(product.id) ? { ...product, inStock: false } : product)),
    orders: [],
    orderSeq: 0,
    syncLog: [],
    unlinkedSkus: [],
    schema: SCHEMA,
  };
}

/** Version of the stored data; `upgradeStore` brings older versions up to it. */
const SCHEMA = 21;

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
  if ((data.schema ?? 1) < 7 && data.settings) {
    // The store texts moved from colloquial to simplified Arabic: replace the old defaults that were never edited.
    for (const [key, old] of Object.entries(OLD_DEFAULT_TEXTS) as [keyof typeof OLD_DEFAULT_TEXTS, string][]) {
      if (data.settings[key] === old) data.settings[key] = DEFAULT_SETTINGS[key];
    }
  }
  if ((data.schema ?? 1) < 8) {
    // Category lines moved from the code into the data, so they can be edited from the dashboard.
    for (const category of data.categories) {
      if (category.tagline === undefined && CATEGORY_TAGLINES[category.id]) category.tagline = CATEGORY_TAGLINES[category.id];
    }
  }
  if ((data.schema ?? 1) < 9) {
    // Line of «أجبان مستوردة» (kept when the category already has its own).
    const imported = data.categories.find((category) => category.id === "imported");
    if (imported && imported.tagline === undefined) imported.tagline = CATEGORY_TAGLINES.imported;
  }
  if ((data.schema ?? 1) < 10) {
    // The imported cheese cover was dropped: forget the card image and icon that pointed at its files.
    for (const category of data.categories) {
      if (category.imageUrl?.startsWith("/covers/imported/")) category.imageUrl = "";
      if (category.iconUrl?.startsWith("/covers/imported/")) category.iconUrl = "";
    }
  }
  if ((data.schema ?? 1) < 11) {
    // Photos of 553 products, taken from the old store (public/products): only for products that have none.
    data.products = data.products.map(withPhoto);
  }
  if ((data.schema ?? 1) < 12) {
    // Cover of «أجبان»: its home-page card and icon, unless the category already has its own.
    const cheese = data.categories.find((category) => category.id === "cheese");
    if (cheese && !cheese.imageUrl) cheese.imageUrl = CATEGORY_IMAGES.cheese;
    if (cheese && !cheese.iconUrl) cheese.iconUrl = CATEGORY_ICONS.cheese;
  }
  if ((data.schema ?? 1) < 13) {
    // Cover of «كيريهات وابتكارات»: its home-page card and icon, unless the category already has its own.
    const kiri = data.categories.find((category) => category.id === "kiri");
    if (kiri && !kiri.imageUrl) kiri.imageUrl = CATEGORY_IMAGES.kiri;
    if (kiri && !kiri.iconUrl) kiri.iconUrl = CATEGORY_ICONS.kiri;
  }
  if ((data.schema ?? 1) < 14) {
    // Cover of «مخللات ومقبلات»: its home-page card and icon, unless the category already has its own.
    const deli = data.categories.find((category) => category.id === "deli");
    if (deli && !deli.imageUrl) deli.imageUrl = CATEGORY_IMAGES.deli;
    if (deli && !deli.iconUrl) deli.iconUrl = CATEGORY_ICONS.deli;
  }
  if ((data.schema ?? 1) < 15) {
    // «عصائر وآيس كريم وقهوة» is shown on the site but ordered in the store only: notice and no cart (owner's wording).
    const drinks = data.categories.find((category) => category.id === "drinks");
    if (drinks && drinks.notice === undefined) drinks.notice = DRINKS_NOTICE;
    if (drinks && drinks.notice === DRINKS_NOTICE) drinks.displayOnly = true;
  }
  if ((data.schema ?? 1) < 16) {
    // Duplicates of products linked to the sheet, hidden at the owner's request: «تونه» and «مختوم فلسطيني».
    for (const product of data.products) if (DUPLICATES.includes(product.id) && !product.sku) product.hidden = true;
  }
  if ((data.schema ?? 1) < 18) {
    // The second imported cheese cover was dropped too: forget the card image and icon that pointed at its files.
    for (const category of data.categories) {
      if (category.imageUrl?.startsWith("/covers/imported/")) category.imageUrl = "";
      if (category.iconUrl?.startsWith("/covers/imported/")) category.iconUrl = "";
    }
  }
  if ((data.schema ?? 1) < 19) {
    // Cover of «منتجات سورية»: its home-page card and icon, unless the category already has its own.
    const syrian = data.categories.find((category) => category.id === "syrian");
    if (syrian && !syrian.imageUrl) syrian.imageUrl = CATEGORY_IMAGES.syrian;
    if (syrian && !syrian.iconUrl) syrian.iconUrl = CATEGORY_ICONS.syrian;
  }
  if ((data.schema ?? 1) < 20) {
    // Cover of «مخبوزات فريش»: its home-page card and icon, unless the category already has its own.
    const fresh = data.categories.find((category) => category.id === "fresh");
    if (fresh && !fresh.imageUrl) fresh.imageUrl = CATEGORY_IMAGES.fresh;
    if (fresh && !fresh.iconUrl) fresh.iconUrl = CATEGORY_ICONS.fresh;
  }
  if ((data.schema ?? 1) < 21) {
    // Dates no longer sold for now (owner): Egyptian medjool small / medium, medjool with nuts, Saudi rashodia.
    for (const product of data.products) if (DATES_PAUSED.includes(product.id)) product.inStock = false;
  }
  data.schema = SCHEMA;
  return data;
}
