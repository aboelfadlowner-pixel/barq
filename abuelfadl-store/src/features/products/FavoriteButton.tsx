"use client";

import { Icon } from "@/components/ui/Icon";
import type { Product } from "@/types/product";
import { useFavorites } from "./FavoritesProvider";

export function FavoriteButton({ product }: { product: Pick<Product, "id" | "name"> }) {
  const { isFavorite, toggle } = useFavorites();
  return (
    <button
      className="fav"
      type="button"
      aria-pressed={isFavorite(product.id)}
      aria-label={`إضافة ${product.name} إلى المفضلة`}
      onClick={() => toggle(product.id)}
    >
      <Icon id="i-heart" />
    </button>
  );
}
