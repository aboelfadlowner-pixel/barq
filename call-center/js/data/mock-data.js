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

/* CONFIRMED: two accounts only. Demo login — no passwords in the demo. */
export const demoAccounts = [
  { id: 'acc-agent',      role: 'agent',      name: 'موظف الكول سنتر' },
  { id: 'acc-supervisor', role: 'supervisor', name: 'المشرف' },
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
];

/* ---------- Delivery areas & fees — PLACEHOLDERS ----------
 * Real areas and fee rules are NOT confirmed. Names are deliberately generic. */
export const areas = [
  { id: 'area-a', name: 'المنطقة أ (تجريبي)', fee: 15 },
  { id: 'area-b', name: 'المنطقة ب (تجريبي)', fee: 20 },
  { id: 'area-c', name: 'المنطقة ج (تجريبي)', fee: 25 },
  { id: 'area-d', name: 'المنطقة د (تجريبي)', fee: 30 },
  { id: 'area-e', name: 'المنطقة هـ (تجريبي)', fee: 40 },
  { id: 'area-f', name: 'المنطقة و (تجريبي)', fee: 50 },
  { id: 'area-g', name: 'المنطقة ز (موقوفة)', fee: 35, active: false },
].map((a) => ({ active: true, ...a }));

/* ---------- Order statuses — CONFIRMED: new and cancelled only ---------- */
export const orderStatuses = [
  { id: 'new',       label: 'جديد', tone: 'blue' },
  { id: 'cancelled', label: 'ملغي', tone: 'red' },
];

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
    addr('c-3-a1', 'area-e', 'شارع تجريبي 22', '7', '2', '4', 'خلف المسجد'),
  ] },
  { id: 'c-4', name: 'سارة إبراهيم', phones: ['01500000004'], addresses: [
    addr('c-4-a1', 'area-a', 'شارع تجريبي 3', '15', '6', '12'),
  ] },
  { id: 'c-5', name: 'محمد علي', phones: ['01000000005'], addresses: [] },
  { id: 'c-6', name: 'هبة مصطفى', phones: ['01000000006'], addresses: [
    addr('c-6-a1', 'area-f', 'شارع تجريبي 30', '9', '4', '8', 'بجوار البنك'),
  ] },
  // Shares a number with c-1 (as a second number) — demonstrates the L6 warning.
  { id: 'c-7', name: 'نادية محمود', phones: ['01000000007', '01000000001'], addresses: [
    addr('c-7-a1', 'area-b', 'شارع تجريبي 40', '2', '1', '3', 'نفس عمارة الصيدلية'),
  ] },
];

// Address names and housing types for the Foodics-style address cards.
customers.forEach((c) => c.addresses.forEach((a, i) => {
  a.label ??= a.notes === 'عنوان العمل' ? 'الشغل' : (i === 0 ? 'البيت' : 'عنوان ' + (i + 1));
  a.housingType ??= a.notes === 'عنوان العمل' ? 'office' : 'apartment';
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

    const history = [{ status: 'new', at: created.toISOString(), by: demoAccounts[0].name }];
    if (t.st === 'cancelled') {
      history.push({ status: 'cancelled', at: new Date(created.getTime() + 20 * 60000).toISOString(),
        by: demoAccounts[1].name, reason: 'العميل لغى الطلب بالتليفون' });
    }

    return {
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
      employee: demoAccounts[0].name,
      cancelReason: history[1]?.reason ?? '',
      isDemo: true,
    };
  });
}
