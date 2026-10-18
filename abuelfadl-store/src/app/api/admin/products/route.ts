import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth";
import { createProduct, listProducts, type ProductInput } from "@/server/catalog";
import { handle, readJson, refreshStore } from "@/server/http";

/** GET /api/admin/products?category=&search=&stock=in|out&linked=yes|no */
export const GET = handle(async (request) => {
  await requireAdmin();
  const params = new URL(request.url).searchParams;
  const stock = params.get("stock");
  return listProducts({
    categoryId: params.get("category") || undefined,
    search: params.get("search") || undefined,
    inStock: stock === "in" ? true : stock === "out" ? false : undefined,
    linked: params.get("linked") === "yes" ? true : params.get("linked") === "no" ? false : undefined,
  });
});

/** POST /api/admin/products : creates a product, returns it with its new id. */
export const POST = handle(async (request) => {
  await requireAdmin();
  const product = await createProduct(await readJson<ProductInput>(request));
  refreshStore();
  return NextResponse.json(product, { status: 201 });
});
