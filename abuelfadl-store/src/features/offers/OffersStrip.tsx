"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { OFFERS_SLUG, dayLabel, useOffers } from "./useOffers";

/**
 * Home-page offers banner, right under the hero. Hidden when nothing is on offer.
 * Title from the dashboard settings, biggest discount, product count, end day, and «شوف كل العروض» (the offers page).
 */
export function OffersStrip() {
  const { title, kicker, subtitle, products, maxPercent, endDay } = useOffers();
  if (!products.length) return null;
  return (
    <section className="sec offers-sec" id="offersSec" aria-labelledby="offersTitle">
      <div className="wrap">
        <div className="offers-head">
          <div className="offers-copy">
            {kicker ? (
              <span className="offers-kicker">
                <span className="offers-dot" aria-hidden="true" />
                {kicker}
              </span>
            ) : null}
            <h2 id="offersTitle">{title}</h2>
            {subtitle ? (
              <p>{subtitle}</p>
            ) : (
              <p>
                خصومات لحد <b className="num">{maxPercent}%</b> على <b className="num">{products.length}</b> منتج
                {endDay ? <> · لحد يوم {dayLabel(endDay)}</> : null}
              </p>
            )}
          </div>
          <span className="offers-big num" aria-hidden="true">
            -{maxPercent}%
          </span>
          <Link className="btn offers-all" href={`/category/${OFFERS_SLUG}`}>
            شوف كل العروض
            <Icon id="i-arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Banner of the offers page (/category/deals). */
export function OffersBanner() {
  const { title, subtitle, products, maxPercent, endDay } = useOffers();
  return (
    <div className="cbanner offers-banner" id="cbanner">
      <span className="offers-big num" aria-hidden="true">
        {products.length ? `-${maxPercent}%` : "%"}
      </span>
      <div className="ct">
        <h1 id="catTitle">{title}</h1>
        <p>
          {products.length && subtitle ? (
            subtitle
          ) : products.length ? (
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
