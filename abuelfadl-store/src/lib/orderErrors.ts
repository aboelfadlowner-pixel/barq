/**
 * Raised when an order could not reach the store at all (no connection, server error), as opposed to an order the
 * server refused with a reason (out of stock, minimum order...). The checkout then offers to send it on WhatsApp.
 */
export class OrderNotDeliveredError extends Error {
  readonly notDelivered = true;
}

export const isOrderNotDelivered = (error: unknown): error is OrderNotDeliveredError =>
  typeof error === "object" && error !== null && (error as { notDelivered?: unknown }).notDelivered === true;
