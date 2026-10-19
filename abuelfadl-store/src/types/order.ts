import type { CartItem } from "./cart";
import type { ProductId } from "./product";

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
  /** Delivery area picked at checkout (`DeliveryArea.id` from the settings). */
  areaId?: string;
  items: CartItem[];
  /** Total in EGP, as shown in the browser. The server recomputes it from its own prices. */
  total: number;
  paymentMethod: PaymentMethod;
}

/** A submitted order. */
export interface Order extends OrderDraft {
  /** Display number such as "AF-01234". */
  number: string;
}

/** Order lifecycle, managed from the admin dashboard. */
export type OrderStatus = "new" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = ["new", "preparing", "out_for_delivery", "delivered", "cancelled"];

/** Arabic labels for the admin dashboard. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "جديد",
  preparing: "بيتحضّر",
  out_for_delivery: "خرج للتوصيل",
  delivered: "اتسلّم",
  cancelled: "ملغي",
};

/** One order line as saved by the server: name and price are copied so later catalog edits do not change old orders. */
export interface OrderLine {
  productId: ProductId;
  name: string;
  /** Unit price in EGP at order time (per kg for weighed products). */
  price: number;
  weighed: boolean;
  quantity: number;
  /** price × quantity, rounded to 2 decimals. */
  lineTotal: number;
}

/** An order as stored by the backend and shown in the admin dashboard. */
export interface StoredOrder {
  /** Internal id (sequence number). */
  id: number;
  number: string;
  customer: CustomerDetails;
  lines: OrderLine[];
  /** Products only, in EGP. Missing on orders placed before delivery fees existed (then it equals `total`). */
  subtotal?: number;
  /** Delivery area name and fee at order time (copied, so later settings changes do not alter the order). */
  deliveryArea?: string;
  deliveryFee?: number;
  /** Server-computed total in EGP: products + delivery fee. */
  total: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Internal note written by the staff (not shown to the customer). */
  staffNote: string;
}
