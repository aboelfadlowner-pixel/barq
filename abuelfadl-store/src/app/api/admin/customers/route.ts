import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { getCustomers } from "@/server/reports";

/** GET /api/admin/customers : one row per mobile number, latest order first. */
export const GET = handle(async () => {
  await requireAdmin();
  return getCustomers();
});
