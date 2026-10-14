/* =====================================================================
 *  DEMO DATA SOURCE (DATA_MODE = 'mock') — used through data-source.js.
 *
 *  Nothing in this file talks to a network, a database or any service.
 *  "Created" orders live in browser memory and disappear on refresh.
 *  supabase-source.js exports the same functions with the same shapes.
 * ===================================================================== */
import * as mock from './mock-data.js';
import { normalizePhone, isSameDay } from '../utils/format.js';

const clone = (v) => structuredClone(v);
const resolve = (v) => Promise.resolve(clone(v));

// In-memory working copies (reset on every page load).
const customers = clone(mock.customers);
const areas = clone(mock.areas);
const agents = clone(mock.agents);
const orders = mock.buildSampleOrders();
let nextOrderNo = 1001 + orders.length;

/* ---------- Catalog ---------- */
export const getProducts      = () => resolve(mock.products);
export const getCategories    = () => resolve(mock.categories);
export const getAreas         = () => resolve(areas);   // includes inactive areas
export const getOrderStatuses = () => resolve(mock.orderStatuses);
export const syncSaleUnits = () => Promise.resolve({ status: 'skipped' });

/* ---------- Employee names ---------- */
export const getAgents = () => resolve(agents);
export function saveAgent({ id = null, name, active = true }) {
  const clean = String(name ?? '').trim();
  if (!clean || clean.length > 40) return Promise.reject(new Error('اكتب الاسم (بحد أقصى 40 حرف)'));
  const key = clean.toLowerCase();
  if (agents.some((a) => a.id !== id && a.name.trim().toLowerCase() === key)) {
    return Promise.reject(new Error('الاسم ده موجود بالفعل في القايمة'));
  }
  if (id) {
    const a = agents.find((x) => x.id === id);
    if (!a) return Promise.reject(new Error('الاسم غير موجود'));
    Object.assign(a, { name: clean, active: !!active });
    return resolve(a);
  }
  const created = { id: `ag-${Date.now()}`, name: clean, active: !!active };
  agents.push(created);
  return resolve(created);
}

/* ---------- Account (the demo is always signed in) ---------- */
const demoRole = new URLSearchParams(location.search).get('role');
const demoAccount = { ...mock.account, role: ['admin', 'call_center', 'prep'].includes(demoRole) ? demoRole : 'admin' };
export const getAccount = () => resolve(demoAccount);
export const signIn = () => resolve(demoAccount);

const staff = clone(mock.staff);
export const listStaff = () => resolve(staff);
export function setStaff({ id, role, active }) {
  if (id === demoAccount.id) return Promise.reject(new Error('مش هتقدر تغيّر صلاحية أكونتك إنت'));
  const s = staff.find((x) => x.id === id);
  if (!s) return Promise.reject(new Error('الأكونت غير موجود'));
  Object.assign(s, { role, active });
  return Promise.resolve(true);
}
export const signOut = () => Promise.resolve();
export const signUp = () => Promise.resolve({ needsConfirmation: false });
export const joinWithCode = () => resolve(demoAccount);
let demoCodeAt = new Date().toISOString();
export const setSignupCode = (code) => (String(code || '').trim().length < 8
  ? Promise.reject(new Error('الكود لازم يكون من 8 لـ 40 حرف/رقم'))
  : Promise.resolve((demoCodeAt = new Date().toISOString())));
export const getSignupCodeStatus = () => Promise.resolve({ isSet: true, updatedAt: demoCodeAt });

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

/* Customers whose main or extra number equals this full number (new-order dialog). */
export function findCustomersByExactPhone(phone) {
  const q = normalizePhone(phone);
  const found = customers
    .filter((c) => c.phones.some((ph) => normalizePhone(ph) === q))
    .map((c) => ({ ...c, lastOrderAt: lastOrderAt(c.id) }));
  return resolve(found);
}

/* Latest orders of one customer ("عرض الطلبات الأخيرة"). */
export const listCustomerOrders = (customerId, limit = 5) =>
  resolve(orders.filter((o) => o.customer.id === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit));

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
export function createOrder(draft) {
  const { cart, customer, address, orderNote, agent } = draft;
  if (!agent || !agents.some((a) => a.id === agent.id && a.active)) {
    return Promise.reject(new Error('اختار اسمك من قايمة الموظفين الأول'));
  }
  const area = areas.find((a) => a.id === address.areaId);
  if (!area || !area.active) return Promise.reject(new Error('منطقة التوصيل غير متاحة'));

  let cust = customer.id ? customers.find((c) => c.id === customer.id) : null;
  if (!cust) {
    cust = { id: `c-demo-${Date.now()}`, name: customer.name, phones: [customer.phone, customer.phone2].filter(Boolean), addresses: [] };
    customers.push(cust);
  }

  // DEMO: an extra number typed in the dialog is added to the customer.
  if (customer.phone2 && !cust.phones.includes(customer.phone2)) cust.phones.push(customer.phone2);

  const { isNew, edited, ...addrFields } = address;
  let addrId = address.id;
  if (isNew || !addrId) {
    addrId = `${cust.id}-a${Date.now()}`;
    cust.addresses.push({ ...addrFields, id: addrId });
  } else if (edited) {
    const saved = cust.addresses.find((a) => a.id === addrId);
    if (saved) Object.assign(saved, addrFields);   // DEMO: edits to a saved address
  }

  const now = new Date().toISOString();
  const no = nextOrderNo++;
  const order = {
    id: `o-${no}`,
    number: `DEMO-${no}`,
    createdAt: now,
    type: 'delivery',
    paymentMethod: 'cash',
    customer: { id: cust.id, name: cust.name, phone: customer.phone, phone2: customer.phone2 || '' },
    address: { ...addrFields, id: addrId, areaName: area.name },
    deliveryFee: area.fee,
    items: cart.map(({ lineId, ...item }) => item),
    note: orderNote || '',
    status: mock.orderStatuses[0].id,
    statusHistory: [{ status: mock.orderStatuses[0].id, at: now, by: agent.name }],
    agentId: agent.id,
    employee: agent.name,
    cancelReason: '',
    isDemo: true,
  };
  orders.push(order);
  return resolve(order);
}

export function cancelOrder(orderId, reason, agent) {
  if (!agent) return Promise.reject(new Error('اختار اسمك من قايمة الموظفين الأول'));
  const o = orders.find((x) => x.id === orderId);
  if (!o) return Promise.reject(new Error('الطلب غير موجود'));
  if (o.status === 'cancelled') return Promise.reject(new Error('الطلب ملغي بالفعل'));
  o.status = 'cancelled';
  o.cancelReason = reason;
  o.statusHistory.push({ status: 'cancelled', at: new Date().toISOString(), by: agent.name, reason });
  return resolve(o);
}

/* ---------- Delivery areas ---------- */
export function saveArea({ id, name, fee, active }) {
  const clean = { name: String(name).trim(), fee: Math.max(0, Number(fee) || 0), active: !!active };
  if (id) {
    const a = areas.find((x) => x.id === id);
    if (!a) return Promise.reject(new Error('المنطقة غير موجودة'));
    Object.assign(a, clean);
    return resolve(a);
  }
  const created = { id: `area-${Date.now()}`, ...clean };
  areas.push(created);
  return resolve(created);
}
