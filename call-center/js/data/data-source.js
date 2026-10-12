/* =====================================================================
 *  DATA SOURCE ADAPTER — currently MOCK / in-memory only.
 *
 *  The UI reads and writes data ONLY through the functions exported here.
 *  To connect the real source later (after verification and approval),
 *  re-implement these functions with the same names and return shapes.
 *  No component should need to change.
 *
 *  Nothing in this file talks to a network, a database or any service.
 *  "Created" orders live in browser memory and disappear on refresh.
 * ===================================================================== */
import * as mock from './mock-data.js';
import { normalizePhone, isSameDay } from '../utils/format.js';

export const IS_MOCK = true;

const clone = (v) => structuredClone(v);
const resolve = (v) => Promise.resolve(clone(v));

// In-memory working copies (reset on every page load).
const customers = clone(mock.customers);
const orders = mock.buildSampleOrders();
let nextOrderNo = 1001 + orders.length;

/* ---------- Catalog ---------- */
export const getCategories    = () => resolve(mock.categories);
export const getProducts      = () => resolve(mock.products);
export const getAreas         = () => resolve(mock.areas);
export const getOrderStatuses = () => resolve(mock.orderStatuses);
export const getCurrentEmployee = () => resolve(mock.demoEmployee);

/* ---------- Customers ---------- */
function lastOrderAt(customerId) {
  const o = orders.filter((x) => x.customer.id === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return o ? o.createdAt : null;
}

/* Partial match on normalized phone digits (min 3 digits). */
export function findCustomersByPhone(query) {
  const q = normalizePhone(query);
  if (q.length < 3) return resolve([]);
  const found = customers
    .filter((c) => c.phones.some((ph) => normalizePhone(ph).includes(q)))
    .map((c) => ({ ...c, lastOrderAt: lastOrderAt(c.id) }));
  return resolve(found);
}

/* Orders placed today for this phone number (duplicate-order warning). */
export function findTodayOrdersByPhone(phone) {
  const q = normalizePhone(phone);
  const now = new Date();
  const list = orders
    .filter((o) => normalizePhone(o.customer.phone) === q && isSameDay(o.createdAt, now) && o.status !== 'cancelled')
    .map((o) => ({ id: o.id, number: o.number, createdAt: o.createdAt }));
  return resolve(list);
}

export function phoneBelongsToCustomer(phone) {
  const q = normalizePhone(phone);
  const c = customers.find((x) => x.phones.some((ph) => normalizePhone(ph) === q));
  return resolve(c ? { id: c.id, name: c.name } : null);
}

/* ---------- Orders ---------- */
export const listOrders = () =>
  resolve([...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

export const getOrder = (id) => resolve(orders.find((o) => o.id === id) ?? null);

/* DEMO ONLY — keeps the order in memory. Does not send or save anything. */
export function createDemoOrder(draft) {
  const { source, cart, customer, address, orderNote, employee } = draft;
  const area = mock.areas.find((a) => a.id === address.areaId);
  if (!area) return Promise.reject(new Error('منطقة التوصيل غير موجودة'));

  let cust = customer.id ? customers.find((c) => c.id === customer.id) : null;
  if (!cust) {
    cust = { id: `c-demo-${Date.now()}`, name: customer.name, phones: [customer.phone, customer.phone2].filter(Boolean), addresses: [] };
    customers.push(cust);
  }

  const { isNew, ...addrFields } = address;
  let addrId = address.id;
  if (isNew || !addrId) {
    addrId = `${cust.id}-a${Date.now()}`;
    cust.addresses.push({ ...addrFields, id: addrId });
  }

  const now = new Date().toISOString();
  const no = nextOrderNo++;
  const order = {
    id: `o-${no}`,
    number: `DEMO-${no}`,
    createdAt: now,
    type: 'delivery',
    source,
    customer: { id: cust.id, name: cust.name, phone: customer.phone },
    address: { ...addrFields, id: addrId, areaName: area.name },
    deliveryFee: area.fee,
    items: cart.map(({ lineId, ...item }) => item),
    note: orderNote || '',
    status: mock.orderStatuses[0].id,
    statusHistory: [{ status: mock.orderStatuses[0].id, at: now }],
    employee: employee?.name ?? mock.demoEmployee.name,
    isDemo: true,
  };
  orders.push(order);
  return resolve(order);
}
