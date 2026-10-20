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

/* Add-ons: same checks as the database (13_modifiers.sql) — prices from here, never from the screen. */
const modifiers = clone(mock.modifiers);
export const getModifiers = () => resolve(modifiers);
export function saveProductModifiers(sku, links) {
  for (const l of links) {
    if (!(l.max >= 1 && l.max <= 20) || l.min < 0 || l.min > l.max) return Promise.reject(new Error('الحد الأقصى من 1 إلى 20 ولا يقل عن الحد الأدنى'));
  }
  modifiers.links = [...modifiers.links.filter((l) => l.sku !== sku), ...links.map((l) => ({ sku, groupId: l.groupId, min: l.min, max: l.max }))];
  return resolve(links.length);
}
/* The line's add-ons priced from the list; the price of an add-on already on the line is kept. */
function priceModifiers(line, old = []) {
  const links = modifiers.links.filter((l) => l.sku === line.productId);
  const out = [];
  for (const m of line.modifiers || []) {
    const link = links.find((l) => modifiers.groups.find((g) => g.id === l.groupId)?.options.some((o) => o.id === m.id));
    const group = link && modifiers.groups.find((g) => g.id === link.groupId);
    const o = group?.options.find((x) => x.id === m.id);
    if (!o) throw new Error(`إضافة غير متاحة لـ«${line.name}» — حدّث الصفحة واختر مرة أخرى`);
    out.push({ id: o.id, groupId: group.id, group: group.name, name: o.name, price: old.find((x) => x.id === o.id)?.price ?? o.price, qty: m.qty });
  }
  for (const l of links) {
    const g = modifiers.groups.find((x) => x.id === l.groupId);
    const n = out.filter((m) => m.groupId === l.groupId).reduce((s, m) => s + m.qty, 0);
    if (n < l.min) throw new Error(`اختر ${l.min} على الأقل من «${g.name}» في «${line.name}»`);
    if (n > l.max) throw new Error(`«${g.name}» لا تزيد عن ${l.max} في «${line.name}»`);
  }
  return out;
}
export const getAreas         = () => resolve(areas);   // includes inactive areas
export const getOrderStatuses = () => resolve(mock.orderStatuses);
export const syncSaleUnits = () => Promise.resolve({ status: 'skipped' });
/* Demo stand-in for the data-center sync (nothing leaves the browser). */
const dcLog = { pulledAt: null, publishedAt: null };
export const lastDataCenterSync = () => resolve(dcLog);
export const pullDataCenter = () => { dcLog.pulledAt = new Date().toISOString(); return resolve({ products: { status: 'ok' }, failed: [] }); };
export const publishDataCenter = () => { dcLog.publishedAt = new Date().toISOString(); return resolve({ products_upserted: 0 }); };

/* ---------- Employee names ---------- */
export const getAgents = () => resolve(agents);
export function saveAgent({ id = null, name, active = true }) {
  const clean = String(name ?? '').trim();
  if (!clean || clean.length > 40) return Promise.reject(new Error('أدخل الاسم (بحد أقصى 40 حرفًا)'));
  const key = clean.toLowerCase();
  if (agents.some((a) => a.id !== id && a.name.trim().toLowerCase() === key)) {
    return Promise.reject(new Error('هذا الاسم موجود بالفعل في القائمة'));
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
  if (id === demoAccount.id) return Promise.reject(new Error('لا يمكنك تغيير صلاحية حسابك'));
  const s = staff.find((x) => x.id === id);
  if (!s) return Promise.reject(new Error('الحساب غير موجود'));
  Object.assign(s, { role, active });
  return Promise.resolve(true);
}
export const signOut = () => Promise.resolve();
export const changePassword = () => Promise.resolve(true);
export const signUp = () => Promise.resolve({ needsConfirmation: false });
export const joinWithCode = () => resolve(demoAccount);
let demoCodeAt = new Date().toISOString();
export const setSignupCode = (code) => (String(code || '').trim().length < 8
  ? Promise.reject(new Error('يجب أن يتكون الكود من 8 إلى 40 حرفًا أو رقمًا'))
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

export function suggestCustomersByPhone(prefix) {
  const q = normalizePhone(prefix);
  if (q.length < 3) return resolve([]);
  return resolve(customers
    .filter((c) => c.phones.some((ph) => normalizePhone(ph).startsWith(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar')).slice(0, 8)
    .map((c) => ({ ...c, lastOrderAt: lastOrderAt(c.id) })));
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

/* Preparation (branch): today's orders + older ones not out yet; one step at a time. */
const STAGE_IDS = ['new', 'preparing', 'at_cashier', 'out'];
export const listPrepOrders = () => resolve(orders
  .filter((o) => isSameDay(o.createdAt, new Date()) || (o.status !== 'cancelled' && o.stage !== 'out'))
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  .map((o) => ({ ...o, cancelledAt: o.statusHistory.find((h) => h.status === 'cancelled')?.at ?? null })));
export function setStage(orderId, stage) {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return Promise.reject(new Error('الطلب غير موجود'));
  if (o.status === 'cancelled') return Promise.reject(new Error('تم إلغاء هذا الطلب، يرجى إيقاف تجهيزه'));
  const from = STAGE_IDS.indexOf(o.stage || 'new');
  const to = STAGE_IDS.indexOf(stage);
  if (to < 0) return Promise.reject(new Error('حالة غير معروفة'));
  if (to === from) return resolve({ id: o.id, stage: o.stage });
  if (Math.abs(to - from) !== 1) return Promise.reject(new Error('تغيّرت حالة الطلب من جهاز آخر — يرجى التحديث'));
  const now = new Date().toISOString();
  o.stage = stage;
  if (to > from) o[['', 'preparingAt', 'atCashierAt', 'outAt'][to]] = now;
  else o[['', 'preparingAt', 'atCashierAt', 'outAt'][from]] = null;
  return resolve({ id: o.id, stage: o.stage });
}

export async function sendOut(orderId, driver) {
  const d = String(driver || '').replace(/\s+/g, ' ').trim();
  if (d.length < 2 || d.length > 80) throw new Error('أدخل اسم الطيار ورقمه — مثال: محمد (01012345678)');
  const o = orders.find((x) => x.id === orderId);
  if (o?.stage === 'out') throw new Error('الطلب خرج بالفعل');
  const r = await setStage(orderId, 'out');
  o.driver = d;
  return { ...r, driver: d };
}

export function ackEdit(orderId) {
  const o = orders.find((x) => x.id === orderId);
  if (o) o.editSeenAt = new Date().toISOString();
  return Promise.resolve(true);
}

/* Edit (demo): same rules as the database — until «على الكاشير»; kept lines keep their price. */
export function editOrder({ orderId, cart, address, orderNote, agent }) {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return Promise.reject(new Error('الطلب غير موجود'));
  if (o.status === 'cancelled') return Promise.reject(new Error('هذا الطلب ملغي ولا يمكن تعديله'));
  if (!['new', 'preparing'].includes(o.stage || 'new')) return Promise.reject(new Error('الطلب وصل إلى الكاشير — أي تعديل يتم بالتليفون مع الفرع'));
  const amount = (l) => (l.unitType === 'weight' ? { qty: null, grams: l.grams } : { qty: l.qty, grams: null });
  const key = (a) => `${a.qty}|${a.grams}`;
  const oldBy = new Map(o.items.map((l) => [l.productId, l]));
  const newBy = new Map(cart.map((l) => [l.productId, l]));
  const changes = [];
  const modsKey = (l) => (l.modifiers || []).map((m) => `${m.name} ×${m.qty}`).join('، ');
  let priced;
  try { priced = cart.map((l) => ({ ...l, modifiers: priceModifiers(l, oldBy.get(l.productId)?.modifiers) })); } catch (e) { return Promise.reject(e); }
  for (const [id, n] of newBy) {
    const old = oldBy.get(id);
    if (!old) changes.push({ kind: 'added', name: n.name, to: amount(n) });
    else if (key(amount(old)) !== key(amount(n))) changes.push({ kind: 'amount', name: n.name, from: amount(old), to: amount(n) });
    else if (modsKey(old) !== modsKey(n)) changes.push({ kind: 'modifiers', name: n.name, from: modsKey(old), to: modsKey(n) });
    else if ((old.note || '') !== (n.note || '')) changes.push({ kind: 'note', name: n.name, to: n.note || '' });
  }
  for (const [id, old] of oldBy) if (!newBy.has(id)) changes.push({ kind: 'removed', name: old.name, from: amount(old) });
  const area = areas.find((a) => a.id === address.areaId);
  const addrChanged = address.areaId !== o.address.areaId || address.street !== o.address.street
    || (address.housingType || '') !== (o.address.housingType || '') || (address.notes || '') !== (o.address.notes || '');
  if (addrChanged) changes.push({ kind: 'address', name: 'العنوان', to: { area: area?.name, street: address.street } });
  if ((orderNote || '') !== (o.note || '')) changes.push({ kind: 'order_note', name: 'ملاحظات الطلب', to: orderNote || '' });
  if (!changes.length) return Promise.reject(new Error('لا يوجد أي تغيير في الطلب'));
  o.items = priced.map(({ lineId, ...l }) => ({ ...l, price: oldBy.get(l.productId)?.price ?? l.price }));
  if (addrChanged) {
    if (address.areaId !== o.address.areaId) o.deliveryFee = area?.fee ?? o.deliveryFee;
    o.address = { ...o.address, areaId: address.areaId, areaName: area?.name ?? o.address.areaName, street: address.street,
      housingType: address.housingType || '', notes: address.notes || '' };
  }
  o.note = orderNote || '';
  Object.assign(o, { editCount: (o.editCount || 0) + 1, editedAt: new Date().toISOString(), editedBy: agent?.name || '', editChanges: changes, editSeenAt: null });
  return resolve(o);
}

export const getOrder = (id) => resolve(orders.find((o) => o.id === id) ?? null);

/* DEMO ONLY — keeps the order in memory. Does not send or save anything. */
export function createOrder(draft) {
  const { cart, customer, address, orderNote, agent } = draft;
  if (!agent || !agents.some((a) => a.id === agent.id && a.active)) {
    return Promise.reject(new Error('اختر اسمك من قائمة الموظفين أولًا'));
  }
  const area = areas.find((a) => a.id === address.areaId);
  if (!area || !area.active) return Promise.reject(new Error('منطقة التوصيل غير متاحة'));
  let items;
  try { items = cart.map(({ lineId, ...item }) => ({ ...item, modifiers: priceModifiers(item) })); } catch (e) { return Promise.reject(e); }

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
    items,
    note: orderNote || '',
    status: mock.orderStatuses[0].id,
    stage: 'new', preparingAt: null, atCashierAt: null, outAt: null,
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
  if (!agent) return Promise.reject(new Error('اختر اسمك من قائمة الموظفين أولًا'));
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
