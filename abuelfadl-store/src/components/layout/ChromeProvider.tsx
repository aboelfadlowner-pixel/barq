"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ProductLayout = "grid" | "list";

interface ChromeContextValue {
  /** Mobile: the header search box is revealed (v29 class `search-open` on `#hdrBar`). */
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  /** Category page view mode. Kept here so it survives navigation between categories (v29 `state.layout`). */
  productLayout: ProductLayout;
  setProductLayout: (layout: ProductLayout) => void;
  /** Shows the small toast message at the bottom for 2.2 seconds (same as v29). */
  showToast: (message: string) => void;
  /** Hides the toast right away (v29 hides it when the cart drawer opens). */
  hideToast: () => void;
}

const ChromeContext = createContext<ChromeContextValue | null>(null);

export function useChrome(): ChromeContextValue {
  const value = useContext(ChromeContext);
  if (!value) throw new Error("useChrome must be used inside <ChromeProvider>");
  return value;
}

const TOAST_MS = 2200;

/** Shared UI state of the page chrome (header, bottom nav, product layout mode, toast). Also renders the toast element. */
export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [productLayout, setProductLayout] = useState<ProductLayout>("grid");
  const [toast, setToast] = useState({ message: "", on: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((message: string) => {
    setToast({ message, on: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast((t) => ({ ...t, on: false })), TOAST_MS);
  }, []);

  const hideToast = useCallback(() => setToast((t) => ({ ...t, on: false })), []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(
    () => ({ searchOpen, setSearchOpen, productLayout, setProductLayout, showToast, hideToast }),
    [searchOpen, productLayout, showToast, hideToast],
  );

  return (
    <ChromeContext.Provider value={value}>
      {children}
      <div className={toast.on ? "toast on" : "toast"} id="toast" role="status" aria-live="polite">
        {toast.message}
      </div>
    </ChromeContext.Provider>
  );
}
