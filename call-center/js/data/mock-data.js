/* =====================================================================
 *  MOCK DATA — بيانات تجريبية للعرض فقط
 *
 *  Every product, price, customer, phone number, delivery area, fee,
 *  order status and order below is FICTIONAL. Nothing here comes from
 *  Supabase, the website, Foodics or any real system.
 *
 *  The UI never imports this file directly. It goes through
 *  js/data/data-source.js, which is the single place to swap in the
 *  real data source after it is verified and approved.
 * ===================================================================== */

export const MOCK_LABEL = 'بيانات تجريبية';

/* The demo opens directly as the admin (add ?role=call_center or ?role=prep to the link to see the others). */
export const account = { id: 'acc-cc', name: 'مركز الاتصال', role: 'admin', email: 'admin@demo' };
export const staff = [
  { id: 'acc-cc',   email: 'admin@demo',       role: 'admin',       active: true, createdAt: '2026-10-01T09:00:00Z' },
  { id: 'acc-cc2',  email: 'callcenter@demo',  role: 'call_center', active: true, createdAt: '2026-10-05T09:00:00Z' },
  { id: 'acc-prep', email: 'betash.prep@demo', role: 'prep',        active: true, createdAt: '2026-10-10T09:00:00Z' },
];

/* CONFIRMED: after signing in, the person picks their name from this list
   (managed from the settings screen). Names here are fictional. */
export const agents = [
  { id: 'ag-1', name: 'عمر',  active: true },
  { id: 'ag-2', name: 'كريم', active: true },
  { id: 'ag-3', name: 'منى',  active: true },
];

/* ---------- Products (sample names, fake prices) ----------
 * unitType: 'weight' → sold by weight, price is per kg, quantity may have decimals (kg)
 *           'piece' / 'pack' → sold by unit, quantity must be a whole number.
 * ⚠️ The real products sheet (products_master) has no such column yet — where
 *    this flag will come from is still open.
 * image:    optional URL; cards fall back to an icon when null.          */
const p = (code, name, unitType, unitLabel, price, image = null) =>
  ({ id: code.toLowerCase(), code, name, unitType, unitLabel, price, image });

export const products = [
  p('M-101', 'جبنة رومي قديمة',      'weight', 'بالكيلو', 420),
  p('M-102', 'جبنة رومي وسط',        'weight', 'بالكيلو', 360),
  p('M-103', 'جبنة شيدر',            'weight', 'بالكيلو', 380),
  p('M-104', 'جبنة إسطنبولي',        'weight', 'بالكيلو', 160),
  p('M-105', 'جبنة فيتا',            'weight', 'بالكيلو', 150),
  p('M-106', 'جبنة موتزاريلا',       'weight', 'بالكيلو', 310),
  p('M-107', 'جبنة قريش',            'weight', 'بالكيلو', 95),
  p('M-108', 'جبنة ريكفورد',         'weight', 'بالكيلو', 540),
  p('M-109', 'جبنة مش',              'weight', 'بالكيلو', 110),
  p('M-110', 'جبنة جودا',            'weight', 'بالكيلو', 450),
  p('M-111', 'جبنة كريمي',           'pack',   'علبة 250 جم', 48),
  p('M-112', 'جبنة مثلثات',          'pack',   'علبة 8 قطع', 40),
  p('M-113', 'جبنة شرائح توست',      'pack',   'عبوة 200 جم', 65),

  p('M-201', 'لبن كامل الدسم',       'pack',  'عبوة 1 لتر', 42),
  p('M-202', 'لبن خالي الدسم',       'pack',  'عبوة 1 لتر', 40),
  p('M-203', 'زبادي طبيعي',          'piece', 'كوب 105 جم', 9),
  p('M-204', 'زبادي يوناني',         'piece', 'كوب 150 جم', 24),
  p('M-205', 'لبن رايب',             'pack',  'عبوة 1 لتر', 36),
  p('M-206', 'لبن بالفراولة',        'piece', 'زجاجة 250 مل', 15),
  p('M-207', 'قشطة',                 'pack',  'علبة 200 جم', 38),

  p('M-301', 'زبدة فلاحي',           'weight', 'بالكيلو', 360),
  p('M-302', 'زبدة',                 'pack',   'عبوة 200 جم', 78),
  p('M-303', 'سمن بلدي',             'weight', 'بالكيلو', 380),
  p('M-304', 'سمن نباتي',            'pack',   'علبة 800 جم', 120),

  p('M-401', 'لانشون بقري',          'weight', 'بالكيلو', 260),
  p('M-402', 'لانشون بالزيتون',      'weight', 'بالكيلو', 280),
  p('M-403', 'بسطرمة',               'weight', 'بالكيلو', 680),
  p('M-404', 'تركي مدخن',            'weight', 'بالكيلو', 490),
  p('M-405', 'سلامي',                'weight', 'بالكيلو', 430),

  p('M-501', 'زيتون أخضر',           'weight', 'بالكيلو', 120),
  p('M-502', 'زيتون أسود',           'weight', 'بالكيلو', 145),
  p('M-503', 'زيتون كالاماتا',       'weight', 'بالكيلو', 220),
  p('M-504', 'مخلل مشكل',            'weight', 'بالكيلو', 60),
  p('M-505', 'ليمون مخلل',           'weight', 'بالكيلو', 70),

  p('M-601', 'حلاوة طحينية',         'weight', 'بالكيلو', 150),
  p('M-602', 'عسل نحل',              'pack',   'برطمان 500 جم', 160),
  p('M-603', 'مربى فراولة',          'pack',   'برطمان 400 جم', 48),
  p('M-604', 'طحينة',                'pack',   'برطمان 300 جم', 58),
  p('M-605', 'فول مدمس',             'piece',  'علبة 400 جم', 20),

  p('M-701', 'أرز مصري',             'pack', 'كيس 1 كجم', 38),
  p('M-702', 'سكر',                  'pack', 'كيس 1 كجم', 36),
  p('M-703', 'مكرونة',               'pack', 'كيس 400 جم', 18),
  p('M-704', 'زيت عباد الشمس',       'pack', 'زجاجة 1 لتر', 88),
  p('M-705', 'عدس أصفر',             'pack', 'كيس 1 كجم', 62),
  p('M-706', 'بيض',                  'pack', 'كرتونة 30 بيضة', 165),

  p('M-801', 'مياه معدنية',          'piece', 'زجاجة 1.5 لتر', 9),
  p('M-802', 'عصير برتقال',          'pack',  'عبوة 1 لتر', 46),
  p('M-803', 'عصير مانجو',           'pack',  'عبوة 1 لتر', 46),
  p('M-804', 'شاي',                  'pack',  'علبة 100 فتلة', 95),

  p('M-901', 'ارز بلبن ابو الفضل',   'piece', 'علبة', 25),
  p('M-902', 'ايس كريم بريميم',      'piece', 'كوب', 35),
];

/* ---------- Categories (like Foodics) — sample names; the real ones come from
 * the Foodics categories export. skus = product codes in the category. */
const cat = (id, name, codes) => ({ id, name, productIds: codes.map((c) => c.toLowerCase()) });
export const categories = [
  cat('c01', 'اجبان',               ['M-101', 'M-102', 'M-103', 'M-104', 'M-105', 'M-106', 'M-107', 'M-108', 'M-109', 'M-110', 'M-111', 'M-112', 'M-113']),
  cat('c02', 'منتجات البان و زبادي', ['M-201', 'M-202', 'M-203', 'M-204', 'M-205', 'M-206', 'M-207']),
  cat('c03', 'سمنة وزبدة',          ['M-301', 'M-302', 'M-303', 'M-304']),
  cat('c04', 'مصنعات',              ['M-401', 'M-402', 'M-403', 'M-404', 'M-405']),
  cat('c05', 'مخلل',                ['M-501', 'M-502', 'M-503', 'M-504', 'M-505']),
  cat('c06', 'مربات',               ['M-601', 'M-602', 'M-603', 'M-604', 'M-605']),
  cat('c07', 'مكرونة و ارز',        ['M-701', 'M-702', 'M-703', 'M-704', 'M-705', 'M-706']),
  cat('c08', 'شاي و قهوة',          ['M-801', 'M-802', 'M-803', 'M-804']),
  cat('c09', 'حلويات',              ['M-901', 'M-902']),
];

/* ---------- Add-ons (like Foodics) — from the Foodics export «الاضافات / خيارات الاضافات».
 * links: which product shows which group, with the minimum and maximum (set by the admin). */
const opt = (id, name, price) => ({ id, name, price });
export const modifiers = {
  groups: [
    { id: 'g-rice', name: 'اضافة ارز بلبن', options: [opt('o-r1', 'قشطة بيور', 15), opt('o-r2', 'عسل', 5), opt('o-r3', 'مكسرات', 20)] },
    { id: 'g-nuts', name: 'اضافة مكسرات ايس كريم', options: [opt('o-n1', 'عسل', 5), opt('o-n2', 'قشطة بيور', 15), opt('o-n3', 'ايس كريم بريميم', 25), opt('o-n4', 'مكسرات ايس كريم', 20)] },
    { id: 'g-prem', name: 'ايس كريم بريميم 35', options: [opt('o-p1', 'ريد فلفلت', 0), opt('o-p2', 'موز', 0), opt('o-p3', 'كوتن كاندي', 0), opt('o-p4', 'مستكة', 0), opt('o-p5', 'فسدق', 0), opt('o-p6', 'شوكلاته ديفوجين', 0)] },
    { id: 'g-sauce', name: 'Extra Sauce', options: [opt('o-s1', 'صوص بستاشيو', 20), opt('o-s2', 'صوص كرميل', 10), opt('o-s3', 'صوص شوكلاتة', 10), opt('o-s4', 'صوص فراولة', 10)] },
  ],
  links: [
    { sku: 'm-901', groupId: 'g-rice', min: 0, max: 5 },
    { sku: 'm-901', groupId: 'g-nuts', min: 0, max: 5 },
    { sku: 'm-902', groupId: 'g-prem', min: 1, max: 2 },
    { sku: 'm-902', groupId: 'g-sauce', min: 0, max: 3 },
  ],
};

/* ---------- Delivery areas — CONFIRMED names; fees are PLACEHOLDERS ----------
 * The four delivery areas. Real fees will be entered from the "المناطق والرسوم" screen. */
export const areas = [
  { id: 'area-a', name: 'الدخيلة',          fee: 15 },
  { id: 'area-b', name: 'خارج الهانوفيل',   fee: 25 },
  { id: 'area-c', name: 'الهانوفيل',        fee: 20 },
  { id: 'area-d', name: 'البيطاش',          fee: 20 },
].map((a) => ({ active: true, ...a }));

/* ---------- Order statuses — CONFIRMED: new and cancelled only (shared with the real source) ---------- */
export { ORDER_STATUSES as orderStatuses } from '../constants.js';

/* ---------- Customers (fictional names, fake numbers) ---------- */
const addr = (id, areaId, street, building, floor = '', apartment = '', landmark = '', notes = '') =>
  ({ id, areaId, street, building, floor, apartment, landmark, notes });

export const customers = [
  { id: 'c-1', name: 'أحمد محمود', phones: ['01000000001'], addresses: [
    addr('c-1-a1', 'area-a', 'شارع تجريبي 1', '12', '3', '7', 'بجوار صيدلية'),
    addr('c-1-a2', 'area-c', 'شارع تجريبي 5', '4', '1', '2', '', 'عنوان العمل'),
  ] },
  { id: 'c-2', name: 'منى عبد الله', phones: ['01000000002', '01100000002'], addresses: [
    addr('c-2-a1', 'area-b', 'شارع تجريبي 8', '20', '5', '10', 'أمام مدرسة'),
    addr('c-2-a2', 'area-d', 'شارع تجريبي 14', '3', 'أرضي', '1'),
  ] },
  { id: 'c-3', name: 'كريم حسن', phones: ['01200000003'], addresses: [
    addr('c-3-a1', 'area-c', 'شارع تجريبي 22', '7', '2', '4', 'خلف المسجد'),
  ] },
  { id: 'c-4', name: 'سارة إبراهيم', phones: ['01500000004'], addresses: [
    addr('c-4-a1', 'area-a', 'شارع تجريبي 3', '15', '6', '12'),
  ] },
  { id: 'c-5', name: 'محمد علي', phones: ['01000000005'], addresses: [] },
  { id: 'c-6', name: 'هبة مصطفى', phones: ['01000000006'], addresses: [
    addr('c-6-a1', 'area-d', 'شارع تجريبي 30', '9', '4', '8', 'بجوار البنك'),
  ] },
  // Shares a number with c-1 (as a second number) — demonstrates the L6 warning.
  { id: 'c-7', name: 'نادية محمود', phones: ['01000000007', '01000000001'], addresses: [
    addr('c-7-a1', 'area-b', 'شارع تجريبي 40', '2', '1', '3', 'نفس عمارة الصيدلية'),
  ] },
];

// Address names and housing types for the Foodics-style address cards.
customers.forEach((c) => c.addresses.forEach((a, i) => {
  a.label ??= a.notes === 'عنوان العمل' ? 'الشغل' : (i === 0 ? 'البيت' : 'عنوان ' + (i + 1));
  a.housingType ??= a.notes === 'عنوان العمل' ? 'office' : (a.id === 'c-6-a1' ? 'villa' : 'building');
}));

/* ---------- Sample orders ----------
 * Times are generated relative to "now" so the list always has orders
 * for today, yesterday and a few days ago.
 * items: [productId, amount, note?]  amount = qty, or 'NNNg' for a line sold by weight. */
const ORDER_TEMPLATES = [
  { day: 3, time: '13:10', c: 'c-4', a: 'c-4-a1', st: 'new'      , items: [['m-701', 2], ['m-702', 1], ['m-104', '500g']] },
  { day: 3, time: '18:45', c: 'c-1', a: 'c-1-a2', st: 'new'      , items: [['m-103', '250g'], ['m-201', 3]] },
  { day: 1, time: '10:20', c: 'c-6', a: 'c-6-a1', st: 'new'      , items: [['m-601', '1000g'], ['m-602', 1], ['m-107', '500g']] },
  { day: 1, time: '12:05', c: 'c-2', a: 'c-2-a1', st: 'new'      , items: [['m-401', '500g', 'شرائح'], ['m-111', 2]] },
  { day: 1, time: '16:30', c: 'c-3', a: 'c-3-a1', st: 'cancelled', items: [['m-108', '250g']] },
  { day: 1, time: '20:15', c: 'c-4', a: 'c-4-a1', st: 'new'      , items: [['m-706', 1], ['m-203', 6], ['m-801', 6]] },
  { day: 0, time: '09:35', c: 'c-4', a: 'c-4-a1', st: 'new'      , items: [['m-701', 2], ['m-702', 2], ['m-705', 1], ['m-706', 1]] },
  { day: 0, time: '10:50', c: 'c-6', a: 'c-6-a1', st: 'new'      , items: [['m-601', '500g'], ['m-107', '500g'], ['m-205', 2]] },
  { day: 0, time: '11:40', c: 'c-2', a: 'c-2-a2', st: 'cancelled', items: [['m-110', '250g']] },
  { day: 0, time: '12:25', c: 'c-3', a: 'c-3-a1', st: 'new',       items: [['m-403', '250g', 'شرائح رفيعة'], ['m-103', '500g'], ['m-704', 1]] },
  { day: 0, time: '13:15', c: 'c-2', a: 'c-2-a1', st: 'new'      , items: [['m-104', '1000g'], ['m-203', 6], ['m-602', 1]] },
  { day: 0, time: '14:05', c: 'c-1', a: 'c-1-a1', st: 'new',       items: [['m-101', '500g'], ['m-201', 2], ['m-501', '250g', 'منزوع النوى']] },
];

export function buildSampleOrders(now = new Date()) {
  const byId = (list, id) => list.find((x) => x.id === id);
  let todayIndex = 0;
  const todayCount = ORDER_TEMPLATES.filter((t) => t.day === 0).length;

  return ORDER_TEMPLATES.map((t, i) => {
    const [hh, mm] = t.time.split(':').map(Number);
    const created = new Date(now);
    created.setDate(created.getDate() - t.day);
    created.setHours(hh, mm, 0, 0);
    // Keep "today" samples in the past even when the demo runs early in the day.
    if (t.day === 0) {
      todayIndex += 1;
      if (created > now) created.setTime(now.getTime() - (todayCount - todayIndex + 1) * 6 * 60000);
    }

    const cust = byId(customers, t.c);
    const address = byId(cust.addresses, t.a);
    const area = byId(areas, address.areaId);
    const items = t.items.map(([pid, amount, note = '']) => {
      const prod = byId(products, pid);
      const base = { productId: prod.id, name: prod.name, unitType: prod.unitType, unitLabel: prod.unitLabel, price: prod.price, note };
      return typeof amount === 'string' && amount.endsWith('g')
        ? { ...base, unitType: 'weight', grams: parseInt(amount, 10) }
        : { ...base, qty: amount };
    });

    const agent = agents[i % agents.length];
    const canceller = agents[(i + 1) % agents.length];
    const history = [{ status: 'new', at: created.toISOString(), by: agent.name }];
    if (t.st === 'cancelled') {
      history.push({ status: 'cancelled', at: new Date(created.getTime() + 20 * 60000).toISOString(),
        by: canceller.name, reason: 'العميل لغى الطلب بالتليفون' });
    }

    // Demo preparation stages for today's orders (new → preparing → at_cashier → out).
    const stage = t.st === 'cancelled' || t.day !== 0 ? (t.day !== 0 && t.st !== 'cancelled' ? 'out' : 'new')
      : ['new', 'preparing', 'at_cashier', 'out'][(todayCount - todayIndex) % 4];   // the newest order is «جديد»
    const step = (n) => new Date(created.getTime() + n * 5 * 60000).toISOString();
    const reached = ['new', 'preparing', 'at_cashier', 'out'].indexOf(stage);
    return {
      stage,
      preparingAt: reached >= 1 ? step(1) : null,
      atCashierAt: reached >= 2 ? step(2) : null,
      outAt: reached >= 3 ? step(3) : null,
      id: `o-${1001 + i}`,
      number: `DEMO-${1001 + i}`,
      createdAt: created.toISOString(),
      type: 'delivery',
      paymentMethod: 'cash',
      customer: { id: cust.id, name: cust.name, phone: cust.phones[0] },
      address: { ...address, areaName: area.name },
      deliveryFee: area.fee,
      items,
      note: '',
      status: t.st,
      statusHistory: history,
      agentId: agent.id,
      employee: agent.name,
      cancelReason: history[1]?.reason ?? '',
      isDemo: true,
    };
  });
}
