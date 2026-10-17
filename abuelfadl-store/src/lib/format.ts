/**
 * Splits a price into the whole part (with thousands separators) and a two-digit fraction for display,
 * e.g. 1250 -> { whole: "1,250", fraction: ".00" }, 210.6 -> { whole: "210", fraction: ".60" }.
 *
 * Difference from v29: v29 always printed ".00" after the number, so a price like 13.5 showed as "13.5.00".
 */
export function formatPrice(price: number): { whole: string; fraction: string } {
  const cents = Math.round(price * 100);
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return { whole: whole.toLocaleString("en-US"), fraction: `.${fraction}` };
}

/** Money amount for totals and labels, up to 2 decimals, no trailing zeros (v29 `money`): 1250 -> "1,250", 13.5 -> "13.5". */
export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
