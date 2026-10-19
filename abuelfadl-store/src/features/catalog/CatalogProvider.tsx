"use client";

import { createContext, useContext, useMemo } from "react";
import { normalizeArabic } from "@/lib/arabic";
import type { CatalogProduct } from "@/lib/pricing";
import type { Category } from "@/types/category";
import type { ProductId } from "@/types/product";

export type { CatalogProduct } from "@/lib/pricing";

interface CatalogContextValue {
  categories: Category[];
  products: CatalogProduct[];
  getProduct: (id: ProductId) => CatalogProduct | undefined;
  getCategory: (id: string) => Category | undefined;
  /** Products whose name or category name contains the text (Arabic-normalized, same rule as v29 `matches`). */
  search: (text: string) => CatalogProduct[];
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function useCatalog(): CatalogContextValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return value;
}

/**
 * Gives client components (cart, product sheet, search) the catalog the root layout loaded from the services layer.
 * Like v29, the whole catalog is available in the browser, so search and the cart work instantly.
 * When a real backend exists, swap this for server-side search and by-id lookups without touching the components.
 */
export function CatalogProvider({
  categories,
  products,
  children,
}: {
  categories: Category[];
  products: CatalogProduct[];
  children: React.ReactNode;
}) {
  const value = useMemo<CatalogContextValue>(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    const categoryById = new Map(categories.map((category) => [category.id as string, category]));
    const haystack = new Map(
      products.map((product) => [product.id, normalizeArabic(`${product.name} ${categoryById.get(product.categoryId)?.name ?? ""}`)]),
    );
    return {
      categories,
      products,
      getProduct: (id) => byId.get(id),
      getCategory: (id) => categoryById.get(id),
      search: (text) => {
        const needle = normalizeArabic(text);
        return needle ? products.filter((product) => haystack.get(product.id)?.includes(needle)) : products;
      },
    };
  }, [categories, products]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
