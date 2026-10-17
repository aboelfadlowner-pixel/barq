import { handle } from "@/server/http";
import { listCategories } from "@/server/catalog";

/** GET /api/categories: all categories in display order. */
export const GET = handle(async () => listCategories());
