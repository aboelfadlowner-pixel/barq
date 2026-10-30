"use client";

import { DEFAULT_SETTINGS } from "@/lib/settings";

/**
 * Last resort when a whole layout fails (the store's or the dashboard's): a plain page with its own <html>, since the
 * layouts and their styles did not load. Numbers are the store defaults (the dashboard settings could not be read).
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { phone, whatsapp } = DEFAULT_SETTINGS;
  const button = { display: "inline-block", margin: "6px", padding: "12px 22px", borderRadius: "999px", fontWeight: 600, textDecoration: "none", border: "1.5px solid #1F5E37", font: "inherit", cursor: "pointer" } as const;
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "Tahoma, 'Segoe UI', sans-serif", background: "#fff", color: "#1A211C", textAlign: "center" }}>
        <main style={{ maxWidth: 520, margin: "12vh auto", padding: "0 20px" }}>
          <h1 style={{ color: "#105028", fontSize: "1.7rem" }}>أبو الفضل</h1>
          <h2 style={{ fontSize: "1.25rem" }}>نعتذر، حدث عطل مؤقت</h2>
          <p style={{ color: "#67726A", lineHeight: 1.8 }}>حاول مرة أخرى بعد لحظات، أو اطلب مباشرة بالتليفون أو واتساب.</p>
          <button type="button" onClick={reset} style={{ ...button, background: "#1F5E37", color: "#fff" }}>
            حاول مرة أخرى
          </button>
          <a href={`https://wa.me/2${whatsapp}`} style={{ ...button, color: "#1F5E37" }}>
            اطلب على واتساب
          </a>
          <a href={`tel:${phone}`} style={{ ...button, color: "#1F5E37" }}>
            اتصل بنا {phone}
          </a>
        </main>
      </body>
    </html>
  );
}
