"use client";

import Link from "next/link";
import { Art } from "@/components/ui/Art";
import { Icon } from "@/components/ui/Icon";
import { useCatalog } from "@/features/catalog/CatalogProvider";
import { useSearch } from "@/features/search/SearchProvider";
import { normalizeArabic } from "@/lib/arabic";
import { OFFERS_SLUG, useOffers } from "@/features/offers/useOffers";
import { ProductCard } from "./ProductCard";
import { ProductGrid } from "./ProductGrid";

/**
 * Everything under the category banner (v29 `renderCat`): the search tag, the product grid for the category
 * (or all products) filtered by the header search text, and the empty state.
 */
export function CategoryProducts({ categoryId }: { categoryId: string }) {
  const { products, search, getCategory } = useCatalog();
  const { query, setQuery } = useSearch();
  const searching = normalizeArabic(query) !== "";
  const offers = useOffers();
  const matching = searching ? search(query) : products;
  const list =
    categoryId === "all"
      ? matching
      : categoryId === OFFERS_SLUG
        ? offers.products.filter((product) => !searching || matching.includes(product))
        : matching.filter((product) => product.categoryId === categoryId);

  return (
    <>
      {/* Hidden in v29 (no sub-categories). Kept in the DOM because the grid spacing CSS depends on it. */}
      <div className="chips" id="chips" role="group" aria-label="الأصناف" hidden />
      <div className="qtag" id="qtag" hidden={!query}>
        <span>نتائج البحث عن</span>
        <button type="button" id="qclear" onClick={() => setQuery("")}>
          <span id="qtext">{query}</span>
          <Icon id="i-x" />
        </button>
      </div>
      {list.length > 0 ? (
        <ProductGrid dropIn>
          {list.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} tint={getCategory(product.categoryId)?.tint ?? ""} />
          ))}
        </ProductGrid>
      ) : (
        <div className="empty" id="empty">
          <Art id="a-basket" viewBox="0 0 120 110" />
          <p>{categoryId === OFFERS_SLUG && !searching ? "لا توجد عروض حاليًا." : "لا توجد منتجات مطابقة."}</p>
          <Link className="btn btn-ghost" href="/category/all" id="reset" onClick={() => setQuery("")}>
            عرض كل المنتجات
          </Link>
        </div>
      )}
    </>
  );
}
