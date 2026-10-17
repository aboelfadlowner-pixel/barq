import { handle, parseId } from "@/server/http";
import { getProduct } from "@/server/catalog";
import { notFound } from "@/server/errors";

/** GET /api/products/13221 */
export const GET = handle(async (_request, { params }: RouteContext<"/api/products/[id]">) => {
  const product = await getProduct(parseId((await params).id, "المنتج"));
  if (!product) throw notFound("المنتج");
  return product;
});
