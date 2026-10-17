import type { CartItem } from "./cart";

/** "card" exists in the v29 checkout as a disabled option; only "cash" can be selected. */
export type PaymentMethod = "cash" | "card";

export interface CustomerDetails {
  name: string;
  /** Egyptian mobile number, digits only, e.g. "01012345678". */
  phone: string;
  address: string;
  /** Optional delivery note. Empty string when none. */
  note: string;
}

/** What the checkout form produces. */
export interface OrderDraft {
  customer: CustomerDetails;
  items: CartItem[];
  /** Total in EGP. */
  total: number;
  paymentMethod: PaymentMethod;
}

/** A submitted order. */
export interface Order extends OrderDraft {
  /** Display number such as "AF-01234". */
  number: string;
}
