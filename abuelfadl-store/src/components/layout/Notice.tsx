"use client";

import { useSettings } from "@/features/settings/SettingsProvider";
import { noticeText } from "@/lib/settings";

/** Delivery notice strip above the header (text and minimum order from the dashboard settings). */
export function Notice() {
  const settings = useSettings();
  const text = noticeText(settings);
  if (!text) return null;
  return (
    <div className={settings.ordersOpen ? "notice" : "notice closed"}>
      <div className="wrap">
        <span className="pulse" aria-hidden="true" />
        <span>{text}</span>
      </div>
    </div>
  );
}
