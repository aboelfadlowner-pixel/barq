"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface SearchContextValue {
  /** Text in the header search box. On a category page it filters the products live. */
  query: string;
  setQuery: (text: string) => void;
  /** Opens "all products" showing the results for the text (v29 `openCat('all', text)`). */
  searchAll: (text: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearch(): SearchContextValue {
  const value = useContext(SearchContext);
  if (!value) throw new Error("useSearch must be used inside <SearchProvider>");
  return value;
}

const ALL_PRODUCTS_PATH = "/category/all";

/**
 * Search text shared by the header box and the category page. Like v29, the text is cleared whenever the visitor
 * moves to another page by any route except a search (opening a category, going home, ...).
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const keepOnNextNavigation = useRef(false);

  useEffect(() => {
    if (keepOnNextNavigation.current) {
      keepOnNextNavigation.current = false;
      return;
    }
    setQuery("");
  }, [pathname]);

  const searchAll = useCallback(
    (text: string) => {
      setQuery(text);
      if (pathname !== ALL_PRODUCTS_PATH) {
        keepOnNextNavigation.current = true;
        router.push(ALL_PRODUCTS_PATH);
      }
    },
    [pathname, router],
  );

  const value = useMemo(() => ({ query, setQuery, searchAll }), [query, searchAll]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
