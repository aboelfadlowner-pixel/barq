import { CategoryGrid } from "@/components/home/CategoryGrid";
import { EditorialSection } from "@/components/home/EditorialSection";
import { Hero } from "@/components/home/Hero";
import { TrustSection } from "@/components/home/TrustSection";
import { catalogService } from "@/services";

/** Home page (v29 `#viewHome`). Server Component; categories come from the catalog service. */
export default async function HomePage() {
  const categories = await catalogService.getCategories();
  return (
    <div id="viewHome">
      <Hero />
      <CategoryGrid categories={categories} />
      <EditorialSection />
      <TrustSection />
    </div>
  );
}
