import { handle } from "@/server/http";
import { listProducts } from "@/server/catalog";

/** GET /api/products?category=dairy&search=جبنة : products in catalog order. */
export const GET = handle(async (request) => {
  const params = new URL(request.url).searchParams;
  return listProducts({ categoryId: params.get("category") || undefined, search: params.get("search") || undefined, forSale: true });
});
