/* =====================================================================
 *  SUPABASE DATA SOURCE (DATA_MODE = 'supabase') — used through data-source.js.
 *
 *  Talks only to the call-center objects created by db/apply_cc.sql:
 *    reads  : cc_staff (own row), cc_delivery_areas, cc_customers, cc_addresses,
 *             cc_orders, cc_order_items, cc_order_events (RLS: the active account only)
 *             cc_agents (employee names)
 *    writes : the functions cc_place_order, cc_cancel_order_as, cc_save_area, cc_save_agent
 *    products: the function cc_list_products (code, name, barcode, price, sold_by)
 *  Prices, fees and totals are always computed by the database.
 *
 *  Uses the public anon key from config.js plus the signed-in session.
 *  The session is kept by supabase-js in this browser, so the password is
 *  typed once per device. No password is ever stored by the app.
 * ===================================================================== */
import { SUPABASE_URL, SUPABASE_ANON_KEY, ACCOUNT_EMAIL } from '../config.js';
import { ORDER_STATUSES } from '../constants.js';
import { normalizePhone } from '../utils/format.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const PAGE = 1000;   // Supabase API row limit per request

/* ---------- Client ---------- */
let client = null;
async function sb() {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('إعدادات الربط ناقصة: SUPABASE_URL و SUPABASE_ANON_KEY في js/config.js');
  }
  const { createClient } = await import(SUPABASE_JS);
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'abu-el-fadl-cc-auth' },
  });
  return client;
}
/* Tests only: run the adapter against another client (e.g. a local PostgREST). */
export function _useClient(c) { client = c; }

/* Database errors carry an Arabic message; HINT names the form field (street, phone, …). */
function fail(error, fallback = 'حصلت مشكلة في الاتصال بقاعدة البيانات') {
  const err = new Error(error?.message || fallback);
  err.field = error?.hint || null;
  err.code = error?.code || null;
  return err;
}
const ok = ({ data, error }) => { if (error) throw fail(error); return data; };

/* ---------- Row → app shapes (exported for tests) ---------- */
export const toProduct = (r) => ({
  id: r.sku, code: r.sku, name: r.name, barcode: r.barcode || '',
  price: Number(r.price) || 0,
  unitType: r.sold_by === 'weight' ? 'weight' : 'piece',
  unitLabel: r.sold_by === 'weight' ? 'بالكيلو' : 'بالوحدة',
  image: null,
});

export const toAgent = (r) => ({ id: r.id, name: r.name, active: !!r.active });

export const toArea = (r) => ({ id: r.id, name: r.name, fee: Number(r.fee) || 0, active: !!r.active });

export const toAddress = (r) => ({
  id: r.id, label: r.label, areaId: r.area_id, street: r.street,
  housingType: r.housing_type || '', notes: r.notes || '',
});

export const toCustomer = (r, lastOrderAt = null) => ({
  id: r.id, name: r.name,
  phones: [r.phone, r.phone2].filter(Boolean),
  addresses: (r.cc_addresses || [])
    .slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map(toAddress),
  lastOrderAt,
});

export function toOrder(r) {
  const items = (r.cc_order_items || []).slice().sort((a, b) => a.line_no - b.line_no).map((it) => {
    const base = { productId: it.sku, name: it.product_name, price: Number(it.unit_price) || 0, note: it.note || '' };
    return it.weight_grams != null
      ? { ...base, unitType: 'weight', unitLabel: 'بالكيلو', grams: it.weight_grams }
      : { ...base, unitType: 'piece', unitLabel: 'بالوحدة', qty: it.qty };
  });
  const statusHistory = (r.cc_order_events || []).slice()
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .map((e) => ({ status: e.status, at: e.at, by: e.by_name || '', reason: e.reason || '' }));
  return {
    id: r.id,
    number: r.order_no,
    createdAt: r.created_at,
    type: 'delivery',
    paymentMethod: r.payment_method,
    customer: { id: r.customer_id, name: r.customer_name, phone: r.customer_phone, phone2: r.customer_phone2 || '' },
    address: {
      id: r.address_id, label: r.address_label, areaId: r.area_id, areaName: r.area_name,
      street: r.street, housingType: r.housing_type || '', notes: r.address_notes || '',
    },
    deliveryFee: Number(r.delivery_fee) || 0,
    subtotal: Number(r.subtotal) || 0,     // computed by the database
    total: Number(r.total) || 0,
    items,
    note: r.note || '',
    status: r.status,
    statusHistory,
    stage: r.stage || 'new',                  // preparation stage (09_prep.sql); 'new' before it is installed
    preparingAt: r.preparing_at || null,
    atCashierAt: r.at_cashier_at || null,
    outAt: r.out_at || null,
    driver: r.driver || '',                   // «الاسم (الرقم)» typed by the branch (11_driver.sql)
    editCount: r.edit_count || 0,             // edits (10_edit_order.sql)
    editedAt: r.edited_at || null,
    editedBy: r.edited_by_name || '',
    editChanges: r.edit_changes || [],
    editSeenAt: r.edit_seen_at || null,
    agentId: r.agent_id || null,
    employee: r.agent_name || r.created_by_name,     // older orders have no employee name
    cancelReason: r.cancel_reason || '',
    isDemo: false,
  };
}

/* Draft (store) → cc_create_order arguments. The app never sends prices or fees. */
export function toCreateOrderArgs({ requestId, cart, customer, address, orderNote }) {
  const phone2 = customer.phone2 || null;
  const p_customer = customer.id
    ? { id: customer.id, order_phone: customer.phone, ...(phone2 ? { phone2 } : {}) }
    : { name: customer.name, phone: customer.phone, ...(phone2 ? { phone2 } : {}) };
  const fields = {
    label: address.label, area_id: address.areaId, street: address.street,
    housing_type: address.housingType || null, notes: address.notes || null,
  };
  let p_address;
  if (address.isNew || !address.id) p_address = fields;                 // new address
  else if (address.edited) p_address = { id: address.id, ...fields };  // saved address, edited
  else p_address = { id: address.id };                                  // saved address as is
  const p_items = cart.map((l) => (l.unitType === 'weight'
    ? { sku: l.productId, weight_grams: l.grams, ...(l.note ? { note: l.note } : {}) }
    : { sku: l.productId, qty: l.qty, ...(l.note ? { note: l.note } : {}) }));
  return {
    p_client_request_id: requestId, p_customer, p_address, p_items,
    p_note: orderNote ? orderNote : null,
  };
}

/* Only digits reach a query filter. */
const digits = (v) => normalizePhone(v).replace(/\D/g, '');

/* ---------- Account ---------- */
/* null = signed out (or a stopped account);
   { pendingCode: true, email } = signed in but not linked yet → must enter the registration code;
   otherwise the call-center account. */
export async function getAccount() {
  const c = await sb();
  const { data: { session } } = await c.auth.getSession();
  if (!session) return null;
  // '*' so this keeps working before the role column exists (then the one account can do everything).
  const row = ok(await c.from('cc_staff').select('*').eq('user_id', session.user.id).maybeSingle());
  if (row && !row.active) {             // stopped account
    await c.auth.signOut();
    return null;
  }
  if (!row) return { pendingCode: true, email: session.user.email || '' };
  return { id: session.user.id, name: row.display_name, role: row.role || 'admin', email: session.user.email || '' };
}

/* Accounts and roles (admin). null = not installed on the database yet. */
/* ---------- Preparation (branch) ---------- */
const toPrepOrder = (r) => ({
  id: r.id, number: r.order_no, createdAt: r.created_at, status: r.status,
  cancelReason: r.cancel_reason || '', cancelledAt: r.cancelled_at || null,
  stage: r.stage, preparingAt: r.preparing_at, atCashierAt: r.at_cashier_at, outAt: r.out_at, driver: r.driver || '',
  customer: { name: r.customer_name, phone: r.customer_phone, phone2: r.customer_phone2 || '' },
  address: { areaName: r.area_name, label: r.address_label, street: r.street, housingType: r.housing_type || '', notes: r.address_notes || '' },
  note: r.note || '', employee: r.agent_name || '',
  editCount: r.edit_count || 0, editedAt: r.edited_at || null, editChanges: r.edit_changes || [], editSeenAt: r.edit_seen_at || null,
  items: (r.items || []).map((it) => (it.weight_grams != null
    ? { name: it.name, unitType: 'weight', grams: it.weight_grams, note: it.note || '' }
    : { name: it.name, unitType: 'piece', qty: it.qty, note: it.note || '' })),
});

export async function listPrepOrders() {
  const c = await sb();
  const res = await c.rpc('cc_prep_orders');
  if (res.error?.code === NOT_INSTALLED) throw new Error('شاشة التجهيز لسه مش متفعّلة على قاعدة البيانات');
  return ok(res).map(toPrepOrder);
}

/* «خرج مع الطيار» with the driver «الاسم (الرقم)». */
export async function sendOut(orderId, driver) {
  const c = await sb();
  const res = await c.rpc('cc_send_out', { p_order_id: orderId, p_driver: driver });
  if (res.error?.code === NOT_INSTALLED) throw new Error('خانة الطيار لسه مش متفعّلة على قاعدة البيانات');
  return ok(res);
}

export async function ackEdit(orderId) {
  const c = await sb();
  return ok(await c.rpc('cc_ack_edit', { p_order_id: orderId }));
}

/* Edit an order (until «على الكاشير»). The database recomputes prices and totals. */
export async function editOrder({ orderId, cart, address, orderNote, agent }) {
  const c = await sb();
  const { p_items } = toCreateOrderArgs({ requestId: null, cart, customer: { id: 'x' }, address, orderNote });
  const p_address = { area_id: address.areaId, street: address.street, housing_type: address.housingType || null, notes: address.notes || null };
  const res = await c.rpc('cc_edit_order', { p_agent_id: agent?.id ?? null, p_order_id: orderId, p_address, p_items, p_note: orderNote || null });
  if (res.error?.code === NOT_INSTALLED) throw new Error('تعديل الطلبات لسه مش متفعّل على قاعدة البيانات');
  ok(res);
  return getOrder(orderId);
}

export async function setStage(orderId, stage) {
  const c = await sb();
  return ok(await c.rpc('cc_set_stage', { p_order_id: orderId, p_stage: stage }));
}

export async function listStaff() {
  const c = await sb();
  const res = await c.rpc('cc_list_staff');
  if (res.error?.code === NOT_INSTALLED) return null;
  return ok(res).map((r) => ({ id: r.user_id, email: r.email, role: r.role, active: !!r.active, createdAt: r.created_at }));
}

export async function setStaff({ id, role, active }) {
  const c = await sb();
  return ok(await c.rpc('cc_set_staff', { p_user_id: id, p_role: role, p_active: active }));
}

export async function signIn(email, password) {
  const c = await sb();
  const { error } = await c.auth.signInWithPassword({ email: (email || ACCOUNT_EMAIL).trim(), password });
  if (error) {
    if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message || '')) {
      throw new Error('لازم تأكد الإيميل الأول — افتح رسالة Supabase على الإيميل واضغط رابط التأكيد');
    }
    throw new Error(error.status === 400 ? 'كلمة السر أو البريد غير صحيح' : 'تعذر تسجيل الدخول — تأكد من الإنترنت وحاول تاني');
  }
  const account = await getAccount();
  if (!account) throw new Error('الأكونت ده متوقف — كلّم المسؤول');
  return account;   // may be { pendingCode: true } → the screen asks for the registration code
}

/* Registration code: links this signed-in account as the call-center account. */
// PGRST202 = the function is not on the database yet (06_signup_code.sql not applied).
const NOT_INSTALLED = 'PGRST202';

export async function joinWithCode(code) {
  const c = await sb();
  const res = await c.rpc('cc_join_with_code', { p_code: String(code || '') });
  if (res.error?.code === NOT_INSTALLED) throw new Error('التسجيل بالكود لسه مش متفعّل — كلّم المسؤول');
  const linked = ok(res);
  if (!linked) throw new Error('كود التسجيل غلط');
  return getAccount();
}

export async function setSignupCode(code) {
  const c = await sb();
  return ok(await c.rpc('cc_set_signup_code', { p_code: String(code || '') }));
}

export async function getSignupCodeStatus() {
  const c = await sb();
  const res = await c.rpc('cc_signup_code_status');
  if (res.error?.code === NOT_INSTALLED) return { isSet: false, updatedAt: null, installed: false };
  const [row] = ok(res);
  return { isSet: !!row?.is_set, updatedAt: row?.updated_at || null, installed: true };
}

/* Account creation (ALLOW_SIGNUP). The new account can read nothing until it
   enters the registration code. Returns whether an email confirmation is pending;
   if not, the session is kept so the screen can ask for the code right away. */
export async function signUp(email, password) {
  const c = await sb();
  const { data, error } = await c.auth.signUp({
    email: email.trim(), password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) {
    const m = String(error.message || '').toLowerCase();
    if (m.includes('already')) throw new Error('الإيميل ده عنده أكونت بالفعل — ادخل بيه');
    if (m.includes('not allowed') || m.includes('disabled')) throw new Error('إنشاء الأكونتات مقفول في المشروع — لازم يتعمل من لوحة Supabase');
    if (m.includes('password')) throw new Error('كلمة السر ضعيفة — خليها 8 حروف/أرقام على الأقل');
    throw new Error('تعذر إنشاء الأكونت — تأكد من الإنترنت وحاول تاني');
  }
  return { needsConfirmation: !data.session };
}

/* The signed-in account changes its own password (stays signed in on this device). */
export async function changePassword(password) {
  const c = await sb();
  const { error } = await c.auth.updateUser({ password });
  if (error) {
    if (/different from the old|same/i.test(error.message)) throw new Error('كلمة السر الجديدة لازم تكون مختلفة عن القديمة');
    if (/weak|short|at least/i.test(error.message)) throw new Error('كلمة السر ضعيفة — خليها 8 حروف/أرقام على الأقل');
    throw fail(error, 'تعذر تغيير كلمة السر');
  }
  return true;
}

export async function signOut() {
  const c = await sb();
  await c.auth.signOut();
}

/* ---------- Catalog ---------- */
export async function getProducts() {
  const c = await sb();
  const all = [];
  let after = null;
  for (let page = 0; page < 50; page += 1) {        // 50 × 1,000 rows is far above the sheet size
    const rows = ok(await c.rpc('cc_list_products', { p_after_sku: after, p_limit: PAGE }));
    all.push(...rows.map(toProduct));
    if (rows.length < PAGE) break;
    after = rows[rows.length - 1].sku;
  }
  return all;
}

/* Categories (like Foodics) with the codes of their products, in one call. */
export async function getCategories() {
  const c = await sb();
  return ok(await c.rpc('cc_list_categories'))
    .map((r) => ({ id: r.reference, name: r.name, productIds: r.skus || [] }));
}

export async function getAreas() {
  const c = await sb();
  return ok(await c.from('cc_delivery_areas').select('id, name, fee, active').order('name')).map(toArea);
}

/* Asks the call-center function cc-sale-unit to refresh "by weight / by unit"
   from the products sheet (is_sold_by_weight). It runs at most once every
   10 minutes; failures never block the app (the last known values stay). */
export async function syncSaleUnits() {
  const c = await sb();
  const { data, error } = await c.functions.invoke('cc-sale-unit', { body: {} });
  if (error) return { status: 'failed', error: error.message };
  return data;
}

export const getOrderStatuses = () => Promise.resolve(ORDER_STATUSES.map((s) => ({ ...s })));

/* ---------- Customers ---------- */
const CUSTOMER_SELECT = 'id, name, phone, phone2, cc_addresses(id, label, area_id, street, housing_type, notes, created_at)';

async function withLastOrder(c, rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const recent = ok(await c.from('cc_orders').select('customer_id, created_at')
    .in('customer_id', ids).order('created_at', { ascending: false }).limit(PAGE));
  const last = new Map();
  recent.forEach((o) => { if (!last.has(o.customer_id)) last.set(o.customer_id, o.created_at); });
  return rows.map((r) => toCustomer(r, last.get(r.id) ?? null));
}

/* Partial match on the main or second number (min 3 digits). */
export async function findCustomersByPhone(query) {
  const q = digits(query);
  if (q.length < 3) return [];
  const c = await sb();
  const rows = ok(await c.from('cc_customers').select(CUSTOMER_SELECT)
    .or(`phone.like.*${q}*,phone2.like.*${q}*`).order('name').limit(20));
  return withLastOrder(c, rows);
}

/* Suggestions while typing (CONFIRMED: from 3 digits, numbers that START with them, 8 at most). */
export async function suggestCustomersByPhone(prefix) {
  const q = digits(prefix);
  if (q.length < 3) return [];
  const c = await sb();
  const rows = ok(await c.from('cc_customers').select(CUSTOMER_SELECT)
    .or(`phone.like.${q}*,phone2.like.${q}*`).order('name').limit(8));
  return withLastOrder(c, rows);
}

/* Customers whose main or second number equals this number (phone2 is not unique — L6). */
export async function findCustomersByExactPhone(phone) {
  const q = digits(phone);
  if (!q) return [];
  const c = await sb();
  const rows = ok(await c.from('cc_customers').select(CUSTOMER_SELECT).or(`phone.eq.${q},phone2.eq.${q}`).order('name'));
  return withLastOrder(c, rows);
}

/* ---------- Orders ---------- */
const ORDER_SELECT = '*, cc_order_items(*), cc_order_events(*)';

export async function listCustomerOrders(customerId, limit = 5) {
  const c = await sb();
  return ok(await c.from('cc_orders').select(ORDER_SELECT).eq('customer_id', customerId)
    .order('created_at', { ascending: false }).limit(limit)).map(toOrder);
}

/* Not-cancelled orders placed today for this number (duplicate-order warning). */
export async function findTodayOrdersByPhone(phone) {
  const q = digits(phone);
  if (!q) return [];
  const c = await sb();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return ok(await c.from('cc_orders').select('id, order_no, created_at')
    .eq('customer_phone', q).neq('status', 'cancelled').gte('created_at', start.toISOString())
    .order('created_at', { ascending: false }))
    .map((o) => ({ id: o.id, number: o.order_no, createdAt: o.created_at }));
}

export async function phoneBelongsToCustomer(phone) {
  const [c0] = await findCustomersByExactPhone(phone);
  return c0 ? { id: c0.id, name: c0.name } : null;
}

/* Latest 1,000 orders, newest first (the board and the orders list filter them further). */
export async function listOrders() {
  const c = await sb();
  return ok(await c.from('cc_orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(PAGE)).map(toOrder);
}

export async function getOrder(id) {
  const c = await sb();
  const row = ok(await c.from('cc_orders').select(ORDER_SELECT).eq('id', id).maybeSingle());
  return row ? toOrder(row) : null;
}

/* Sending the same draft twice (double click, retry) returns the same order.
   The employee who took it is saved with it (cc_place_order). */
export async function createOrder(draft) {
  if (!draft.requestId) throw new Error('رقم المسودة مفقود — أعد فتح الطلب');
  if (!draft.agent?.id) throw new Error('اختار اسمك من قايمة الموظفين الأول');
  const c = await sb();
  const created = ok(await c.rpc('cc_place_order', { p_agent_id: draft.agent.id, ...toCreateOrderArgs(draft) }));
  return getOrder(created.id);
}

export async function cancelOrder(orderId, reason, agent) {
  if (!agent?.id) throw new Error('اختار اسمك من قايمة الموظفين الأول');
  const c = await sb();
  ok(await c.rpc('cc_cancel_order_as', { p_agent_id: agent.id, p_order_id: orderId, p_reason: reason }));
  return getOrder(orderId);
}

/* ---------- Employee names ---------- */
export async function getAgents() {
  const c = await sb();
  return ok(await c.from('cc_agents').select('id, name, active').order('name')).map(toAgent);
}

export async function saveAgent({ id = null, name, active = true }) {
  const c = await sb();
  return toAgent(ok(await c.rpc('cc_save_agent', { p_id: id || null, p_name: String(name).trim(), p_active: !!active })));
}

/* ---------- Delivery areas ---------- */
export async function saveArea({ id = null, name, fee, active = true }) {
  const c = await sb();
  return toArea(ok(await c.rpc('cc_save_area', {
    p_id: id || null, p_name: String(name).trim(), p_fee: Number(fee), p_active: !!active,
  })));
}
