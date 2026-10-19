import { CATEGORY_ARTS } from "../lib/category-art";
import { normalizeArabic } from "../lib/arabic";
import { DEFAULT_MAX_WEIGHT, DEFAULT_WEIGHT_STEP, roundQty } from "../lib/quantity";
import { isValidSku, normalizeSku } from "../lib/sku";
import type { Category, CategoryId } from "../types/category";
import type { Product, ProductId, ProductQuery } from "../types/product";
import { mutate, read } from "./db";
import { ApiError, assertValid, notFound } from "./errors";

/** Image address: a site path (/uploads/…, /products/…), an https link, or (demo uploads) an inline data URL. */
const IMAGE_URL = /^(\/|https:\/\/|data:image\/(webp|jpeg|png);base64,)/;

// ---------- reads ----------

export async function listCategories(): Promise<Category[]> {
  return (await read()).categories;
}

export async function getCategory(id: CategoryId): Promise<Category | null> {
  return (await read()).categories.find((category) => category.id === id) ?? null;
}

/** Extra admin-only filters on top of the public `ProductQuery`. */
export interface AdminProductQuery extends ProductQuery {
  inStock?: boolean;
  /** true: only products with a SKU; false: only products without one. */
  linked?: boolean;
}

/** Products in catalog order. Search keeps the v29 rule: the normalized text must appear in "<product name> <category name>". */
export async function listProducts(query: AdminProductQuery = {}): Promise<Product[]> {
  const { categories, products } = await read();
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const search = query.search ? normalizeArabic(query.search) : "";
  return products.filter((product) => {
    if (query.categoryId && product.categoryId !== query.categoryId) return false;
    if (query.inStock !== undefined && product.inStock !== query.inStock) return false;
    if (query.linked !== undefined && Boolean(product.sku) !== query.linked) return false;
    if (search && !normalizeArabic(`${product.name} ${categoryName.get(product.categoryId) ?? ""} ${product.sku ?? ""}`).includes(search)) return false;
    return true;
  });
}

export async function getProduct(id: ProductId): Promise<Product | null> {
  return (await read()).products.find((product) => product.id === id) ?? null;
}

export async function getProductsByIds(ids: ProductId[]): Promise<Product[]> {
  const byId = new Map((await read()).products.map((product) => [product.id, product]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

// ---------- product writes ----------

export type ProductInput = Partial<Omit<Product, "id">>;

/** Offer date: "" / missing -> undefined, a valid "YYYY-MM-DD" -> itself, anything else -> null (invalid). */
function cleanDate(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) return null;
  return text;
}

/** True when `value` is a positive weight in kg with at most gram precision (0.125 is fine, 0.1255 is not). */
const isWeight = (value: number, max: number) => Number.isFinite(value) && value > 0 && value <= max && Math.abs(roundQty(value) - value) < 1e-9;

/**
 * Checks and cleans product fields. `existing` is the current product for updates (missing fields keep their value);
 * `products` is the whole catalog, used to keep SKUs unique.
 */
function buildProduct(input: ProductInput, categories: Category[], products: Product[], existing?: Product): Omit<Product, "id"> {
  const fields: Record<string, string> = {};
  const merged = { ...existing, ...input };

  const name = typeof merged.name === "string" ? merged.name.trim() : "";
  if (name.length < 2 || name.length > 120) fields.name = "اكتب اسم المنتج (من 2 إلى 120 حرفًا)";

  const categoryId = merged.categoryId ?? "";
  if (!categories.some((category) => category.id === categoryId)) fields.categoryId = "اختر قسمًا موجودًا";

  const price = Number(merged.price);
  if (!Number.isFinite(price) || price <= 0 || price > 100000) fields.price = "يجب أن يكون السعر رقمًا أكبر من صفر";

  // Weight settings (like WooCommerce's weight-based pricing): from minWeight, in steps of weightStep, up to maxWeight.
  const weighed = Boolean(merged.weighed);
  let weights: Pick<Product, "weightStep" | "minWeight" | "maxWeight"> = {};
  if (weighed) {
    const weightStep = merged.weightStep === undefined ? DEFAULT_WEIGHT_STEP : Number(merged.weightStep);
    const minWeight = merged.minWeight === undefined ? weightStep : Number(merged.minWeight);
    const maxWeight = merged.maxWeight === undefined ? DEFAULT_MAX_WEIGHT : Number(merged.maxWeight);
    if (!isWeight(weightStep, 5)) fields.weightStep = "يجب أن تكون الزيادة بين 0.001 و 5 كيلو";
    if (!isWeight(minWeight, 50)) fields.minWeight = "يجب أن يكون أقل وزن أكبر من صفر (بالكيلو، مثلًا 0.125)";
    if (!isWeight(maxWeight, 100)) fields.maxWeight = "يجب أن يكون أقصى وزن بين 0.001 و 100 كيلو";
    else if (!fields.minWeight && maxWeight < minWeight) fields.maxWeight = "يجب أن يكون أقصى وزن أكبر من أقل وزن أو مساويًا له";
    weights = { weightStep, minWeight, maxWeight };
  }

  // SKU: optional, "sk-" + digits, and never used by another product (one sheet row updates one product).
  const sku = normalizeSku(merged.sku);
  if (sku && !isValidSku(sku)) fields.sku = "يجب أن يكون الـ SKU بالشكل sk-1234";
  else if (sku) {
    const owner = products.find((product) => product.sku === sku && product.id !== existing?.id);
    if (owner) fields.sku = `هذا الـ SKU مرتبط بمنتج آخر: «${owner.name}»`;
  }

  // Offer: optional sale price below the price, with optional first / last day ("YYYY-MM-DD").
  const offer = Boolean(merged.offer);
  let offerFields: Pick<Product, "salePrice" | "offerStart" | "offerEnd"> = {};
  if (offer) {
    const hasSale = merged.salePrice !== undefined && merged.salePrice !== null && String(merged.salePrice) !== "";
    const salePrice = hasSale ? Number(merged.salePrice) : undefined;
    if (salePrice !== undefined && (!Number.isFinite(salePrice) || salePrice <= 0)) fields.salePrice = "يجب أن يكون سعر العرض رقمًا أكبر من صفر";
    else if (salePrice !== undefined && !fields.price && salePrice >= price) fields.salePrice = "يجب أن يكون سعر العرض أقل من السعر الأصلي";
    const offerStart = cleanDate(merged.offerStart);
    const offerEnd = cleanDate(merged.offerEnd);
    if (offerStart === null) fields.offerStart = "التاريخ غير صحيح";
    if (offerEnd === null) fields.offerEnd = "التاريخ غير صحيح";
    else if (offerStart && offerEnd && offerEnd < offerStart) fields.offerEnd = "يجب أن يكون آخر يوم بعد أول يوم";
    offerFields = {
      ...(salePrice !== undefined && !fields.salePrice ? { salePrice: Math.round(salePrice * 100) / 100 } : {}),
      ...(offerStart ? { offerStart } : {}),
      ...(offerEnd ? { offerEnd } : {}),
    };
  }

  const description = typeof merged.description === "string" ? merged.description.trim() : "";
  if (description.length > 1000) fields.description = "الوصف طويل جدًا (الحد الأقصى 1000 حرف)";

  const imageUrl = typeof merged.imageUrl === "string" ? merged.imageUrl.trim() : "";
  if (imageUrl && !IMAGE_URL.test(imageUrl)) fields.imageUrl = "يجب أن يبدأ رابط الصورة بـ / أو https://";

  assertValid(fields);
  return {
    categoryId,
    name,
    price: Math.round(price * 100) / 100,
    weighed,
    ...weights,
    ...(sku ? { sku } : {}),
    inStock: merged.inStock === undefined ? true : Boolean(merged.inStock),
    bestseller: Boolean(merged.bestseller),
    offer,
    ...offerFields,
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

/** Creates a product with the next free id (ids continue the old WooCommerce numbering). */
export function createProduct(input: ProductInput): Promise<Product> {
  return mutate((data) => {
    const product: Product = { id: Math.max(0, ...data.products.map((p) => p.id)) + 1, ...buildProduct(input, data.categories, data.products) };
    data.products.push(product);
    return product;
  });
}

export function updateProduct(id: ProductId, input: ProductInput): Promise<Product> {
  return mutate((data) => {
    const index = data.products.findIndex((product) => product.id === id);
    if (index < 0) throw notFound("المنتج");
    const product: Product = { id, ...buildProduct(input, data.categories, data.products, data.products[index]) };
    data.products[index] = product;
    return product;
  });
}

/** What the products table can change on many products at once. */
export interface BulkPatch {
  inStock?: boolean;
  bestseller?: boolean;
  categoryId?: CategoryId;
  /** Puts the selected products on offer at this discount, 1-90 %. */
  discountPercent?: number;
  /** Last offer day ("YYYY-MM-DD") used with `discountPercent`; empty for no end date. */
  offerEnd?: string;
  /** false: ends the offer on the selected products. */
  offer?: boolean;
}

/**
 * Applies one change to many products (products table, «تعديل جماعي»). Unknown ids are skipped.
 * With `discountPercent`, each product gets `salePrice = price × (1 − percent)`, rounded to 2 decimals, and the offer on.
 * Returns the changed products.
 */
export function bulkUpdateProducts(ids: unknown, patch: BulkPatch): Promise<Product[]> {
  return mutate((data) => {
    const wanted = new Set(Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : []);
    if (!wanted.size) throw new ApiError(400, "اختر منتجًا واحدًا على الأقل");
    if (patch.categoryId !== undefined && !data.categories.some((c) => c.id === patch.categoryId)) throw new ApiError(400, "اختر قسمًا موجودًا");
    const percent = patch.discountPercent === undefined ? undefined : Number(patch.discountPercent);
    if (percent !== undefined && (!Number.isFinite(percent) || percent < 1 || percent > 90)) throw new ApiError(400, "يجب أن تكون نسبة الخصم من 1 إلى 90");
    const offerEnd = cleanDate(patch.offerEnd);
    if (offerEnd === null) throw new ApiError(400, "تاريخ آخر يوم غير صحيح");

    const changed: Product[] = [];
    for (const product of data.products) {
      if (!wanted.has(product.id)) continue;
      if (patch.inStock !== undefined) product.inStock = Boolean(patch.inStock);
      if (patch.bestseller !== undefined) product.bestseller = Boolean(patch.bestseller);
      if (patch.categoryId !== undefined) product.categoryId = patch.categoryId;
      if (percent !== undefined) {
        product.offer = true;
        product.salePrice = Math.round(product.price * (100 - percent)) / 100;
        delete product.offerStart;
        if (offerEnd) product.offerEnd = offerEnd;
        else delete product.offerEnd;
      } else if (patch.offer === false) {
        product.offer = false;
        delete product.salePrice;
        delete product.offerStart;
        delete product.offerEnd;
      }
      changed.push(product);
    }
    return changed;
  });
}

/**
 * New display order for one category's products («ترتيب المنتجات»). `ids` must list every product of the category once.
 * The category's products keep their slots in the catalog list and are put back into them in the new order,
 * so other categories (and the "كل المنتجات" page around them) do not move.
 */
export function reorderCategory(categoryId: CategoryId, ids: unknown): Promise<void> {
  return mutate((data) => {
    const slots = data.products.flatMap((product, index) => (product.categoryId === categoryId ? [index] : []));
    const order = Array.isArray(ids) ? ids.map(Number) : [];
    const byId = new Map(slots.map((index) => [data.products[index].id, data.products[index]]));
    if (order.length !== slots.length || new Set(order).size !== order.length || order.some((id) => !byId.has(id))) {
      throw new ApiError(409, "تغيّرت قائمة المنتجات منذ فتح الصفحة. حدّث الصفحة وأعد الترتيب.");
    }
    const placed = order.map((id) => byId.get(id)!);
    slots.forEach((index, i) => (data.products[index] = placed[i]));
  });
}

export function deleteProduct(id: ProductId): Promise<void> {
  return mutate((data) => {
    const index = data.products.findIndex((product) => product.id === id);
    if (index < 0) throw notFound("المنتج");
    data.products.splice(index, 1);
  });
}

// ---------- category writes ----------

export type CategoryInput = Partial<Category> & {
  /** New 0-based position in the display order. */
  position?: number;
};

function checkCategoryFields(category: Category) {
  const fields: Record<string, string> = {};
  if (!/^[a-z0-9-]{2,40}$/.test(category.id)) fields.id = "استخدم حروفًا إنجليزية صغيرة وأرقامًا و - فقط (مثال: frozen-food)";
  if (category.name.length < 2 || category.name.length > 60) fields.name = "اكتب اسم القسم (من 2 إلى 60 حرفًا)";
  if (!(CATEGORY_ARTS as readonly string[]).includes(category.art)) fields.art = "اختر أيقونة من القائمة";
  if (!/^#[0-9a-fA-F]{6}$/.test(category.tint)) fields.tint = "يجب أن يكون اللون بالشكل #RRGGBB";
  if (category.imageUrl && !IMAGE_URL.test(category.imageUrl)) fields.imageUrl = "يجب أن يبدأ رابط الصورة بـ / أو https://";
  if (category.iconUrl && !IMAGE_URL.test(category.iconUrl)) fields.iconUrl = "يجب أن يبدأ رابط الصورة بـ / أو https://";
  assertValid(fields);
}

/** Category photo from the request: trimmed; empty means "no photo" (the icon is shown). */
const cleanImage = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function createCategory(input: CategoryInput): Promise<Category> {
  return mutate((data) => {
    const category: Category = {
      id: String(input.id ?? "").trim().toLowerCase(),
      name: String(input.name ?? "").trim(),
      art: input.art ?? "a-bowl",
      tint: input.tint ?? "#EEF6EC",
      ...(cleanImage(input.imageUrl) ? { imageUrl: cleanImage(input.imageUrl) } : {}),
      ...(cleanImage(input.iconUrl) ? { iconUrl: cleanImage(input.iconUrl) } : {}),
    };
    checkCategoryFields(category);
    if (category.id === "all" || category.id === "deals" || data.categories.some((c) => c.id === category.id)) {
      throw new ApiError(409, "هذا الكود مستخدم من قبل", { id: "هذا الكود مستخدم من قبل" });
    }
    data.categories.push(category);
    return category;
  });
}

/** Updates name, icon, colour, photo and/or position. The id cannot change: it is in product records and page URLs. */
export function updateCategory(id: CategoryId, input: CategoryInput): Promise<Category> {
  return mutate((data) => {
    const index = data.categories.findIndex((category) => category.id === id);
    if (index < 0) throw notFound("القسم");
    const current = data.categories[index];
    const category: Category = {
      id,
      name: input.name !== undefined ? String(input.name).trim() : current.name,
      art: input.art ?? current.art,
      tint: input.tint ?? current.tint,
    };
    const imageUrl = input.imageUrl !== undefined ? cleanImage(input.imageUrl) : current.imageUrl;
    if (imageUrl) category.imageUrl = imageUrl;
    const iconUrl = input.iconUrl !== undefined ? cleanImage(input.iconUrl) : current.iconUrl;
    if (iconUrl) category.iconUrl = iconUrl;
    checkCategoryFields(category);
    data.categories.splice(index, 1);
    const position = input.position === undefined ? index : Math.max(0, Math.min(data.categories.length, Math.trunc(input.position)));
    data.categories.splice(position, 0, category);
    return category;
  });
}

/** Deletes an empty category. Categories that still have products are refused, so no product is left without a category. */
export function deleteCategory(id: CategoryId): Promise<void> {
  return mutate((data) => {
    const index = data.categories.findIndex((category) => category.id === id);
    if (index < 0) throw notFound("القسم");
    const count = data.products.filter((product) => product.categoryId === id).length;
    if (count) throw new ApiError(409, `يحتوي القسم على ${count} منتج. انقلها أو احذفها أولًا.`);
    data.categories.splice(index, 1);
  });
}
