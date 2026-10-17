import type { ProductId } from "./product";

/**
 * One cart line. `quantity` counts pieces, or kilograms for weighed products
 * (multiples of the product's `weightStep`).
 */
export interface CartItem {
  productId: ProductId;
  quantity: number;
}

/**
 * Persisted cart format, kept identical to v29 so existing carts are not lost:
 * localStorage key `abuelfadl_cart` holding a JSON object { "<productId>": quantity }.
 */
export type StoredCart = Record<string, number>;
