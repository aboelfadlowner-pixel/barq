/* «العملاء» — like the Foodics customer page (admin and call center).
   List: search by name or phone, sort by latest order / most orders / most spent / name.
   Customer page: call-center numbers (orders, total paid, average, last order, cancelled),
   favourite products and add-ons, usual area, the Foodics order count and last order
   (from the Foodics customers export), addresses and all orders, with «طلب جديد» and
   «تكرار آخر طلب». The numbers come from the database (15_customer_profile.sql).
   Black list (16_blocked_numbers.sql): «محظور» on the list, «المحظورين» shows every
   blocked number; the customer page blocks / unblocks the customer's numbers. */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, loadDraftFromOrder } from '../store.js';
import { esc, on } from '../utils/dom.js';
import {
  formatAddress, formatDateTime, formatRelative, formatWeight, housingLabel, isSameDay, isValidPhone, normalizePhone,
} from '../utils/format.js';
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
const listState = { q: '', sort: 'last', blockedOnly: false };   // kept while going to a customer and back

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
        <button type="button" class="btn btn-secondary blocked-toggle" data-blocked-only aria-pressed="false" hidden>${icon('alert')}المحظورين <span data-blocked-count></span></button>
      </div>
      <form class="card block-add" data-block-add hidden novalidate>
        <label for="cuBlockPhone">حظر رقم</label>
        <input id="cuBlockPhone" class="input ltr" name="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="01xxxxxxxxx">
        <button type="submit" class="btn btn-danger">${icon('alert')}حظر</button>
        <div class="field-error" data-err="block"></div>
      </form>
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
  let blocked = null;        // [{ phone, customerId, customerName, source, by, at }] — null = not installed
  const isBlocked = (c) => !!blocked?.some((b) => c.phones.includes(b.phone));

  const rowHtml = (c) => `
    <tr data-id="${esc(c.id)}" tabindex="0">
      <td><strong>${esc(c.name)}</strong>${isBlocked(c) ? ' <span class="tag tag-danger">محظور</span>' : ''}</td>
      <td class="col-opt ltr-cell">${c.phones.map(esc).join(' / ')}</td>
      <td class="num">${c.orders}</td>
      <td>${c.orders ? money(c.total) : '—'}</td>
      <td class="col-opt">${c.lastOrderAt ? esc(when(c.lastOrderAt)) : '—'}</td>
      <td class="col-opt num">${c.foodicsOrders ?? '—'}</td>
    </tr>`;

  const blockedRowHtml = (b) => `
    <tr ${b.customerId ? `data-id="${esc(b.customerId)}" tabindex="0"` : ''}>
      <td>${b.customerId ? `<strong>${esc(b.customerName)}</strong>` : '<span class="muted">غير مسجل عندنا</span>'}</td>
      <td class="ltr-cell">${esc(b.phone)}</td>
      <td>${b.source === 'foodics' ? 'فودكس' : esc(b.by || '—')}</td>
      <td>${esc(when(b.at))}</td>
      <td><button type="button" class="btn btn-soft btn-sm" data-unblock="${esc(b.phone)}">فك الحظر</button></td>
    </tr>`;

  function paintBlockedToggle() {
    const btn = $('[data-blocked-only]');
    btn.hidden = !blocked;
    if (!blocked) return;
    $('[data-blocked-count]').textContent = `(${blocked.length})`;
    btn.setAttribute('aria-pressed', String(listState.blockedOnly));
    btn.classList.toggle('is-on', listState.blockedOnly);
    $('[data-block-add]').hidden = !listState.blockedOnly;
  }

  function showBlocked() {
    const q = listState.q.trim();
    const dq = q.replace(/\D/g, '');
    const shown = blocked.filter((b) => !q || b.customerName.includes(q) || (dq.length >= 3 && b.phone.includes(dq)));
    $('[data-meta]').textContent = `${shown.length} رقم في القائمة السوداء`;
    view.querySelector('.customers-table thead').innerHTML = '<tr><th>العميل</th><th>الرقم</th><th>حظره</th><th>إمتى</th><th></th></tr>';
    $('[data-body]').innerHTML = shown.length ? shown.map(blockedRowHtml).join('')
      : '<tr><td colspan="5" class="table-empty">لا توجد أرقام محظورة</td></tr>';
    $('[data-more]').hidden = true;
  }
  const HEAD = view.querySelector('.customers-table thead').innerHTML;

  async function loadBlocked() {
    blocked = await ds.listBlocked().catch(() => null);
    paintBlockedToggle();
  }

  async function load({ append = false } = {}) {
    if (listState.blockedOnly && blocked) { showBlocked(); return; }
    view.querySelector('.customers-table thead').innerHTML = HEAD;
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
    on(view, 'click', '[data-blocked-only]', () => { listState.blockedOnly = !listState.blockedOnly; paintBlockedToggle(); load(); }),
    on(view, 'submit', '[data-block-add]', async (e, form) => {
      e.preventDefault();
      const err = form.querySelector('[data-err="block"]');
      const phone = normalizePhone(form.phone.value);
      if (!isValidPhone(phone)) { err.textContent = 'رقم غير صحيح — مثال: 01012345678'; form.phone.focus(); return; }
      if (blocked?.some((b) => b.phone === phone)) { err.textContent = 'الرقم ده محظور بالفعل'; return; }
      err.textContent = '';
      if (!(await confirmDialog({ title: 'حظر رقم', message: `الرقم ${phone} هيتحط في القائمة السوداء ومش هيقدر يطلب لحد ما حد يفك الحظر.`, confirmLabel: 'حظر', danger: true }))) return;
      try {
        await ds.setBlocked([phone], true);
        form.reset();
        showToast('تم حظر الرقم');
        await loadBlocked();
        load();
      } catch (ex) { err.textContent = ex.message; }
    }),
    on(view, 'click', '[data-unblock]', async (e, btn) => {
      const phone = btn.dataset.unblock;
      if (!(await confirmDialog({ title: 'فك الحظر', message: `هيتشال الرقم ${phone} من القائمة السوداء ويقدر يطلب تاني.`, confirmLabel: 'فك الحظر' }))) return;
      try {
        await ds.setBlocked([phone], false);
        showToast('تم فك الحظر');
        await loadBlocked();
        load();
      } catch (err) { showToast(err.message); }
    }),
    on(view, 'click', 'tr[data-id]', (e, tr) => {
      if (e.target.closest('[data-unblock]')) return;   // «فك الحظر» on the black list stays on the list
      location.hash = `#/customers/${encodeURIComponent(tr.dataset.id)}`;
    }),
    on(view, 'keydown', 'tr[data-id]', (e, tr) => {
      if (e.key === 'Enter') location.hash = `#/customers/${encodeURIComponent(tr.dataset.id)}`;
    }),
  ];
  loadBlocked().then(() => load());
  $('#cuQ').focus();
  return () => { clearTimeout(timer); offs.forEach((f) => f()); };
}

/* ---------- Customer page ---------- */
const amountText = (p) => [p.qty ? `${p.qty} قطعة` : '', p.grams ? formatWeight(p.grams) : ''].filter(Boolean).join(' + ');

function mountProfile(view, customerId) {
  view.innerHTML = '<div class="center-state"><p class="muted">جارٍ التحميل…</p></div>';
  let offs = [];
  let gone = false;

  const load = () => Promise.all([ds.getCustomer(customerId), ds.getCustomerStats(customerId).catch(() => null), ds.listCustomerOrders(customerId, 100)])
    .then(async ([c, s, orders]) => {
      if (gone) return;
      const blockMap = c ? await ds.getBlocked(c.phones).catch(() => null) : null;
      if (gone) return;
      const blocks = blockMap ? [...blockMap] : [];
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
              ${blocks.length ? '' : `<button type="button" class="btn btn-primary btn-lg" data-new>${icon('headset')}طلب جديد</button>
              ${orders.some((o) => o.status !== 'cancelled') ? `<button type="button" class="btn btn-soft btn-lg" data-repeat>${icon('repeat')}تكرار آخر طلب</button>` : ''}`}
              ${blockMap ? (blocks.length
                ? `<button type="button" class="btn btn-secondary btn-lg" data-block="off">فك الحظر</button>`
                : `<button type="button" class="btn btn-danger-soft btn-lg" data-block="on">${icon('alert')}حظر العميل</button>`) : ''}
            </div>
          </div>
          ${blocks.length ? `
          <div class="block-banner" role="alert">
            <span class="block-tag">القائمة السوداء</span>
            <div class="grow">${blocks.map(([ph, b]) => `
              <div><strong>الرقم <span class="ltr-inline">${esc(ph)}</span> ممنوع من الطلب</strong>
                <span class="muted">— ${b.source === 'foodics' ? 'محظور على فودكس' : `حظره ${esc(b.by || 'موظف')}`}${b.at ? ` · ${esc(formatDateTime(b.at))}` : ''}</span></div>`).join('')}
            </div>
          </div>` : ''}

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
        on(view, 'click', '[data-block]', async (e, btn) => {
          const on_ = btn.dataset.block === 'on';
          const phones = on_ ? c.phones : blocks.map(([ph]) => ph);
          if (!(await confirmDialog(on_ ? {
            title: 'حظر العميل',
            message: `${c.name} (${c.phones.join(' / ')}) هيتحط في القائمة السوداء ومش هيقدر يطلب لحد ما حد يفك الحظر.`,
            confirmLabel: 'حظر', danger: true,
          } : { title: 'فك الحظر', message: `${c.name} هيقدر يطلب تاني.`, confirmLabel: 'فك الحظر' }))) return;
          try {
            await ds.setBlocked(phones, on_);
            showToast(on_ ? 'تم حظر العميل' : 'تم فك الحظر');
            offs.forEach((f) => f()); offs = [];
            load();
          } catch (err) { showToast(err.message); }
        }),
        on(view, 'keydown', 'tr[data-order]', (e, tr) => { if (e.key === 'Enter') location.hash = `#/orders/${encodeURIComponent(tr.dataset.order)}`; }),
      ];
    })
    .catch((err) => { if (!gone) view.innerHTML = `<div class="center-state"><div><h2>تعذر تحميل العميل</h2><p>${esc(err.message)}</p></div></div>`; });
  load();

  return () => { gone = true; offs.forEach((f) => f()); };
}
