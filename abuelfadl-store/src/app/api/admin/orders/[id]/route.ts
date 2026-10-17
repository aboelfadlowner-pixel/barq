import { requireAdmin } from "@/server/auth";
import { notFound } from "@/server/errors";
import { handle, parseId, readJson } from "@/server/http";
import { getOrder, updateOrder } from "@/server/orders";

type Context = RouteContext<"/api/admin/orders/[id]">;

export const GET = handle(async (_request, { params }: Context) => {
  await requireAdmin();
  const order = await getOrder(parseId((await params).id, "الطلب"));
  if (!order) throw notFound("الطلب");
  return order;
});

/** PATCH : { status?, staffNote? } */
export const PATCH = handle(async (request, { params }: Context) => {
  await requireAdmin();
  return updateOrder(parseId((await params).id, "الطلب"), await readJson(request));
});
