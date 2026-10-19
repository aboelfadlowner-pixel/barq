import { requireStaff } from "@/server/auth";
import { ApiError, notFound } from "@/server/errors";
import { handle, parseId, readJson } from "@/server/http";
import { getOrder, updateOrder } from "@/server/orders";

type Context = RouteContext<"/api/admin/orders/[id]">;

export const GET = handle(async (_request, { params }: Context) => {
  await requireStaff();
  const order = await getOrder(parseId((await params).id, "الطلب"));
  if (!order) throw notFound("الطلب");
  return order;
});

/** PATCH : { status?, staffNote? }. The call center may change the internal note only. */
export const PATCH = handle(async (request, { params }: Context) => {
  const role = await requireStaff();
  const body = await readJson<{ status?: unknown; staffNote?: unknown }>(request);
  if (role !== "admin" && body.status !== undefined) throw new ApiError(403, "تغيير حالة الطلب للأدمن بس");
  return updateOrder(parseId((await params).id, "الطلب"), body);
});
