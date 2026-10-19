import { requireAdmin } from "@/server/auth";
import { bulkUpdateProducts, type BulkPatch } from "@/server/catalog";
import { handle, readJson, refreshStore } from "@/server/http";

/** POST /api/admin/products/bulk : { ids: number[], patch: { inStock?, bestseller?, categoryId?, discountPercent?, offerEnd?, offer? } } */
export const POST = handle(async (request) => {
  await requireAdmin();
  const body = await readJson<{ ids?: unknown; patch?: BulkPatch }>(request);
  const changed = await bulkUpdateProducts(body.ids, body.patch ?? {});
  refreshStore();
  return changed;
});
