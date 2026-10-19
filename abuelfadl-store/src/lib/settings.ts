import type { StoreSettings } from "../types/settings";
import { MIN_ORDER } from "./constants";

/** Settings of a new store (the values the v29 interface had hard-coded). */
export const DEFAULT_SETTINGS: StoreSettings = {
  minOrder: MIN_ORDER,
  notice: "التوصيل متاح حاليًا داخل البيطاش فقط",
  whatsapp: "",
  ordersOpen: true,
  closedMessage: "استقبال الطلبات متوقف دلوقتي، ارجعلنا كمان شوية",
};

/** Text of the strip above the header: the notice followed by the minimum order, or the paused message. */
export function noticeText(settings: StoreSettings): string {
  if (!settings.ordersOpen) return settings.closedMessage;
  const min = settings.minOrder > 0 ? `الحد الأدنى للطلب ${settings.minOrder} جنيه` : "";
  if (!settings.notice) return min;
  return min ? `${settings.notice}، و${min}` : settings.notice;
}
