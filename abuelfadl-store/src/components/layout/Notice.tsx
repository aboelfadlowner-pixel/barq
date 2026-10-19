"use client";

import { useSettings } from "@/features/settings/SettingsProvider";
import { useOrdering } from "@/features/settings/useOrdering";
import { noticeText } from "@/lib/settings";

/** Delivery notice strip above the header (dashboard settings), or why orders are off (paused / outside the order hours). */
export function Notice() {
  const settings = useSettings();
  const { canOrder, message } = useOrdering();
  const text = canOrder ? noticeText(settings) : message;
  if (!text) return null;
  return (
    <div className={canOrder ? "notice" : "notice closed"}>
      <div className="wrap">
        <span className="pulse" aria-hidden="true" />
        <span>{text}</span>
      </div>
    </div>
  );
}
