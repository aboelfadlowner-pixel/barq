import { requireAdmin } from "@/server/auth";
import { handle } from "@/server/http";
import { getReport } from "@/server/reports";

/** GET /api/admin/reports?days=7|30|90 : sales report for the last N days (default 30). */
export const GET = handle(async (request) => {
  await requireAdmin();
  const days = Number(new URL(request.url).searchParams.get("days"));
  return getReport([1, 7, 30, 90, 365].includes(days) ? days : 30);
});
