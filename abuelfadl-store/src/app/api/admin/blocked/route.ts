import { requireAdmin, requireStaff } from "@/server/auth";
import { blockPhone, listBlocked, unblockPhone } from "@/server/blocked";
import { handle, readJson } from "@/server/http";

/** GET /api/admin/blocked : blocked numbers, newest first (manager and call center). */
export const GET = handle(async () => {
  await requireStaff();
  return listBlocked();
});

/** POST { phone, reason? } : blocks a number (manager only). Blocking it again keeps the first entry. */
export const POST = handle(async (request) => {
  await requireAdmin();
  return blockPhone(await readJson<{ phone?: unknown; reason?: unknown }>(request));
});

/** DELETE ?phone=01012345678 : unblocks a number (manager only). */
export const DELETE = handle(async (request) => {
  await requireAdmin();
  return unblockPhone(new URL(request.url).searchParams.get("phone"));
});
