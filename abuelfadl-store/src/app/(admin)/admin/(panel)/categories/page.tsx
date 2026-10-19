import type { Metadata } from "next";
import { IllustrationSprite } from "@/components/layout/Sprites";
import { CategoriesManager } from "@/features/admin/CategoriesManager";
import { adminOnlyPage } from "@/server/auth";

export const metadata: Metadata = { title: "الأقسام" };

export default async function CategoriesPage() {
  await adminOnlyPage();
  return (
    <>
      {/* Same category icons as the store, for the previews. */}
      <IllustrationSprite />
      <CategoriesManager />
    </>
  );
}
