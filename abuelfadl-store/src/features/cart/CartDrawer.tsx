"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useChrome } from "@/components/layout/ChromeProvider";
import { useOverlay } from "@/components/layout/OverlayProvider";
import { Art } from "@/components/ui/Art";
import { Icon } from "@/components/ui/Icon";
import { useCatalog } from "@/features/catalog/CatalogProvider";
import { flyToCart } from "@/lib/cart-effects";
import { useSettings } from "@/features/settings/SettingsProvider";
import { useOrdering } from "@/features/settings/useOrdering";
import { formatMoney } from "@/lib/format";
import { decreaseQuantity, increaseQuantity, quantityLabel, round2 } from "@/lib/quantity";
import { useCheckout } from "@/features/checkout/CheckoutProvider";
import { useCart } from "./CartProvider";
import { CART_SHEET_ID } from "./sheetIds";


/** Opens / closes the cart drawer from anywhere (header button, bottom nav). */
export function useCartDrawer() {
  const { isOpen, open, close } = useOverlay();
  const { hideToast } = useChrome();
  return {
    isOpen: isOpen(CART_SHEET_ID),
    openCart: () => {
      hideToast();
      open(CART_SHEET_ID);
    },
    closeCart: () => close(CART_SHEET_ID),
  };
}

/** The cart drawer (v29 `#drawer`): minimum-order progress, the lines with steppers, total and the checkout button. */
export function CartDrawer() {
  const { lines, total, quantityOf, setQuantity } = useCart();
  const { getCategory } = useCatalog();
  const { openCheckout } = useCheckout();
  const { isOpen, closeCart } = useCartDrawer();
  const drawerRef = useRef<HTMLElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  // Focus the close button when the drawer opens and give focus back to what opened it when it closes (v29 `lastFocus`).
  useEffect(() => {
    if (isOpen) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => drawerRef.current?.querySelector<HTMLElement>("#drClose")?.focus(), 50);
      return () => clearTimeout(timer);
    }
    // Give focus back to what opened the drawer, unless focus already moved on (e.g. into the checkout sheet).
    const active = document.activeElement;
    if (!active || active === document.body || drawerRef.current?.contains(active)) lastFocus.current?.focus?.();
    lastFocus.current = null;
  }, [isOpen]);

  const { minOrder } = useSettings();
  const { canOrder, message } = useOrdering();
  const reachedMinimum = total >= minOrder;
  const progress = minOrder > 0 ? Math.min(100, Math.round((total / minOrder) * 100)) : 100;

  const focusLine = (id: number, selectors: string[]) =>
    requestAnimationFrame(() => {
      for (const selector of selectors) {
        const target = drawerRef.current?.querySelector<HTMLElement>(`[data-line="${id}"] ${selector}`);
        if (target) return target.focus({ preventScroll: true });
      }
      drawerRef.current?.querySelector<HTMLElement>("#drClose")?.focus({ preventScroll: true });
    });

  return (
    <aside className={isOpen ? "drawer open" : "drawer"} id="drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="drTitle" inert={!isOpen}>
      <div className="dr-h">
        <h2 id="drTitle">سلة الطلبات</h2>
        <button className="circ" type="button" id="drClose" aria-label="إغلاق السلة" onClick={closeCart}>
          <Icon id="i-x" />
        </button>
      </div>
      <div className="dr-min">
        <p id="minMsg">
          {!canOrder
            ? message
            : reachedMinimum
            ? "وصلت إلى الحد الأدنى للطلب. تُحسب رسوم التوصيل حسب منطقتك."
            : `أضف ${formatMoney(minOrder - total)} ج.م لتصل إلى الحد الأدنى للطلب (${minOrder} ج.م).`}
        </p>
        <div className="track" hidden={!canOrder}>
          <div className="fill" id="fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <ul className="dr-list" id="drList">
        {lines.length === 0 ? (
          <li className="dr-empty">
            <Art id="a-basket" viewBox="0 0 120 110" />
            <b>سلتك فارغة</b>
            <span>أضف منتجات من الأقسام لتبدأ طلبك.</span>
          </li>
        ) : (
          lines.map(({ product, quantity }) => (
            <li className="dr-item" key={product.id} data-line={product.id}>
              <div className="di">
                <span className="th" style={{ "--tint": getCategory(product.categoryId)?.tint } as CSSProperties}>
                  {product.imageUrl ? <img className="ph" alt="" src={product.imageUrl} /> : <span className="phl" aria-hidden="true" />}
                </span>
                <div>
                  <b>{product.name}</b>
                  <br />
                  <small>
                    {formatMoney(product.price)}
                    {product.weighed ? " ج.م للكيلو" : " ج.م للوحدة"}
                  </small>
                </div>
              </div>
              <span className="lt">{formatMoney(round2(product.price * quantity))} ج.م</span>
              <div className="step" role="group" aria-label={`كمية ${product.name}`}>
                <button
                  type="button"
                  data-inc={product.id}
                  aria-label="زيادة الكمية"
                  onClick={(event) => {
                    flyToCart(event.currentTarget);
                    setQuantity(product.id, increaseQuantity(product, quantityOf(product.id)));
                    focusLine(product.id, ["[data-inc]"]);
                  }}
                >
                  <Icon id="i-plus" />
                </button>
                <output>{quantityLabel(product, quantity)}</output>
                <button
                  type="button"
                  data-dec={product.id}
                  aria-label="تقليل الكمية"
                  onClick={() => {
                    setQuantity(product.id, decreaseQuantity(product, quantityOf(product.id)));
                    focusLine(product.id, ["[data-dec]"]);
                  }}
                >
                  <Icon id="i-minus" />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
      <div className="dr-f">
        <div className="sum">
          <span>الإجمالي</span>
          <strong id="total">{formatMoney(total)} ج.م</strong>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          id="checkout"
          disabled={!canOrder || !reachedMinimum}
          onClick={openCheckout}
        >
          {!canOrder ? "استقبال الطلبات متوقف حاليًا" : reachedMinimum ? "إتمام الطلب" : `الحد الأدنى للطلب ${minOrder} ج.م`}
        </button>
      </div>
    </aside>
  );
}
