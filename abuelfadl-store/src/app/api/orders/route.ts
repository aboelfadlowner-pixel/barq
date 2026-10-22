import { NextResponse } from "next/server";
import { handle, readJson } from "@/server/http";
import { clientKey } from "@/server/loginGuard";
import { createOrder, type OrderRequest } from "@/server/orders";
import { assertWithinLimit } from "@/server/rateLimit";

/** Order attempts allowed from one address per hour: high, since mobile networks share addresses between customers. */
const ADDRESS_LIMIT = 30;

/**
 * POST /api/orders : places an order from the checkout form.
 * Body: { customer: { name, phone, address, note }, items: [{ productId, quantity }], paymentMethod: "cash" }.
 * Returns 201 with { number, total }. Prices and the total are computed by the server.
 * Sending the same order again returns the first one (see createOrder); too many attempts from one address get 429.
 */
export const POST = handle(async (request) => {
  await assertWithinLimit(`order:${clientKey(request)}`, ADDRESS_LIMIT, 60 * 60 * 1000, "طلبات كثيرة من نفس الشبكة. حاول مرة أخرى بعد قليل.");
  const order = await createOrder(await readJson<OrderRequest>(request));
  return NextResponse.json({ number: order.number, total: order.total }, { status: 201 });
});
