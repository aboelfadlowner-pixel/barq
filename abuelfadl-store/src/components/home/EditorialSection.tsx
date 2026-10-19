import { Icon } from "../ui/Icon";

interface Block {
  title: string;
  text: string;
  points: string[];
  flip?: boolean;
}

const blocks: Block[] = [
  {
    title: "جودة نختارها بأنفسنا",
    text: "من الجبنة الرومي إلى الألبان الطازجة، نختار كل صنف بعناية قبل أن يصل إلى رفوفنا، لتحصل دائمًا على الأفضل.",
    points: ["أصناف مختارة بعناية", "خبرة في السوق منذ 2014"],
  },
  {
    title: "طازج يومًا بيوم",
    text: "المخبوزات من الفرن والوجبات الجاهزة تُحضَّر يوميًا، لتصلك طازجة كأنك اشتريتها من المتجر.",
    points: ["مخبوزات من الفرن", "سحور أبو الفضل جاهز"],
    flip: true,
  },
];

/** Two text + image blocks. The images are placeholders in v29 ("مكان الصورة"). */
export function EditorialSection() {
  return (
    <section className="sec">
      <div className="wrap">
        {blocks.map((block) => (
          <div key={block.title} className={block.flip ? "ed flip rv" : "ed rv"}>
            <div className="ed-img">
              <span className="slot">
                <Icon id="i-image" />
                مكان الصورة
              </span>
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
