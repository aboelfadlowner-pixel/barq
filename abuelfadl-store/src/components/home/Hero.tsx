import Link from "next/link";
import type { CSSProperties } from "react";
import { MIN_ORDER } from "@/lib/constants";
import { Icon } from "../ui/Icon";
import { HeroPhoto } from "./HeroPhoto";
import { ScrollToButton } from "./ScrollToButton";

const delay = (ms: number) => ({ "--d": ms }) as CSSProperties;

/**
 * Home hero (v29 `.hero3`): headline, team photo, intro text, buttons and quick facts.
 * The entrance animations that are pure CSS (`.seq`) are kept. The team photo (fly-in from both sides, 3D tilt) is `HeroPhoto`.
 */
export function Hero() {
  return (
    <section className="hero3">
      <div className="wrap">
        <div className="hero3-head">
          <span className="eyebrow seq" style={delay(0)}>
            <Icon id="i-pin" />
            البيطاش · عين شمس
          </span>
          <h1 className="seq" style={delay(120)}>
            طازج كل يوم، بجودة{" "}
            <span className="mark">
              نثق بها
              <svg viewBox="0 0 120 12" aria-hidden="true">
                <path pathLength={1} d="M3 8 Q 20 1 38 7 T 75 6 T 117 5" />
              </svg>
            </span>
          </h1>
        </div>
        <HeroPhoto />
        <div className="hero3-txt">
          <div>
            <p className="lead seq" style={delay(260)}>
              ألبان وأجبان ومخبوزات وبقالة وطعام جاهز، نحضّره لك يومًا بيوم ونوصله لبابك في دقائق.
            </p>
            <div className="cta-row seq" style={delay(380)}>
              <Link className="btn btn-primary" href="/category/all">
                تسوّق الآن
                <Icon id="i-arrow" />
              </Link>
              <ScrollToButton className="btn btn-ghost" targetId="catsSec">
                تصفّح الأقسام
              </ScrollToButton>
            </div>
            <div className="facts seq" style={delay(520)}>
              <div>
                <Icon id="i-truck" />
                توصيل في نفس اليوم
              </div>
              <div>
                <Icon id="i-bag" />
                الحد الأدنى {MIN_ORDER} ج.م
              </div>
              <div>
                <Icon id="i-clock" />
                الطلبات حتى 1:30 صباحًا
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
