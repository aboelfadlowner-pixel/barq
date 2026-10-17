import type { OrderService } from "../contracts";

/**
 * Sends the order to `POST /api/orders`. The server checks it, recomputes the total from its own prices,
 * and returns the order number. Rejects with an Error holding the server's Arabic message.
 */
export const httpOrderService: OrderService = {
  async submitOrder(draft) {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = (await response.json().catch(() => ({}))) as { number?: string; total?: number; error?: string };
    if (!response.ok || !body.number) throw new Error(body.error || "تعذّر إرسال الطلب، حاول مرة أخرى.");
    return { ...draft, number: body.number, total: body.total ?? draft.total };
  },
};
