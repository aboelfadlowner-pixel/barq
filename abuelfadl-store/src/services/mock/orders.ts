import type { OrderService } from "../contracts";

/**
 * Simulated order submission, same as v29: nothing is sent or stored anywhere.
 * The order number format ("AF-" + 5 digits) matches v29.
 * Replace with a real implementation once an order API exists.
 */
export const mockOrderService: OrderService = {
  async submitOrder(draft) {
    return {
      ...draft,
      number: `AF-${String(Date.now() % 100000).padStart(5, "0")}`,
    };
  },
};
