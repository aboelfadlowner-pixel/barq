"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useSettings } from "@/features/settings/SettingsProvider";

/** Phone number as people read it, e.g. "010 9940 0097". */
const spaced = (phone: string) => (phone.length === 11 ? `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}` : phone);

/**
 * «اتصل بنا»: call and WhatsApp buttons, social pages, branches with a map button, and opening / delivery hours.
 * Everything comes from the dashboard settings, so staff can change it without a developer.
 */
export function ContactPage() {
  const s = useSettings();
  const socials = [
    { url: s.facebook, label: "فيسبوك", icon: "i-fb" },
    { url: s.instagram, label: "إنستجرام", icon: "i-ig" },
    { url: s.tiktok, label: "تيك توك", icon: "i-tt" },
  ].filter((item) => item.url);

  return (
    <div className="wrap contact" id="viewContact">
      <div className="cbar">
        <Link className="circ" href="/" aria-label="رجوع إلى الرئيسية">
          <Icon id="i-back" />
        </Link>
      </div>
      <header className="ct-head">
        <h1>اتصل بنا</h1>
        <p>عندك سؤال عن طلب أو منتج؟ كلّمنا وإحنا نساعدك.</p>
      </header>

      <div className="ct-actions">
        {s.phone ? (
          <a className="ct-btn call" href={`tel:${s.phone}`}>
            <Icon id="i-phone" />
            <span>
              <b>اتصل بينا</b>
              <small dir="ltr">{spaced(s.phone)}</small>
            </span>
          </a>
        ) : null}
        {s.whatsapp ? (
          <a className="ct-btn wa" href={`https://wa.me/2${s.whatsapp}`} target="_blank" rel="noopener">
            <Icon id="i-wa" />
            <span>
              <b>كلّمنا واتساب</b>
              <small dir="ltr">{spaced(s.whatsapp)}</small>
            </span>
          </a>
        ) : null}
      </div>

      <div className="ct-grid">
        {s.workHours || s.deliveryHours ? (
          <section className="ct-card">
            <h2>
              <Icon id="i-clock" />
              المواعيد
            </h2>
            <dl>
              {s.workHours ? (
                <>
                  <dt>مواعيد العمل</dt>
                  <dd>{s.workHours}</dd>
                </>
              ) : null}
              {s.deliveryHours ? (
                <>
                  <dt>مواعيد التوصيل</dt>
                  <dd>{s.deliveryHours}</dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        {s.branches.length ? (
          <section className="ct-card">
            <h2>
              <Icon id="i-pin" />
              فروعنا
            </h2>
            <ul className="ct-branches">
              {s.branches.map((branch) => (
                <li key={branch.name}>
                  <b>{branch.name}</b>
                  {branch.address ? <span>{branch.address}</span> : null}
                  {branch.mapUrl ? (
                    <a className="btn btn-ghost ct-map" href={branch.mapUrl} target="_blank" rel="noopener">
                      <Icon id="i-pin" />
                      افتح على الخريطة
                    </a>
                  ) : (
                    <span className="ct-map soon">
                      <Icon id="i-pin" />
                      الخريطة قريبًا
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {socials.length ? (
          <section className="ct-card">
            <h2>تابعنا</h2>
            <div className="ct-social">
              {socials.map((item) => (
                <a key={item.label} href={item.url} target="_blank" rel="noopener">
                  <Icon id={item.icon} />
                  {item.label}
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
