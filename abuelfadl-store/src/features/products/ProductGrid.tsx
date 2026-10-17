"use client";

import { useEffect, useRef } from "react";
import { useChrome } from "@/components/layout/ChromeProvider";

/**
 * The `.grid` container of the category page.
 * With `dropIn`, a product photo falls into its place the first time its card is reached by scrolling
 * (class `in` on the card starts the CSS animation in `26-product-drop.css`); cards that come into view
 * together land one after another. Cards already on screen when the page opens are simply in place
 * (class `st`, no animation): the drop is for what you scroll down to.
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
    // Already on screen: no drop, the photo is just there.
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    const below: HTMLElement[] = [];
    cards.forEach((card) => {
      const box = card.getBoundingClientRect();
      if (box.top < viewport && box.bottom > 0) card.classList.add("in", "st");
      else below.push(card);
    });
    if (!below.length) return;
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
    below.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [dropIn, children]);

  const className = ["grid", productLayout === "list" ? "list" : "", dropIn ? "drop" : ""].filter(Boolean).join(" ");
  return (
    <div className={className} id="grid" ref={ref}>
      {children}
    </div>
  );
}
