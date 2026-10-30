import { OrderNotDeliveredError } from "@/lib/orderErrors";
import type { OrderService } from "../contracts";

/**
 * Sends the order to `POST /api/orders`. The server checks it, recomputes the total from its own prices,
 * and returns the order number. Rejects with an Error holding the server's Arabic message, or with an
 * `OrderNotDeliveredError` when the store could not be reached or failed (no connection, 5xx).
 */
export const httpOrderService: OrderService = {
  async submitOrder(draft) {
    let response: Response;
    try {
      response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
    } catch {
      throw new OrderNotDeliveredError("تعذّر الاتصال بالمتجر الآن.");
    }
    const body = (await response.json().catch(() => ({}))) as { number?: string; total?: number; error?: string };
    if (response.status >= 500) throw new OrderNotDeliveredError(body.error || "حدث عطل مؤقت في المتجر.");
    if (!response.ok || !body.number) throw new Error(body.error || "تعذّر إرسال الطلب، حاول مرة أخرى.");
    return { ...draft, number: body.number, total: body.total ?? draft.total };
  },
};
