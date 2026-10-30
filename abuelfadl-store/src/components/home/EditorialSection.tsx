import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { HomeBlock, HomeImages } from "@/types/settings";
import { Icon } from "../ui/Icon";

/** Which photo and side go with each block, in page order (the texts come from the dashboard settings). */
const LAYOUT: { image: keyof HomeImages; flip?: boolean }[] = [{ image: "quality" }, { image: "fresh", flip: true }];

/** Two text + image blocks. Photos and texts come from the dashboard («الصفحة الرئيسية»); without a photo the placeholder shows. */
export function EditorialSection({ images, blocks = DEFAULT_SETTINGS.homeBlocks }: { images?: HomeImages; blocks?: HomeBlock[] }) {
  return (
    <section className="sec">
      <div className="wrap">
        {LAYOUT.map(({ image, flip }, i) => {
          const block = blocks[i] ?? DEFAULT_SETTINGS.homeBlocks[i];
          return (
            <div key={image} className={flip ? "ed flip rv" : "ed rv"}>
              <div className="ed-img">
                {images?.[image] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[image]} alt={block.title} loading="lazy" decoding="async" />
                ) : (
                  <span className="slot">
                    <Icon id="i-image" />
                    مكان الصورة
                  </span>
                )}
              </div>
              <div>
                <h2>{block.title}</h2>
                {block.text ? <p>{block.text}</p> : null}
                <ul>
                  {block.points.filter(Boolean).map((point) => (
                    <li key={point}>
                      <Icon id="i-check" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
