import type { Metadata, Viewport } from "next";
import "@/styles/admin.css";
import { ToastProvider } from "@/features/admin/ui";

export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: "%s · لوحة تحكم أبو الفضل" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Root layout of the admin dashboard: separate from the store layout, so none of the store styles or providers load here. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300..700&display=swap" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
