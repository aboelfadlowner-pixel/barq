"use client";

import { useSettings } from "@/features/settings/SettingsProvider";
import { Icon } from "../ui/Icon";

/** Footer WhatsApp button, shown only when a number is set in the dashboard settings. */
export function WhatsAppLink() {
  const { whatsapp } = useSettings();
  if (!whatsapp) return null;
  return (
    <a className="circ" href={`https://wa.me/2${whatsapp}`} target="_blank" rel="noopener" aria-label="واتساب أبو الفضل">
      <Icon id="i-wa" />
    </a>
  );
}
