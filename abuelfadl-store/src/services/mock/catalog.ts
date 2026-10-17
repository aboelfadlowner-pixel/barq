import { categories } from "../../data/categories";
import { products } from "../../data/products";
import { normalizeArabic } from "../../lib/arabic";
import type { CatalogService } from "../contracts";

const categoryById = new Map(categories.map((category) => [category.id, category]));
const productById = new Map(products.map((product) => [product.id, product]));

/**
 * Catalog backed by the static data copied from v29 (`src/data`).
 * Search keeps the v29 rule: normalized query must appear in the normalized "<product name> <category name>".
 */
export const mockCatalogService: CatalogService = {
  async getCategories() {
    return [...categories];
  },

  async getCategory(id) {
    return categoryById.get(id) ?? null;
  },

  async getProducts(query = {}) {
    const search = query.search ? normalizeArabic(query.search) : "";
    return products.filter((product) => {
      if (query.categoryId && product.categoryId !== query.categoryId) return false;
      if (!search) return true;
      const categoryName = categoryById.get(product.categoryId)?.name ?? "";
      return normalizeArabic(`${product.name} ${categoryName}`).includes(search);
    });
  },

  async getProduct(id) {
    return productById.get(id) ?? null;
  },

  async getProductsByIds(ids) {
    return ids.flatMap((id) => {
      const product = productById.get(id);
      return product ? [product] : [];
    });
  },
};
