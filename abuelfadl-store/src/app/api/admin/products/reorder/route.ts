import { requireAdmin } from "@/server/auth";
import { reorderCategory } from "@/server/catalog";
import { handle, readJson, refreshStore } from "@/server/http";

/** POST /api/admin/products/reorder : { categoryId, ids: number[] } (every product of the category, in the new order). */
export const POST = handle(async (request) => {
  await requireAdmin();
  const body = await readJson<{ categoryId?: unknown; ids?: unknown }>(request);
  await reorderCategory(String(body.categoryId ?? ""), body.ids);
  refreshStore();
  return { ok: true };
});
