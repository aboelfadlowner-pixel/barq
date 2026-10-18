import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { getSyncStatus } from "@/server/sync";

/** GET /api/admin/sync : price import log, sheet SKUs not used by any product, and how many products are linked. */
export const GET = handle(async () => {
  await requireAdmin();
  return getSyncStatus();
});
