/** One branch on the contact page. */
export interface Branch {
  name: string;
  address: string;
  /** Google Maps link ("افتح على الخريطة"). Empty until it is added. */
  mapUrl: string;
}

/** Store-wide settings edited from the dashboard ("الإعدادات"). */
export interface StoreSettings {
  /** Minimum order total in EGP. 0 means no minimum. */
  minOrder: number;
  /** Text of the strip above the header, e.g. "التوصيل متاح حاليًا داخل البيطاش فقط". The minimum is added after it. */
  notice: string;
  /** Customer-service WhatsApp number (Egyptian mobile, 11 digits), shown in the footer. Empty when none. */
  whatsapp: string;
  /** False while orders are paused (rush hour, after hours): the store shows `closedMessage` and refuses orders. */
  ordersOpen: boolean;
  /** Shown in the strip and the cart while orders are paused. */
  closedMessage: string;
  /** Contact page («اتصل بنا»): phone for the call button (Egyptian number, digits only). Empty when none. */
  phone: string;
  /** Social links (full https URLs). Empty when the store has none. */
  facebook: string;
  instagram: string;
  tiktok: string;
  /** Free text, e.g. "من 7 الصبح لـ 3 الفجر". */
  workHours: string;
  deliveryHours: string;
  branches: Branch[];
  /** Name of the offers section, e.g. "عروض الخميس والجمعة". The section shows only while some product is on offer. */
  offersTitle: string;
  /** Small label above the offers title, e.g. "عروض لفترة محدودة". Empty: no label. */
  offersKicker: string;
}
