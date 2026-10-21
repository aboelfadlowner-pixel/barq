"use client";

import { useChrome } from "@/components/layout/ChromeProvider";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/features/cart/CartProvider";
import { flyToCart } from "@/lib/cart-effects";
import { decreaseQuantity, increaseQuantity, weightLabel } from "@/lib/quantity";
import { useCatalog, type CatalogProduct } from "@/features/catalog/CatalogProvider";
import { useProductSheet } from "./ProductSheet";

/** After the card's controls change (add button <-> stepper), keeps keyboard focus on the matching control, as v29 does. */
function focusInCard(from: HTMLElement, selectors: string[]) {
  const card = from.closest(".p");
  requestAnimationFrame(() => {
    for (const selector of selectors) {
      const target = card?.querySelector<HTMLElement>(selector);
      if (target) return target.focus({ preventScroll: true });
    }
  });
}

/**
 * The control inside a product card's photo (v29 `actionHTML`):
 * unavailable -> disabled add button; weighed -> opens the product sheet (button shows the chosen weight);
 * piece product -> add button, then a +/- stepper once it is in the cart. Display-only categories: no control.
 */
export function ProductAction({ product }: { product: CatalogProduct }) {
  const { quantityOf, setQuantity } = useCart();
  const { showToast } = useChrome();
  const { openProduct } = useProductSheet();
  const { getCategory } = useCatalog();
  const quantity = quantityOf(product.id);

  if (getCategory(product.categoryId)?.displayOnly) return null;

  if (!product.inStock) {
    return (
      <button className="add" type="button" disabled aria-label="غير متوفر">
        <Icon id="i-plus" />
      </button>
    );
  }

  if (product.weighed) {
    return quantity ? (
      <button className="wchip" type="button" data-open={product.id} aria-label="تعديل الوزن" onClick={() => openProduct(product.id)}>
        {weightLabel(quantity)}
      </button>
    ) : (
      <button className="add" type="button" data-open={product.id} aria-label={`اختر وزن ${product.name}`} onClick={() => openProduct(product.id)}>
        <Icon id="i-plus" />
      </button>
    );
  }

  if (!quantity) {
    return (
      <button
        className="add"
        type="button"
        data-add={product.id}
        aria-label={`أضف ${product.name} إلى السلة`}
        onClick={(event) => {
          const button = event.currentTarget;
          flyToCart(button);
          setQuantity(product.id, 1);
          showToast(`أُضيف إلى السلة: ${product.name}`);
          focusInCard(button, ["[data-inc]"]);
        }}
      >
        <Icon id="i-plus" />
      </button>
    );
  }

  return (
    <div className="step" role="group" aria-label={`كمية ${product.name}`}>
      <button
        type="button"
        data-inc={product.id}
        aria-label="زيادة الكمية"
        onClick={(event) => {
          flyToCart(event.currentTarget);
          setQuantity(product.id, increaseQuantity(product, quantity));
        }}
      >
        <Icon id="i-plus" />
      </button>
      <output aria-live="polite">{quantity}</output>
      <button
        type="button"
        data-dec={product.id}
        aria-label="تقليل الكمية"
        onClick={(event) => {
          const button = event.currentTarget;
          setQuantity(product.id, decreaseQuantity(product, quantity));
          focusInCard(button, ["[data-dec]", "[data-add]"]);
        }}
      >
        <Icon id="i-minus" />
      </button>
    </div>
  );
}
