/* Formatting & normalization helpers (Arabic UI, Western digits). */
import { HOUSING_TYPES } from '../constants.js';

export const CURRENCY = 'ج.م';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toWesternDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
    .replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d));
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatMoney = (n) => `${moneyFmt.format(round2(n))} ${CURRENCY}`;
/* Short price for product cards (like Foodics): 165 ج.م, 54.5 ج.م — no ".00". */
const priceFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const formatPrice = (n) => `${priceFmt.format(round2(n))} ${CURRENCY}`;

export function formatWeight(grams) {
  const g = Math.round(Number(grams) || 0);
  if (g < 1000) return `${g} جم`;
  return `${(g / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} كجم`;
}

const timeFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long' });

export const formatTime = (iso) => timeFmt.format(new Date(iso));

export function isSameDay(a, b) {
  const x = new Date(a); const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/* Working day: from 2 AM to 2 AM, Cairo time (orders after midnight still belong to
   the evening before). Screens that show "today" start empty again at 2 AM. */
export const DAY_START_HOUR = 2;
const cairoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const cairoOffset = (ms) => {       // Cairo wall clock minus UTC, in ms (handles summer time)
  const p = Object.fromEntries(cairoFmt.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
};
export function workDayStart(now = new Date()) {
  const ms = new Date(now).getTime();
  const p = Object.fromEntries(cairoFmt.formatToParts(new Date(ms - DAY_START_HOUR * 3600e3)).map((x) => [x.type, Number(x.value)]));
  const local = Date.UTC(p.year, p.month - 1, p.day, DAY_START_HOUR);
  return new Date(local - cairoOffset(local - cairoOffset(ms)));
}
export const inWorkDay = (iso, now = new Date()) => !!iso && new Date(iso) >= workDayStart(now);

export function dayLabel(iso, now = new Date()) {
  if (isSameDay(iso, now)) return 'اليوم';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (isSameDay(iso, y)) return 'أمس';
  return dateFmt.format(new Date(iso));
}

export const formatDateTime = (iso) => `${dayLabel(iso)} · ${formatTime(iso)}`;

/* Phone: accepts 01xxxxxxxxx, +201xxxxxxxxx, 00201xxxxxxxxx, Arabic digits, spaces. */
export function normalizePhone(input) {
  let d = toWesternDigits(input).replace(/\D/g, '');
  if (d.startsWith('0020')) d = d.slice(4);
  else if (d.startsWith('20') && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith('1')) d = `0${d}`;
  return d;
}

/* Proposed rule: Egyptian mobile (11 digits, 01…) or landline (9–10 digits, 0…). */
export function isValidPhone(input) {
  const d = normalizePhone(input);
  return /^01\d{9}$/.test(d) || /^0[2-9]\d{7,8}$/.test(d);
}

/* Arabic search normalization: alef forms, taa marbuta, yaa, diacritics, digits. */
export function normalizeArabic(text) {
  return toWesternDigits(text)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export const housingLabel = (id) => (id ? HOUSING_TYPES.find((h) => h.id === id)?.label ?? '' : '');

export function formatAddress(a) {
  if (!a) return '';
  const text = [
    a.street,
    a.building && `عمارة ${a.building}`,
    a.floor && `الدور ${a.floor}`,
    a.apartment && `شقة ${a.apartment}`,
  ].filter(Boolean).join('، ');
  const housing = housingLabel(a.housingType);
  return housing ? `${text} (${housing})` : text;
}

/* "منذ 5 دقائق" style time for order cards. */
export function formatRelative(iso, now = new Date()) {
  const mins = Math.round((now - new Date(iso)) / 60000);
  if (mins < 1) return 'منذ لحظات';
  if (mins < 60) return `منذ ${mins} ${mins <= 10 ? 'دقائق' : 'دقيقة'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24 && isSameDay(iso, now)) return `منذ ${hrs} ${hrs === 1 ? 'ساعة' : hrs <= 10 ? 'ساعات' : 'ساعة'}`;
  return formatDateTime(iso);
}
