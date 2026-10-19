import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { getCategoryCover } from "@/features/products/CategoryCover";
import { CategorySwitcherButton } from "@/features/products/CategorySwitcher";
import { LayoutToggle } from "@/features/products/LayoutToggle";
import { CategoryProducts } from "@/features/products/CategoryProducts";
import { OffersBanner } from "@/features/offers/OffersStrip";
import { OFFERS_SLUG } from "@/lib/offers";
import { catalogService, getSettings } from "@/services";
import type { Category } from "@/types/category";

/** "All products" pseudo category used by the "تسوّق الآن" button (v29 `openCat('all')`). */
const ALL_SLUG = "all";
const ALL_CATEGORY: Category = { id: ALL_SLUG, name: "كل المنتجات", art: "", tint: "" };

export async function generateStaticParams() {
  const categories = await catalogService.getCategories();
  return [{ slug: ALL_SLUG }, { slug: OFFERS_SLUG }, ...categories.map((category) => ({ slug: category.id }))];
}

/** Category page (v29 `#viewCat`): header bar, banner, and the product grid (rendered on the client, it reacts to the search text). */
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const isAll = slug === ALL_SLUG;
  // "offers" is not a stored category: it lists the products on offer today, under the name set in the dashboard.
  const category = isAll
    ? ALL_CATEGORY
    : slug === OFFERS_SLUG
      ? { id: OFFERS_SLUG, name: (await getSettings()).offersTitle, art: "", tint: "" }
      : await catalogService.getCategory(slug);
  if (!category) notFound();

  const cover = getCategoryCover(slug);
  const tagline = category.tagline;

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
        {slug === OFFERS_SLUG ? (
          <OffersBanner />
        ) : (
          <div className={cover ? `cbanner has-cover cv-${slug}` : "cbanner"} id="cbanner">
            {cover ?? (
              <span className="slot">
                <Icon id="i-image" />
                مكان صورة القسم
              </span>
            )}
            <div className="ct">
              <h1 id="catTitle">{category.name}</h1>
              {tagline ? (
                <p>
                  {/* <bdi>: an English line keeps its own word order inside the right-to-left page. */}
                  <bdi>{tagline}</bdi>
                </p>
              ) : null}
            </div>
          </div>
        )}
        <CategoryProducts categoryId={category.id} />
      </div>
    </div>
  );
}
