"use client";

import { useEffect } from "react";
import { REDUCE_MOTION } from "@/lib/motion";

/**
 * 3D tilt of the home category cards that follows the mouse (v29 card tilt). Only on devices with a real hover pointer.
 * Renders nothing: it adds the `tilt` class and the `--rx` / `--ry` variables to the existing `.pcs .pc` cards.
 */
export function CardTilt() {
  useEffect(() => {
    if (REDUCE_MOTION || !window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    const cleanups: Array<() => void> = [];
    document.querySelectorAll<HTMLElement>(".pcs .pc").forEach((card) => {
      card.classList.add("tilt");
      const onMove = (event: PointerEvent) => {
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        card.style.setProperty("--ry", `${(-x * 9).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${(y * 9).toFixed(2)}deg`);
      };
      const onLeave = () => {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      };
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
        card.classList.remove("tilt");
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
  return null;
}
