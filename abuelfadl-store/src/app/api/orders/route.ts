import { NextResponse } from "next/server";
import { handle, readJson } from "@/server/http";
import { createOrder, type OrderRequest } from "@/server/orders";

/**
 * POST /api/orders : places an order from the checkout form.
 * Body: { customer: { name, phone, address, note }, items: [{ productId, quantity }], paymentMethod: "cash" }.
 * Returns 201 with { number, total }. Prices and the total are computed by the server.
 */
export const POST = handle(async (request) => {
  const order = await createOrder(await readJson<OrderRequest>(request));
  return NextResponse.json({ number: order.number, total: order.total }, { status: 201 });
});
