import type { HomeImages } from "@/types/settings";
import { Icon } from "../ui/Icon";

interface Block {
  /** Which «صور الصفحة الرئيسية» photo goes with this block. */
  image: keyof HomeImages;
  title: string;
  text: string;
  points: string[];
  flip?: boolean;
}

const blocks: Block[] = [
  {
    image: "quality",
    title: "جودة نختارها بأنفسنا",
    text: "من الجبنة الرومي إلى الألبان الطازجة، نختار كل صنف بعناية قبل أن يصل إلى رفوفنا، لتحصل دائمًا على الأفضل.",
    points: ["أصناف مختارة بعناية", "خبرة في السوق منذ 2014"],
  },
  {
    image: "fresh",
    title: "طازج يومًا بيوم",
    text: "المخبوزات من الفرن والوجبات الجاهزة تُحضَّر يوميًا، لتصلك طازجة كأنك اشتريتها من المتجر.",
    points: ["مخبوزات من الفرن", "سحور أبو الفضل جاهز"],
    flip: true,
  },
];

/** Two text + image blocks. Photos come from the dashboard («صور الصفحة الرئيسية»); without one the placeholder shows. */
export function EditorialSection({ images }: { images?: HomeImages }) {
  return (
    <section className="sec">
      <div className="wrap">
        {blocks.map((block) => (
          <div key={block.title} className={block.flip ? "ed flip rv" : "ed rv"}>
            <div className="ed-img">
              {images?.[block.image] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[block.image]} alt={block.title} loading="lazy" decoding="async" />
              ) : (
                <span className="slot">
                  <Icon id="i-image" />
                  مكان الصورة
                </span>
              )}
            </div>
            <div>
              <h2>{block.title}</h2>
              <p>{block.text}</p>
              <ul>
                {block.points.map((point) => (
                  <li key={point}>
                    <Icon id="i-check" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
