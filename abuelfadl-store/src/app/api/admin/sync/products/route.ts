import { requireAdmin } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { handle, readJson, refreshStore } from "@/server/http";
import { applyPrices, readProductsSheet } from "@/server/sync";

/**
 * POST /api/admin/sync/products { csv, fileName? } : imports the Foodics products sheet and updates prices by SKU.
 * Temporary manual upload; the Supabase sync will call the same `applyPrices`.
 */
export const POST = handle(async (request) => {
  await requireAdmin();
  const { csv, fileName } = await readJson<{ csv?: unknown; fileName?: unknown }>(request);
  if (typeof csv !== "string" || !csv.trim()) throw new ApiError(400, "اختر ملف الشيت أولًا");
  const run = await applyPrices(readProductsSheet(csv), `رفع يدوي${typeof fileName === "string" && fileName ? `: ${fileName.slice(0, 80)}` : ""}`);
  if (run.changes.length) refreshStore();
  return run;
});
