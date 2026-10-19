"use client";

import { useMemo } from "react";
import { useCatalog } from "@/features/catalog/CatalogProvider";
import { useSettings } from "@/features/settings/SettingsProvider";
import { discountPercent, type CatalogProduct } from "@/lib/pricing";

/** URL slug of the offers section: /category/deals. Not a stored category (products keep their own); "offers" is taken by the old static «العروض» category. */
export const OFFERS_SLUG = "deals";

/** "الجمعة 24/10" for an offer end date "2026-10-24". */
export function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" }).replace("،", "");
}

export interface OffersSummary {
  /** Section name from the dashboard settings, e.g. "عروض الخميس والجمعة". */
  title: string;
  /** Products on offer today, available ones first. Empty: the offers section is hidden everywhere. */
  products: CatalogProduct[];
  /** Biggest discount, in whole percent. */
  maxPercent: number;
  /** Last day shared by every offer, when they all end the same day. */
  endDay: string | null;
}

/** The products on offer today (the store catalog already has today's prices) and the numbers the offers UI shows. */
export function useOffers(): OffersSummary {
  const { products } = useCatalog();
  const { offersTitle } = useSettings();
  return useMemo(() => {
    const onOffer = products.filter((product) => product.oldPrice);
    const sorted = [...onOffer.filter((p) => p.inStock), ...onOffer.filter((p) => !p.inStock)];
    const maxPercent = Math.max(0, ...onOffer.map((p) => discountPercent(p.oldPrice!, p.price)));
    const ends = new Set(onOffer.map((p) => p.offerEnd ?? ""));
    const endDay = ends.size === 1 && !ends.has("") ? [...ends][0] : null;
    return { title: offersTitle, products: sorted, maxPercent, endDay };
  }, [products, offersTitle]);
}
