import { requireAdmin } from "@/server/auth";
import { handle, readJson, refreshStore } from "@/server/http";
import { getSettings, updateSettings } from "@/server/settings";

/** GET /api/admin/settings */
export const GET = handle(async () => {
  await requireAdmin();
  return getSettings();
});

/** PATCH /api/admin/settings : { minOrder?, notice?, whatsapp?, ordersOpen?, closedMessage? } */
export const PATCH = handle(async (request) => {
  await requireAdmin();
  const settings = await updateSettings(await readJson(request));
  refreshStore();
  return settings;
});
