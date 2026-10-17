import { Icon } from "../ui/Icon";

const cards = [
  { icon: "i-truck", title: "توصيل سريع في نفس اليوم", text: "البقالة والضروريات اليومية تصلك في دقائق داخل البيطاش." },
  { icon: "i-shield", title: "جودة وسعر لا يقارن", text: "طعام طازج يُحضَّر يومًا بيوم، وجودة المنتجات تتحدث عن نفسها." },
  { icon: "i-pin", title: "فروعنا", text: "فروع البيطاش: شارع السماليهي 1، عين شمس." },
];

export function TrustSection() {
  return (
    <section className="sec trust">
      <div className="wrap trust-grid">
        {cards.map((card) => (
          <div key={card.title} className="tcard rv">
            <span className="ci">
              <Icon id={card.icon} />
            </span>
            <div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
