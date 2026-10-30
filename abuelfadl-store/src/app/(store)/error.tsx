"use client";

import { useEffect } from "react";
import { useSettings } from "@/features/settings/SettingsProvider";

/**
 * Shown instead of a store page that failed (e.g. the database did not answer): a calm message, a retry, and the
 * phone and WhatsApp numbers from the dashboard so the customer can still order.
 */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { phone, whatsapp } = useSettings();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="wrap store-error" role="alert">
      <h1>نعتذر، حدث عطل مؤقت</h1>
      <p>لم نتمكن من عرض هذه الصفحة الآن. حاول مرة أخرى بعد لحظات، أو اطلب مباشرة بالتليفون أو واتساب.</p>
      <div className="cta-row">
        <button className="btn btn-primary" type="button" onClick={reset}>
          حاول مرة أخرى
        </button>
        {whatsapp ? (
          <a className="btn btn-ghost" href={`https://wa.me/2${whatsapp}`} target="_blank" rel="noreferrer">
            اطلب على واتساب
          </a>
        ) : null}
        {phone ? (
          <a className="btn btn-ghost" href={`tel:${phone}`}>
            اتصل بنا <bdi>{phone}</bdi>
          </a>
        ) : null}
      </div>
    </div>
  );
}
