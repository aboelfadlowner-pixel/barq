/* «التوصيل» (admin only) — 18_driver_tracking.sql.
   For a day or a period: how long the driver waited after the branch picked him (picked → out),
   how long the delivery took (out → delivered), how long the driver
   took to come back after his last delivery of the trip, per driver and per area, and every
   order with its photo and the driver's place. Late = more than 45 minutes for the first order
   of a trip, +10 minutes for each order after it (to be adjusted from real numbers). */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { formatTime, dayLabel } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { openModal, showToast } from '../components/modal.js';
import { mountDriversNow } from '../components/drivers-now.js';
import { money } from '../components/chips.js';

const LATE_FIRST = 45;     // minutes, first order of a trip
const LATE_STEP = 10;      // + minutes for each next order in the same trip
const PERIODS = [
  { id: 'today', label: 'النهارده' },
  { id: 'yesterday', label: 'إمبارح' },
  { id: 'week', label: 'آخر 7 أيام' },
  { id: 'month', label: 'آخر 30 يوم' },
];
const state = { period: 'today' };   // kept while going to an order and back

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function range(period) {
  const today = new Date();
  const back = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  if (period === 'yesterday') return [iso(back(1)), iso(back(1))];
  if (period === 'week') return [iso(back(6)), iso(today)];
  if (period === 'month') return [iso(back(29)), iso(today)];
  return [iso(today), iso(today)];
}
const minutes = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000)) : null);
const avg = (xs) => { const v = xs.filter((x) => x != null); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };
const minText = (m) => (m == null ? '—' : `${m} د`);
const limitOf = (r) => LATE_FIRST + LATE_STEP * Math.max(0, (r.tripSeq || 1) - 1);

/* Each order + its delivery minutes, the trip's return minutes, and whether it is late. */
function enrich(rows) {
  const trips = new Map();
  rows.forEach((r) => { const t = trips.get(r.tripId) ?? []; t.push(r); trips.set(r.tripId, t); });
  const now = new Date().toISOString();
  return rows.map((r) => {
    const trip = trips.get(r.tripId) ?? [r];
    const lastDelivered = trip.map((x) => x.deliveredAt).filter(Boolean).sort().pop() ?? null;
    const deliverMin = minutes(r.outAt, r.deliveredAt);
    const waiting = !r.deliveredAt ? minutes(r.outAt, now) : null;
    return {
      ...r, deliverMin,
      waitMin: minutes(r.assignedAt, r.outAt),     // picked by the branch → he left
      backMin: r.returnedAt && lastDelivered ? minutes(lastDelivered, r.returnedAt) : null,
      late: deliverMin != null ? deliverMin > limitOf(r) : waiting > limitOf(r),
      noPlace: !!r.deliveredAt && !r.deliveredAdmin && r.lat == null,
      byAdmin: r.outByAdmin || r.deliveredAdmin || r.returnedAdmin,
      far: !!r.returnedFar,                        // «رجعت الفرع» far from the branch
    };
  });
}

/* CONFIRMED «لوحة الطيارين»: kilometres are ESTIMATED — for each trip, from the branch to each
   delivery place (in the order they were delivered) and back, × 1.3 for the streets.
   Orders delivered without a place are left out of the distance. */
const ROAD = 1.3;
const metres = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};
function tripKm(rows, branch) {
  if (branch?.lat == null) return null;
  const trips = new Map();
  rows.filter((r) => r.lat != null && r.deliveredAt).forEach((r) => { const t = trips.get(r.tripId) ?? []; t.push(r); trips.set(r.tripId, t); });
  let m = 0;
  trips.forEach((t) => {
    const pts = t.sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt));
    let at = branch;
    pts.forEach((p) => { m += metres(at, p); at = p; });
    m += metres(at, branch);
  });
  return (m * ROAD) / 1000;
}
const kmText = (k) => (k == null ? '—' : `${k < 10 ? k.toFixed(1) : Math.round(k)} كم`);
const sum = (rows, k) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
const bars = (items, fmt) => {
  const max = Math.max(1, ...items.map((x) => x.value));
  return `<div class="dd-bars">${items.map((x) => `
    <div class="dd-bar"><span class="dd-name">${esc(x.name)}</span>
      <span class="dd-track"><span class="dd-fill" style="width:${Math.round((x.value / max) * 100)}%"></span></span>
      <span class="dd-val num">${fmt(x.value)}</span></div>`).join('')}</div>`;
};

/* Return minutes counted once per trip; «بعيد عن الفرع» too. */
const tripBacks = (rows) => [...new Map(rows.filter((r) => r.backMin != null).map((r) => [r.tripId, r.backMin])).values()];
const farTrips = (rows) => new Set(rows.filter((r) => r.far).map((r) => r.tripId)).size;

export function mountDelivery(view) {
  view.innerHTML = `
    <div class="page"><div class="page-inner">
      <div class="page-head">
        <div>
          <h1 class="title-icon">${icon('package')}التوصيل</h1>
          <div class="page-sub"><span>وقت التوصيل والرجوع لكل طيار ولكل منطقة — للإدارة بس</span></div>
        </div>
      </div>
      <div data-drivers-now></div>
      <div class="chips period-chips" role="tablist">${PERIODS.map((p) => `
        <button type="button" class="chip ${p.id === state.period ? 'is-on' : ''}" data-period="${p.id}" role="tab" aria-selected="${p.id === state.period}">${p.label}</button>`).join('')}</div>
      <div data-body><p class="muted">جارٍ التحميل…</p></div>
    </div></div>`;
  const body = view.querySelector('[data-body]');
  const unmountNow = mountDriversNow(view.querySelector('[data-drivers-now]'));
  let seq = 0;

  async function load() {
    const mine = ++seq;
    const [from, to] = range(state.period);
    let rows;
    let branch = null;
    try { [rows, branch] = await Promise.all([ds.deliveryReport(from, to), ds.branchPlace().catch(() => null)]); } catch (err) { body.innerHTML = `<div class="card card-pad">${esc(err.message)}</div>`; return; }
    if (mine !== seq) return;
    if (rows == null) { body.innerHTML = '<div class="card card-pad">صفحة التوصيل غير مفعّلة على قاعدة البيانات بعد</div>'; return; }
    const list = enrich(rows);
    const delivered = list.filter((r) => r.deliveredAt);
    const stat = (k, v, cls = '') => `<div class="stat card"><span class="k">${k}</span><strong class="v ${cls}">${v}</strong></div>`;

    const byDriver = new Map();
    list.forEach((r) => { const k = r.driverId || r.driver; const g = byDriver.get(k) ?? { name: r.driver || '—', rows: [] }; g.rows.push(r); byDriver.set(k, g); });
    const byArea = new Map();
    list.forEach((r) => { const g = byArea.get(r.areaName) ?? []; g.push(r); byArea.set(r.areaName, g); });
    const drivers = [...byDriver.values()].sort((a, b) => b.rows.length - a.rows.length)
      .map((g) => ({ ...g, km: tripKm(g.rows, branch), total: sum(g.rows, 'total'), fees: sum(g.rows, 'deliveryFee') }));
    const allKm = tripKm(list, branch);

    body.innerHTML = list.length ? `
      <h2 class="section-title">${icon('clipboard')}لوحة الطيارين</h2>
      <div class="summary-row">
        ${stat('فلوس الطلبات', money(sum(list, 'total')))}
        ${stat('رسوم التوصيل', money(sum(list, 'deliveryFee')))}
        ${stat('كيلومترات (تقريبي)', kmText(allKm))}
        ${stat('طلبات خرجت', `<span class="num">${list.length}</span>`)}
        ${stat('اتسلّمت', `<span class="num">${delivered.length}</span>`)}
        ${stat('متوسط الانتظار قبل الخروج', minText(avg(list.map((r) => r.waitMin))))}
        ${stat('متوسط وقت التوصيل', minText(avg(delivered.map((r) => r.deliverMin))))}
        ${stat('متوسط الرجوع بعد آخر تسليم', minText(avg(tripBacks(list))))}
        ${stat('متأخرة', `<span class="num">${list.filter((r) => r.late).length}</span>`, list.some((r) => r.late) ? 'tone-text-red' : '')}
        ${stat('من غير مكان', `<span class="num">${list.filter((r) => r.noPlace).length}</span>`)}
        ${stat('رجوع بعيد عن الفرع', `<span class="num">${farTrips(list)}</span>`, farTrips(list) ? 'tone-text-red' : '')}
      </div>
      ${branch?.lat == null ? `<p class="muted">${icon('info')}الكيلومترات بتظهر بعد تسجيل مكان الفرع (من «المناطق والموظفين»).</p>` : ''}
      <div class="dd-grid">
        <div class="card card-pad"><h3 class="dd-h">الطلبات لكل طيار</h3>${bars(drivers.map((g) => ({ name: g.name.replace(/\s*\(.*\)$/, ''), value: g.rows.length })), (v) => v)}</div>
        <div class="card card-pad"><h3 class="dd-h">فلوس الطلبات لكل طيار</h3>${bars(drivers.map((g) => ({ name: g.name.replace(/\s*\(.*\)$/, ''), value: g.total })), (v) => `${Math.round(v).toLocaleString('en')} ج.م`)}</div>
        <div class="card card-pad"><h3 class="dd-h">متوسط وقت التوصيل</h3>${bars(drivers.map((g) => ({ name: g.name.replace(/\s*\(.*\)$/, ''), value: avg(g.rows.map((r) => r.deliverMin)) ?? 0 })), (v) => `${v} د`)}</div>
        <div class="card card-pad"><h3 class="dd-h">أكتر المناطق توصيل</h3>${bars([...byArea].sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([name, rs]) => ({ name, value: rs.length })), (v) => `${v} طلب`)}</div>
      </div>

      <h2 class="section-title">${icon('user')}الطيارين</h2>
      <div class="card table-wrap"><table class="table">
        <thead><tr><th>الطيار</th><th>الطلبات</th><th class="col-opt">المشاوير</th><th>فلوس الطلبات</th><th class="col-opt">رسوم التوصيل</th><th>كم (تقريبي)</th>
          <th class="col-opt">الانتظار قبل الخروج</th><th>متوسط التوصيل</th><th>متوسط الرجوع</th>
          <th>متأخر</th><th class="col-opt">من غير مكان</th><th class="col-opt">رجوع بعيد</th><th class="col-opt">سجّلها الأدمن</th></tr></thead>
        <tbody>${drivers.map((g) => `
          <tr><td><strong>${esc(g.name)}</strong></td><td class="num">${g.rows.length}</td>
            <td class="col-opt num">${new Set(g.rows.map((r) => r.tripId)).size}</td>
            <td>${money(g.total)}</td><td class="col-opt">${money(g.fees)}</td><td class="num">${kmText(g.km)}</td>
            <td class="col-opt">${minText(avg(g.rows.map((r) => r.waitMin)))}</td>
            <td>${minText(avg(g.rows.map((r) => r.deliverMin)))}</td><td>${minText(avg(tripBacks(g.rows)))}</td>
            <td class="num ${g.rows.some((r) => r.late) ? 'tone-text-red' : ''}">${g.rows.filter((r) => r.late).length}</td>
            <td class="col-opt num">${g.rows.filter((r) => r.noPlace).length}</td>
            <td class="col-opt num ${farTrips(g.rows) ? 'tone-text-red' : ''}">${farTrips(g.rows)}</td>
            <td class="col-opt num">${g.rows.filter((r) => r.byAdmin).length}</td></tr>`).join('')}</tbody>
      </table></div>

      <h2 class="section-title">${icon('pin')}المناطق</h2>
      <div class="card table-wrap"><table class="table">
        <thead><tr><th>المنطقة</th><th>الطلبات</th><th>فلوس الطلبات</th><th class="col-opt">رسوم التوصيل</th><th>متوسط التوصيل</th><th class="col-opt">أطول توصيل</th></tr></thead>
        <tbody>${[...byArea].sort((a, b) => b[1].length - a[1].length).map(([name, rs]) => `
          <tr><td><strong>${esc(name)}</strong></td><td class="num">${rs.length}</td>
            <td>${money(sum(rs, 'total'))}</td><td class="col-opt">${money(sum(rs, 'deliveryFee'))}</td>
            <td>${minText(avg(rs.map((r) => r.deliverMin)))}</td><td class="col-opt">${minText(Math.max(...rs.map((r) => r.deliverMin ?? 0)))}</td></tr>`).join('')
          || '<tr><td colspan="6" class="table-empty">لا توجد طلبات</td></tr>'}</tbody>
      </table></div>

      <h2 class="section-title">${icon('list')}الطلبات</h2>
      <p class="muted">المتأخر بالأحمر: أكتر من ${LATE_FIRST} دقيقة لأول طلب في المشوار، و+${LATE_STEP} دقايق لكل طلب بعده.</p>
      <div class="card table-wrap"><table class="table delivery-table">
        <thead><tr><th>رقم الطلب</th><th>الطيار</th><th class="col-opt">المنطقة</th><th>خرج</th><th>التوصيل</th>
          <th class="col-opt">الرجوع</th><th class="col-opt">في المشوار</th><th>الصورة</th></tr></thead>
        <tbody>${list.map((r) => `
          <tr class="${r.late ? 'is-late' : ''}" data-order="${esc(r.id)}" tabindex="0">
            <td class="ltr-cell"><strong>${esc(r.number)}</strong></td>
            <td>${esc((r.driver || '—').replace(/\s*\(.*\)$/, ''))}</td>
            <td class="col-opt">${esc(r.areaName)}</td>
            <td class="num">${state.period === 'today' ? formatTime(r.outAt) : `${dayLabel(r.outAt)} ${formatTime(r.outAt)}`}${r.outByAdmin ? ' <span class="tag tag-amber">أدمن</span>' : ''}</td>
            <td>${r.deliveredAt ? `<strong>${minText(r.deliverMin)}</strong>${r.deliveredAdmin ? ' <span class="tag tag-amber">أدمن</span>' : ''}${r.noPlace ? ' <span class="tag tag-warn">من غير مكان</span>' : ''}` : '<span class="muted">لسه</span>'}</td>
            <td class="col-opt">${r.returnedAt ? minText(r.backMin) : '<span class="muted">—</span>'}${r.returnedAdmin ? ' <span class="tag tag-amber">أدمن</span>' : ''}${r.far ? ' <span class="tag tag-far">بعيد عن الفرع</span>' : ''}</td>
            <td class="col-opt num">${r.tripSize > 1 ? `${r.tripSeq} من ${r.tripSize}` : '—'}</td>
            <td>${r.photoPath ? `<button type="button" class="btn btn-soft btn-sm" data-photo="${esc(r.photoPath)}" data-no="${esc(r.number)}" data-lat="${r.lat ?? ''}" data-lng="${r.lng ?? ''}">عرض</button>` : '<span class="muted">—</span>'}</td>
          </tr>`).join('')}</tbody>
      </table></div>`
      : '<div class="card card-pad center-note"><h3>مفيش طلبات خرجت في الفترة دي</h3></div>';
  }

  const offs = [
    on(view, 'click', '[data-period]', (e, b) => {
      state.period = b.dataset.period;
      view.querySelectorAll('[data-period]').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      body.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
      load();
    }),
    on(view, 'click', '[data-photo]', async (e, b) => {
      e.stopPropagation();
      let url;
      try { url = await ds.photoUrl(b.dataset.photo); } catch (err) { showToast(err.message); return; }
      openModal({
        title: `${icon('package')} صورة التسليم — <span class="ltr-inline">${esc(b.dataset.no)}</span>`,
        size: 'md',
        body: `<img class="dl-photo-big" src="${esc(url)}" alt="صورة التسليم">
          ${b.dataset.lat ? `<a class="link-btn" href="https://www.google.com/maps?q=${esc(b.dataset.lat)},${esc(b.dataset.lng)}" target="_blank" rel="noopener">${icon('pin')}مكان الطيار وقت التسليم على الخريطة</a>` : '<p class="muted">اتسلّم من غير مكان</p>'}`,
        footer: '<button type="button" class="btn btn-secondary" data-close>إغلاق</button>',
      });
    }),
    on(view, 'click', 'tr[data-order]', (e, tr) => { if (!e.target.closest('[data-photo]')) location.hash = `#/orders/${encodeURIComponent(tr.dataset.order)}`; }),
    on(view, 'keydown', 'tr[data-order]', (e, tr) => { if (e.key === 'Enter') location.hash = `#/orders/${encodeURIComponent(tr.dataset.order)}`; }),
  ];
  load();
  return () => { offs.forEach((f) => f()); unmountNow(); };
}

