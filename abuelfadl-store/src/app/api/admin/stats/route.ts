import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { getStats } from "@/server/orders";

/** GET /api/admin/stats : numbers for the dashboard home. */
export const GET = handle(async () => {
  await requireAdmin();
  return getStats();
});
