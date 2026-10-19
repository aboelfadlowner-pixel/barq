import { cairoToday } from "../lib/pricing";
import type { StoredOrder } from "../types/order";
import { read } from "./db";

const round2 = (value: number) => Math.round(value * 100) / 100;
const cairoDay = (iso: string) => cairoToday(new Date(iso));
const cairoHour = (iso: string) => Number(new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false })) % 24;

/** Products total of an order (older orders have no `subtotal`: no delivery fee then). */
const productsTotal = (order: StoredOrder) => order.subtotal ?? order.total - (order.deliveryFee ?? 0);

/** "YYYY-MM-DD" `n` days before `day` (calendar arithmetic in UTC, so no daylight-saving surprises). */
function shiftDay(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

/** Orders of the last `days` Cairo days, today included, without cancelled ones. */
export function ordersInRange(orders: StoredOrder[], days: number): StoredOrder[] {
  const from = shiftDay(cairoToday(), days - 1);
  return orders.filter((order) => order.status !== "cancelled" && cairoDay(order.createdAt) >= from);
}

export interface ProductSales {
  productId: number;
  name: string;
  weighed: boolean;
  /** Pieces, or kg for weighed products. */
  quantity: number;
  revenue: number;
  /** Number of orders that had it. */
  orders: number;
}

/** Sales report for the dashboard «التقارير» page. */
export async function getReport(days: number) {
  const { orders, products, categories } = await read();
  const inRange = ordersInRange(orders, days);
  const today = cairoToday();

  // Sales = products; delivery fees are reported on their own.
  const revenue = round2(inRange.reduce((sum, order) => sum + productsTotal(order), 0));
  const deliveryFees = round2(inRange.reduce((sum, order) => sum + (order.deliveryFee ?? 0), 0));
  const daily = Array.from({ length: days }, (_, i) => ({ day: shiftDay(today, days - 1 - i), orders: 0, revenue: 0 }));
  const dayIndex = new Map(daily.map((entry, i) => [entry.day, i]));
  const byHour = Array.from({ length: 24 }, () => 0);
  const productSales = new Map<number, ProductSales>();
  const categoryOf = new Map(products.map((product) => [product.id, product.categoryId]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const categorySales = new Map<string, number>();

  for (const order of inRange) {
    const entry = daily[dayIndex.get(cairoDay(order.createdAt)) ?? -1];
    if (entry) {
      entry.orders += 1;
      entry.revenue = round2(entry.revenue + productsTotal(order));
    }
    byHour[cairoHour(order.createdAt)] += 1;
    for (const line of order.lines) {
      const sales = productSales.get(line.productId) ?? { productId: line.productId, name: line.name, weighed: line.weighed, quantity: 0, revenue: 0, orders: 0 };
      sales.quantity = round2(sales.quantity + line.quantity);
      sales.revenue = round2(sales.revenue + line.lineTotal);
      sales.orders += 1;
      productSales.set(line.productId, sales);
      const category = categoryName.get(categoryOf.get(line.productId) ?? "") ?? "منتجات محذوفة";
      categorySales.set(category, round2((categorySales.get(category) ?? 0) + line.lineTotal));
    }
  }

  const ranked = [...productSales.values()];
  return {
    days,
    orders: inRange.length,
    revenue,
    averageOrder: inRange.length ? round2(revenue / inRange.length) : 0,
    deliveryFees,
    customers: new Set(inRange.map((order) => order.customer.phone)).size,
    daily,
    byHour,
    topByRevenue: [...ranked].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    topByOrders: [...ranked].sort((a, b) => b.orders - a.orders || b.revenue - a.revenue).slice(0, 10),
    byCategory: [...categorySales.entries()].map(([name, total]) => ({ name, revenue: total })).sort((a, b) => b.revenue - a.revenue),
  };
}

export type SalesReport = Awaited<ReturnType<typeof getReport>>;

export interface Customer {
  phone: string;
  /** Name and address from the latest order. */
  name: string;
  address: string;
  orders: number;
  total: number;
  firstOrder: string;
  lastOrder: string;
}

/** Customers built from the orders, one per mobile number (cancelled orders are not counted). */
export async function getCustomers(): Promise<Customer[]> {
  const { orders } = await read();
  const byPhone = new Map<string, Customer>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const current = byPhone.get(order.customer.phone);
    if (!current) {
      byPhone.set(order.customer.phone, {
        phone: order.customer.phone,
        name: order.customer.name,
        address: order.customer.address,
        orders: 1,
        total: order.total,
        firstOrder: order.createdAt,
        lastOrder: order.createdAt,
      });
      continue;
    }
    current.orders += 1;
    current.total = round2(current.total + order.total);
    if (order.createdAt >= current.lastOrder) {
      current.lastOrder = order.createdAt;
      current.name = order.customer.name;
      current.address = order.customer.address;
    }
    if (order.createdAt < current.firstOrder) current.firstOrder = order.createdAt;
  }
  return [...byPhone.values()].sort((a, b) => b.lastOrder.localeCompare(a.lastOrder));
}
