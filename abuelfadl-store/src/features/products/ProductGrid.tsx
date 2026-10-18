"use client";

import { useEffect, useRef } from "react";
import { useChrome } from "@/components/layout/ChromeProvider";

/**
 * The `.grid` container of the category page.
 * With `dropIn`, every product photo (or the logo placeholder of products without one) falls into its place the
 * first time its card is on screen: the cards visible when the category opens, then each card reached by scrolling
 * (class `in` on the card starts the CSS animation in `26-product-drop.css`). Cards that come into view together
 * land one after another.
 */
export function ProductGrid({ children, dropIn = false }: { children: React.ReactNode; dropIn?: boolean }) {
  const { productLayout } = useChrome();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!dropIn || !grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".p:not(.in)"));
    if (!cards.length) return;
    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => card.classList.add("in", "st"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        let order = 0;
        entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
          .forEach((entry) => {
            const card = entry.target as HTMLElement;
            card.style.setProperty("--dd", `${Math.min(order, 7) * 110}ms`);
            card.classList.add("in");
            observer.unobserve(card);
            order += 1;
          });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.25 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [dropIn, children]);

  const className = ["grid", productLayout === "list" ? "list" : "", dropIn ? "drop" : ""].filter(Boolean).join(" ");
  return (
    <div className={className} id="grid" ref={ref}>
      {children}
    </div>
  );
}
