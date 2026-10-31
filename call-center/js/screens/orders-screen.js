/* Orders list with search and filters.
   CONFIRMED: 50 orders a page («التالي» / «السابق»); the search and the filters run on the server
   (22_order_log_backup.sql), so any old order can be found, and the totals cover the whole filter. */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { esc, on } from '../utils/dom.js';
import { dayLabel, formatTime, workDayStart } from '../utils/format.js';
import { computeTotals } from '../utils/pricing.js';
import { icon } from '../components/icons.js';
import { money, orderStateChip } from '../components/chips.js';
import { getState } from '../store.js';
import { can } from '../permissions.js';
import { startNewOrder } from './board-screen.js';
import { openPrintPreview } from '../components/print-ticket.js';
import { agentFilterHtml, initAgentFilter } from '../components/agent-filter.js';

// Filters survive navigating to an order and back.
const DEFAULT_FILTERS = { q: '', date: 'today', status: '' };
let filters = { ...DEFAULT_FILTERS };
const agentFilter = new Set();   // employee names; empty = everyone

const PAGE_SIZE = 50;
let page = 0;                     // survives navigating to an order and back, like the filters

/* The date filter as [from, to) — by working day (it starts at 2 AM), like the board. */
function dateRange(range) {
  const start = workDayStart();
  const day = 864e5;
  if (range === 'today') return [start, null];
  if (range === 'yesterday') return [new Date(start - day), start];
  if (range === '7d') return [new Date(start - 6 * day), null];
  return [null, null];
}

export function mountOrders(view) {
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  view.innerHTML = `
    <div class="page"><div class="page-inner">
      <div class="page-head">
        <div>
          <h1>الطلبات</h1>
          <div class="page-sub">
            <span>طلبات التوصيل التي أنشأها مركز الاتصال</span>
            <span class="demo-pill">${icon('info')}بيانات وحالات تجريبية</span>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-lg" data-new-order>${icon('headset')}طلب جديد لمركز الاتصال</button>
      </div>

      <div data-summary></div>
      <div class="card filters" role="search">
        <div class="search search-sm">${icon('search')}
          <input id="ordQ" type="search" autocomplete="off" placeholder="رقم الطلب أو الموبايل أو اسم العميل" value="${esc(filters.q)}" aria-label="بحث في الطلبات">
        </div>
        <select class="select" id="ordDate" aria-label="التاريخ">
          ${opt('today', 'اليوم', filters.date)}${opt('yesterday', 'أمس', filters.date)}${opt('7d', 'آخر 7 أيام', filters.date)}${opt('all', 'كل الطلبات', filters.date)}
        </select>
        <select class="select" id="ordStatus" aria-label="الحالة">
          ${opt('', 'كل الحالات', filters.status)}${catalog.statuses.map((s) => opt(s.id, s.label, filters.status)).join('')}
        </select>
        ${agentFilterHtml()}
        <button type="button" class="btn btn-ghost" data-reset>مسح الفلاتر</button>
      </div>

      <div class="list-meta" data-meta></div>
      <div class="card table-wrap">
        <table class="table orders-table">
          <thead><tr>
            <th>رقم الطلب</th><th>الوقت</th><th>العميل</th><th class="col-opt">الموبايل</th>
            <th class="col-opt">المنطقة</th><th class="col-opt">الموظف</th><th>الإجمالي</th><th>الحالة</th><th><span class="sr-only">طباعة</span></th>
          </tr></thead>
          <tbody data-body><tr><td colspan="9" class="table-empty">جارٍ التحميل…</td></tr></tbody>
        </table>
      </div>
      <div class="pager" data-pager hidden>
        <button type="button" class="btn btn-secondary" data-page="-1">${icon('arrowRight')}السابق</button>
        <span class="muted num" data-page-info></span>
        <button type="button" class="btn btn-secondary" data-page="1">التالي${icon('chevronLeft')}</button>
      </div>
    </div></div>`;

  const $ = (sel) => view.querySelector(sel);
  let orders = [];

  let seq = 0;
  async function renderList() {
    const mine = ++seq;
    const [from, to] = dateRange(filters.date);
    let r;
    try {
      r = await ds.orderLog({ from, to, status: filters.status, agents: [...agentFilter], q: filters.q.trim(), limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    } catch (err) {
      if (mine === seq) $('[data-body]').innerHTML = `<tr><td colspan="9" class="table-empty">${esc(err.message)}</td></tr>`;
      return;
    }
    if (mine !== seq) return;                       // a newer search is on its way
    if (!r.orders.length && page > 0 && r.count) { page = Math.max(0, Math.ceil(r.count / PAGE_SIZE) - 1); renderList(); return; }
    orders = r.orders;
    $('[data-meta]').innerHTML = `
      <span><strong class="num">${r.count}</strong> طلب${r.cancelled ? ` <span class="muted">(منها ${r.cancelled} ملغي)</span>` : ''}</span>
      <span>إجمالي الطلبات غير الملغاة: <strong>${money(r.sum)}</strong></span>`;
    const pages = Math.max(1, Math.ceil(r.count / PAGE_SIZE));
    $('[data-pager]').hidden = !r.count;            // always shown (greyed out when there is no other page)
    $('[data-page-info]').textContent = r.count ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, r.count)} من ${r.count} · صفحة ${page + 1} من ${pages}` : '';
    $('[data-page="-1"]').disabled = page === 0;
    $('[data-page="1"]').disabled = page >= pages - 1;

    const list = orders;
    $('[data-body]').innerHTML = list.length ? list.map((o) => {
      const t = computeTotals(o.items, o.deliveryFee);
      return `
        <tr tabindex="0" data-id="${esc(o.id)}" aria-label="فتح الطلب ${esc(o.number)}">
          <td><strong class="ltr-inline">${esc(o.number)}</strong></td>
          <td class="nowrap">${dayLabel(o.createdAt)} · <span class="num">${formatTime(o.createdAt)}</span></td>
          <td><strong>${esc(o.customer.name)}</strong></td>
          <td class="col-opt"><span class="ltr-inline">${esc(o.customer.phone)}</span></td>
          <td class="col-opt">${esc(o.address.areaName)}</td>
          <td class="col-opt">${esc(o.employee)}</td>
          <td class="nowrap"><strong>${money(t.total)}</strong>${t.estimated ? ' <span class="est">تقريبي</span>' : ''}</td>
          <td>${orderStateChip(o)}</td>
          <td><button type="button" class="btn btn-ghost btn-icon btn-sm" data-print-order="${esc(o.id)}" title="إعادة طباعة الطلب" aria-label="طباعة الطلب ${esc(o.number)}">${icon('printer')}</button></td>
        </tr>`;
    }).join('') : `<tr><td colspan="9" class="table-empty">لا توجد طلبات مطابقة.
        ${filters.date !== 'all' ? '<button type="button" class="btn btn-soft btn-sm" data-all-dates>عرض كل التواريخ</button>' : ''}</td></tr>`;
  }

  let typing = null;
  const setFilter = (patch) => { filters = { ...filters, ...patch }; page = 0; renderList(); };
  $('#ordQ').addEventListener('input', (e) => {      // search on the server after a short pause
    clearTimeout(typing);
    typing = setTimeout(() => setFilter({ q: e.target.value }), 350);
  });
  $('#ordDate').addEventListener('change', (e) => setFilter({ date: e.target.value }));
  $('#ordStatus').addEventListener('change', (e) => setFilter({ status: e.target.value }));

  const offs = [
    on(view, 'click', '[data-new-order]', () => startNewOrder()),
    on(view, 'click', '[data-reset]', () => {
      filters = { ...DEFAULT_FILTERS };
      $('#ordQ').value = filters.q;
      $('#ordDate').value = filters.date;
      $('#ordStatus').value = filters.status;
      agentFilter.clear();
      cleanAgentFilter();
      mountAgentFilter();
      page = 0;
      renderList();
    }),
    on(view, 'click', '[data-page]', (e, btn) => {
      page = Math.max(0, page + Number(btn.dataset.page));
      renderList();
      view.querySelector('.orders-table')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }),
    on(view, 'click', '[data-all-dates]', () => { $('#ordDate').value = 'all'; setFilter({ date: 'all' }); }),
    on(view, 'click', '[data-print-order]', (e, btn) => {
      e.stopPropagation();
      const o = orders.find((x) => x.id === btn.dataset.printOrder);
      if (o) openPrintPreview(o);
    }),
    on(view, 'click', 'tr[data-id]', (e, tr) => {
      if (e.target.closest('[data-print-order]')) return;
      location.hash = `#/orders/${encodeURIComponent(tr.dataset.id)}`;
    }),
    on(view, 'keydown', 'tr[data-id]', (e, tr) => {
      if (e.key === 'Enter' && e.target === tr) location.hash = `#/orders/${encodeURIComponent(tr.dataset.id)}`;
    }),
  ];

  let cleanAgentFilter = () => {};
  const mountAgentFilter = () => {
    const holder = view.querySelector('[data-agent-filter]');
    holder.outerHTML = agentFilterHtml();
    cleanAgentFilter = initAgentFilter(view, { selected: agentFilter, getOrders: () => orders, onChange: () => { page = 0; renderList(); } });
  };
  mountAgentFilter();
  offs.push(() => cleanAgentFilter());

  // today's numbers (on the server, so they are right however many orders there are)
  function renderSummary() {
    if (!can(getState().user, 'viewDailySummary')) return;
    ds.orderLog({ from: workDayStart(), limit: 1 }).then((r) => {
      $('[data-summary]').innerHTML = `
        <div class="summary-row">
          <div class="stat card"><span class="k">طلبات اليوم</span><strong class="v num">${r.count - r.cancelled}</strong></div>
          <div class="stat card"><span class="k">إجمالي اليوم</span><strong class="v">${money(r.sum)}</strong></div>
          <div class="stat card"><span class="k">ملغي اليوم</span><strong class="v num tone-text-red">${r.cancelled}</strong></div>
        </div>`;
    }).catch(() => {});
  }

  renderSummary();
  renderList();
  $('#ordQ').focus();
  return () => offs.forEach((f) => f());
}
