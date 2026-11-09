/* =====================================================================
 *  DEMO DATA SOURCE (DATA_MODE = 'mock') — used through data-source.js.
 *
 *  Nothing in this file talks to a network, a database or any service.
 *  "Created" orders live in browser memory and disappear on refresh.
 *  supabase-source.js exports the same functions with the same shapes.
 * ===================================================================== */
import * as mock from './mock-data.js';
import { normalizePhone, isSameWorkDay, workDayIso } from '../utils/format.js';
import { computeTotals, lineTotal } from '../utils/pricing.js';

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
  modifiers.links = [...modifiers.links.filter((l) => l.sku !== sku), ...links.map((l) => ({ sku, groupId: l.groupId, min: l.min, max: l.max, defaultId: l.defaultId || null }))];
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
const demoAccount = { ...mock.account, role: ['admin', 'call_center', 'prep', 'driver'].includes(demoRole) ? demoRole : 'admin' };
// «?role=driver»: the demo driver أحمد.
if (demoAccount.role === 'driver') Object.assign(demoAccount, { id: 'drv-1', name: 'أحمد', email: 'ahmed.driver@demo' });
// «?own» in the link: an account with its own name (عمر) — no «اختر اسمك».
if (new URLSearchParams(location.search).has('own')) Object.assign(demoAccount, { agentId: 'ag-1', name: 'عمر' });
export const getAccount = () => resolve(demoAccount);
export const signIn = () => resolve(demoAccount);

const staff = clone(mock.staff);
export const listStaff = () => resolve(staff);
export const ownerId = () => resolve(staff.find((s) => s.isOwner)?.id ?? null);
export function setStaff({ id, role, active }) {
  if (id === demoAccount.id) return Promise.reject(new Error('لا يمكنك تغيير صلاحية حسابك'));
  const s = staff.find((x) => x.id === id);
  if (!s) return Promise.reject(new Error('الحساب غير موجود'));
  if (s.isOwner) return Promise.reject(new Error('ده حساب المالك — محدش يقدر يغيّر صلاحيته أو يوقفه'));
  Object.assign(s, { role, active });
  return Promise.resolve(true);
}
export const signOut = () => Promise.resolve();
export const changePassword = () => Promise.resolve(true);
export const signUp = () => Promise.resolve({ needsConfirmation: false });
export const joinWithCode = () => resolve(demoAccount);
export const setMyName = () => resolve(demoAccount);
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

/* ---------- Customers page (same numbers as cc_customer_stats / cc_list_customers) ---------- */
const orderTotal = (o) => o.items.reduce((s, it) => s + (it.unitType === 'weight'
  ? it.price * it.grams / 1000 + (it.modifiers || []).reduce((t, m) => t + m.price * m.qty, 0)
  : (it.price + (it.modifiers || []).reduce((t, m) => t + m.price * m.qty, 0)) * it.qty), 0) + (o.deliveryFee || 0);
function statsOf(customerId) {
  const all = orders.filter((o) => o.customer.id === customerId);
  const okOrders = all.filter((o) => o.status !== 'cancelled');
  const total = okOrders.reduce((s, o) => s + orderTotal(o), 0);
  const byProduct = new Map(); const byMod = new Map(); const byArea = new Map();
  for (const o of okOrders) {
    const seen = new Set();
    for (const it of o.items) {
      const p = byProduct.get(it.productId) ?? { id: it.productId, name: it.name, orders: 0, qty: 0, grams: 0 };
      if (!seen.has(it.productId)) { p.orders += 1; seen.add(it.productId); }
      if (it.unitType === 'weight') p.grams += it.grams; else p.qty += it.qty;
      byProduct.set(it.productId, p);
      for (const m of it.modifiers || []) byMod.set(m.name, (byMod.get(m.name) || 0) + 1);
    }
    byArea.set(o.address.areaName, (byArea.get(o.address.areaName) || 0) + 1);
  }
  const dates = okOrders.map((o) => o.createdAt).sort();
  const area = [...byArea].sort((a, b) => b[1] - a[1])[0];
  return {
    orders: okOrders.length, cancelled: all.length - okOrders.length,
    total, average: okOrders.length ? Math.round((total / okOrders.length) * 100) / 100 : 0,
    firstOrderAt: dates[0] ?? null, lastOrderAt: dates[dates.length - 1] ?? null,
    foodicsOrders: null, foodicsLastOrderAt: null,
    topProducts: [...byProduct.values()].sort((a, b) => b.orders - a.orders || b.qty - a.qty).slice(0, 3)
      .map((p) => ({ ...p, qty: p.qty || null, grams: p.grams || null })),
    topModifiers: [...byMod].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, times]) => ({ name, times })),
    topArea: area ? { name: area[0], orders: area[1] } : null,
  };
}
export const getCustomerStats = (customerId) => resolve(statsOf(customerId));
export const getCustomer = (id) => resolve(customers.find((c) => c.id === id) ?? null);
export function listCustomerSummaries({ q = '', sort = 'last', limit = 50, offset = 0 } = {}) {
  const qq = String(q).trim().toLowerCase(); const dq = normalizePhone(q);
  const rows = customers
    .filter((c) => !qq || c.name.toLowerCase().includes(qq) || (dq.length >= 3 && c.phones.some((ph) => normalizePhone(ph).includes(dq))))
    .map((c) => { const s = statsOf(c.id); return { id: c.id, name: c.name, phones: c.phones, orders: s.orders, total: s.total, lastOrderAt: s.lastOrderAt, foodicsOrders: null, foodicsLastOrderAt: null }; });
  const by = {
    orders: (a, b) => b.orders - a.orders, total: (a, b) => b.total - a.total,
    name: (a, b) => a.name.localeCompare(b.name, 'ar'), last: (a, b) => String(b.lastOrderAt ?? '').localeCompare(String(a.lastOrderAt ?? '')),
  }[sort] ?? ((a, b) => 0);
  rows.sort(by);
  return resolve({ total: rows.length, rows: rows.slice(offset, offset + limit) });
}

/* ---------- Blocked numbers (same rules as 16_blocked_numbers.sql) ---------- */
// DEMO: one number blocked on Foodics, so the red «القائمة السوداء» can be tried.
const blocked = new Map([['01099990000', { source: 'foodics', by: '', at: new Date(Date.now() - 86400000 * 3).toISOString() }]]);
export const getBlocked = (phones) => resolve(new Map((phones || []).map(normalizePhone)
  .filter((ph) => blocked.has(ph)).map((ph) => [ph, blocked.get(ph)])));
export const listBlocked = () => resolve([...blocked].map(([phone, b]) => {
  const c = customers.find((x) => x.phones.some((ph) => normalizePhone(ph) === phone));
  return { phone, customerId: c?.id ?? null, customerName: c?.name ?? '', ...b };
}).sort((a, b) => String(b.at).localeCompare(String(a.at))));
export function setBlocked(phones, on) {
  const list = [...new Set((phones || []).map(normalizePhone).filter(Boolean))];
  if (!list.length || list.some((ph) => !/^0[0-9]{8,10}$/.test(ph))) return Promise.reject(new Error('رقم غير صحيح'));
  if (!on && demoAccount.role !== 'admin') return Promise.reject(new Error('فك الحظر للأدمن بس'));
  let n = 0;
  for (const ph of list) {
    if (on && !blocked.has(ph)) { blocked.set(ph, { source: 'call_center', by: demoAccount.name || 'أنت', at: new Date().toISOString() }); n += 1; }
    if (!on && blocked.delete(ph)) n += 1;
  }
  return resolve(n);
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
    .filter((o) => normalizePhone(o.customer.phone) === q && isSameWorkDay(o.createdAt, now) && o.status !== 'cancelled')
    .map((o) => ({ id: o.id, number: o.number, createdAt: o.createdAt }));
  return resolve(list);
}

export function phoneBelongsToCustomer(phone) {
  const q = normalizePhone(phone);
  const c = customers.find((x) => x.phones.some((ph) => normalizePhone(ph) === q));
  return resolve(c ? { id: c.id, name: c.name } : null);
}

/* ---------- Orders ---------- */
export const listOrders = ({ since = null } = {}) =>
  resolve([...orders].filter((o) => !since || new Date(o.createdAt) >= new Date(since))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

/* «سجل الطلبات» one page — same rules as cc_order_log (22_order_log_backup.sql). */
export function orderLog({ from = null, to = null, status = '', agents = [], q = '', limit = 50, offset = 0 } = {}) {
  const text = String(q || '').trim().toLowerCase();
  const digits = /[^0-9\s+()-]/.test(normalizePhone(q || '')) ? '' : normalizePhone(q || '').replace(/\D/g, '');
  const list = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((o) =>
    (!from || new Date(o.createdAt) >= new Date(from)) && (!to || new Date(o.createdAt) < new Date(to))
    && (!status || o.status === status) && (!agents.length || agents.includes(o.employee))
    && (!text || o.number.toLowerCase().includes(text) || o.customer.name.toLowerCase().includes(text)
      || (digits.length >= 3 && normalizePhone(o.customer.phone).includes(digits))));
  const live = list.filter((o) => o.status !== 'cancelled');
  return resolve({ count: list.length, sum: live.reduce((t, o) => t + computeTotals(o.items, o.deliveryFee).total, 0),
    cancelled: list.length - live.length, orders: list.slice(offset, offset + limit) });
}

/* Nightly copies (demo): the last 3 days, each = the demo data. */
export const listBackups = () => resolve([0, 1, 2].map((i) => {
  const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
  return { day: d, name: `${d}.json`, size: 48000 };
}));
export const getBackup = () => backupExport();

/* Backup (demo): the demo data in the same shape as cc_backup_export. */
export const backupExport = () => resolve({
  made_at: new Date().toISOString(),
  orders: orders.map((o) => ({ order_no: o.number, created_at: o.createdAt, status: o.status, customer_name: o.customer.name,
    customer_phone: o.customer.phone, area_name: o.address.areaName, street: o.address.street, total: computeTotals(o.items, o.deliveryFee).total,
    delivery_fee: o.deliveryFee, agent_name: o.employee })),
  order_items: orders.flatMap((o) => o.items.map((it) => ({ order_no: o.number, product_name: it.name, qty: it.qty ?? null, weight_grams: it.grams ?? null }))),
  customers: customers.map((c) => ({ name: c.name, phone: c.phones[0], phone2: c.phones[1] || null })),
  areas: areas.map((a) => ({ name: a.name, fee: a.fee, active: a.active })),
  staff: staff.map((s) => ({ display_name: s.name, role: s.role, active: s.active, phone: s.phone || null })),
});

/* Preparation (branch): today's orders + older ones not out yet; one step at a time. */
const STAGE_IDS = ['new', 'preparing', 'at_cashier', 'out'];
export const listPrepOrders = () => resolve(orders
  .filter((o) => isSameWorkDay(o.createdAt, new Date()) || (o.status !== 'cancelled' && o.stage !== 'out'))
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  .map((o) => ({ ...o, prepMine: !!o.prepUserId && o.prepUserId === demoAccount.id, cancelledAt: o.statusHistory.find((h) => h.status === 'cancelled')?.at ?? null })));
/* «استلمت» (32_prep_claim.sql): the demo has a colleague «نادية» preparing one order. */
const myPrepName = () => (demoAccount.role === 'prep' ? 'إنت (التجربة)' : demoAccount.name || 'الأدمن');
(function seedPrep() {
  const p = orders.filter((o) => o.stage === 'preparing' && o.status !== 'cancelled');
  if (p[0]) Object.assign(p[0], { prepUserId: 'prep-nadia', prepName: 'نادية', prepClaimedAt: p[0].preparingAt });
  if (p[1]) Object.assign(p[1], { prepUserId: demoAccount.id, prepName: myPrepName(), prepClaimedAt: p[1].preparingAt });
}());
export function prepClaim(orderId) {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return Promise.reject(new Error('الطلب غير موجود'));
  if (o.status === 'cancelled') return Promise.reject(new Error('الطلب ده اتلغى'));
  if (!['preparing', 'at_cashier'].includes(o.stage)) return Promise.reject(new Error('الطلب ده مش في التجهيز'));
  Object.assign(o, { prepUserId: demoAccount.id, prepName: myPrepName(), prepClaimedAt: new Date().toISOString() });
  return resolve({ id: o.id, prep_name: o.prepName });
}
export function setStage(orderId, stage) {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return Promise.reject(new Error('الطلب غير موجود'));
  if (stage === 'out') return Promise.reject(new Error('الطيار هو اللي بيدوس «خرجت» من موبايله'));
  if (o.stage === 'out' && deliveries.get(orderId)?.deliveredAt) return Promise.reject(new Error('الطلب اتسلّم للعميل — مينفعش يرجع'));
  if (o.status === 'cancelled') return Promise.reject(new Error('تم إلغاء هذا الطلب، يرجى إيقاف تجهيزه'));
  const from = STAGE_IDS.indexOf(o.stage || 'new');
  const to = STAGE_IDS.indexOf(stage);
  if (to < 0) return Promise.reject(new Error('حالة غير معروفة'));
  if (to === from) return resolve({ id: o.id, stage: o.stage });
  if (Math.abs(to - from) !== 1) return Promise.reject(new Error('تغيّرت حالة الطلب من جهاز آخر — يرجى التحديث'));
  if (o.prepUserId && o.prepUserId !== demoAccount.id && demoAccount.role !== 'admin') {
    return Promise.reject(new Error(`الطلب ده مع ${o.prepName || 'زميلك'} — دوس «خده مني» لو هتكمّله إنت`));
  }
  const now = new Date().toISOString();
  if (stage === 'new') Object.assign(o, { prepUserId: null, prepName: '', prepClaimedAt: null });
  else if (!o.prepUserId) Object.assign(o, { prepUserId: demoAccount.id, prepName: myPrepName(), prepClaimedAt: now });
  o.stage = stage;
  if (to > from) o[['', 'preparingAt', 'atCashierAt', 'outAt'][to]] = now;
  else o[['', 'preparingAt', 'atCashierAt', 'outAt'][from]] = null;
  if (to < 4) Object.assign(o, { tripId: null, tripSeq: null, tripSize: null, outByAdmin: false });
  if (to < 3) Object.assign(o, { driver: '', driverUserId: null, assignedAt: null });
  return resolve({ id: o.id, stage: o.stage });
}

export async function sendOut() {
  throw new Error('الطيار هو اللي بيدوس «خرجت» من موبايله');
}

/* ---------- Drivers (same rules as 18_driver_tracking.sql) ---------- */
const deliveries = new Map();   // order id → { deliveredAt, photo, lat, lng, accuracy, deliveredAdmin, returnedAt, returnedAdmin }
const driverLabel = (id) => { const d = staff.find((x) => x.id === id); return d ? `${d.name}${d.phone ? ` (${d.phone})` : ''}` : ''; };
// DEMO photo (a drawn bag with the ticket) so the admin pages show something.
const DEMO_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#e9efe9"/><rect x="150" y="70" width="180" height="230" rx="14" fill="#c9a36a"/><rect x="190" y="120" width="100" height="120" fill="#fff"/><text x="240" y="170" font-size="18" text-anchor="middle" fill="#333">DEMO</text><text x="240" y="200" font-size="14" text-anchor="middle" fill="#666">صورة تجريبية</text></svg>')}`;
(function seedDemoDeliveries() {
  const ids = ['drv-1', 'drv-2'];
  const outs = orders.filter((o) => o.stage === 'out' && o.status !== 'cancelled' && o.outAt)
    .sort((a, b) => a.outAt.localeCompare(b.outAt));
  outs.forEach((o, i) => {
    const drv = ids[i % 2];
    Object.assign(o, { driverUserId: drv, driver: driverLabel(drv), assignedAt: new Date(new Date(o.outAt).getTime() - 4 * 60000).toISOString(),
      tripId: `trip-${o.id}`, tripSeq: 1, tripSize: 1, outByAdmin: false });
    const out = new Date(o.outAt).getTime();
    const deliveredAt = out + (12 + (i * 7) % 30) * 60000;
    if (deliveredAt < Date.now()) {
      const returnedAt = deliveredAt + (8 + (i * 5) % 25) * 60000;
      deliveries.set(o.id, { deliveredAt: new Date(deliveredAt).toISOString(), photo: DEMO_PHOTO,
        lat: 31.12 + i / 1000, lng: 29.79 + i / 1000, accuracy: 15, deliveredAdmin: false,
        returnedAt: returnedAt < Date.now() && i !== outs.length - 2 ? new Date(returnedAt).toISOString() : null, returnedAdmin: false,
        returnedLat: 31.1100 + (i % 4 === 3 ? 0.012 : 0.0005), returnedLng: 29.7800, returnedDistance: i % 4 === 3 ? 1340 : 56, returnedFar: i % 4 === 3 });
    }
  });
  // DEMO: the orders at the cashier are picked for أحمد, so his screen has something to take out.
  orders.filter((o) => o.stage === 'at_cashier' && o.status !== 'cancelled').forEach((o, i) => Object.assign(o, {
    driverUserId: 'drv-1', driver: driverLabel('drv-1'), assignedAt: new Date(Date.now() - (10 - i) * 60000).toISOString() }));
}());
const driverAddress = (o) => ({ ...o.address });
const me = () => staff.find((x) => x.id === demoAccount.id);
export function getDriverOrders() {
  const today = new Date();
  return resolve({
    phone: me()?.phone || '',
    ready: orders.filter((o) => o.stage === 'at_cashier' && o.status !== 'cancelled' && o.driverUserId === demoAccount.id)
      .sort((a, b) => String(a.assignedAt).localeCompare(String(b.assignedAt)))
      .map((o) => ({ id: o.id, number: o.number, assignedAt: o.assignedAt, address: driverAddress(o) })),
    mine: orders.filter((o) => o.driverUserId === demoAccount.id && o.stage === 'out' && isSameWorkDay(o.outAt, today)
      && !deliveries.get(o.id)?.returnedAt)
      .sort((a, b) => b.outAt.localeCompare(a.outAt) || a.tripSeq - b.tripSeq)
      .map((o) => ({ id: o.id, number: o.number, outAt: o.outAt, tripId: o.tripId, tripSeq: o.tripSeq, tripSize: o.tripSize,
        cancelled: o.status === 'cancelled', deliveredAt: deliveries.get(o.id)?.deliveredAt ?? null, address: driverAddress(o),
        phones: o.status === 'cancelled' || deliveries.get(o.id)?.deliveredAt ? []
          : [...new Set([o.customer?.phone, o.customer?.phone2].filter(Boolean))] })),
  });
}
export function setPhone(userId, phone) {
  const v = String(phone || '').replace(/\D/g, '');
  if (!/^0[0-9]{8,10}$/.test(v)) return Promise.reject(new Error('رقم الموبايل غير صحيح — مثال: 01012345678'));
  const s = staff.find((x) => x.id === (userId || demoAccount.id));
  if (!s) return Promise.reject(new Error('الأكونت غير موجود'));
  s.phone = v;
  return resolve(v);
}
export function driverTake() {
  if (!me()?.phone) return Promise.reject(new Error('اكتب رقم موبايلك الأول'));
  const list = orders.filter((o) => o.stage === 'at_cashier' && o.status !== 'cancelled' && o.driverUserId === demoAccount.id)
    .sort((a, b) => String(a.assignedAt).localeCompare(String(b.assignedAt)));
  if (!list.length) return Promise.reject(new Error('مفيش طلبات متحددة ليك دلوقتي'));
  const trip = `trip-${Date.now()}`; const now = new Date().toISOString();
  list.forEach((o, i) => Object.assign(o, { stage: 'out', outAt: now, driver: driverLabel(demoAccount.id),
    tripId: trip, tripSeq: i + 1, tripSize: list.length, outByAdmin: false }));
  chatAuto(demoAccount.id, `خرج بـ ${list.length === 1 ? list[0].number : `${list.length} طلبات: ${list.map((o) => o.number).join('، ')}`}`, 'out');
  return resolve(list.length);
}
export function assignDriver(id, driverId) {
  const o = orders.find((x) => x.id === id);
  if (!o) return Promise.reject(new Error('الطلب غير موجود'));
  if (o.status === 'cancelled') return Promise.reject(new Error('الطلب ده اتلغى'));
  if (o.stage === 'out') return Promise.reject(new Error('الطيار خرج بالطلب خلاص'));
  if (o.stage !== 'at_cashier') return Promise.reject(new Error('الطلب لازم يكون على الكاشير'));
  if (driverId && !staff.some((x) => x.id === driverId && x.role === 'driver' && x.active)) return Promise.reject(new Error('اختار طيار من القائمة'));
  Object.assign(o, { driverUserId: driverId || null, driver: driverId ? driverLabel(driverId) : '', assignedAt: driverId ? new Date().toISOString() : null });
  return resolve(o.driver || null);
}
export function driverDelivered(id, photo, pos) {
  const o = orders.find((x) => x.id === id);
  if (!o || o.driverUserId !== demoAccount.id || o.stage !== 'out') return Promise.reject(new Error('الطلب ده مش معاك'));
  if (!photo) return Promise.reject(new Error('صوّر الطلب الأول'));
  const d = deliveries.get(id) ?? {};
  if (d.deliveredAt) return resolve(d.deliveredAt);
  deliveries.set(id, { ...d, deliveredAt: new Date().toISOString(), photo: URL.createObjectURL(photo),
    lat: pos?.lat ?? null, lng: pos?.lng ?? null, accuracy: pos?.accuracy ?? null, deliveredAdmin: false });
  chatAuto(demoAccount.id, `سلّم ${o.number}`, 'delivered', o);
  return resolve(deliveries.get(id).deliveredAt);
}
/* The driver: «رجعت الفرع» with his place; farther than the branch radius → «بعيد عن الفرع». */
const branch = { lat: 31.1100, lng: 29.7800, radius: 300, updatedAt: '2026-10-12T09:00:00Z' };
const distanceM = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
};
export function driverReturned(pos) {
  const list = orders.filter((o) => o.stage === 'out' && o.driverUserId === demoAccount.id && !deliveries.get(o.id)?.returnedAt);
  if (!list.length) return Promise.reject(new Error('مفيش طلبات معاك دلوقتي'));
  const dist = pos && branch.lat != null ? distanceM(branch, pos) : null;
  const far = dist != null && dist - Math.min(pos.accuracy || 0, 200) > branch.radius;
  const now = new Date().toISOString();
  list.forEach((o) => deliveries.set(o.id, { ...(deliveries.get(o.id) ?? {}), returnedAt: now, returnedAdmin: false,
    returnedLat: pos?.lat ?? null, returnedLng: pos?.lng ?? null, returnedDistance: dist, returnedFar: far }));
  chatAuto(demoAccount.id, 'رجع الفرع', 'returned');
  return resolve({ orders: list.length, distanceM: dist, far });
}

/* The driver's personal link (demo: any link opens أحمد). */
export const linkLogin = () => resolve(Object.assign(demoAccount, { role: 'driver', id: 'drv-1', name: 'أحمد', email: '' }));
/* Admin: the drivers, each with his own link. */
const linkFor = new Map(staff.filter((s) => s.role === 'driver').map((s) => [s.id, true]));
const demoToken = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim();
const cleanPhone = (p) => normalizePhone(p).replace(/\D/g, '');
const checkDriver = (name, phone, id = null) => {
  if (name.length < 2 || name.length > 40) return 'اكتب اسم الطيار';
  if (!/^0[0-9]{8,10}$/.test(phone)) return 'رقم الموبايل غير صحيح — مثال: 01012345678';
  if (staff.some((x) => x.role === 'driver' && x.id !== id && x.name.toLowerCase() === name.toLowerCase())) return 'فيه طيار بنفس الاسم';
  return null;
};
export function adminDrivers() {
  return resolve(staff.filter((s) => s.role === 'driver')
    .sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name, 'ar'))
    .map((s) => ({ userId: s.id, name: s.name, phone: s.phone || '', active: s.active, hasLink: !!linkFor.get(s.id),
      lastOutAt: orders.filter((o) => o.driverUserId === s.id && o.outAt).map((o) => o.outAt).sort().pop() ?? null })));
}
export function addDriver(name, phone) {
  const n = cleanName(name); const p = cleanPhone(phone);
  const bad = checkDriver(n, p);
  if (bad) return Promise.reject(new Error(bad));
  const id = `drv-${Date.now()}`;
  staff.push({ id, email: '', name: n, role: 'driver', active: true, createdAt: new Date().toISOString(), phone: p });
  linkFor.set(id, true);
  return resolve({ userId: id, token: demoToken() });
}
export function newDriverLink(userId) {
  if (!staff.some((x) => x.id === userId && x.role === 'driver')) return Promise.reject(new Error('الطيار غير موجود'));
  linkFor.set(userId, true);
  return resolve(demoToken());
}
export function updateDriver({ userId, name, phone, active }) {
  const d = staff.find((x) => x.id === userId && x.role === 'driver');
  if (!d) return Promise.reject(new Error('الطيار غير موجود'));
  const n = cleanName(name); const p = cleanPhone(phone);
  const bad = checkDriver(n, p, userId);
  if (bad) return Promise.reject(new Error(bad));
  Object.assign(d, { name: n, phone: p, active: !!active });
  if (!active) linkFor.set(userId, false);
  orders.filter((o) => o.driverUserId === userId && (o.stage === 'at_cashier' || o.stage === 'out')).forEach((o) => { o.driver = driverLabel(userId); });
  return resolve(true);
}
export const branchPlace = () => resolve(branch.lat == null ? null : { ...branch });
export function setBranchPlace(lat, lng) {
  if (!(lat >= 21 && lat <= 32 && lng >= 24 && lng <= 37)) return Promise.reject(new Error('المكان مش في مصر — انسخ الإحداثيات من خرائط جوجل (مثال: 31.1234, 29.8123)'));
  Object.assign(branch, { lat, lng, updatedAt: new Date().toISOString() });
  return resolve(true);
}
/* «الطيارين دلوقتي» (demo): the drivers out now; their last place is made up near the branch. */
const places = new Map();
/* Demo: أحمد's link was opened on another phone. */
const demoDeviceAlerts = [{ userId: 'drv-1', name: 'أحمد',
  main: { label: 'iPhone – Safari', firstSeen: new Date(Date.now() - 6 * 3600e3).toISOString(), lastSeen: new Date(Date.now() - 20 * 60e3).toISOString() },
  others: [{ label: 'Android – SM-A515F – Chrome', firstSeen: new Date(Date.now() - 50 * 60e3).toISOString(), lastSeen: new Date(Date.now() - 8 * 60e3).toISOString(), opens: 3 }] }];
export const driverDevice = () => resolve(true);
export const driverDeviceAlerts = () => resolve(demoAccount.role === 'admin' ? clone(demoDeviceAlerts) : []);
export function driverDeviceSeen(userId) {
  const i = demoDeviceAlerts.findIndex((a) => a.userId === userId);
  if (i >= 0) demoDeviceAlerts.splice(i, 1);
  return resolve(1);
}
export function driverPing(pos) {
  const out = orders.some((o) => o.stage === 'out' && o.driverUserId === demoAccount.id && !deliveries.get(o.id)?.returnedAt);
  if (out) places.set(demoAccount.id, { ...pos, at: new Date().toISOString() });
  return resolve(out);
}
export function driversNow() {
  const by = new Map();
  orders.filter((o) => o.stage === 'out' && o.status !== 'cancelled' && o.driverUserId && !deliveries.get(o.id)?.returnedAt
    && Date.now() - new Date(o.outAt).getTime() < 86400000).forEach((o) => {
    const r = by.get(o.driverUserId) ?? { userId: o.driverUserId, orders: 0, delivered: 0, outAt: o.outAt };
    r.orders += 1; if (deliveries.get(o.id)?.deliveredAt) r.delivered += 1;
    if (o.outAt < r.outAt) r.outAt = o.outAt;
    by.set(o.driverUserId, r);
  });
  return resolve([...by.values()].map((r, i) => {
    const s = staff.find((x) => x.id === r.userId) ?? {};
    const p = places.get(r.userId) ?? { lat: branch.lat + 0.008 + i * 0.004, lng: branch.lng + 0.006 - i * 0.009, accuracy: 20,
      at: new Date(Date.now() - (i ? 16 : 2) * 60000).toISOString() };   // DEMO: one fresh, one stale
    return { ...r, name: s.name || '', phone: s.phone || '', lat: p.lat, lng: p.lng, accuracy: p.accuracy, seenAt: p.at };
  }));
}
/* DEMO trail: from the branch towards the driver's place, a few bends, one point every 30 s. */
export function driverTrails() {
  return driversNow().then((rows) => new Map(rows.map((r) => {
    const n = 12; const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const f = i / n;
      pts.push({ lat: branch.lat + (r.lat - branch.lat) * f + Math.sin(f * 6) * 0.0012,
        lng: branch.lng + (r.lng - branch.lng) * f, at: new Date(Date.now() - (n - i) * 30000).toISOString() });
    }
    pts[n] = { lat: r.lat, lng: r.lng, at: r.seenAt };
    // DEMO: his delivered orders of this trip, on the line
    const stops = orders.filter((o) => o.driverUserId === r.userId && o.stage === 'out' && deliveries.get(o.id)?.deliveredAt
      && !deliveries.get(o.id)?.returnedAt).map((o, k) => ({ number: o.number, lat: pts[Math.min(n - 2, 5 + k * 3)].lat,
      lng: pts[Math.min(n - 2, 5 + k * 3)].lng, at: deliveries.get(o.id).deliveredAt,
      id: o.id, photoPath: deliveries.get(o.id).photo ?? null, address: { ...o.address } }));
    return [r.userId, { points: pts, stops }];
  })));
}
export const prepDeliveries = () => resolve(new Map([...deliveries].map(([id, d]) => [id, { deliveredAt: d.deliveredAt ?? null, returnedAt: d.returnedAt ?? null }])));
export const listDrivers = () => resolve(staff.filter((s) => s.role === 'driver' && s.active).map((s) => ({ userId: s.id, label: driverLabel(s.id) })));
export function adminDelivery(id, what, driverId) {
  const o = orders.find((x) => x.id === id);
  if (!o) return Promise.reject(new Error('الطلب غير موجود'));
  const now = new Date().toISOString();
  if (what === 'out') {
    if (o.stage !== 'at_cashier') return Promise.reject(new Error('الطلب لازم يكون على الكاشير'));
    if (!driverId) return Promise.reject(new Error('اختار الطيار'));
    Object.assign(o, { stage: 'out', outAt: now, driverUserId: driverId, driver: driverLabel(driverId), tripId: `trip-${Date.now()}`, tripSeq: 1, tripSize: 1, outByAdmin: true });
  } else {
    if (o.stage !== 'out') return Promise.reject(new Error('الطلب لسه ما خرجش'));
    const d = deliveries.get(id) ?? {};
    if (what === 'delivered' && !d.deliveredAt) deliveries.set(id, { ...d, deliveredAt: now, deliveredAdmin: true });
    if (what === 'returned' && !d.returnedAt) deliveries.set(id, { ...d, returnedAt: now, returnedAdmin: true });
  }
  return resolve(true);
}
const deliveryOf = (o) => {
  const d = deliveries.get(o.id) ?? {};
  return { outByAdmin: !!o.outByAdmin, tripSeq: o.tripSeq ?? null, tripSize: o.tripSize ?? null, assignedAt: o.assignedAt ?? null,
    deliveredAt: d.deliveredAt ?? null, deliveredAdmin: !!d.deliveredAdmin, returnedAt: d.returnedAt ?? null, returnedAdmin: !!d.returnedAdmin,
    photoPath: d.photo ?? null, lat: d.lat ?? null, lng: d.lng ?? null, accuracy: d.accuracy ?? null,
    returnedLat: d.returnedLat ?? null, returnedLng: d.returnedLng ?? null, returnedDistance: d.returnedDistance ?? null, returnedFar: !!d.returnedFar };
};
export function getOrderDelivery(id) {
  const o = orders.find((x) => x.id === id);
  if (!o) return resolve(null);
  const d = deliveryOf(o);
  if (demoAccount.role !== 'admin') Object.assign(d, { photoPath: null, lat: null, lng: null, accuracy: null, returnedLat: null, returnedLng: null, returnedDistance: null, returnedFar: false });
  return resolve(d);
}
export function deliveryReport(from, to) {
  const start = new Date(`${from}T00:00:00`); const end = new Date(`${to}T00:00:00`); end.setDate(end.getDate() + 1);
  return resolve(orders.filter((o) => o.outAt && o.status !== 'cancelled' && new Date(o.outAt) >= start && new Date(o.outAt) < end)
    .sort((a, b) => b.outAt.localeCompare(a.outAt))
    .map((o) => ({ id: o.id, number: o.number, createdAt: o.createdAt, areaName: o.address.areaName, atCashierAt: o.atCashierAt,
      outAt: o.outAt, driverId: o.driverUserId ?? null, driver: o.driver || '', tripId: o.tripId ?? null, ...deliveryOf(o),
      total: o.total ?? computeTotals(o.items, o.deliveryFee ?? 0).total, deliveryFee: o.deliveryFee ?? 0 })));
}
export const photoUrl = (path) => resolve(path);
export const listPhones = () => resolve(new Map(staff.filter((s) => s.phone).map((s) => [s.id, s.phone])));

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
  const hit = [...(cust?.phones ?? []), customer.phone, customer.phone2].map(normalizePhone).find((ph) => ph && blocked.has(ph));
  if (hit) return Promise.reject(new Error(`الرقم ${hit} في القائمة السوداء — ممنوع من الطلب`));
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
    requestId: draft.requestId || null,   // = the draft's id (33_drafts.sql): a sent draft leaves «مسودة»
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
  if (o.driverUserId && ['at_cashier', 'out'].includes(o.stage)) {
    chatAuto(o.driverUserId, `${o.number} اتلغى${o.stage === 'out' ? ' — رجّعه للفرع' : ''}`, 'cancelled', o, true);
  }
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

/* «التقارير» (27_reports.sql) on the demo orders — same shape as cc_report. */
export function report(from, to) {
  const day = (iso) => workDayIso(iso);
  const len = Math.round((new Date(to) - new Date(from)) / 864e5) + 1;
  const pf = new Date(from); pf.setDate(pf.getDate() - len);
  const prevFrom = day(pf);
  const inRange = (o, a, b) => { const d = day(o.createdAt); return d >= a && d <= b; };
  const tot = (o) => computeTotals(o.items, o.deliveryFee).total;
  const sum = (list) => {
    const ok = list.filter((o) => o.status !== 'cancelled');
    const sales = ok.reduce((t, o) => t + tot(o), 0);
    return { orders: ok.length, sales, avg: ok.length ? Math.round((sales / ok.length) * 100) / 100 : 0,
      fees: ok.reduce((t, o) => t + (o.deliveryFee || 0), 0), cancelled: list.length - ok.length, all: list.length };
  };
  const cur = orders.filter((o) => inRange(o, from, to));
  const prev = orders.filter((o) => { const d = day(o.createdAt); return d >= prevFrom && d < from; });
  const ok = cur.filter((o) => o.status !== 'cancelled');
  const count = (arr, key) => Object.entries(arr.reduce((m, x) => { const k = key(x); m[k] = (m[k] || 0) + 1; return m; }, {}))
    .map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  const agents = Object.values(cur.reduce((m, o) => {
    const a = (m[o.employee] ??= { name: o.employee || 'بدون اسم', orders: 0, sales: 0, cancelled: 0 });
    if (o.status === 'cancelled') a.cancelled += 1; else { a.orders += 1; a.sales += tot(o); }
    return m;
  }, {})).map((a) => ({ ...a, avg: a.orders ? Math.round((a.sales / a.orders) * 100) / 100 : 0 })).sort((a, b) => b.orders - a.orders);
  const cancelled = cur.filter((o) => o.status === 'cancelled').map((o) => {
    const h = o.statusHistory.find((x) => x.status === 'cancelled') || {};
    return { id: o.id, order_no: o.number, at: h.at || o.createdAt, reason: o.cancelReason || h.reason || '', by: h.by || o.employee, total: tot(o), agent: o.employee };
  });
  return resolve({
    from, to, summary: sum(cur), previous: sum(prev),
    hours: Array.from({ length: 24 }, (_, h) => { const l = ok.filter((o) => new Date(o.createdAt).getHours() === h); return { h, n: l.length, sales: l.reduce((t, o) => t + tot(o), 0) }; }),
    weekdays: Array.from({ length: 7 }, (_, d) => { const l = ok.filter((o) => new Date(o.createdAt).getDay() === d); return { d, n: l.length, sales: l.reduce((t, o) => t + tot(o), 0) }; }),
    agents,
    cancel: {
      reasons: count(cancelled, (c) => c.reason || 'بدون سبب').map(({ k, n }) => ({ reason: k, n })),
      by: count(cancelled, (c) => c.by || 'غير معروف').map(({ k, n }) => ({ name: k, n })),
      orders: cancelled,
    },
  });
}

/* «التقارير» phase 2 (29_reports_ops.sql): speed, areas, items, add-ons. */
export function reportOps(from, to) {
  const ok = orders.filter((o) => { const d = workDayIso(o.createdAt); return d >= from && d <= to && o.status !== 'cancelled'; });
  const mins = (a, b) => (a && b && b >= a ? (new Date(b) - new Date(a)) / 60000 : null);
  const rows = ok.map((o) => ({ o, to_prep: mins(o.createdAt, o.preparingAt), prep: mins(o.preparingAt, o.atCashierAt),
    wait: mins(o.atCashierAt, o.outAt), deliver: mins(o.outAt, deliveries.get(o.id)?.deliveredAt), total: mins(o.createdAt, o.outAt) }));
  const stat = (k) => {
    const v = rows.map((r) => r[k]).filter((x) => x != null).sort((a, b) => a - b);
    if (!v.length) return { n: 0, avg: null, mid: null };
    const mid = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
    return { n: v.length, avg: Math.round(v.reduce((t, x) => t + x, 0) / v.length), mid: Math.round(mid) };
  };
  const areas = new Map(); const items = new Map(); const mods = new Map();
  for (const o of ok) {
    const a = areas.get(o.address.areaName) ?? { name: o.address.areaName || 'بدون منطقة', orders: 0, sales: 0, fees: 0 };
    a.orders += 1; a.sales += computeTotals(o.items, o.deliveryFee).total; a.fees += o.deliveryFee || 0; areas.set(a.name, a);
    const seen = new Set();
    for (const it of o.items) {
      const p = items.get(it.productId) ?? { name: it.name, sku: it.productId, orders: 0, qty: 0, kg: 0, sales: 0 };
      if (!seen.has(it.productId)) { p.orders += 1; seen.add(it.productId); }
      if (it.unitType === 'weight') p.kg += (it.grams || 0) / 1000; else p.qty += it.qty || 0;
      p.sales += lineTotal(it); items.set(it.productId, p);
      for (const m of it.modifiers || []) {
        const k = `${m.group || ''}|${m.name}`; const x = mods.get(k) ?? { group: m.group || '', name: m.name, times: 0, sales: 0 };
        const n = (m.qty || 1) * (it.unitType === 'weight' ? 1 : it.qty || 1); x.times += n; x.sales += m.price * n; mods.set(k, x);
      }
    }
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  return resolve({
    from, to,
    speed: { orders: ok.length, to_prep: stat('to_prep'), prep: stat('prep'), wait: stat('wait'), deliver: stat('deliver'), total: stat('total') },
    slow: rows.filter((r) => r.total != null).sort((a, b) => b.total - a.total).slice(0, 10).map((r) => ({ id: r.o.id, order_no: r.o.number,
      at: r.o.createdAt, area: r.o.address.areaName, driver: r.o.driver || null, to_prep: r.to_prep && Math.round(r.to_prep),
      prep: r.prep && Math.round(r.prep), wait: r.wait && Math.round(r.wait), total: Math.round(r.total) })),
    areas: [...areas.values()].map((a) => ({ ...a, sales: r2(a.sales) })).sort((a, b) => b.orders - a.orders || b.sales - a.sales),
    items: [...items.values()].map((p) => ({ ...p, kg: r2(p.kg), sales: r2(p.sales) })).sort((a, b) => b.sales - a.sales).slice(0, 50),
    items_count: items.size,
    prep_people: Object.values(rows.filter((r) => r.prep != null).reduce((m, r) => {
      const n = r.o.prepName || 'من غير اسم'; (m[n] ??= { name: n, list: [] }).list.push(r.prep); return m;
    }, {})).map(({ name, list }) => ({ name, orders: list.length, avg: Math.round(list.reduce((t, x) => t + x, 0) / list.length), mid: Math.round(list.sort((a, b) => a - b)[Math.floor(list.length / 2)]) })),
    modifiers: [...mods.values()].map((m) => ({ ...m, sales: r2(m.sales) })).sort((a, b) => b.times - a.times || b.sales - a.sales).slice(0, 30),
  });
}

/* ---------- «الشات» (30_driver_chat.sql) — demo: kept in memory only ---------- */
const chat = [];
const chatReads = new Map();   // `${driverId}|staff` / `${driverId}|driver` → last read id
let chatSeq = 0;
function chatAuto(driverId, body, kind, o = null, notify = false) {   // hoisted: used by the driver actions above
  chatAdd({ driverId, from: 'system', name: 'السيستم', body, kind, notify, orderId: o?.id ?? null, orderNo: o?.number ?? null });
}
const chatAdd = (m) => { const msg = { id: ++chatSeq, at: new Date().toISOString(), orderId: null, orderNo: null, kind: 'text', notify: false, name: '', ...m }; chat.push(msg); return msg; };
(function seedChat() {
  const t = (min) => new Date(Date.now() - min * 60000).toISOString();
  const o = orders.find((x) => x.driverUserId === 'drv-1');
  chat.push(
    { id: ++chatSeq, driverId: 'drv-1', from: 'system', name: 'السيستم', body: 'خرج بـ 2 طلبات', kind: 'out', notify: false, at: t(40), orderId: null, orderNo: null },
    { id: ++chatSeq, driverId: 'drv-1', from: 'driver', name: 'أحمد', body: 'العنوان مش واضح 📍', kind: 'text', notify: false, at: t(25), orderId: o?.id ?? null, orderNo: o?.number ?? null },
    { id: ++chatSeq, driverId: 'drv-1', from: 'staff', name: 'منى', body: 'هكلّم العميل وأرد عليك 📞', kind: 'text', notify: false, at: t(23), orderId: o?.id ?? null, orderNo: o?.number ?? null },
    { id: ++chatSeq, driverId: 'drv-2', from: 'driver', name: 'محمود', body: 'العميل مش بيرد 📵', kind: 'text', notify: false, at: t(3), orderId: null, orderNo: null },
  );
  chatReads.set('drv-1|staff', 2);
}());
const isDriverMe = () => demoAccount.role === 'driver';
const meId = () => demoAccount.id;
const chatView = (m) => ({ ...m, mine: isDriverMe() ? m.from === 'driver' : m.from === 'staff' });
export function chatSend(driverId, body, orderId = null) {
  const text = String(body || '').trim();
  if (!text || text.length > 500) return Promise.reject(new Error('اكتب الرسالة (لحد 500 حرف)'));
  const d = isDriverMe() ? meId() : driverId;
  if (!staff.some((x) => x.id === d && x.role === 'driver')) return Promise.reject(new Error('الطيار غير موجود'));
  let no = null;
  if (orderId) {
    const o = orders.find((x) => x.id === orderId && x.driverUserId === d);
    if (!o) return Promise.reject(new Error('الطلب ده مش مع الطيار ده'));
    no = o.number;
  }
  const msg = chatAdd({ driverId: d, from: isDriverMe() ? 'driver' : 'staff', name: isDriverMe() ? (me()?.name || 'الطيار') : 'الكول سنتر',
    body: text, orderId: orderId || null, orderNo: no });
  chatReads.set(`${d}|${isDriverMe() ? 'driver' : 'staff'}`, msg.id);
  // DEMO: an answer so the other side can be seen
  if (isDriverMe()) setTimeout(() => chatAdd({ driverId: d, from: 'staff', name: 'منى', body: 'تمام ✅', orderId: msg.orderId, orderNo: msg.orderNo }), 4000);
  return resolve(chatView(msg));
}
export function chatThread(driverId = null, after = 0) {
  const d = isDriverMe() ? meId() : driverId;
  const list = chat.filter((m) => m.driverId === d && m.id > (after || 0)).slice(-200);
  if (list.length) chatReads.set(`${d}|${isDriverMe() ? 'driver' : 'staff'}`, Math.max(chatReads.get(`${d}|${isDriverMe() ? 'driver' : 'staff'}`) || 0, list[list.length - 1].id));
  return resolve({ driverId: d, messages: list.map(chatView) });
}
export function chatUnread() {
  if (isDriverMe()) {
    const r = chatReads.get(`${meId()}|driver`) || 0;
    return resolve({ unread: chat.filter((m) => m.driverId === meId() && m.id > r && (m.from === 'staff' || m.notify)).length });
  }
  const drivers = staff.filter((s) => s.role === 'driver');
  const unreadOf = (id) => chat.filter((m) => m.driverId === id && m.from === 'driver' && m.id > (chatReads.get(`${id}|staff`) || 0));
  const all = drivers.flatMap((d) => unreadOf(d.id));
  const newest = all.sort((a, b) => b.id - a.id)[0];
  return resolve({
    unread: all.length,
    newest: newest ? { ...chatView(newest), driverName: drivers.find((d) => d.id === newest.driverId)?.name || '' } : null,
    orders: [...new Set(all.map((m) => m.orderId).filter(Boolean))],
    drivers: drivers.map((d) => {
      const mine = chat.filter((m) => m.driverId === d.id);
      return { id: d.id, name: d.name, phone: d.phone || '', active: d.active !== false, unread: unreadOf(d.id).length, last: mine.length ? chatView(mine[mine.length - 1]) : null };
    }).sort((a, b) => (b.last?.id || 0) - (a.last?.id || 0)),
  });
}
const contacts = [
  { id: 'cn-1', label: 'الكول سنتر', phone: '01000000100', sort: 1, active: true },
  { id: 'cn-2', label: 'أ. حسن', phone: '01000000200', sort: 2, active: true },
];
export const contactNumbers = () => resolve(contacts.filter((c) => c.active || demoAccount.role === 'admin').map((c) => ({ ...c })));
export function saveContactNumber({ id = null, label, phone, active = true, sort = 0 }) {
  const l = String(label || '').trim(); const p = String(phone || '').replace(/[^0-9+]/g, '');
  if (!l || l.length > 40) return Promise.reject(new Error('اكتب الاسم (لحد 40 حرف)'));
  if (!/^[0-9+]{3,20}$/.test(p)) return Promise.reject(new Error('رقم غير صحيح'));
  if (id) { const c = contacts.find((x) => x.id === id); if (!c) return Promise.reject(new Error('الرقم غير موجود')); Object.assign(c, { label: l, phone: p, active: !!active, sort }); return resolve({ ...c }); }
  const c = { id: `cn-${Date.now()}`, label: l, phone: p, active: !!active, sort };
  contacts.push(c);
  return resolve({ ...c });
}

/* ---------- «مسودة» in the database (33_drafts.sql) — demo: in memory ---------- */
const drafts = [];
(function seedDrafts() {
  const c = orders[0]?.customer; const a = orders[0]?.address; const it = orders[0]?.items?.slice(0, 2) || [];
  if (c) drafts.push({ id: 'draft-demo-karim', owner: 'other', agentName: 'كريم', data: { customer: { ...c, todayOrders: [] }, address: a, cart: it.map((x, i) => ({ ...x, lineId: `d${i}` })), orderNote: '' },
    createdAt: new Date(Date.now() - 18 * 60000).toISOString(), updatedAt: new Date(Date.now() - 15 * 60000).toISOString() });
}());
export function draftSave(id, data, agentName) {
  if (orders.some((o) => o.requestId === id)) return resolve(new Date().toISOString());
  const d = drafts.find((x) => x.id === id);
  if (d && d.owner !== 'me') return Promise.reject(new Error('المسودة دي بتاعة موظف تاني'));
  const at = new Date().toISOString();
  if (d) Object.assign(d, { data, agentName, updatedAt: at });
  else drafts.unshift({ id, owner: 'me', agentName, data, createdAt: at, updatedAt: at });
  return resolve(at);
}
export function draftDelete(id) {
  const i = drafts.findIndex((x) => x.id === id && x.owner === 'me');
  if (i >= 0) drafts.splice(i, 1);
  return resolve(i >= 0);
}
export const draftList = () => resolve(drafts
  .filter((d) => (d.owner === 'me' || demoAccount.role === 'admin') && !orders.some((o) => o.requestId === d.id))
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .map((d) => ({ id: d.id, mine: d.owner === 'me', agentName: d.agentName || '', data: JSON.parse(JSON.stringify(d.data)), createdAt: d.createdAt, updatedAt: d.updatedAt })));
