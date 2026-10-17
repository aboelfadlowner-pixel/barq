import type { Category, CategoryId } from "../types/category";
import type { Product, ProductId, ProductQuery } from "../types/product";
import type { Order, OrderDraft } from "../types/order";

/**
 * Read access to the store catalog.
 *
 * Pages and components must only talk to these interfaces (through `src/services/index.ts`),
 * never import `src/data` directly. Today the implementation reads the static v29 data;
 * later it can be replaced by an implementation backed by an API or a database
 * without touching any UI code. All methods are async on purpose, so loading and error
 * states can be designed now.
 */
export interface CatalogService {
  /** All categories, in display order. */
  getCategories(): Promise<Category[]>;
  /** One category, or null when the id does not exist. */
  getCategory(id: CategoryId): Promise<Category | null>;
  /** Products matching the optional filters, in catalog order. */
  getProducts(query?: ProductQuery): Promise<Product[]>;
  /** One product, or null when the id does not exist. */
  getProduct(id: ProductId): Promise<Product | null>;
  /** Products for the given ids (unknown ids are skipped). Used to rebuild the cart from stored ids. */
  getProductsByIds(ids: ProductId[]): Promise<Product[]>;
}

/** Order submission. */
export interface OrderService {
  /**
   * Submits an order and returns it with its order number.
   * Rejects with an Error when the order cannot be submitted.
   */
  submitOrder(draft: OrderDraft): Promise<Order>;
}
