"use client";

import { useChrome } from "@/components/layout/ChromeProvider";
import { Icon } from "@/components/ui/Icon";

/** Grid / list view switch of the category page. The choice is kept while navigating between categories (as in v29). */
export function LayoutToggle() {
  const { productLayout, setProductLayout } = useChrome();
  return (
    <div className="vt" role="group" aria-label="طريقة العرض">
      <button type="button" aria-pressed={productLayout === "grid"} aria-label="عرض شبكي" onClick={() => setProductLayout("grid")}>
        <Icon id="i-all" />
      </button>
      <button type="button" aria-pressed={productLayout === "list"} aria-label="عرض قائمة" onClick={() => setProductLayout("list")}>
        <Icon id="i-list" />
      </button>
    </div>
  );
}
