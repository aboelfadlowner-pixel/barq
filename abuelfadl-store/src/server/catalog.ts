import { CATEGORY_ARTS } from "../lib/category-art";
import { normalizeArabic } from "../lib/arabic";
import type { Category, CategoryId } from "../types/category";
import type { Product, ProductId, ProductQuery } from "../types/product";
import { mutate, read } from "./db";
import { ApiError, assertValid, notFound } from "./errors";

/** Default weight step for weighed products (kg), same as v29. */
const DEFAULT_WEIGHT_STEP = 0.25;

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
}

/** Products in catalog order. Search keeps the v29 rule: the normalized text must appear in "<product name> <category name>". */
export async function listProducts(query: AdminProductQuery = {}): Promise<Product[]> {
  const { categories, products } = await read();
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const search = query.search ? normalizeArabic(query.search) : "";
  return products.filter((product) => {
    if (query.categoryId && product.categoryId !== query.categoryId) return false;
    if (query.inStock !== undefined && product.inStock !== query.inStock) return false;
    if (search && !normalizeArabic(`${product.name} ${categoryName.get(product.categoryId) ?? ""}`).includes(search)) return false;
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

/** Checks and cleans product fields. `existing` is the current product for updates (missing fields keep their value). */
function buildProduct(input: ProductInput, categories: Category[], existing?: Product): Omit<Product, "id"> {
  const fields: Record<string, string> = {};
  const merged = { ...existing, ...input };

  const name = typeof merged.name === "string" ? merged.name.trim() : "";
  if (name.length < 2 || name.length > 120) fields.name = "اكتب اسم المنتج (من 2 لـ 120 حرف)";

  const categoryId = merged.categoryId ?? "";
  if (!categories.some((category) => category.id === categoryId)) fields.categoryId = "اختار قسم موجود";

  const price = Number(merged.price);
  if (!Number.isFinite(price) || price <= 0 || price > 100000) fields.price = "السعر لازم يكون رقم أكبر من صفر";

  const weighed = Boolean(merged.weighed);
  let weightStep: number | undefined;
  if (weighed) {
    weightStep = merged.weightStep === undefined ? DEFAULT_WEIGHT_STEP : Number(merged.weightStep);
    if (!Number.isFinite(weightStep) || weightStep <= 0 || weightStep > 5) fields.weightStep = "خطوة الوزن لازم تكون بين 0 و 5 كيلو";
  }

  const description = typeof merged.description === "string" ? merged.description.trim() : "";
  if (description.length > 1000) fields.description = "الوصف طويل جدًا (أقصى حد 1000 حرف)";

  const imageUrl = typeof merged.imageUrl === "string" ? merged.imageUrl.trim() : "";
  if (imageUrl && !/^(\/|https:\/\/)/.test(imageUrl)) fields.imageUrl = "رابط الصورة لازم يبدأ بـ / أو https://";

  assertValid(fields);
  return {
    categoryId,
    name,
    price: Math.round(price * 100) / 100,
    weighed,
    ...(weighed ? { weightStep } : {}),
    inStock: merged.inStock === undefined ? true : Boolean(merged.inStock),
    bestseller: Boolean(merged.bestseller),
    offer: Boolean(merged.offer),
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

/** Creates a product with the next free id (ids continue the old WooCommerce numbering). */
export function createProduct(input: ProductInput): Promise<Product> {
  return mutate((data) => {
    const product: Product = { id: Math.max(0, ...data.products.map((p) => p.id)) + 1, ...buildProduct(input, data.categories) };
    data.products.push(product);
    return product;
  });
}

export function updateProduct(id: ProductId, input: ProductInput): Promise<Product> {
  return mutate((data) => {
    const index = data.products.findIndex((product) => product.id === id);
    if (index < 0) throw notFound("المنتج");
    const product: Product = { id, ...buildProduct(input, data.categories, data.products[index]) };
    data.products[index] = product;
    return product;
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
  if (!/^[a-z0-9-]{2,40}$/.test(category.id)) fields.id = "الكود بالإنجليزي الصغير وأرقام و - فقط (مثال: frozen-food)";
  if (category.name.length < 2 || category.name.length > 60) fields.name = "اكتب اسم القسم (من 2 لـ 60 حرف)";
  if (!(CATEGORY_ARTS as readonly string[]).includes(category.art)) fields.art = "اختار أيقونة من القائمة";
  if (!/^#[0-9a-fA-F]{6}$/.test(category.tint)) fields.tint = "اللون لازم يكون بالشكل #RRGGBB";
  assertValid(fields);
}

export function createCategory(input: CategoryInput): Promise<Category> {
  return mutate((data) => {
    const category: Category = {
      id: String(input.id ?? "").trim().toLowerCase(),
      name: String(input.name ?? "").trim(),
      art: input.art ?? "a-bowl",
      tint: input.tint ?? "#EEF6EC",
    };
    checkCategoryFields(category);
    if (category.id === "all" || data.categories.some((c) => c.id === category.id)) {
      throw new ApiError(409, "الكود ده مستخدم قبل كده", { id: "الكود ده مستخدم قبل كده" });
    }
    data.categories.push(category);
    return category;
  });
}

/** Updates name, icon, colour and/or position. The id cannot change: it is in product records and page URLs. */
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
    if (count) throw new ApiError(409, `القسم فيه ${count} منتج. انقلهم أو امسحهم الأول.`);
    data.categories.splice(index, 1);
  });
}
