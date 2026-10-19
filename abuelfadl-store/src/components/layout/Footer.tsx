"use client";

import Link from "next/link";
import { useSettings } from "@/features/settings/SettingsProvider";
import { Icon } from "../ui/Icon";
import { Wordmark } from "./Wordmark";

/** Site footer. Contact details, hours and social links come from the dashboard settings. */
export function Footer() {
  const s = useSettings();
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <a className="logo" href="#top" aria-label="أبو الفضل ستور، الصفحة الرئيسية">
              <Wordmark />
            </a>
            <p style={{ marginTop: 14 }}>منذ 2014، متجرك القريب للبقالة والمخبوزات والأجبان واللحوم والوجبات الجاهزة.</p>
          </div>
          <div>
            <h3>التواصل</h3>
            <ul>
              {s.branches[0] ? <li>{s.branches[0].address || s.branches[0].name}</li> : null}
              {s.phone ? (
                <li>
                  <a href={`tel:${s.phone}`} dir="ltr">
                    {s.phone}
                  </a>
                </li>
              ) : null}
              <li>
                <Link href="/contact" className="foot-link">
                  اتصل بنا ←
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>التوصيل</h3>
            <ul>
              <li>داخل البيطاش حاليًا</li>
              {s.minOrder > 0 ? <li>الحد الأدنى للطلب {s.minOrder} ج.م</li> : null}
              {s.deliveryHours ? <li>{s.deliveryHours}</li> : null}
            </ul>
          </div>
          <div>
            <h3>خدمة العملاء</h3>
            <p>تواصل معنا على صفحاتنا:</p>
            <div className="soc">
              {s.facebook ? (
                <a className="circ" href={s.facebook} target="_blank" rel="noopener" aria-label="فيسبوك أبو الفضل">
                  <Icon id="i-fb" />
                </a>
              ) : null}
              {s.instagram ? (
                <a className="circ" href={s.instagram} target="_blank" rel="noopener" aria-label="إنستجرام أبو الفضل">
                  <Icon id="i-ig" />
                </a>
              ) : null}
              {s.tiktok ? (
                <a className="circ" href={s.tiktok} target="_blank" rel="noopener" aria-label="تيك توك أبو الفضل">
                  <Icon id="i-tt" />
                </a>
              ) : null}
              {s.whatsapp ? (
                <a className="circ" href={`https://wa.me/2${s.whatsapp}`} target="_blank" rel="noopener" aria-label="واتساب أبو الفضل">
                  <Icon id="i-wa" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="copy">
          <span>الحقوق محفوظة | 2014 - 2026 أبو الفضل ستور</span>
          <span>الأسعار والصور المعروضة في هذا التصميم أمثلة تجريبية.</span>
        </div>
      </div>
    </footer>
  );
}
