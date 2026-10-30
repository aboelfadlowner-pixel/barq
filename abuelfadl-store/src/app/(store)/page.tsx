import { CategoryGrid } from "@/components/home/CategoryGrid";
import { EditorialSection } from "@/components/home/EditorialSection";
import { Hero } from "@/components/home/Hero";
import { TrustSection } from "@/components/home/TrustSection";
import { OffersStrip } from "@/features/offers/OffersStrip";
import { catalogService, getSettings } from "@/services";

/** Home page (v29 `#viewHome`). Server Component; categories come from the catalog service. */
export default async function HomePage() {
  const [categories, settings] = await Promise.all([catalogService.getCategories(), getSettings()]);
  return (
    <div id="viewHome">
      <Hero />
      <OffersStrip />
      <CategoryGrid categories={categories} />
      <EditorialSection images={settings.homeImages} blocks={settings.homeBlocks} />
      <TrustSection />
    </div>
  );
}
