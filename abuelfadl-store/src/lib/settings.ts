import type { StoreSettings } from "../types/settings";
import { MIN_ORDER } from "./constants";

/** Settings of a new store (the values the v29 interface had hard-coded). */
export const DEFAULT_SETTINGS: StoreSettings = {
  minOrder: MIN_ORDER,
  notice: "التوصيل متاح حاليًا داخل البيطاش فقط",
  whatsapp: "01099400097",
  ordersOpen: true,
  closedMessage: "استقبال الطلبات متوقف دلوقتي، ارجعلنا كمان شوية",
  phone: "01099400097",
  facebook: "https://www.facebook.com/Abu.AlFadl.Market",
  instagram: "https://www.instagram.com/abu_elfadl1/",
  tiktok: "",
  workHours: "يوميًا من 7 الصبح لـ 3 الفجر",
  deliveryHours: "يوميًا من 2 الضهر لـ 1:30 بالليل",
  offersTitle: "العروض",
  offersKicker: "عروض لفترة محدودة",
  branches: [{ name: "البيطاش (الفرع الرئيسي)", address: "شارع السماليهي 1، البيطاش", mapUrl: "https://maps.app.goo.gl/uZ3ZrZA4WM4Ggjye7" }],
};

/** Saved settings completed with the defaults (older data files miss the fields added later). */
export const withDefaults = (settings: Partial<StoreSettings> | undefined): StoreSettings => ({ ...DEFAULT_SETTINGS, ...settings });

/** Text of the strip above the header: the notice followed by the minimum order, or the paused message. */
export function noticeText(settings: StoreSettings): string {
  if (!settings.ordersOpen) return settings.closedMessage;
  const min = settings.minOrder > 0 ? `الحد الأدنى للطلب ${settings.minOrder} جنيه` : "";
  if (!settings.notice) return min;
  return min ? `${settings.notice}، و${min}` : settings.notice;
}
