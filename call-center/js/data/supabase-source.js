/* =====================================================================
 *  SUPABASE DATA SOURCE (DATA_MODE = 'supabase') — used through data-source.js.
 *
 *  Talks only to the call-center objects created by db/apply_cc.sql:
 *    reads  : cc_staff (own row), cc_delivery_areas, cc_customers, cc_addresses,
 *             cc_orders, cc_order_items, cc_order_events (RLS: the active account only)
 *             cc_agents (employee names)
 *    writes : the functions cc_place_order, cc_cancel_order_as, cc_save_area, cc_save_agent
 *    products: the function cc_list_products (code, name, barcode, price, sold_by)
 *    add-ons : cc_list_modifiers (groups, options, product links), cc_save_product_modifiers (admin)
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

/* Database messages that are still in Egyptian dialect, shown in simple standard
   Arabic. Only the text on screen changes; the database functions stay as they are. */
const DB_WORDING = [
  [/^أسماء الموظفين للأدمن بس$/, 'أسماء الموظفين للمسؤول فقط'],
  [/^اختار اسمك من قايمة الموظفين الأول$/, 'اختر اسمك من قائمة الموظفين أولًا'],
  [/^اسم العميل مطلوب وبحد أقصى 120 حرف$/, 'اسم العميل مطلوب وبحد أقصى 120 حرفًا'],
  [/^اسم العنوان مطلوب وبحد أقصى 40 حرف$/, 'اسم العنوان مطلوب وبحد أقصى 40 حرفًا'],
  [/^اسم المنطقة مطلوب وبحد أقصى 80 حرف$/, 'اسم المنطقة مطلوب وبحد أقصى 80 حرفًا'],
  [/^اكتب اسم الطيار ورقمه/, 'أدخل اسم الطيار ورقمه — مثال: محمد (01012345678)'],
  [/^اكتب الاسم \(بحد أقصى 40 حرف\)$/, 'أدخل الاسم (بحد أقصى 40 حرفًا)'],
  [/^الأكونت ده متوقف — كلّم المسؤول$/, 'هذا الحساب موقوف — تواصل مع المسؤول'],
  [/^الأكونت غير موجود$/, 'الحساب غير موجود'],
  [/^الاسم ده موجود بالفعل في القايمة$/, 'هذا الاسم موجود بالفعل في القائمة'],
  [/^التسجيل متوقف مؤقتًا بسبب محاولات كتير غلط — جرّب تاني بعد ساعة$/, 'التسجيل متوقف مؤقتًا بسبب محاولات خاطئة كثيرة — حاول مرة أخرى بعد ساعة'],
  [/^محاولات كتير غلط — جرّب تاني بعد ساعة$/, 'محاولات خاطئة كثيرة — حاول مرة أخرى بعد ساعة'],
  [/^الحسابات للأدمن بس$/, 'الحسابات للمسؤول فقط'],
  [/^الرسوم لازم تكون رقم صفر أو أكتر$/, 'يجب أن تكون الرسوم صفرًا أو أكثر'],
  [/^السطر (\d+) لازم يكون بالكمية أو بالوزن$/, 'يجب أن يكون السطر $1 بالكمية أو بالوزن'],
  [/^الشارع مطلوب وبحد أقصى 150 حرف$/, 'الشارع مطلوب وبحد أقصى 150 حرفًا'],
  [/^الصنف «(.+)» بيتباع بالوحدة — اكتب الكمية بالعدد$/, 'الصنف «$1» يُباع بالوحدة — أدخل الكمية بالعدد'],
  [/^الصنف «(.+)» بيتباع بالوزن — اكتب الوزن بالكيلو$/, 'الصنف «$1» يُباع بالوزن — أدخل الوزن بالكيلو'],
  [/^الطلب اتغيرت حالته من جهاز تاني — اعمل تحديث$/, 'تغيّرت حالة الطلب من جهاز آخر — يرجى التحديث'],
  [/^الطلب ده اتلغى — متكملش تجهيزه$/, 'تم إلغاء هذا الطلب، يرجى إيقاف تجهيزه'],
  [/^الطلب ده ملغي — مينفعش يتعدّل$/, 'هذا الطلب ملغي ولا يمكن تعديله'],
  [/^الطلب وصل الكاشير — أي تعديل يبقى بالتليفون مع الفرع$/, 'الطلب وصل إلى الكاشير — أي تعديل يتم بالتليفون مع الفرع'],
  [/^الكود لازم يكون من 8 لـ 40 حرف\/رقم$/, 'يجب أن يتكون الكود من 8 إلى 40 حرفًا أو رقمًا'],
  [/^المعلومات الإضافية بحد أقصى 200 حرف$/, 'المعلومات الإضافية بحد أقصى 200 حرف'],
  [/^المناطق والرسوم للأدمن بس$/, 'المناطق والرسوم للمسؤول فقط'],
  [/^تغيير حالة التجهيز للفرع بس$/, 'تغيير حالة التجهيز للفرع فقط'],
  [/^شاشة التجهيز للفرع بس$/, 'شاشة التجهيز للفرع فقط'],
  [/^للفرع بس$/, 'للفرع فقط'],
  [/^كود التسجيل للأدمن بس$/, 'كود التسجيل للمسؤول فقط'],
  [/^سجّل دخول الأول$/, 'سجّل الدخول أولًا'],
  [/^فيه منطقة بنفس الاسم$/, 'توجد منطقة بنفس الاسم'],
  [/^كود الصنف (.+) مكرر في شيت المنتجات — لازم يتصلح في الشيت الأول$/, 'كود الصنف $1 مكرر في شيت المنتجات — يجب تصحيحه في الشيت أولًا'],
  [/^لسه مفيش كود تسجيل — اطلبه من المسؤول$/, 'لا يوجد كود تسجيل بعد — اطلبه من المسؤول'],
  [/^مش هتقدر تغيّر صلاحية أكونتك إنت$/, 'لا يمكنك تغيير صلاحية حسابك'],
  [/^مفيش أي تغيير في الطلب$/, 'لا يوجد أي تغيير في الطلب'],
  [/^رقم الموبايل مسجل لعميل آخر — اختاره من نتائج البحث$/, 'رقم الموبايل مسجل لعميل آخر — اختره من نتائج البحث'],
];
export const dbWording = (msg) => {
  for (const [re, to] of DB_WORDING) if (re.test(msg)) return msg.replace(re, to);
  return msg;
};

/* Database errors carry an Arabic message; HINT names the form field (street, phone, …). */
/* The sign-in on this device ended (e.g. another account signed in on the same browser):
   the database sees no account → «permission denied for function». Say it plainly and
   go back to the sign-in screen once, instead of leaving a page that cannot load. */
let reloading = false;
const sessionEnded = (error) => error?.code === '42501' && /^permission denied for function/.test(error?.message || '');
function fail(error, fallback = 'حدثت مشكلة في الاتصال بقاعدة البيانات') {
  if (sessionEnded(error)) {
    if (!reloading) {
      reloading = true;
      // a second time within a minute: forget the stale sign-in on this device first (no reload loop)
      let again = false;
      try { again = Date.now() - Number(sessionStorage.getItem('cc-session-ended') || 0) < 60000; sessionStorage.setItem('cc-session-ended', String(Date.now())); } catch { /* private mode */ }
      setTimeout(async () => {
        if (again) await client?.auth.signOut({ scope: 'local' }).catch(() => {});
        location.reload();
      }, 2500);
    }
    const err = new Error('انتهى تسجيل الدخول على الجهاز ده — هيفتح شاشة الدخول. افتحي كل حساب في متصفح لوحده.');
    err.code = error.code;
    return err;
  }
  const err = new Error(error?.message ? dbWording(error.message) : fallback);
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

/* Add-ons copied onto an order line (13_modifiers.sql). */
export const toModifiers = (list) => (Array.isArray(list) ? list : []).map((m) => ({
  id: m.id, groupId: m.group_id || null, group: m.group || '', name: m.name, price: Number(m.price) || 0, qty: Number(m.qty) || 1,
}));

export function toOrder(r) {
  const items = (r.cc_order_items || []).slice().sort((a, b) => a.line_no - b.line_no).map((it) => {
    const base = { productId: it.sku, name: it.product_name, price: Number(it.unit_price) || 0, note: it.note || '', modifiers: toModifiers(it.modifiers) };
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
  const p_items = cart.map((l) => {
    const extra = {
      ...(l.note ? { note: l.note } : {}),
      ...(l.modifiers?.length ? { modifiers: l.modifiers.map((m) => ({ id: m.id, qty: m.qty })) } : {}),
    };
    return l.unitType === 'weight'
      ? { sku: l.productId, weight_grams: l.grams, ...extra }
      : { sku: l.productId, qty: l.qty, ...extra };
  });
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
  // One account per person (14_account_names.sql): the account's own name goes on its orders.
  // An account from before writes its name once (needsName).
  const named = 'agent_id' in row;
  return {
    id: session.user.id, name: row.display_name, role: row.role || 'admin', email: session.user.email || '',
    agentId: row.agent_id || null, needsName: named && !row.agent_id && row.role !== 'driver',   // a driver's name is set by the admin
  };
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
    ? { name: it.name, unitType: 'weight', grams: it.weight_grams, note: it.note || '', modifiers: toModifiers(it.modifiers) }
    : { name: it.name, unitType: 'piece', qty: it.qty, note: it.note || '', modifiers: toModifiers(it.modifiers) })),
});

export async function listPrepOrders() {
  const c = await sb();
  const res = await c.rpc('cc_prep_orders');
  if (res.error?.code === NOT_INSTALLED) throw new Error('شاشة التجهيز غير مفعّلة على قاعدة البيانات بعد');
  return ok(res).map(toPrepOrder);
}

/* «خرج مع الطيار» with the driver «الاسم (الرقم)». */
export async function sendOut(orderId, driver) {
  const c = await sb();
  const res = await c.rpc('cc_send_out', { p_order_id: orderId, p_driver: driver });
  if (res.error?.code === NOT_INSTALLED) throw new Error('خانة الطيار غير مفعّلة على قاعدة البيانات بعد');
  return ok(res);
}

/* ---------- Drivers (18_driver_tracking.sql) ---------- */
const PHOTO_BUCKET = 'cc-delivery-photos';
const toDriverAddress = (r) => ({ areaName: r.area_name, label: r.address_label, street: r.street, housingType: r.housing_type || '', notes: r.address_notes || '' });

/* The driver's screen: the order number and the address only. */
export async function getDriverOrders() {
  const c = await sb();
  const d = ok(await c.rpc('cc_driver_orders'));
  return {
    phone: d.phone || '',
    ready: (d.ready || []).map((r) => ({ id: r.id, number: r.order_no, assignedAt: r.assigned_at, address: toDriverAddress(r) })),
    mine: (d.mine || []).map((r) => ({
      id: r.id, number: r.order_no, outAt: r.out_at, tripId: r.trip_id, tripSeq: r.trip_seq, tripSize: r.trip_size,
      cancelled: !!r.cancelled, deliveredAt: r.delivered_at || null, address: toDriverAddress(r),
    })),
  };
}
export async function setPhone(userId, phone) {
  const c = await sb();
  return ok(await c.rpc('cc_set_phone', { p_user_id: userId || null, p_phone: String(phone || '') }));
}
/* «خرجت»: every order the branch picked for him leaves now (one trip). */
export async function driverTake() {
  const c = await sb();
  return ok(await c.rpc('cc_driver_take'));
}
/* Branch: «اختيار الطيار» for an order at the cashier (null = take him off). */
export async function assignDriver(orderId, driverId) {
  const c = await sb();
  return ok(await c.rpc('cc_assign_driver', { p_order_id: orderId, p_driver: driverId || null }));
}
/* «سلّمت»: the photo goes to the driver's own folder first, then the server records the time. */
export async function driverDelivered(orderId, photo, pos) {
  const c = await sb();
  const { data: { session } } = await c.auth.getSession();
  const path = `${session.user.id}/${orderId}-${Date.now()}.jpg`;
  const up = await c.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw new Error('الصورة ما اترفعتش — اتأكد من النت وجرّب تاني');
  return ok(await c.rpc('cc_driver_delivered', {
    p_order_id: orderId, p_photo: path, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, p_accuracy: pos?.accuracy ?? null,
  }));
}
/* The driver: «رجعت الفرع» with his place → { orders, distanceM, far } («بعيد عن الفرع»). */
export async function driverReturned(pos) {
  const c = await sb();
  const r = ok(await c.rpc('cc_driver_returned', { p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, p_accuracy: pos?.accuracy ?? null }));
  return { orders: r.orders, distanceM: r.distance_m ?? null, far: !!r.far };
}

/* The driver opens his personal link (#d=…): no e-mail, no password. */
const fnError = async (error) => {
  try { const b = await error.context.json(); if (b?.error) return b.error; } catch { /* not JSON */ }
  return 'تعذر الاتصال — اتأكد من النت وجرّب تاني';
};
export async function linkLogin(token) {
  const c = await sb();
  const { data, error } = await c.functions.invoke('cc-drivers', { body: { action: 'login', token } });
  if (error) throw new Error(await fnError(error));
  await c.auth.signOut({ scope: 'local' }).catch(() => {});   // another account on this phone
  const v = await c.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
  if (v.error) throw new Error('تعذر الدخول — افتح اللينك تاني');
  return getAccount();
}

/* Admin: the drivers (name, mobile, link). */
export async function adminDrivers() {
  const c = await sb();
  const res = await c.rpc('cc_admin_drivers');
  if (res.error?.code === NOT_INSTALLED) return null;
  return ok(res).map((r) => ({ userId: r.user_id, name: r.name, phone: r.phone || '', active: !!r.active, hasLink: !!r.has_link, lastOutAt: r.last_out_at }));
}
/* → { userId, token } — the token is shown once, in his link. */
export async function addDriver(name, phone) {
  const c = await sb();
  const { data, error } = await c.functions.invoke('cc-drivers', { body: { action: 'create', name, phone } });
  if (error) throw new Error(dbWording(await fnError(error)));
  return { userId: data.user_id, token: data.token };
}
export async function newDriverLink(userId) {
  const c = await sb();
  return ok(await c.rpc('cc_new_driver_link', { p_user_id: userId }));
}
export async function updateDriver({ userId, name, phone, active }) {
  const c = await sb();
  return ok(await c.rpc('cc_admin_update_driver', { p_user_id: userId, p_name: name, p_phone: phone, p_active: active }));
}
export async function branchPlace() {
  const c = await sb();
  const res = await c.rpc('cc_branch_place');
  if (res.error?.code === NOT_INSTALLED) return null;
  const r = ok(res);
  return r ? { lat: r.lat, lng: r.lng, radius: r.radius_m, updatedAt: r.updated_at } : null;
}
export async function setBranchPlace(lat, lng) {
  const c = await sb();
  return ok(await c.rpc('cc_set_branch_place', { p_lat: lat, p_lng: lng }));
}
/* The driver's place while he is out (about once a minute); ignored by the server when he is not. */
export async function driverPing(pos) {
  const c = await sb();
  const res = await c.rpc('cc_driver_ping', { p_lat: pos.lat, p_lng: pos.lng, p_accuracy: pos.accuracy ?? null });
  return !res.error && res.data === true;
}
/* Admin: «الطيارين دلوقتي» — the drivers out now with their last place. */
export async function driversNow() {
  const c = await sb();
  const res = await c.rpc('cc_drivers_now');
  if (res.error?.code === NOT_INSTALLED) return null;
  return ok(res).map((r) => ({ userId: r.user_id, name: r.name, phone: r.phone || '', orders: r.orders, delivered: r.delivered,
    outAt: r.out_at, lat: r.lat ?? null, lng: r.lng ?? null, accuracy: r.accuracy_m ?? null, seenAt: r.seen_at || null }));
}
/* Admin: «خط سير المشوار» — each driver out now: { points: his line since he left, stops: where he
   delivered (✓ + order number) } (20_driver_trail.sql). */
export async function driverTrails() {
  const c = await sb();
  const res = await c.rpc('cc_drivers_trails');
  if (res.error) return new Map();            // not installed yet: no lines, the map still works
  return new Map(res.data.map((r) => [r.user_id, {
    points: (r.points || []).map((p) => ({ lat: p[0], lng: p[1], at: p[2] })),
    stops: (r.stops || []).map((x) => ({ number: x.order_no, lat: x.lat, lng: x.lng, at: x.at, id: x.id || null,
      photoPath: x.photo_path || null,
      address: { areaName: x.area_name || '', label: x.address_label || '', street: x.street || '', housingType: x.housing_type || '', notes: x.address_notes || '' } })),
  }]));
}
/* Branch: «اتسلّم» / «رجع الفرع» times of today's orders that left (order id → times). */
export async function prepDeliveries() {
  const c = await sb();
  const res = await c.rpc('cc_prep_deliveries');
  if (res.error) return new Map();
  return new Map(res.data.map((r) => [r.order_id, { deliveredAt: r.delivered_at || null, returnedAt: r.returned_at || null }]));
}
export async function listDrivers() {
  const c = await sb();
  const res = await c.rpc('cc_list_drivers');
  if (res.error?.code === NOT_INSTALLED) return [];
  return ok(res).map((r) => ({ userId: r.user_id, label: r.label }));
}
/* Admin: record a step for a driver who forgot ('out' | 'delivered' | 'returned'). */
export async function adminDelivery(orderId, what, driverId = null) {
  const c = await sb();
  return ok(await c.rpc('cc_admin_delivery', { p_order_id: orderId, p_what: what, p_driver: driverId }));
}
const toDelivery = (r) => ({
  outByAdmin: !!r.out_by_admin, tripSeq: r.trip_seq ?? null, tripSize: r.trip_size ?? null, assignedAt: r.assigned_at || null,
  deliveredAt: r.delivered_at || null, deliveredAdmin: !!r.delivered_admin,
  returnedAt: r.returned_at || null, returnedAdmin: !!r.returned_admin,
  returnedLat: r.returned_lat ?? null, returnedLng: r.returned_lng ?? null, returnedDistance: r.returned_distance_m ?? null, returnedFar: !!r.returned_far,
  photoPath: r.photo_path || null, lat: r.lat ?? null, lng: r.lng ?? null, accuracy: r.accuracy_m ?? null,
});
export async function getOrderDelivery(orderId) {
  const c = await sb();
  const res = await c.rpc('cc_order_delivery_of', { p_order_id: orderId });
  if (res.error?.code === NOT_INSTALLED) return null;
  const r = ok(res);
  return r ? toDelivery(r) : null;
}
export async function deliveryReport(from, to) {
  const c = await sb();
  const res = await c.rpc('cc_delivery_report', { p_from: from, p_to: to });
  if (res.error?.code === NOT_INSTALLED) return null;
  return ok(res).map((r) => ({
    id: r.id, number: r.order_no, createdAt: r.created_at, areaName: r.area_name, atCashierAt: r.at_cashier_at, outAt: r.out_at,
    driverId: r.driver_user_id, driver: r.driver || '', tripId: r.trip_id, ...toDelivery(r),
    total: Number(r.total) || 0, deliveryFee: Number(r.delivery_fee) || 0,   // 19_driver_dashboard.sql
  }));
}
/* A delivery photo for the admin (a link that works for one hour). */
export async function photoUrl(path) {
  const c = await sb();
  const { data, error } = await c.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error('الصورة مش موجودة (الصور بتتمسح بعد 30 يوم)');
  return data.signedUrl;
}
export async function listPhones() {
  const c = await sb();
  const res = await c.rpc('cc_list_phones');
  if (res.error) return new Map();
  return new Map(res.data.map((r) => [r.user_id, r.phone]));
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
  if (res.error?.code === NOT_INSTALLED) throw new Error('تعديل الطلبات غير مفعّل على قاعدة البيانات بعد');
  ok(res);
  return getOrder(orderId);
}

export async function setStage(orderId, stage) {
  const c = await sb();
  return ok(await c.rpc('cc_set_stage', { p_order_id: orderId, p_stage: stage }));
}

export async function listStaff() {
  const c = await sb();
  let res = await c.rpc('cc_list_accounts');               // with each person's name (14_account_names.sql)
  if (res.error?.code === NOT_INSTALLED) res = await c.rpc('cc_list_staff');
  if (res.error?.code === NOT_INSTALLED) return null;
  return ok(res).map((r) => ({ id: r.user_id, email: r.email, name: r.name || '', role: r.role, active: !!r.active, createdAt: r.created_at }));
}

/* An account from before writes its name once. */
export async function setMyName(name) {
  const c = await sb();
  ok(await c.rpc('cc_set_my_name', { p_name: String(name || '').trim() }));
  return getAccount();
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
      throw new Error('يجب تأكيد البريد الإلكتروني أولًا — افتح رسالة Supabase في بريدك واضغط رابط التأكيد');
    }
    throw new Error(error.status === 400 ? 'كلمة المرور غير صحيحة' : 'تعذر تسجيل الدخول — تأكد من الاتصال بالإنترنت وحاول مرة أخرى');
  }
  const account = await getAccount();
  if (!account) throw new Error('هذا الحساب موقوف — تواصل مع المسؤول');
  return account;   // may be { pendingCode: true } → the screen asks for the registration code
}

/* Registration code: links this signed-in account as the call-center account. */
// PGRST202 = the function is not on the database yet (06_signup_code.sql not applied).
const NOT_INSTALLED = 'PGRST202';

export async function joinWithCode(code, name = '') {
  const c = await sb();
  let res = await c.rpc('cc_join_with_code', { p_code: String(code || ''), p_name: String(name || '').trim() });
  if (res.error?.code === NOT_INSTALLED) res = await c.rpc('cc_join_with_code', { p_code: String(code || '') });
  if (res.error?.code === NOT_INSTALLED) throw new Error('التسجيل بالكود غير مفعّل بعد — تواصل مع المسؤول');
  const linked = ok(res);
  if (!linked) throw new Error('كود التسجيل غير صحيح');
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
    if (m.includes('already')) throw new Error('هذا البريد الإلكتروني له حساب بالفعل — سجّل الدخول به');
    if (m.includes('not allowed') || m.includes('disabled')) throw new Error('إنشاء الحسابات مغلق في المشروع — يجب إنشاؤها من لوحة Supabase');
    if (m.includes('password')) throw new Error('كلمة المرور ضعيفة — اجعلها 8 أحرف أو أرقام على الأقل');
    if (error.status === 429 || error.code === 'over_email_send_rate_limit' || m.includes('rate limit')) {
      throw new Error('وصلنا للحد المسموح لإيميلات التسجيل — حاول بعد ساعة، أو اطلب من المسؤول تأكيد حسابك');
    }
    throw new Error('تعذر إنشاء الحساب — تأكد من الاتصال بالإنترنت وحاول مرة أخرى');
  }
  return { needsConfirmation: !data.session };
}

/* The signed-in account changes its own password (stays signed in on this device). */
export async function changePassword(password) {
  const c = await sb();
  const { error } = await c.auth.updateUser({ password });
  if (error) {
    if (/different from the old|same/i.test(error.message)) throw new Error('يجب أن تختلف كلمة المرور الجديدة عن القديمة');
    if (/weak|short|at least/i.test(error.message)) throw new Error('كلمة المرور ضعيفة — اجعلها 8 أحرف أو أرقام على الأقل');
    throw fail(error, 'تعذر تغيير كلمة المرور');
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

/* Add-ons (like Foodics): groups with their options and which product shows which group.
   Before 13_modifiers.sql is installed there are simply no add-ons. */
export async function getModifiers() {
  const c = await sb();
  const res = await c.rpc('cc_list_modifiers');
  if (res.error?.code === NOT_INSTALLED) return { groups: [], links: [] };
  const d = ok(res) || {};
  return {
    groups: (d.groups || []).map((g) => ({
      id: g.id, name: g.name, options: (g.options || []).map((o) => ({ id: o.id, name: o.name, price: Number(o.price) || 0 })),
    })),
    links: (d.links || []).map((l) => ({ sku: l.sku, groupId: l.group_id, min: Number(l.min) || 0, max: Number(l.max) || 1, defaultId: l.default || null })),
  };
}

/* Admin: the add-on groups of one product, in order: [{ groupId, min, max, defaultId }]. */
export async function saveProductModifiers(sku, links) {
  const c = await sb();
  const res = await c.rpc('cc_save_product_modifiers', {
    p_sku: sku, p_links: links.map((l) => ({ group_id: l.groupId, min: l.min, max: l.max, default: l.defaultId || null })),
  });
  if (res.error?.code === NOT_INSTALLED) throw new Error('الإضافات غير مفعّلة على قاعدة البيانات بعد');
  return ok(res);
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

/* Data center (the same sync the pricing / inventory / receiving tools run when they open — used as is,
   nothing in it is changed): when did it last pull the products sheet from Drive, and when were the
   products last published to products_master? Read only. */
export async function lastDataCenterSync() {
  const c = await sb();
  const last = async (type) => ok(await c.from('dc_sync_log').select('started_at')
    .eq('sync_type', type).eq('status', 'ok').order('started_at', { ascending: false }).limit(1))[0]?.started_at ?? null;
  const [pulledAt, publishedAt] = await Promise.all([last('products'), last('catalog_products_master')]);
  return { pulledAt, publishedAt };
}

/* Pull the sheets from Drive (dc-sync), then publish them to products_master (sync_catalog_from_dc —
   the server publishes at most once every 10 minutes). Exactly what the other tools call. */
export async function pullDataCenter() {
  const c = await sb();
  const { data, error } = await c.functions.invoke('dc-sync', { body: {} });
  if (error) throw new Error(`تعذّر التحديث من الدرايف: ${error.message}`);
  const products = (data?.results || []).find((r) => r.table === 'dc_products');
  return { products: products ?? null, failed: (data?.results || []).filter((r) => r.status === 'failed').map((r) => r.table) };
}
export async function publishDataCenter() {
  const c = await sb();
  for (let attempt = 0; ; attempt += 1) {
    const { data, error } = await c.rpc('sync_catalog_from_dc');
    if (!error) return Array.isArray(data) ? data[0] : data;
    if (attempt || !/timeout|Thread killed/i.test(error.message)) throw new Error(`تعذّر نشر المنتجات: ${error.message}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
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
/* ---------- Customers page (15_customer_profile.sql) ---------- */
const toStats = (s) => ({
  orders: Number(s.orders) || 0, cancelled: Number(s.cancelled) || 0,
  total: Number(s.total) || 0, average: Number(s.average) || 0,
  firstOrderAt: s.first_order_at || null, lastOrderAt: s.last_order_at || null,
  foodicsOrders: s.foodics_total_orders ?? null, foodicsLastOrderAt: s.foodics_last_order_at || null,
  topProducts: (s.top_products || []).map((p) => ({ id: p.sku, name: p.name, orders: Number(p.orders) || 0, qty: p.qty == null ? null : Number(p.qty), grams: p.grams == null ? null : Number(p.grams) })),
  topModifiers: (s.top_modifiers || []).map((m) => ({ name: m.name, times: Number(m.times) || 0 })),
  topArea: s.top_area ? { name: s.top_area.name, orders: Number(s.top_area.orders) || 0 } : null,
});

/* Customers with their totals: { rows, total }. null = not installed on the database yet. */
export async function listCustomerSummaries({ q = '', sort = 'last', limit = 50, offset = 0 } = {}) {
  const c = await sb();
  const res = await c.rpc('cc_list_customers', { p_q: q || null, p_sort: sort, p_limit: limit, p_offset: offset });
  if (res.error?.code === NOT_INSTALLED) return null;
  const rows = ok(res);
  return {
    total: rows.length ? Number(rows[0].full_count) : 0,
    rows: rows.map((r) => ({
      id: r.id, name: r.name, phones: [r.phone, r.phone2].filter(Boolean),
      orders: Number(r.orders) || 0, total: Number(r.total) || 0, lastOrderAt: r.last_order_at || null,
      foodicsOrders: r.foodics_total_orders ?? null, foodicsLastOrderAt: r.foodics_last_order_at || null,
    })),
  };
}

export async function getCustomerStats(customerId) {
  const c = await sb();
  const res = await c.rpc('cc_customer_stats', { p_customer_id: customerId });
  if (res.error?.code === NOT_INSTALLED) return null;
  return toStats(ok(res) || {});
}

/* ---------- Blocked numbers (16_blocked_numbers.sql) ---------- */
const toBlock = (r) => ({ source: r.source, by: r.blocked_by_name || '', at: r.blocked_at });

export async function getBlocked(phones) {
  const list = [...new Set((phones || []).map(digits).filter(Boolean))];
  const c = await sb();
  const res = await c.rpc('cc_blocked_of', { p_phones: list });
  if (res.error?.code === NOT_INSTALLED) return null;
  return new Map(ok(res).map((r) => [r.phone, toBlock(r)]));
}

export async function listBlocked() {
  const c = await sb();
  const res = await c.rpc('cc_list_blocked');
  if (res.error?.code === NOT_INSTALLED) return null;
  return ok(res).map((r) => ({ phone: r.phone, customerId: r.customer_id || null, customerName: r.customer_name || '', ...toBlock(r) }));
}

export async function setBlocked(phones, blocked) {
  const c = await sb();
  return ok(await c.rpc('cc_set_blocked', { p_phones: (phones || []).map(digits).filter(Boolean), p_blocked: !!blocked }));
}

export async function getCustomer(id) {
  const c = await sb();
  const row = ok(await c.from('cc_customers').select(CUSTOMER_SELECT).eq('id', id).maybeSingle());
  return row ? toCustomer(row) : null;
}

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
  if (!draft.agent?.id) throw new Error('اختر اسمك من قائمة الموظفين أولًا');
  const c = await sb();
  const created = ok(await c.rpc('cc_place_order', { p_agent_id: draft.agent.id, ...toCreateOrderArgs(draft) }));
  return getOrder(created.id);
}

export async function cancelOrder(orderId, reason, agent) {
  if (!agent?.id) throw new Error('اختر اسمك من قائمة الموظفين أولًا');
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
