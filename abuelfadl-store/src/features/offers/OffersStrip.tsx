"use client";

import Link from "next/link";
import { useCatalog } from "@/features/catalog/CatalogProvider";
import { ProductCard } from "@/features/products/ProductCard";
import { Icon } from "@/components/ui/Icon";
import { OFFERS_SLUG, dayLabel, useOffers } from "./useOffers";

/** How many offer products the home strip shows before «شوف كل العروض». */
const STRIP_LIMIT = 12;

/**
 * Home-page offers section, right under the hero. Hidden when nothing is on offer.
 * Title from the dashboard settings, biggest discount, product count, end day, and a swipeable row of the products.
 */
export function OffersStrip() {
  const { title, products, maxPercent, endDay } = useOffers();
  const { getCategory } = useCatalog();
  if (!products.length) return null;
  return (
    <section className="sec offers-sec" id="offersSec" aria-labelledby="offersTitle">
      <div className="wrap">
        <div className="offers-head">
          <div className="offers-copy">
            <span className="offers-kicker">
              <span className="offers-dot" aria-hidden="true" />
              عروض لفترة محدودة
            </span>
            <h2 id="offersTitle">{title}</h2>
            <p>
              خصومات لحد <b className="num">{maxPercent}%</b> على <b className="num">{products.length}</b> منتج
              {endDay ? <> · لحد يوم {dayLabel(endDay)}</> : null}
            </p>
          </div>
          <span className="offers-big num" aria-hidden="true">
            -{maxPercent}%
          </span>
          <Link className="btn offers-all" href={`/category/${OFFERS_SLUG}`}>
            شوف كل العروض
            <Icon id="i-arrow" />
          </Link>
        </div>
        <div className="offers-row" role="list">
          {products.slice(0, STRIP_LIMIT).map((product, index) => (
            <div className="offers-item" role="listitem" key={product.id}>
              <ProductCard product={product} index={index} tint={getCategory(product.categoryId)?.tint ?? ""} />
            </div>
          ))}
          {products.length > STRIP_LIMIT ? (
            <Link className="offers-more" href={`/category/${OFFERS_SLUG}`}>
              <b className="num">+{products.length - STRIP_LIMIT}</b>
              عرض كمان
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** First card in «تسوّق حسب القسم» while there are offers. */
export function OffersCategoryCard() {
  const { title, products, maxPercent } = useOffers();
  if (!products.length) return null;
  return (
    <Link className="pc pc-offers" href={`/category/${OFFERS_SLUG}`}>
      <span className="pph">
        <span className="pc-offers-art" aria-hidden="true">
          <b className="num">{maxPercent}%</b>
          <small>خصم لحد</small>
        </span>
      </span>
      <span className="pt">
        <b>{title}</b>
      </span>
    </Link>
  );
}

/** Banner of the offers page (/category/deals). */
export function OffersBanner() {
  const { title, products, maxPercent, endDay } = useOffers();
  return (
    <div className="cbanner offers-banner" id="cbanner">
      <span className="offers-big num" aria-hidden="true">
        {products.length ? `-${maxPercent}%` : "%"}
      </span>
      <div className="ct">
        <h1 id="catTitle">{title}</h1>
        <p>
          {products.length ? (
            <>
              خصومات لحد {maxPercent}% على {products.length} منتج{endDay ? ` · لحد يوم ${dayLabel(endDay)}` : ""}
            </>
          ) : (
            "مفيش عروض دلوقتي، تابعنا عشان تلحق العروض الجاية"
          )}
        </p>
      </div>
    </div>
  );
}
