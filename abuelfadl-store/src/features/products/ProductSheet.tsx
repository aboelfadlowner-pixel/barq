"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useChrome } from "@/components/layout/ChromeProvider";
import { useOverlay } from "@/components/layout/OverlayProvider";
import { Icon } from "@/components/ui/Icon";
import { useCart } from "@/features/cart/CartProvider";
import { useCatalog } from "@/features/catalog/CatalogProvider";
import { flyToCart } from "@/lib/cart-effects";
import { formatMoney, formatPrice } from "@/lib/format";
import { maxQuantityOf, minQuantityOf, quantityLabel, round2, roundQty, stepOf, weightLabel, weightPresets } from "@/lib/quantity";
import type { ProductId } from "@/types/product";

const SHEET_ID = "pd";

/** Grams under the big weight label, e.g. 0.25 -> "٢٥٠ جم". */
const gramsLabel = (quantity: number) => `${Math.round(quantity * 1000).toLocaleString("ar-EG")} جم`;

interface ProductSheetContextValue {
  openProduct: (id: ProductId) => void;
}

const ProductSheetContext = createContext<ProductSheetContextValue | null>(null);

export function useProductSheet(): ProductSheetContextValue {
  const value = useContext(ProductSheetContext);
  if (!value) throw new Error("useProductSheet must be used inside <ProductSheetProvider>");
  return value;
}

/**
 * The product sheet (v29 `#pd`): photo, price, availability, weight chooser for weighed products,
 * quantity stepper and the add button. Rendered once; any card opens it through `openProduct(id)`.
 */
export function ProductSheetProvider({ children }: { children: React.ReactNode }) {
  const { getProduct, getCategory } = useCatalog();
  const { quantityOf, setQuantity } = useCart();
  const { isOpen, open, close } = useOverlay();
  const { showToast } = useChrome();
  const [productId, setProductId] = useState<ProductId | null>(null);
  const [quantity, setSheetQuantity] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const sheetOpen = isOpen(SHEET_ID);

  const openProduct = useCallback(
    (id: ProductId) => {
      const product = getProduct(id);
      if (!product) return;
      setProductId(id);
      setSheetQuantity(product.weighed ? quantityOf(id) || minQuantityOf(product) : 1);
      open(SHEET_ID);
    },
    [getProduct, quantityOf, open],
  );

  useEffect(() => {
    if (!sheetOpen) return;
    const timer = setTimeout(() => closeRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [sheetOpen]);

  const value = useMemo(() => ({ openProduct }), [openProduct]);
  const product = productId === null ? undefined : getProduct(productId);
  const category = product ? getCategory(product.categoryId) : undefined;
  const inCart = product ? quantityOf(product.id) : 0;

  const step = product ? stepOf(product) : 1;
  const min = product ? minQuantityOf(product) : 1;
  const addLabel = !product
    ? ""
    : !product.inStock
      ? "غير متوفر"
      : product.weighed
        ? `${inCart ? "تحديث · " : "أضف · "}${formatMoney(round2(product.price * quantity))} ج.م`
        : "أضف إلى السلة";

  const addToCart = () => {
    if (!product) return;
    flyToCart(addRef.current);
    setQuantity(product.id, product.weighed ? quantity : inCart + quantity);
    showToast(product.weighed ? `أُضيف: ${weightLabel(quantity)} · ${product.name}` : `أُضيف إلى السلة: ${product.name}`);
    close(SHEET_ID);
  };

  const qtyControl = product ? (
    <div className="qty">
      <button type="button" id="pdMinus" aria-label="تقليل" disabled={product.weighed && quantity <= min} onClick={() => setSheetQuantity((q) => Math.max(product.weighed ? min : 1, roundQty(q - step)))}>
        <Icon id="i-minus" />
      </button>
      {product.weighed ? (
        <div className="read">
          <output id="pdQty">{weightLabel(quantity)}</output>
          <span className="rg">{gramsLabel(quantity)}</span>
        </div>
      ) : (
        <output id="pdQty">{quantityLabel(product, quantity)}</output>
      )}
      <button
        type="button"
        id="pdPlus"
        aria-label="زيادة"
        disabled={product.weighed && quantity >= maxQuantityOf(product)}
        onClick={() => setSheetQuantity((q) => Math.min(maxQuantityOf(product), roundQty(q + step)))}
      >
        <Icon id="i-plus" />
      </button>
    </div>
  ) : null;

  const price = product ? formatPrice(product.price) : null;

  return (
    <ProductSheetContext.Provider value={value}>
      {children}
      <aside className={sheetOpen ? "sheet open" : "sheet"} id="pd" role="dialog" aria-modal="true" aria-labelledby="pdName" inert={!sheetOpen}>
        <button className="circ sh-x" type="button" id="pdClose" ref={closeRef} aria-label="إغلاق" onClick={() => close(SHEET_ID)}>
          <Icon id="i-x" />
        </button>
        <div className="sh-img" id="pdImg" style={{ "--tint": category?.tint } as CSSProperties}>
          {product?.imageUrl ? <img alt={product.name} src={product.imageUrl} /> : <span className="phl" aria-hidden="true" />}
        </div>
        <small className="pdcat" id="pdCat">
          {category?.name}
        </small>
        <h2 id="pdName">{product?.name}</h2>
        <div className="pp" id="pdPrice">
          {price && (
            <>
              <span className="n" dir="ltr">
                <b>{price.whole}</b>
                <small>{price.fraction}</small>
              </span>
              {product?.weighed && <span className="per">/ كيلو</span>}
              {product?.oldPrice ? <s aria-label={`بدلًا من ${formatMoney(product.oldPrice)} جنيه`}>{formatMoney(product.oldPrice)}</s> : null}
            </>
          )}
        </div>
        {product?.inStock === false ? (
          <div className="av no" id="pdAv">
            غير متوفر حاليًا
          </div>
        ) : (
          <div className="av" id="pdAv">
            متوفر
          </div>
        )}
        <p className="desc">يُحضَّر ويُحفظ بعناية ليصلك طازجًا. التفاصيل الكاملة (الوزن والمكوّنات) تُضاف من بيانات المتجر.</p>
        <div className="wpick" id="pdW" hidden={!product?.weighed}>
          <p>اختر الوزن</p>
          {product?.weighed && qtyControl}
          <div className="wchips" id="pdWc">
            {product?.weighed &&
              weightPresets(product).map((option) => {
                return (
                  <button key={option} type="button" data-w={option} aria-pressed={option === quantity} onClick={() => setSheetQuantity(option)}>
                    <b>{weightLabel(option)}</b>
                    <small>{formatMoney(round2(product.price * option))} ج.م</small>
                  </button>
                );
              })}
          </div>
        </div>
        <div className="sh-row">
          {!product?.weighed && qtyControl}
          <button className="btn btn-primary" type="button" id="pdAdd" ref={addRef} disabled={!product?.inStock} onClick={addToCart}>
            {addLabel}
          </button>
        </div>
      </aside>
    </ProductSheetContext.Provider>
  );
}
