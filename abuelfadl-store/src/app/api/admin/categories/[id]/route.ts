import { requireAdmin } from "@/server/auth";
import { deleteCategory, updateCategory, type CategoryInput } from "@/server/catalog";
import { handle, readJson, refreshStore } from "@/server/http";

type Context = RouteContext<"/api/admin/categories/[id]">;

/** PATCH : { name?, art?, tint?, imageUrl?, position? } ("" removes the photo) */
export const PATCH = handle(async (request, { params }: Context) => {
  await requireAdmin();
  const category = await updateCategory((await params).id, await readJson<CategoryInput>(request));
  refreshStore();
  return category;
});

/** DELETE : only for categories without products. */
export const DELETE = handle(async (_request, { params }: Context) => {
  await requireAdmin();
  await deleteCategory((await params).id);
  refreshStore();
});
