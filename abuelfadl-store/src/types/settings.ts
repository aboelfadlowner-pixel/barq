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
}
