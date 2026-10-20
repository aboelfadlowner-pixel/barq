import * as catalog from "../../server/catalog";
import type { CatalogService } from "../contracts";

/**
 * Catalog read from the backend data store (`src/server`), so edits made in the admin dashboard show up in the store.
 * Server-side only (it reads the store file): used by layouts and pages, never by client components.
 */
export const serverCatalogService: CatalogService = {
  getCategories: catalog.listCategories,
  getCategory: catalog.getCategory,
  getProducts: (query) => catalog.listProducts({ ...query, forSale: true }),
  getProduct: catalog.getProduct,
  getProductsByIds: catalog.getProductsByIds,
};
