import { MIN_ORDER } from "../lib/constants";
import { ORDER_STATUSES, type OrderLine, type OrderStatus, type StoredOrder } from "../types/order";
import { mutate, read } from "./db";
import { ApiError, assertValid, notFound } from "./errors";

/** Egyptian mobile number: strips spaces and dashes and turns Arabic-Indic digits into 0-9 (same rule as the checkout form). */
const cleanPhone = (value: string) =>
  value.replace(/[\s-]/g, "").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));

const round2 = (value: number) => Math.round(value * 100) / 100;

/** What the public `POST /api/orders` accepts (same shape as `OrderDraft`; `total` is ignored). */
export interface OrderRequest {
  customer?: { name?: unknown; phone?: unknown; address?: unknown; note?: unknown };
  items?: { productId?: unknown; quantity?: unknown }[];
  paymentMethod?: unknown;
}

/**
 * Places an order. Everything the browser sends is checked again here:
 * customer fields use the checkout form rules, prices come from the catalog (never from the browser),
 * unavailable or unknown products are refused, and the minimum order applies to the server total.
 */
export function createOrder(request: OrderRequest): Promise<StoredOrder> {
  return mutate((data) => {
    const fields: Record<string, string> = {};
    const name = String(request.customer?.name ?? "").trim();
    const phone = cleanPhone(String(request.customer?.phone ?? ""));
    const address = String(request.customer?.address ?? "").trim();
    const note = String(request.customer?.note ?? "").trim().slice(0, 500);
    if (name.length < 3 || name.length > 80) fields.name = "اكتب اسمك من فضلك";
    if (!/^01[0125][0-9]{8}$/.test(phone)) fields.phone = "اكتب رقم موبايل مصري صحيح من 11 رقم";
    if (address.length < 8 || address.length > 300) fields.address = "اكتب العنوان بالتفصيل (الشارع والعمارة والدور)";
    if (request.paymentMethod !== undefined && request.paymentMethod !== "cash") fields.paymentMethod = "الدفع كاش عند الاستلام فقط حاليًا";
    assertValid(fields);

    const items = Array.isArray(request.items) ? request.items : [];
    if (!items.length || items.length > 200) throw new ApiError(400, "السلة فاضية");

    const byId = new Map(data.products.map((product) => [product.id, product]));
    const lines: OrderLine[] = [];
    for (const item of items) {
      const product = byId.get(Number(item.productId));
      if (!product) throw new ApiError(409, "فيه منتج في السلة مبقاش موجود. حدّث الصفحة وجرّب تاني.");
      if (!product.inStock) throw new ApiError(409, `«${product.name}» خلص حاليًا. شيله من السلة وكمّل.`);
      const quantity = Number(item.quantity);
      const step = product.weighed ? (product.weightStep ?? 0.25) : 1;
      // Quantity must be a positive multiple of the step (pieces, or kg in steps of e.g. 0.25).
      const steps = quantity / step;
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100 || Math.abs(steps - Math.round(steps)) > 1e-9) {
        throw new ApiError(400, `الكمية غير صحيحة لـ «${product.name}»`);
      }
      lines.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        weighed: product.weighed,
        quantity,
        lineTotal: round2(product.price * quantity),
      });
    }
    const total = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    if (total < MIN_ORDER) throw new ApiError(400, `الحد الأدنى للطلب ${MIN_ORDER} جنيه`);

    const now = new Date().toISOString();
    data.orderSeq += 1;
    const order: StoredOrder = {
      id: data.orderSeq,
      number: `AF-${String(data.orderSeq).padStart(5, "0")}`,
      customer: { name, phone, address, note },
      lines,
      total,
      paymentMethod: "cash",
      status: "new",
      createdAt: now,
      updatedAt: now,
      staffNote: "",
    };
    data.orders.push(order);
    return order;
  });
}

export interface OrderListQuery {
  status?: OrderStatus;
  /** Matches order number, customer name or phone. */
  search?: string;
}

/** Orders, newest first. */
export async function listOrders(query: OrderListQuery = {}): Promise<StoredOrder[]> {
  const search = query.search?.trim().toLowerCase() ?? "";
  return (await read()).orders
    .filter((order) => {
      if (query.status && order.status !== query.status) return false;
      if (!search) return true;
      return `${order.number} ${order.customer.name} ${order.customer.phone}`.toLowerCase().includes(search);
    })
    .reverse();
}

export async function getOrder(id: number): Promise<StoredOrder | null> {
  return (await read()).orders.find((order) => order.id === id) ?? null;
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (ORDER_STATUSES as unknown[]).includes(value);
}

/** Staff updates: status and/or internal note. */
export function updateOrder(id: number, input: { status?: unknown; staffNote?: unknown }): Promise<StoredOrder> {
  return mutate((data) => {
    const order = data.orders.find((o) => o.id === id);
    if (!order) throw notFound("الطلب");
    if (input.status !== undefined) {
      if (!isOrderStatus(input.status)) throw new ApiError(400, "حالة غير معروفة");
      order.status = input.status;
    }
    if (input.staffNote !== undefined) order.staffNote = String(input.staffNote).trim().slice(0, 1000);
    order.updatedAt = new Date().toISOString();
    return order;
  });
}

/** Numbers for the dashboard home. "Today" is the Cairo calendar day. */
export async function getStats() {
  const { orders, products } = await read();
  const cairoDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  const today = cairoDay(new Date().toISOString());
  const todays = orders.filter((order) => cairoDay(order.createdAt) === today && order.status !== "cancelled");
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>;
  for (const order of orders) byStatus[order.status] += 1;
  return {
    todayOrders: todays.length,
    todayRevenue: round2(todays.reduce((sum, order) => sum + order.total, 0)),
    averageOrder: todays.length ? round2(todays.reduce((sum, order) => sum + order.total, 0) / todays.length) : 0,
    byStatus,
    totalOrders: orders.length,
    products: products.length,
    outOfStock: products.filter((product) => !product.inStock).length,
    latestOrders: orders.slice(-5).reverse(),
  };
}

export type DashboardStats = Awaited<ReturnType<typeof getStats>>;
