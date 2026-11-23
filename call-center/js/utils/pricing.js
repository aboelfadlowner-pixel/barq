/* Line and order totals. Shared by the cart, review, and order screens. */
import { round2, formatWeight } from './format.js';
import { UNIT_TYPES } from '../constants.js';

/* Add-ons of one piece (like Foodics they count per piece: 2 × أرز بلبن with عسل = 2 × (أرز بلبن + عسل)). */
export const modifiersTotal = (item) => (item.modifiers || []).reduce((s, m) => s + m.price * m.qty, 0);

export function lineTotal(item) {
  return item.unitType === 'weight'
    ? (item.price * (item.grams || 0)) / 1000 + modifiersTotal(item)
    : (item.price + modifiersTotal(item)) * (item.qty || 0);
}

/* «عسل ×2، مكسرات» — the add-ons of a line in one short text. */
export const modifiersText = (mods) => (mods || []).map((m) => (m.qty > 1 ? `${m.name} ×${m.qty}` : m.name)).join('، ');

/* «خصم»: { kind: 'percent' | 'amount', value } — a percent is taken from the items only (not the delivery fee);
   never more than the items. A percent follows the items if the branch corrects a weight. */
export function discountAmount(subtotal, discount) {
  if (!discount || !(discount.value > 0)) return 0;
  const raw = discount.kind === 'percent' ? (subtotal * discount.value) / 100 : discount.value;
  return round2(Math.min(Math.max(raw, 0), subtotal));
}

/* deliveryFee: number, or null when no area is selected yet.
   discount: see discountAmount. feeRemoved: the delivery fee taken off the order («بدون رسوم توصيل»), only to show it. */
export function computeTotals(items, deliveryFee = null, discount = null, feeRemoved = 0) {
  let fixed = 0;
  let weighted = 0;
  for (const it of items) {
    if (it.unitType === 'weight') weighted += lineTotal(it);
    else fixed += lineTotal(it);
  }
  const subtotal = fixed + weighted;
  return {
    fixed: round2(fixed),
    weighted: round2(weighted),
    subtotal: round2(subtotal),
    deliveryFee,
    feeRemoved: feeRemoved || 0,
    discount: discountAmount(subtotal, discount),
    discountSpec: discount && discount.value > 0 ? discount : null,
    total: round2(subtotal - discountAmount(subtotal, discount) + (deliveryFee ?? 0)),
    estimated: items.some((i) => i.unitType === 'weight'),
    count: items.length,
  };
}

export function quantityLabel(item) {
  if (item.unitType === 'weight') return formatWeight(item.grams);
  return `${item.qty} ${UNIT_TYPES[item.unitType]?.per ?? ''}`.trim();
}

export const perUnitLabel = (unitType) => UNIT_TYPES[unitType]?.per ?? '';

/* The totals of a saved order (items, fee, discount, fee taken off). */
export const totalsOf = (o) => computeTotals(o.items, o.deliveryFee, o.discount ?? null, o.feeRemoved ?? 0);

/* «خصم 10%» / «خصم 50 ج.م» */
export const discountLabel = (d) => (!d ? '' : d.kind === 'percent' ? `خصم ${d.value}%` : 'خصم');

/* For the branch (prep card, printed ticket): what was taken off the order, in plain lines.
   [{ kind: 'fee' | 'discount', text }] — empty when nothing was adjusted. */
export function adjustLines(o) {
  const out = [];
  if (o.feeRemoved > 0) out.push({ kind: 'fee', text: 'رسوم التوصيل متشالة' });
  const amount = o.discountAmount ?? totalsOf(o).discount;   // the branch's list carries the amount from the database
  if (amount > 0 && o.discount) {
    out.push({ kind: 'discount', text: `${discountLabel(o.discount)} (− ${Number(amount).toFixed(2)} ج.م)` });
  }
  return out;
}
