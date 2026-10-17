import type { Metadata } from "next";
import { IllustrationSprite } from "@/components/layout/Sprites";
import { CategoriesManager } from "@/features/admin/CategoriesManager";

export const metadata: Metadata = { title: "الأقسام" };

export default function CategoriesPage() {
  return (
    <>
      {/* Same category icons as the store, for the previews. */}
      <IllustrationSprite />
      <CategoriesManager />
    </>
  );
}
