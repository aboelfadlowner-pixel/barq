import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { CategoryPhoto, getCategoryCover } from "@/features/products/CategoryCover";
import { CategorySwitcherButton } from "@/features/products/CategorySwitcher";
import { LayoutToggle } from "@/features/products/LayoutToggle";
import { CategoryProducts } from "@/features/products/CategoryProducts";
import { catalogService } from "@/services";
import type { Category } from "@/types/category";

/** "All products" pseudo category used by the "تسوّق الآن" button (v29 `openCat('all')`). */
const ALL_SLUG = "all";
const ALL_CATEGORY: Category = { id: ALL_SLUG, name: "كل المنتجات", art: "", tint: "" };

export async function generateStaticParams() {
  const categories = await catalogService.getCategories();
  return [{ slug: ALL_SLUG }, ...categories.map((category) => ({ slug: category.id }))];
}

/** Category page (v29 `#viewCat`): header bar, banner, and the product grid (rendered on the client, it reacts to the search text). */
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const isAll = slug === ALL_SLUG;
  const category = isAll ? ALL_CATEGORY : await catalogService.getCategory(slug);
  if (!category) notFound();

  // Animated cover when the category has one (sandwiches, juices), else its photo from the dashboard.
  const cover = getCategoryCover(slug) ?? (category.imageUrl ? <CategoryPhoto src={category.imageUrl} /> : null);

  return (
    <div id="viewCat">
      <div className="wrap" style={{ paddingBottom: 40 }}>
        <div className="cbar">
          <Link className="circ" href="/" id="back" aria-label="رجوع إلى الرئيسية">
            <Icon id="i-back" />
          </Link>
          <CategorySwitcherButton category={category} />
          <LayoutToggle />
        </div>
        <div className={cover ? `cbanner ${getCategoryCover(slug) ? "has-cover" : "has-photo"}` : "cbanner"} id="cbanner">
          {cover ?? (
            <span className="slot">
              <Icon id="i-image" />
              مكان صورة القسم
            </span>
          )}
          <div className="ct">
            <h1 id="catTitle">{category.name}</h1>
          </div>
        </div>
        <CategoryProducts categoryId={category.id} />
      </div>
    </div>
  );
}
