"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Scroll reveal (v29 `.rv`): elements with class `rv` fade up the first time they come into view (class `in` is added).
 * The `js` class on <html> (added by the inline script in the root layout) is what hides `.rv` elements until then.
 * Runs again after every page change, because navigating mounts new `.rv` elements.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".rv:not(.in)"));
    if (!elements.length) return;
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
