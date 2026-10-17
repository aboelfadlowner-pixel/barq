import { requireAdmin } from "@/server/auth";
import { deleteProduct, getProduct, updateProduct, type ProductInput } from "@/server/catalog";
import { notFound } from "@/server/errors";
import { handle, parseId, readJson, refreshStore } from "@/server/http";

type Context = RouteContext<"/api/admin/products/[id]">;

export const GET = handle(async (_request, { params }: Context) => {
  await requireAdmin();
  const product = await getProduct(parseId((await params).id, "المنتج"));
  if (!product) throw notFound("المنتج");
  return product;
});

/** PATCH : partial update, e.g. { price: 120 } or { inStock: false }. */
export const PATCH = handle(async (request, { params }: Context) => {
  await requireAdmin();
  const product = await updateProduct(parseId((await params).id, "المنتج"), await readJson<ProductInput>(request));
  refreshStore();
  return product;
});

export const DELETE = handle(async (_request, { params }: Context) => {
  await requireAdmin();
  await deleteProduct(parseId((await params).id, "المنتج"));
  refreshStore();
});
