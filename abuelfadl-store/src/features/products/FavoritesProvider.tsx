"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ProductId } from "@/types/product";

interface FavoritesContextValue {
  isFavorite: (id: ProductId) => boolean;
  toggle: (id: ProductId) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/** In-memory favourites, same as v29: kept while the page is open, not saved anywhere. */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<ReadonlySet<ProductId>>(new Set());
  const toggle = useCallback(
    (id: ProductId) =>
      setFavorites((current) => {
        const next = new Set(current);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );
  const isFavorite = useCallback((id: ProductId) => favorites.has(id), [favorites]);
  const value = useMemo(() => ({ isFavorite, toggle }), [isFavorite, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used inside <FavoritesProvider>");
  return value;
}
