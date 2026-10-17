"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useCatalog } from "@/features/catalog/CatalogProvider";
import { formatMoney } from "@/lib/format";
import { normalizeArabic } from "@/lib/arabic";
import { useSearch } from "./SearchProvider";

const MAX_SUGGESTIONS = 6;

/**
 * The header search (v29 `#q` + `#sug`).
 * On the home page typing shows up to 6 suggestions; picking one, "عرض كل النتائج" or Enter opens the results.
 * On a category page typing filters that page's products directly and no suggestions are shown.
 */
export function SearchBox({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const { query, setQuery, searchAll } = useSearch();
  const { search, getCategory } = useCatalog();
  const pathname = usePathname();
  const onCategoryPage = pathname.startsWith("/category");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the suggestions when the page changes or the visitor clicks anywhere outside the search area.
  useEffect(() => setSuggestionsOpen(false), [pathname]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setSuggestionsOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const hasText = normalizeArabic(query) !== "";
  const showSuggestions = suggestionsOpen && !onCategoryPage && hasText;
  const hits = showSuggestions ? search(query).slice(0, MAX_SUGGESTIONS) : [];

  return (
    <div className="search" ref={boxRef}>
      <label className="search-box">
        <Icon id="i-search" />
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>ابحث عن منتج</span>
        <input
          id="q"
          ref={inputRef}
          type="search"
          placeholder="ابحث عن جبنة، لبن، عيش، فول…"
          autoComplete="off"
          enterKeyHint="search"
          aria-controls="sug"
          aria-expanded={showSuggestions}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSuggestionsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setSuggestionsOpen(false);
              if (!onCategoryPage) searchAll(query);
            }
            if (event.key === "Escape") setSuggestionsOpen(false);
          }}
        />
      </label>
      <div className="sug" id="sug" role="listbox" hidden={!showSuggestions}>
        {hits.length > 0 ? (
          <>
            {hits.map((product) => (
              <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={false}
                data-pick={product.id}
                onClick={() => {
                  setSuggestionsOpen(false);
                  searchAll(product.name);
                }}
              >
                {product.imageUrl ? <img className="ph" alt="" src={product.imageUrl} /> : <span className="phl" aria-hidden="true" />}
                <span>
                  <b>{product.name}</b>
                  <small>{getCategory(product.categoryId)?.name}</small>
                </span>
                <i>{formatMoney(product.price)} ج.م</i>
              </button>
            ))}
            <button
              type="button"
              className="all"
              data-all
              onClick={() => {
                setSuggestionsOpen(false);
                searchAll(query);
              }}
            >
              عرض كل النتائج
            </button>
          </>
        ) : (
          showSuggestions && <p className="none">لا توجد نتائج عن «{query}»</p>
        )}
      </div>
    </div>
  );
}
