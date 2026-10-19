import { MinOrderAmount } from "@/features/settings/SettingsProvider";
import { Icon } from "../ui/Icon";
import { Wordmark } from "./Wordmark";
import { WhatsAppLink } from "./WhatsAppLink";

export function Footer() {
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
              <li>البيطاش: شارع السماليهي 1</li>
              <li>عين شمس، القاهرة</li>
            </ul>
          </div>
          <div>
            <h3>التوصيل</h3>
            <ul>
              <li>داخل البيطاش حاليًا</li>
              <li>الحد الأدنى للطلب <MinOrderAmount /> ج.م</li>
              <li>الطلبات حتى 1:30 صباحًا</li>
            </ul>
          </div>
          <div>
            <h3>خدمة العملاء</h3>
            <p>تواصل معنا على صفحاتنا:</p>
            <div className="soc">
              <a className="circ" href="https://www.facebook.com/Abu.AlFadl.Market" target="_blank" rel="noopener" aria-label="فيسبوك أبو الفضل">
                <Icon id="i-fb" />
              </a>
              <a className="circ" href="https://www.instagram.com/abu_elfadl1/" target="_blank" rel="noopener" aria-label="إنستجرام أبو الفضل">
                <Icon id="i-ig" />
              </a>
              <WhatsAppLink />
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
