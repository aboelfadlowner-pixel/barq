"use client";

import { memo, type CSSProperties } from "react";
import { BESTSELLER_LABEL } from "@/lib/constants";
import { formatMoney, formatPrice } from "@/lib/format";
import { discountPercent } from "@/lib/pricing";
import type { CatalogProduct } from "@/features/catalog/CatalogProvider";
import { FavoriteButton } from "./FavoriteButton";
import { ProductAction } from "./ProductAction";
import { useProductSheet } from "./ProductSheet";

interface ProductCardProps {
  product: CatalogProduct;
  /** Position in the list; only the first 10 get a staggered entrance delay (v29 `--i`). */
  index: number;
  /** Background tint of the photo area: the colour of the product's category. */
  tint: string;
}

/**
 * Product card (v29 `.p`): photo, best-seller tag, favourite, add control, price (first), name and availability.
 * Clicking the card (anywhere except a button) opens the product sheet.
 */
export const ProductCard = memo(function ProductCard({ product, index, tint }: ProductCardProps) {
  const { openProduct } = useProductSheet();
  const { whole, fraction } = formatPrice(product.price);
  return (
    <article
      className={product.inStock ? "p" : "p out"}
      data-id={product.id}
      style={{ "--i": Math.min(index, 9) } as CSSProperties}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("button")) openProduct(product.id);
      }}
    >
      <div className="pi" style={{ "--tint": tint } as CSSProperties}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" />
        ) : (
          <span className="phl" aria-hidden="true" />
        )}
        {product.oldPrice ? (
          <span className="tag sale">خصم {discountPercent(product.oldPrice, product.price)}%</span>
        ) : (
          product.bestseller && <span className="tag">{BESTSELLER_LABEL}</span>
        )}
        <FavoriteButton product={product} />
        <div className="act" data-act>
          <ProductAction product={product} />
        </div>
      </div>
      <div className="pp">
        <span className="n" dir="ltr">
          <b>{whole}</b>
          <small>{fraction}</small>
        </span>
        {product.weighed && <span className="per">/ كيلو</span>}
        {product.oldPrice ? <s aria-label={`بدل ${formatMoney(product.oldPrice)} جنيه`}>{formatMoney(product.oldPrice)}</s> : null}
      </div>
      <h3>{product.name}</h3>
      {product.inStock ? <div className="av">متوفر</div> : <div className="av no">غير متوفر حاليًا</div>}
    </article>
  );
});
