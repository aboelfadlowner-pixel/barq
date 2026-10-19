"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useOverlay } from "@/components/layout/OverlayProvider";
import { CART_SHEET_ID } from "@/features/cart/sheetIds";
import { useCart } from "@/features/cart/CartProvider";
import { useSettings } from "@/features/settings/SettingsProvider";
import type { Order } from "@/types/order";
import { CheckoutSheet, CHECKOUT_SHEET_ID } from "./CheckoutSheet";
import { OrderDone } from "./OrderDone";

interface CheckoutContextValue {
  /** Opens the delivery-details sheet (closing the cart drawer). Does nothing below the minimum order. */
  openCheckout: () => void;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function useCheckout(): CheckoutContextValue {
  const value = useContext(CheckoutContext);
  if (!value) throw new Error("useCheckout must be used inside <CheckoutProvider>");
  return value;
}

export const DONE_SCREEN_ID = "done";

/**
 * Checkout flow: cart drawer -> delivery details sheet -> "order received" animation (v29 `openCO`, `submitOrder`, `runDone`).
 * The order is sent to `POST /api/orders` through `orderService` (`src/services/client.ts`), which returns the order number.
 */
export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  const { total } = useCart();
  const { minOrder, ordersOpen } = useSettings();
  const { open, close } = useOverlay();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);

  const openCheckout = useCallback(() => {
    if (!ordersOpen || total < minOrder) return;
    open(CHECKOUT_SHEET_ID);
    close(CART_SHEET_ID);
  }, [total, minOrder, ordersOpen, open, close]);

  const showDone = useCallback(
    (placed: Order) => {
      setOrder(placed);
      open(DONE_SCREEN_ID);
      close(CHECKOUT_SHEET_ID);
      close(CART_SHEET_ID);
    },
    [open, close],
  );

  const dismissDone = useCallback(() => {
    setOrder(null);
    close(DONE_SCREEN_ID);
    router.push("/"); // "متابعة التسوق" goes back to the home page (v29 `goHome`)
    window.scrollTo(0, 0);
  }, [close, router]);

  const value = useMemo(() => ({ openCheckout }), [openCheckout]);

  return (
    <CheckoutContext.Provider value={value}>
      {children}
      <CheckoutSheet onPlaced={showDone} />
      <OrderDone order={order} onContinue={dismissDone} />
    </CheckoutContext.Provider>
  );
}
