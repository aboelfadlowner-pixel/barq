/* «العملاء» — like the Foodics customer page (admin and call center).
   List: search by name or phone, sort by latest order / most orders / most spent / name.
   Customer page: call-center numbers (orders, total paid, average, last order, cancelled),
   favourite products and add-ons, usual area, the Foodics order count and last order
   (from the Foodics customers export), addresses and all orders, with «طلب جديد» and
   «تكرار آخر طلب». The numbers come from the database (15_customer_profile.sql). */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, loadDraftFromOrder } from '../store.js';
import { esc, on } from '../utils/dom.js';
import { formatAddress, formatDateTime, formatRelative, formatWeight, housingLabel, isSameDay } from '../utils/format.js';
import { computeTotals } from '../utils/pricing.js';
import { icon } from '../components/icons.js';
import { money, orderStateChip } from '../components/chips.js';
import { confirmDialog, showToast } from '../components/modal.js';
import { startNewOrder } from './board-screen.js';

const PAGE = 50;
const SORTS = [
  { id: 'last', label: 'آخر طلب' },
  { id: 'orders', label: 'الأكثر طلبًا' },
  { id: 'total', label: 'الأكثر شراءً' },
  { id: 'name', label: 'الاسم' },
];
const listState = { q: '', sort: 'last' };   // kept while going to a customer and back

export function mountCustomers(view, customerId) {
  return customerId ? mountProfile(view, customerId) : mountList(view);
}

// «اليوم · منذ ساعتين» today, otherwise the date and time («أمس · 8:15 م»).
const when = (iso) => (!iso ? '—' : isSameDay(iso, new Date()) ? `اليوم · ${formatRelative(iso)}` : formatDateTime(iso));

/* ---------- List ---------- */
function mountList(view) {
  view.innerHTML = `
    <div class="page"><div class="page-inner">
      <div class="page-head">
        <div>
          <h1>العملاء</h1>
          <div class="page-sub"><span>عملاء مركز الاتصال وطلباتهم — اضغط على العميل لعرض صفحته</span></div>
        </div>
      </div>
      <div class="card filters" role="search">
        <div class="search search-sm">${icon('search')}
          <input id="cuQ" type="search" autocomplete="off" placeholder="اسم العميل أو رقم الموبايل" value="${esc(listState.q)}" aria-label="بحث في العملاء">
        </div>
        <select class="select" id="cuSort" aria-label="الترتيب">
          ${SORTS.map((s) => `<option value="${s.id}" ${s.id === listState.sort ? 'selected' : ''}>ترتيب: ${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="list-meta" data-meta></div>
      <div class="card table-wrap">
        <table class="table customers-table">
          <thead><tr>
            <th>العميل</th><th class="col-opt">الموبايل</th><th>طلبات الكول سنتر</th><th>الإجمالي</th>
            <th class="col-opt">آخر طلب</th><th class="col-opt">طلبات فودكس</th>
          </tr></thead>
          <tbody data-body><tr><td colspan="6" class="table-empty">جارٍ التحميل…</td></tr></tbody>
        </table>
      </div>
      <div class="more-row"><button type="button" class="btn btn-secondary" data-more hidden>عرض المزيد</button></div>
    </div></div>`;
  const $ = (sel) => view.querySelector(sel);
  let rows = [];
  let total = 0;
  let seq = 0;

  const rowHtml = (c) => `
    <tr data-id="${esc(c.id)}" tabindex="0">
      <td><strong>${esc(c.name)}</strong></td>
      <td class="col-opt ltr-cell">${c.phones.map(esc).join(' / ')}</td>
      <td class="num">${c.orders}</td>
      <td>${c.orders ? money(c.total) : '—'}</td>
      <td class="col-opt">${c.lastOrderAt ? esc(when(c.lastOrderAt)) : '—'}</td>
      <td class="col-opt num">${c.foodicsOrders ?? '—'}</td>
    </tr>`;

  async function load({ append = false } = {}) {
    const mySeq = ++seq;
    const res = await ds.listCustomerSummaries({ q: listState.q, sort: listState.sort, limit: PAGE, offset: append ? rows.length : 0 })
      .catch((err) => { showToast(err.message); return { rows: [], total: 0 }; });
    if (mySeq !== seq) return;
    if (!res) {
      $('[data-body]').innerHTML = '<tr><td colspan="6" class="table-empty">صفحة العملاء غير مفعّلة على قاعدة البيانات بعد</td></tr>';
      return;
    }
    rows = append ? [...rows, ...res.rows] : res.rows;
    total = res.total;
    $('[data-meta]').textContent = total ? `${total} عميل${listState.q ? ' مطابق للبحث' : ''}` : '';
    $('[data-body]').innerHTML = rows.length ? rows.map(rowHtml).join('')
      : `<tr><td colspan="6" class="table-empty">${listState.q ? 'لا يوجد عميل مطابق' : 'لا يوجد عملاء بعد'}</td></tr>`;
    $('[data-more]').hidden = rows.length >= total;
  }

  let timer;
  const offs = [
    on(view, 'input', '#cuQ', (e, input) => { listState.q = input.value; clearTimeout(timer); timer = setTimeout(() => load(), 250); }),
    on(view, 'change', '#cuSort', (e, sel) => { listState.sort = sel.value; load(); }),
    on(view, 'click', '[data-more]', () => load({ append: true })),
    on(view, 'click', 'tr[data-id]', (e, tr) => { location.hash = `#/customers/${encodeURIComponent(tr.dataset.id)}`; }),
    on(view, 'keydown', 'tr[data-id]', (e, tr) => {
      if (e.key === 'Enter') location.hash = `#/customers/${encodeURIComponent(tr.dataset.id)}`;
    }),
  ];
  load();
  $('#cuQ').focus();
  return () => { clearTimeout(timer); offs.forEach((f) => f()); };
}

/* ---------- Customer page ---------- */
const amountText = (p) => [p.qty ? `${p.qty} قطعة` : '', p.grams ? formatWeight(p.grams) : ''].filter(Boolean).join(' + ');

function mountProfile(view, customerId) {
  view.innerHTML = '<div class="center-state"><p class="muted">جارٍ التحميل…</p></div>';
  let offs = [];
  let gone = false;

  Promise.all([ds.getCustomer(customerId), ds.getCustomerStats(customerId).catch(() => null), ds.listCustomerOrders(customerId, 100)])
    .then(([c, s, orders]) => {
      if (gone) return;
      if (!c) { view.innerHTML = '<div class="center-state"><div><h2>العميل غير موجود</h2><a href="#/customers" class="btn btn-secondary">رجوع للعملاء</a></div></div>'; return; }
      const stat = (k, v, cls = '') => `<div class="stat card"><span class="k">${k}</span><strong class="v ${cls}">${v}</strong></div>`;
      view.innerHTML = `
        <div class="page"><div class="page-inner">
          <a href="#/customers" class="back-link">${icon('arrowRight')}العملاء</a>
          <div class="page-head">
            <div>
              <h1>${esc(c.name)}</h1>
              <div class="page-sub"><span class="ltr-inline">${c.phones.map(esc).join(' / ')}</span></div>
            </div>
            <div class="head-actions">
              <button type="button" class="btn btn-primary btn-lg" data-new>${icon('headset')}طلب جديد</button>
              ${orders.some((o) => o.status !== 'cancelled') ? `<button type="button" class="btn btn-soft btn-lg" data-repeat>${icon('repeat')}تكرار آخر طلب</button>` : ''}
            </div>
          </div>

          ${s ? `
          <div class="summary-row cust-stats">
            ${stat('طلبات الكول سنتر', `<span class="num">${s.orders}</span>`)}
            ${stat('إجمالي المدفوع', money(s.total))}
            ${stat('متوسط الطلب', s.orders ? money(s.average) : '—')}
            ${stat('آخر طلب', s.lastOrderAt ? esc(formatRelative(s.lastOrderAt)) : '—')}
            ${stat('طلبات ملغاة', `<span class="num">${s.cancelled}</span>`, s.cancelled ? 'tone-text-red' : '')}
            ${stat('طلبات فودكس', s.foodicsOrders != null ? `<span class="num">${s.foodicsOrders}</span>` : '—')}
          </div>

          <div class="cust-favs">
            <div class="card card-pad">
              <h3 class="block-title">${icon('package')}المنتجات المفضلة</h3>
              ${s.topProducts.length ? `<ol class="fav-list">${s.topProducts.map((p, i) => `
                <li class="${i === 0 ? 'top' : ''}"><strong>${i === 0 ? '⭐ ' : ''}${esc(p.name)}</strong>
                  <span class="muted">في ${p.orders} ${p.orders === 1 ? 'طلب' : 'طلبات'}${amountText(p) ? ` · ${amountText(p)}` : ''}</span></li>`).join('')}</ol>`
                : '<p class="muted">لا توجد طلبات بعد من مركز الاتصال</p>'}
            </div>
            <div class="card card-pad">
              <h3 class="block-title">${icon('plus')}الإضافات المفضلة</h3>
              ${s.topModifiers.length ? `<ol class="fav-list">${s.topModifiers.map((m) => `
                <li><strong>${esc(m.name)}</strong> <span class="muted">${m.times} ${m.times === 1 ? 'مرة' : 'مرات'}</span></li>`).join('')}</ol>`
                : '<p class="muted">—</p>'}
            </div>
            <div class="card card-pad">
              <h3 class="block-title">${icon('pin')}المنطقة المعتادة</h3>
              <p>${s.topArea ? `<strong>${esc(s.topArea.name)}</strong> <span class="muted">في ${s.topArea.orders} ${s.topArea.orders === 1 ? 'طلب' : 'طلبات'}</span>` : '—'}</p>
              ${s.firstOrderAt ? `<p class="muted">أول طلب: ${esc(formatDateTime(s.firstOrderAt))}</p>` : ''}
              ${s.foodicsLastOrderAt ? `<p class="muted">آخر طلب في فودكس: ${esc(formatDateTime(s.foodicsLastOrderAt))}</p>` : ''}
            </div>
          </div>` : ''}

          <h2 class="section-title">${icon('pin')}العناوين</h2>
          <div class="card table-wrap">
            <table class="table">
              <thead><tr><th>الاسم</th><th>المنطقة</th><th>العنوان</th><th class="col-opt">نوع السكن</th></tr></thead>
              <tbody>${c.addresses.length ? c.addresses.map((a) => `
                <tr><td><strong>${esc(a.label)}</strong></td>
                  <td>${esc(catalog.areasById.get(a.areaId)?.name ?? '—')}</td>
                  <td>${esc(formatAddress(a))}${a.notes ? `<div class="muted">${esc(a.notes)}</div>` : ''}</td>
                  <td class="col-opt">${esc(housingLabel(a.housingType) || '—')}</td></tr>`).join('')
                : '<tr><td colspan="4" class="table-empty">لا توجد عناوين</td></tr>'}</tbody>
            </table>
          </div>

          <h2 class="section-title">${icon('list')}الطلبات</h2>
          <div class="card table-wrap">
            <table class="table orders-table">
              <thead><tr><th>رقم الطلب</th><th>الوقت</th><th class="col-opt">الأصناف</th><th class="col-opt">المنطقة</th>
                <th class="col-opt">الموظف</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
              <tbody>${orders.length ? orders.map((o) => `
                <tr data-order="${esc(o.id)}" tabindex="0">
                  <td class="ltr-cell"><strong>${esc(o.number)}</strong></td>
                  <td>${esc(when(o.createdAt))}</td>
                  <td class="col-opt">${o.items.length}</td>
                  <td class="col-opt">${esc(o.address.areaName)}</td>
                  <td class="col-opt">${esc(o.employee || '')}</td>
                  <td>${money(computeTotals(o.items, o.deliveryFee).total)}</td>
                  <td>${orderStateChip(o)}</td>
                </tr>`).join('') : '<tr><td colspan="7" class="table-empty">لا توجد طلبات من مركز الاتصال بعد</td></tr>'}</tbody>
            </table>
          </div>
        </div></div>`;

      offs = [
        on(view, 'click', '[data-new]', () => startNewOrder({ phone: c.phones[0] })),
        on(view, 'click', '[data-repeat]', async () => {
          const last = orders.find((o) => o.status !== 'cancelled');
          const st = getState();
          if ((st.cart.length || st.customer) && !(await confirmDialog({
            title: 'تكرار آخر طلب',
            message: 'يوجد طلب قيد الإنشاء. سيتم استبدال السلة والعميل الحاليين بأصناف وبيانات آخر طلب.',
            confirmLabel: 'استبدال وتكرار',
          }))) return;
          const today = await ds.findTodayOrdersByPhone(last.customer.phone);
          const { skipped } = loadDraftFromOrder(last, today);
          location.hash = '#/pos';
          showToast(skipped.length ? `تم نسخ الأصناف — ${skipped.length} صنف غير متاح حاليًا` : 'تم نسخ أصناف آخر طلب بالأسعار الحالية — راجع قبل الإرسال');
        }),
        on(view, 'click', 'tr[data-order]', (e, tr) => { location.hash = `#/orders/${encodeURIComponent(tr.dataset.order)}`; }),
        on(view, 'keydown', 'tr[data-order]', (e, tr) => { if (e.key === 'Enter') location.hash = `#/orders/${encodeURIComponent(tr.dataset.order)}`; }),
      ];
    })
    .catch((err) => { if (!gone) view.innerHTML = `<div class="center-state"><div><h2>تعذر تحميل العميل</h2><p>${esc(err.message)}</p></div></div>`; });

  return () => { gone = true; offs.forEach((f) => f()); };
}
