import type { Product } from "../types/product";

/** Rounds to 2 decimals (v29 `r2`), so 0.25 steps never drift (0.1 + 0.2 style errors). */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

type Weighable = Pick<Product, "weighed" | "weightStep">;

/** Quantity increment: weight step in kg for weighed products (v29 default 0.25), 1 piece otherwise. */
export const stepOf = (product: Weighable): number => (product.weighed ? (product.weightStep ?? 0.25) : 1);

/** Largest quantity of one product in the cart (v29 `capOf`): 10 kg or 20 pieces. */
export const maxQuantityOf = (product: Weighable): number => (product.weighed ? 10 : 20);

/** Largest quantity accepted when an old cart is restored from localStorage (v29 caps every line at 20). */
export const MAX_RESTORED_QUANTITY = 20;

/** Arabic weight label (v29 `wLabel`): 0.25 -> "ربع كيلو", 1.5 -> "1 كيلو ونصف". */
export function weightLabel(quantity: number): string {
  const whole = Math.floor(quantity + 1e-9);
  const fraction = round2(quantity - whole);
  const fractionName = ({ 0.25: "ربع", 0.5: "نصف", 0.75: "ثلاثة أرباع" } as Record<number, string>)[fraction];
  if (fraction !== 0 && !fractionName) return quantity < 1 ? `${Math.round(quantity * 1000)} جم` : `${quantity} كيلو`;
  if (!whole) return `${fractionName} كيلو`;
  if (!fraction) return `${whole} كيلو`;
  return `${whole} كيلو و${fractionName}`;
}

/** What to show for a quantity: a weight label for weighed products, the plain number otherwise (v29 `qLabel`). */
export const quantityLabel = (product: Weighable, quantity: number): string =>
  product.weighed ? weightLabel(quantity) : String(quantity);
