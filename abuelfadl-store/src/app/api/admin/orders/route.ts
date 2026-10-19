import { requireStaff } from "@/server/auth";
import { handle } from "@/server/http";
import { isOrderStatus, listOrders } from "@/server/orders";

/** GET /api/admin/orders?status=new&search=AF-00012 : newest first. */
export const GET = handle(async (request) => {
  await requireStaff();
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  return listOrders({ status: isOrderStatus(status) ? status : undefined, search: params.get("search") || undefined });
});
