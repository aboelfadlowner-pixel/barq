import type { Product } from "../types/product";

/** Today's date in Cairo as "YYYY-MM-DD" (offer dates are compared as text in this format). */
export const cairoToday = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

type Priced = Pick<Product, "price" | "offer" | "salePrice" | "offerStart" | "offerEnd">;

/** True when the product's offer applies today: offer on, a sale price below the price, and today within the dates. */
export function isOfferActive(product: Priced, today = cairoToday()): boolean {
  return (
    product.offer &&
    product.salePrice !== undefined &&
    product.salePrice > 0 &&
    product.salePrice < product.price &&
    (!product.offerStart || product.offerStart <= today) &&
    (!product.offerEnd || today <= product.offerEnd)
  );
}

/** The price a customer pays today (per kg for weighed products): the sale price during an offer, else the price. */
export function sellingPrice(product: Priced, today = cairoToday()): number {
  return isOfferActive(product, today) ? product.salePrice! : product.price;
}

/** Discount in whole percent, e.g. price 200, sale 170 -> 15. */
export const discountPercent = (price: number, salePrice: number) => Math.round((1 - salePrice / price) * 100);

/**
 * The product fields the browser needs. `price` is what the customer pays today (the offer price during an offer)
 * and `oldPrice` the regular price shown struck through; the offer settings themselves stay on the server.
 */
export type CatalogProduct = Omit<Product, "description" | "offer" | "salePrice" | "offerStart" | "offerEnd"> & {
  oldPrice?: number;
  /** Last offer day ("YYYY-MM-DD") while an offer with an end date is on. */
  offerEnd?: string;
};

/** Turns a stored product into what the store sends to the browser (see `CatalogProduct`). */
export function toCatalogProduct(product: Product, today = cairoToday()): CatalogProduct {
  const { description: _d, offer: _o, salePrice: _s, offerStart: _a, offerEnd: _b, ...rest } = product;
  if (!isOfferActive(product, today)) return rest;
  return { ...rest, price: product.salePrice!, oldPrice: product.price, ...(product.offerEnd ? { offerEnd: product.offerEnd } : {}) };
}
