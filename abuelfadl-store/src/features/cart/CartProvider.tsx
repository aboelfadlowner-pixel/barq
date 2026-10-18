"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useCatalog, type CatalogProduct } from "@/features/catalog/CatalogProvider";
import { CART_STORAGE_KEY } from "@/lib/constants";
import { MAX_RESTORED_QUANTITY, maxQuantityOf, round2, roundQty } from "@/lib/quantity";
import type { ProductId } from "@/types/product";

export interface CartLine {
  product: CatalogProduct;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  /** Number shown on the cart badges: a weighed product counts as 1 line, a piece product counts its pieces (v29). */
  count: number;
  total: number;
  quantityOf: (id: ProductId) => number;
  /** Sets the quantity of a product. 0 or less removes it; the value is capped and unavailable products are refused. */
  setQuantity: (id: ProductId, quantity: number) => void;
  /** Empties the cart (after an order is placed). */
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}

type Quantities = Record<number, number>;

/**
 * The cart. Stored in localStorage under `abuelfadl_cart` as `{ "<productId>": quantity }`, exactly like v29,
 * so a cart created by the old site still loads. The stored cart is read after the first render so the server HTML
 * and the first client render match; products that no longer exist or are unavailable are dropped.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { getProduct } = useCatalog();
  const [quantities, setQuantities] = useState<Quantities>({});
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const next: Quantities = {};
    try {
      const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "{}") as Record<string, unknown>;
      for (const [key, raw] of Object.entries(stored)) {
        const product = getProduct(Number(key));
        const quantity = Number(raw);
        if (product && product.inStock && quantity > 0) next[product.id] = Math.min(quantity, MAX_RESTORED_QUANTITY);
      }
    } catch {
      // unreadable or blocked storage: start with an empty cart
    }
    setQuantities(next);
    setRestored(true);
  }, [getProduct]);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(quantities));
    } catch {
      // storage full or blocked: the cart still works for this visit
    }
  }, [quantities, restored]);

  const setQuantity = useCallback(
    (id: ProductId, quantity: number) => {
      const product = getProduct(id);
      if (!product) return;
      setQuantities((current) => {
        const next = { ...current };
        if (quantity <= 0 || !product.inStock) delete next[id];
        else next[id] = Math.min(roundQty(quantity), maxQuantityOf(product));
        return next;
      });
    },
    [getProduct],
  );

  const clear = useCallback(() => setQuantities({}), []);

  const value = useMemo<CartContextValue>(() => {
    const lines: CartLine[] = [];
    let count = 0;
    let sum = 0;
    for (const [key, quantity] of Object.entries(quantities)) {
      const product = getProduct(Number(key));
      if (!product) continue;
      lines.push({ product, quantity });
      count += product.weighed ? 1 : quantity;
      sum += quantity * product.price;
    }
    return {
      lines,
      count,
      total: round2(sum),
      quantityOf: (id) => quantities[id] ?? 0,
      setQuantity,
      clear,
    };
  }, [quantities, getProduct, setQuantity, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
