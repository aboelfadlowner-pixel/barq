import { httpOrderService } from "./http/orders";
import type { OrderService } from "./contracts";

/**
 * Services for client components (they run in the browser and talk to `/api`).
 * `mock/orders.ts` (simulated, nothing sent) can be swapped back here for offline UI work.
 */
export const orderService: OrderService = httpOrderService;
