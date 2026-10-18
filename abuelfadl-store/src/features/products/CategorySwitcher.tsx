"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useOverlay } from "@/components/layout/OverlayProvider";
import { Art } from "@/components/ui/Art";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/types/category";

const SHEET_ID = "cs";

type ThumbCategory = Pick<Category, "id" | "name" | "art" | "imageUrl">;

/** Category thumbnail: the category photo (small and round), else its illustration; the "all" icon for the pseudo category "all". */
function Thumb({ category }: { category: Pick<Category, "id" | "art" | "imageUrl"> }) {
  if (category.id === "all") return <Icon id="i-all" />;
  // eslint-disable-next-line @next/next/no-img-element
  return category.imageUrl ? <img alt="" src={category.imageUrl} decoding="async" /> : <Art id={category.art} />;
}

/** Pill button in the category page header that opens the category switcher sheet. */
export function CategorySwitcherButton({ category }: { category: ThumbCategory }) {
  const { isOpen, open } = useOverlay();
  return (
    <button className="cswitch" type="button" id="csBtn" aria-haspopup="dialog" aria-label="تغيير القسم" aria-expanded={isOpen(SHEET_ID)} onClick={() => open(SHEET_ID)}>
      <span className="cs-th" id="csTh">
        <Thumb category={category} />
      </span>
      <span className="cs-name" id="csName">
        {category.name}
      </span>
      <Icon id="i-chev" />
    </button>
  );
}

/** Bottom sheet listing "all products" + every category. Rendered once in the root layout. */
export function CategorySwitcherSheet({ categories }: { categories: Category[] }) {
  const { isOpen, close } = useOverlay();
  const open = isOpen(SHEET_ID);
  const sheetRef = useRef<HTMLElement>(null);
  const params = useParams<{ slug?: string }>();
  const current = params.slug ?? "";

  // Move focus into the sheet after it opens (v29: current tile, else the close button).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const target = sheetRef.current?.querySelector<HTMLElement>('[aria-current="true"]') ?? sheetRef.current?.querySelector<HTMLElement>("#csClose");
      target?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [open]);

  const tiles: ThumbCategory[] = [{ id: "all", name: "كل المنتجات", art: "" }, ...categories];

  return (
    <aside className={open ? "sheet cs open" : "sheet cs"} id="cs" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="csTitle" inert={!open}>
      <button className="circ sh-x" type="button" id="csClose" aria-label="إغلاق" onClick={() => close(SHEET_ID)}>
        <Icon id="i-x" />
      </button>
      <h2 id="csTitle" style={{ marginTop: 34 }}>
        الأقسام
      </h2>
      <p className="co-sub">اختر القسم وانتقل له مباشرة.</p>
      <div className="cs-grid" id="csGrid">
        {tiles.map((tile, index) => (
          <Link
            key={tile.id}
            className="cs-tile"
            href={`/category/${tile.id}`}
            style={{ "--i": index } as React.CSSProperties}
            aria-current={tile.id === current ? "true" : undefined}
            onClick={() => close(SHEET_ID)}
          >
            <span className="t">
              <Thumb category={tile} />
            </span>
            {tile.name}
          </Link>
        ))}
      </div>
    </aside>
  );
}
