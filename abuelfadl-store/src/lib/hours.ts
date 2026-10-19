import type { OrderHours } from "../types/settings";

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes since midnight in Cairo. */
export function cairoMinutes(now = new Date()): number {
  const [h, m] = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return (h % 24) * 60 + m;
}

/** True when orders are taken right now (always, when the hours are switched off). Handles windows past midnight. */
export function isWithinHours(hours: OrderHours, now = new Date()): boolean {
  if (!hours.enabled) return true;
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const minute = cairoMinutes(now);
  if (open === close) return true;
  return open < close ? minute >= open && minute < close : minute >= open || minute < close;
}

/** "2 الضهر", "1:30 بالليل", "7 الصبح". */
export function timeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "صباحًا" : h < 16 ? "ظهرًا" : h < 19 ? "عصرًا" : "مساءً";
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${period}`;
}

/** Message shown outside the hours, e.g. "بنستقبل الطلبات من 2 الضهر لـ 1:30 بالليل". */
export const outsideHoursMessage = (hours: OrderHours) => `نستقبل الطلبات يوميًا من ${timeLabel(hours.open)} حتى ${timeLabel(hours.close)}`;
