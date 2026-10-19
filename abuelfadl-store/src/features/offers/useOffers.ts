"use client";

import { useMemo } from "react";
import { useCatalog } from "@/features/catalog/CatalogProvider";
import { useSettings } from "@/features/settings/SettingsProvider";
import { discountPercent, type CatalogProduct } from "@/lib/pricing";

export { OFFERS_SLUG } from "@/lib/offers";

export interface OffersSummary {
  /** Section name from the dashboard settings, e.g. "عروض الخميس والجمعة". */
  title: string;
  /** Label above the title, from the settings. */
  kicker: string;
  /** Products on offer today, available ones first. Empty: the offers section is hidden everywhere. */
  products: CatalogProduct[];
  /** Biggest discount, in whole percent (the faint "-25%" on the banners). */
  maxPercent: number;
}

/** The products on offer today (the store catalog already has today's prices) and the numbers the offers UI shows. */
export function useOffers(): OffersSummary {
  const { products } = useCatalog();
  const { offersTitle, offersKicker } = useSettings();
  return useMemo(() => {
    const onOffer = products.filter((product) => product.oldPrice);
    const sorted = [...onOffer.filter((p) => p.inStock), ...onOffer.filter((p) => !p.inStock)];
    const maxPercent = Math.max(0, ...onOffer.map((p) => discountPercent(p.oldPrice!, p.price)));
    return { title: offersTitle, kicker: offersKicker, products: sorted, maxPercent };
  }, [products, offersTitle, offersKicker]);
}
