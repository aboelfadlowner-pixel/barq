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
  /** Offer switch from the dashboard. The offer shows only with a `salePrice` below `price` and within its dates. */
  offer: boolean;
  /** Offer price in EGP (per kg for weighed products). The store shows `price` struck through next to it. */
  salePrice?: number;
  /** First day of the offer, "YYYY-MM-DD" (Cairo). Missing: starts now. */
  offerStart?: string;
  /** Last day of the offer, "YYYY-MM-DD" (Cairo), included. Missing: until it is turned off. */
  offerEnd?: string;
  description?: string;
  /** Public path of the product photo, e.g. "/products/13221.webp". Missing when there is no photo yet. */
  imageUrl?: string;
  /** Set by the database store: the price is the products-sheet price of the SKU (not editable in the dashboard). */
  priceFromSheet?: boolean;
  /** Set by the database store: the SKU has no price in the products sheet, so the product is hidden from the store. */
  priceMissing?: boolean;
}

/** Filter for listing products. All fields are optional and combined with AND. */
export interface ProductQuery {
  categoryId?: CategoryId;
  /** Free-text search over product name and category name (Arabic-normalized). */
  search?: string;
}
