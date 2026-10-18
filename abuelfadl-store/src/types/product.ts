import type { CategoryId } from "./category";

export type ProductId = number;

export interface Product {
  id: ProductId;
  categoryId: CategoryId;
  /** Arabic display name. */
  name: string;
  /** Price in EGP. For weighed products this is the price per kilogram. */
  price: number;
  /** True when the product is sold by weight (kg) instead of by piece. */
  weighed: boolean;
  /** Quantity increment in kg. Present only when `weighed` is true (v29 uses 0.25). */
  weightStep?: number;
  /** Smallest weight a customer can order, in kg (weighed products only). Defaults to `weightStep`. */
  minWeight?: number;
  /** Largest weight in one order, in kg (weighed products only). Defaults to 10. */
  maxWeight?: number;
  /**
   * Foodics product SKU, e.g. "sk-16671". Links the product to the products sheet: when the sheet is imported,
   * the price of the product with the same SKU is updated. Missing when the product is not linked yet.
   */
  sku?: string;
  /** False when the product is currently unavailable. v29 has no stock quantities, only available / unavailable. */
  inStock: boolean;
  /** Shown with the "best seller" label. */
  bestseller: boolean;
  /** Imported from the old store; not used by the v29 interface, kept so no data is lost. */
  offer: boolean;
  description?: string;
  /** Public path of the product photo, e.g. "/products/13221.webp". Missing when there is no photo yet. */
  imageUrl?: string;
}

/** Filter for listing products. All fields are optional and combined with AND. */
export interface ProductQuery {
  categoryId?: CategoryId;
  /** Free-text search over product name and category name (Arabic-normalized). */
  search?: string;
}
