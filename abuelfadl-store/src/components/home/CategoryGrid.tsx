import Link from "next/link";
import type { Category } from "@/types/category";
import { Icon } from "../ui/Icon";
import { CardTilt } from "./CardTilt";
import { getCategoryTile } from "@/features/products/CategoryCover";

/**
 * "Shop by category" section. Each card links to `/category/<id>`.
 * Categories without a photo (all but the ones in `getCategoryTile`) show the "مكان الصورة" placeholder.
 */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <section className="sec" id="catsSec" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="sec-h rv">
          <h2>تسوّق حسب القسم</h2>
          <p>اختر القسم لتشوف منتجاته.</p>
        </div>
        <div className="pcs" id="cats">
          {categories.map((category) => {
            const tile = getCategoryTile(category.id);
            return (
              <Link
                key={category.id}
                className={tile ? "pc rv pc-light" : "pc rv"}
                href={`/category/${category.id}`}
              >
                <span className="pph">
                  {tile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={tile} />
                  ) : (
                    <span className="slot">
                      <Icon id="i-image" />
                      مكان الصورة
                    </span>
                  )}
                </span>
                <span className="pt">
                  <b>{category.name}</b>
                </span>
              </Link>
            );
          })}
        </div>
        <CardTilt />
      </div>
    </section>
  );
}
