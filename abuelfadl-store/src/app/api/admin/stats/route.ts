import { requireStaff } from "@/server/auth";
import { handle } from "@/server/http";
import { getStats } from "@/server/orders";

/** GET /api/admin/stats : numbers for the dashboard home (order counts only for the call center). */
export const GET = handle(async () => {
  return getStats(await requireStaff());
});
