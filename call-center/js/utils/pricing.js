/* Line and order totals. Shared by the cart, review, and order screens. */
import { round2, formatWeight } from './format.js';
import { UNIT_TYPES } from '../constants.js';

export function lineTotal(item) {
  return item.unitType === 'weight'
    ? (item.price * (item.grams || 0)) / 1000
    : item.price * (item.qty || 0);
}

/* deliveryFee: number, or null when no area is selected yet. */
export function computeTotals(items, deliveryFee = null) {
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
    total: round2(subtotal + (deliveryFee ?? 0)),
    estimated: items.some((i) => i.unitType === 'weight'),
    count: items.length,
  };
}

export function quantityLabel(item) {
  if (item.unitType === 'weight') return formatWeight(item.grams);
  return `${item.qty} ${UNIT_TYPES[item.unitType]?.per ?? ''}`.trim();
}

export const perUnitLabel = (unitType) => UNIT_TYPES[unitType]?.per ?? '';
