/* App constants. Each item notes whether it is confirmed or only proposed. */

/* Order source (phone / WhatsApp / Facebook) was removed by decision (UI and database). */

/* CONFIRMED: cash on delivery is the only payment method. */
export const PAYMENT_METHOD = { id: 'cash', label: 'كاش عند الاستلام' };

/* CONFIRMED: order type is delivery. */
export const ORDER_TYPE = 'delivery';

export const UNIT_TYPES = {
  weight: { label: 'بالوزن',  per: 'كجم' },
  piece:  { label: 'بالقطعة', per: 'قطعة' },
  pack:   { label: 'بالعبوة', per: 'عبوة' },
};

/* Address form fields (Foodics-style "إنشاء العنوان") and their length limits.
   ⚠️ The draft DB (db/01_schema.sql) still has building/floor/apartment and no
   label/housing type — it must be updated to match before connecting. */
export const ADDRESS_LIMITS = {
  label:  { max: 40,  label: 'اسم العنوان' },
  street: { max: 150, label: 'الشارع' },
  notes:  { max: 200, label: 'المعلومات الإضافية' },
};
/* CONFIRMED: housing type options, as in Foodics. */
export const HOUSING_TYPES = [
  { id: '',         label: 'لاشيء' },
  { id: 'building', label: 'عمارة' },
  { id: 'villa',    label: 'فيلا' },
  { id: 'office',   label: 'مكتب' },
];
export const CUSTOMER_NAME_MAX = 120;

/* PROPOSED (pending approval): weight presets, step and limits. */
export const WEIGHT_PRESETS = [
  { grams: 125,  label: 'تُمن كيلو' },
  { grams: 250,  label: 'ربع كيلو' },
  { grams: 500,  label: 'نص كيلو' },
  { grams: 750,  label: 'تلت أرباع' },
  { grams: 1000, label: '1 كيلو' },
  { grams: 2000, label: '2 كيلو' },
];
export const WEIGHT_STEP_GRAMS = 50;
export const WEIGHT_MIN_GRAMS = 10;
export const WEIGHT_MAX_GRAMS = 20000;
export const MAX_PIECE_QTY = 999;
