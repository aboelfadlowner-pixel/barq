import { isWithinHours, outsideHoursMessage } from "../lib/hours";
import { withDefaults } from "../lib/settings";
import { cairoToday, sellingPrice } from "../lib/pricing";
import { isAllowedQuantity } from "../lib/quantity";
import type { Role } from "../types/auth";
import { ORDER_STATUSES, type OrderLine, type OrderStatus, type StoredOrder } from "../types/order";
import { mutate, read } from "./db";
import { ApiError, assertValid, notFound } from "./errors";

/** Egyptian mobile number: strips spaces and dashes and turns Arabic-Indic digits into 0-9 (same rule as the checkout form). */
const cleanPhone = (value: string) =>
  value.replace(/[\s-]/g, "").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Products total of an order (older orders have no `subtotal`: no delivery fee then). */
const productsOf = (order: StoredOrder) => order.subtotal ?? order.total - (order.deliveryFee ?? 0);

/** What the public `POST /api/orders` accepts (same shape as `OrderDraft`; `total` is ignored). */
export interface OrderRequest {
  customer?: { name?: unknown; phone?: unknown; address?: unknown; note?: unknown };
  items?: { productId?: unknown; quantity?: unknown }[];
  areaId?: unknown;
  paymentMethod?: unknown;
}

/**
 * Places an order. Everything the browser sends is checked again here:
 * customer fields use the checkout form rules, prices come from the catalog (never from the browser),
 * unavailable or unknown products are refused, the minimum order (dashboard settings) applies to the server total,
 * and nothing is accepted while orders are paused.
 */
export function createOrder(request: OrderRequest): Promise<StoredOrder> {
  return mutate((data) => {
    const settings = withDefaults(data.settings);
    if (!settings.ordersOpen) throw new ApiError(409, settings.closedMessage);
    if (!isWithinHours(settings.orderHours)) throw new ApiError(409, outsideHoursMessage(settings.orderHours));
    const fields: Record<string, string> = {};
    const name = String(request.customer?.name ?? "").trim();
    const phone = cleanPhone(String(request.customer?.phone ?? ""));
    const address = String(request.customer?.address ?? "").trim();
    const note = String(request.customer?.note ?? "").trim().slice(0, 500);
    if (name.length < 3 || name.length > 80) fields.name = "اكتب اسمك من فضلك";
    if (!/^01[0125][0-9]{8}$/.test(phone)) fields.phone = "اكتب رقم موبايل مصريًا صحيحًا من 11 رقمًا";
    if (address.length < 8 || address.length > 300) fields.address = "اكتب العنوان بالتفصيل (الشارع والعمارة والدور)";
    if (request.paymentMethod !== undefined && request.paymentMethod !== "cash") fields.paymentMethod = "الدفع نقدًا عند الاستلام فقط حاليًا";
    // Delivery area: required while the settings have active areas; its fee comes from the settings, never the browser.
    const areas = settings.deliveryAreas.filter((area) => area.active);
    const area = areas.find((a) => a.id === request.areaId);
    if (areas.length && !area) fields.areaId = "اختر منطقة التوصيل";
    assertValid(fields);

    const items = Array.isArray(request.items) ? request.items : [];
    if (!items.length || items.length > 200) throw new ApiError(400, "السلة فارغة");

    const byId = new Map(data.products.map((product) => [product.id, product]));
    const displayOnly = new Set(data.categories.filter((category) => category.displayOnly).map((category) => category.id));
    const today = cairoToday();
    const lines: OrderLine[] = [];
    for (const item of items) {
      const product = byId.get(Number(item.productId));
      if (!product || product.priceMissing) throw new ApiError(409, "أحد المنتجات في السلة لم يعد متوفرًا. حدّث الصفحة وحاول مرة أخرى.");
      if (displayOnly.has(product.categoryId)) throw new ApiError(409, `«${product.name}» للعرض فقط ولا يُطلب من الموقع. احذفه من السلة وأكمل طلبك.`);
      if (!product.inStock) throw new ApiError(409, `«${product.name}» غير متوفر حاليًا. احذفه من السلة وأكمل طلبك.`);
      const quantity = Number(item.quantity);
      // Pieces: 1 to 20. Weighed: from the product's minimum, in its steps, up to its maximum (dashboard settings).
      if (!isAllowedQuantity(product, quantity)) {
        throw new ApiError(400, `الكمية غير صحيحة لـ «${product.name}»`);
      }
      const price = sellingPrice(product, today); // the offer price while an offer is on
      lines.push({
        productId: product.id,
        name: product.name,
        price,
        weighed: product.weighed,
        quantity,
        lineTotal: round2(price * quantity),
      });
    }
    const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    if (subtotal < settings.minOrder) throw new ApiError(400, `الحد الأدنى للطلب ${settings.minOrder} جنيه`);
    const deliveryFee = area?.fee ?? 0;

    const now = new Date().toISOString();
    data.orderSeq += 1;
    const order: StoredOrder = {
      id: data.orderSeq,
      number: `AF-${String(data.orderSeq).padStart(5, "0")}`,
      customer: { name, phone, address, note },
      lines,
      subtotal,
      ...(area ? { deliveryArea: area.name, deliveryFee } : {}),
      total: round2(subtotal + deliveryFee),
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
/** Dashboard home numbers. The call center gets the order counts only (no sales, products or price sync). */
export interface DashboardStats {
  role: Role;
  todayOrders: number;
  totalOrders: number;
  latestOrders: StoredOrder[];
  todayRevenue?: number;
  averageOrder?: number;
  byStatus?: Record<OrderStatus, number>;
  products?: number;
  outOfStock?: number;
  unlinkedProducts?: number;
  lastSync?: string | null;
}

export async function getStats(role: Role): Promise<DashboardStats> {
  const { orders, products, syncLog = [] } = await read();
  const cairoDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  const today = cairoDay(new Date().toISOString());
  const todays = orders.filter((order) => cairoDay(order.createdAt) === today && order.status !== "cancelled");
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<OrderStatus, number>;
  for (const order of orders) byStatus[order.status] += 1;
  const counts = { role, todayOrders: todays.length, totalOrders: orders.length, latestOrders: orders.slice(-5).reverse() };
  if (role !== "admin") return counts;
  return {
    ...counts,
    // Sales = products (delivery fees are not sales).
    todayRevenue: round2(todays.reduce((sum, order) => sum + productsOf(order), 0)),
    averageOrder: todays.length ? round2(todays.reduce((sum, order) => sum + productsOf(order), 0) / todays.length) : 0,
    byStatus,
    products: products.length,
    outOfStock: products.filter((product) => !product.inStock).length,
    unlinkedProducts: products.filter((product) => !product.sku).length,
    lastSync: syncLog.at(-1)?.at ?? null,
  };
}
