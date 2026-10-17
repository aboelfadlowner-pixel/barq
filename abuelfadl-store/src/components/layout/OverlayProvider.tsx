"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface OverlayContextValue {
  isOpen: (id: string) => boolean;
  open: (id: string) => void;
  close: (id: string) => void;
  closeAll: () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function useOverlay(): OverlayContextValue {
  const value = useContext(OverlayContext);
  if (!value) throw new Error("useOverlay must be used inside <OverlayProvider>");
  return value;
}

/**
 * Tracks which sheets/drawers are open (by id) and renders the shared dark scrim (v29 `#scrim`).
 * While anything is open the page behind cannot scroll; Escape closes the most recently opened one;
 * clicking the scrim closes all of them. Stage 4 uses it for the category switcher, Stage 5 for cart and product sheets.
 */
/** Full-screen screens that lock page scrolling but get no scrim, are not closed by Escape or by the scrim (the "order received" screen). */
const PASSIVE_IDS = new Set(["done"]);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  const open = useCallback((id: string) => setOpenIds((ids) => (ids.includes(id) ? ids : [...ids, id])), []);
  const close = useCallback((id: string) => setOpenIds((ids) => ids.filter((x) => x !== id)), []);
  const closeAll = useCallback(() => setOpenIds((ids) => ids.filter((id) => PASSIVE_IDS.has(id))), []);
  const isOpen = useCallback((id: string) => openIds.includes(id), [openIds]);

  useEffect(() => {
    document.body.style.overflow = openIds.length ? "hidden" : "";
  }, [openIds.length]);

  useEffect(() => {
    if (!openIds.length) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenIds((ids) => {
        const last = ids.map((id) => PASSIVE_IDS.has(id)).lastIndexOf(false);
        return last === -1 ? ids : ids.filter((_, index) => index !== last);
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openIds.length]);

  const value = useMemo(() => ({ isOpen, open, close, closeAll }), [isOpen, open, close, closeAll]);

  return (
    <OverlayContext.Provider value={value}>
      {children}
      <div className={openIds.some((id) => !PASSIVE_IDS.has(id)) ? "scrim on" : "scrim"} id="scrim" onClick={closeAll} />
    </OverlayContext.Provider>
  );
}
