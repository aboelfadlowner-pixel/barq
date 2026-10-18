import type { Product } from "../types/product";

/** Rounds to 2 decimals (v29 `r2`), so 0.25 steps never drift (0.1 + 0.2 style errors). Used for money. */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Rounds a quantity to grams (3 decimals), so steps like 0.125 kg stay exact. */
export const roundQty = (value: number): number => Math.round(value * 1000) / 1000;

type Weighable = Pick<Product, "weighed" | "weightStep" | "minWeight" | "maxWeight">;

/** Default weight settings (v29 sold every weighed product in 0.25 kg steps up to 10 kg). */
export const DEFAULT_WEIGHT_STEP = 0.25;
export const DEFAULT_MAX_WEIGHT = 10;
/** Largest number of pieces of one product in the cart (v29 `capOf`). */
const MAX_PIECES = 20;

/**
 * What a customer may order: from `min`, in steps of `step`, up to `max`.
 * Weighed products use their weight settings (kg); other products are 1 to 20 pieces.
 */
export function quantityRule(product: Weighable): { min: number; step: number; max: number } {
  if (!product.weighed) return { min: 1, step: 1, max: MAX_PIECES };
  const step = product.weightStep ?? DEFAULT_WEIGHT_STEP;
  return { min: product.minWeight ?? step, step, max: product.maxWeight ?? DEFAULT_MAX_WEIGHT };
}

/** Quantity increment: weight step in kg for weighed products, 1 piece otherwise. */
export const stepOf = (product: Weighable): number => quantityRule(product).step;

/** Smallest quantity that can be ordered. */
export const minQuantityOf = (product: Weighable): number => quantityRule(product).min;

/** Largest quantity of one product in the cart. */
export const maxQuantityOf = (product: Weighable): number => quantityRule(product).max;

/** Largest quantity accepted when an old cart is restored from localStorage (v29 caps every line at 20). */
export const MAX_RESTORED_QUANTITY = 20;

/** True when `quantity` is one of the allowed values: min, min + step, min + 2·step, ... up to max. */
export function isAllowedQuantity(product: Weighable, quantity: number): boolean {
  const { min, step, max } = quantityRule(product);
  if (!Number.isFinite(quantity) || quantity < min - 1e-9 || quantity > max + 1e-9) return false;
  const steps = (quantity - min) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

/** Nearest allowed quantity to `quantity` (e.g. a weight typed by the customer). */
export function snapQuantity(product: Weighable, quantity: number): number {
  const { min, step, max } = quantityRule(product);
  if (!Number.isFinite(quantity) || quantity <= min) return min;
  const lastStep = Math.floor((max - min) / step + 1e-9);
  const steps = Math.min(lastStep, Math.round((quantity - min) / step));
  return roundQty(min + steps * step);
}

/** One step up (starting at the minimum when the product is not in the cart yet), capped at the maximum. */
export function increaseQuantity(product: Weighable, quantity: number): number {
  const { min, step, max } = quantityRule(product);
  if (quantity < min - 1e-9) return min;
  return roundQty(Math.min(max, quantity + step));
}

/** One step down; returns 0 (remove from the cart) when going below the minimum. */
export function decreaseQuantity(product: Weighable, quantity: number): number {
  const { min, step } = quantityRule(product);
  const next = roundQty(quantity - step);
  return next < min - 1e-9 ? 0 : next;
}

/** Up to four quick weight choices for the product sheet, e.g. ربع / نصف / 1 كيلو / 2 كيلو, within the product's settings. */
export function weightPresets(product: Weighable): number[] {
  const { min, step } = quantityRule(product);
  const choices = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5].filter((kg) => isAllowedQuantity(product, kg));
  for (let n = 0; choices.length < 4 && n < 40; n++) {
    const kg = roundQty(min + n * step);
    if (isAllowedQuantity(product, kg) && !choices.includes(kg)) choices.push(kg);
  }
  return choices.sort((a, b) => a - b).slice(0, 4);
}

/** Arabic weight label (v29 `wLabel`): 0.25 -> "ربع كيلو", 1.5 -> "1 كيلو ونصف", 0.375 -> "375 جم", 1.125 -> "1 كيلو و125 جم". */
export function weightLabel(quantity: number): string {
  const whole = Math.floor(quantity + 1e-9);
  const fraction = roundQty(quantity - whole);
  const fractionName = ({ 0.25: "ربع", 0.5: "نصف", 0.75: "ثلاثة أرباع" } as Record<number, string>)[fraction];
  const grams = Math.round(fraction * 1000);
  if (fraction !== 0 && !fractionName) return whole ? `${whole} كيلو و${grams} جم` : `${grams} جم`;
  if (!whole) return `${fractionName} كيلو`;
  if (!fraction) return `${whole} كيلو`;
  return `${whole} كيلو و${fractionName}`;
}

/** What to show for a quantity: a weight label for weighed products, the plain number otherwise (v29 `qLabel`). */
export const quantityLabel = (product: Weighable, quantity: number): string =>
  product.weighed ? weightLabel(quantity) : String(quantity);
