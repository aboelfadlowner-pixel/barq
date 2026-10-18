import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth";
import { createCategory, listCategories, listProducts, type CategoryInput } from "@/server/catalog";
import { handle, readJson, refreshStore } from "@/server/http";

/** GET /api/admin/categories : categories with their product counts. */
export const GET = handle(async () => {
  await requireAdmin();
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  return categories.map((category) => ({
    ...category,
    productCount: products.filter((product) => product.categoryId === category.id).length,
  }));
});

/** POST /api/admin/categories { id, name, art, tint, imageUrl? } */
export const POST = handle(async (request) => {
  await requireAdmin();
  const category = await createCategory(await readJson<CategoryInput>(request));
  refreshStore();
  return NextResponse.json(category, { status: 201 });
});
