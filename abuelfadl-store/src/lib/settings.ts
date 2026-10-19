import type { StoreSettings } from "../types/settings";
import { MIN_ORDER } from "./constants";

/** Settings of a new store (the values the v29 interface had hard-coded). */
export const DEFAULT_SETTINGS: StoreSettings = {
  minOrder: MIN_ORDER,
  notice: "التوصيل متاح للبيطاش والهانوفيل والدخيلة",
  whatsapp: "01099400097",
  ordersOpen: true,
  closedMessage: "استقبال الطلبات متوقف مؤقتًا، يسعدنا طلبك بعد قليل",
  phone: "01099400097",
  facebook: "https://www.facebook.com/Abu.AlFadl.Market",
  instagram: "https://www.instagram.com/abu_elfadl1/",
  tiktok: "",
  workHours: "يوميًا من 7 صباحًا حتى 3 فجرًا",
  deliveryHours: "يوميًا من 2 ظهرًا حتى 1:30 صباحًا",
  offersTitle: "العروض",
  offersKicker: "عروض لفترة محدودة",
  deliveryAreas: [
    { id: "bitash", name: "داخل البيطاش", fee: 30, active: true },
    { id: "hannoville", name: "الهانوفيل", fee: 40, active: true },
    { id: "outside", name: "خارج الهانوفيل والدخيلة", fee: 50, active: true },
  ],
  orderHours: { enabled: true, open: "14:00", close: "01:30" },
  branches: [{ name: "البيطاش (الفرع الرئيسي)", address: "شارع السماليهي 1، البيطاش", mapUrl: "https://maps.app.goo.gl/uZ3ZrZA4WM4Ggjye7" }],
};

/** Saved settings completed with the defaults (older data files miss the fields added later). */
export const withDefaults = (settings: Partial<StoreSettings> | undefined): StoreSettings => ({ ...DEFAULT_SETTINGS, ...settings });

/** Notice text of the first version, replaced by the new default when it was never edited (see `upgradeStore`). */
export const OLD_NOTICE = "التوصيل متاح حاليًا داخل البيطاش فقط";

/** Colloquial defaults of earlier versions, replaced by the simplified-Arabic ones when never edited (see `upgradeStore`). */
export const OLD_DEFAULT_TEXTS: Partial<Record<"closedMessage" | "workHours" | "deliveryHours", string>> = {
  closedMessage: "استقبال الطلبات متوقف دلوقتي، ارجعلنا كمان شوية",
  workHours: "يوميًا من 7 الصبح لـ 3 الفجر",
  deliveryHours: "يوميًا من 2 الضهر لـ 1:30 بالليل",
};

/** Text of the strip above the header: the notice followed by the minimum order, or the paused message. */
export function noticeText(settings: StoreSettings): string {
  if (!settings.ordersOpen) return settings.closedMessage;
  const min = settings.minOrder > 0 ? `الحد الأدنى للطلب ${settings.minOrder} جنيه` : "";
  if (!settings.notice) return min;
  return min ? `${settings.notice}، و${min}` : settings.notice;
}
