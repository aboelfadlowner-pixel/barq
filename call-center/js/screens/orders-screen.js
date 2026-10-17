/* Orders list with search and filters. */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { esc, on } from '../utils/dom.js';
import { dayLabel, formatTime, isSameDay, normalizeArabic, normalizePhone } from '../utils/format.js';
import { computeTotals } from '../utils/pricing.js';
import { icon } from '../components/icons.js';
import { money, orderStateChip } from '../components/chips.js';
import { getState } from '../store.js';
import { can } from '../permissions.js';
import { startNewOrder } from './board-screen.js';
import { openPrintPreview } from '../components/print-ticket.js';
import { agentFilterHtml, initAgentFilter, matchesAgent } from '../components/agent-filter.js';

// Filters survive navigating to an order and back.
const DEFAULT_FILTERS = { q: '', date: 'today', status: '' };
let filters = { ...DEFAULT_FILTERS };
const agentFilter = new Set();   // employee names; empty = everyone

function matchesDate(iso, range) {
  const now = new Date();
  if (range === 'all') return true;
  if (range === 'today') return isSameDay(iso, now);
  if (range === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); return isSameDay(iso, y); }
  if (range === '7d') return now - new Date(iso) <= 7 * 864e5;
  return true;
}

function matchesQuery(o, q) {
  if (!q) return true;
  const text = normalizeArabic(q);
  const digits = normalizePhone(q);
  return normalizeArabic(o.number).includes(text)
    || normalizeArabic(o.customer.name).includes(text)
    || (digits.length >= 3 && normalizePhone(o.customer.phone).includes(digits));
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
    </div></div>`;

  const $ = (sel) => view.querySelector(sel);
  let orders = [];

  function renderList() {
    const list = orders.filter((o) =>
      matchesDate(o.createdAt, filters.date)
      && (!filters.status || o.status === filters.status)
      && matchesAgent(o, agentFilter)
      && matchesQuery(o, filters.q.trim()));

    const sum = list.reduce((acc, o) => acc + (o.status === 'cancelled' ? 0 : computeTotals(o.items, o.deliveryFee).total), 0);
    $('[data-meta]').innerHTML = `
      <span><strong class="num">${list.length}</strong> طلب</span>
      <span>إجمالي الطلبات غير الملغاة: <strong>${money(sum)}</strong></span>`;

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
          <td><button type="button" class="btn btn-ghost btn-icon btn-sm" data-print-order="${esc(o.id)}" title="طباعة الطلب تاني" aria-label="طباعة الطلب ${esc(o.number)}">${icon('printer')}</button></td>
        </tr>`;
    }).join('') : `<tr><td colspan="9" class="table-empty">لا توجد طلبات مطابقة.
        ${filters.date !== 'all' ? '<button type="button" class="btn btn-soft btn-sm" data-all-dates>عرض كل التواريخ</button>' : ''}</td></tr>`;
  }

  const setFilter = (patch) => { filters = { ...filters, ...patch }; renderList(); };
  $('#ordQ').addEventListener('input', (e) => setFilter({ q: e.target.value }));
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
      renderList();
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
    cleanAgentFilter = initAgentFilter(view, { selected: agentFilter, getOrders: () => orders, onChange: renderList });
  };
  mountAgentFilter();
  offs.push(() => cleanAgentFilter());

  function renderSummary() {
    if (!can(getState().user, 'viewDailySummary')) return;
    const today = orders.filter((o) => isSameDay(o.createdAt, new Date()));
    const active = today.filter((o) => o.status !== 'cancelled');
    const total = active.reduce((acc, o) => acc + computeTotals(o.items, o.deliveryFee).total, 0);
    $('[data-summary]').innerHTML = `
      <div class="summary-row">
        <div class="stat card"><span class="k">طلبات اليوم</span><strong class="v num">${active.length}</strong></div>
        <div class="stat card"><span class="k">إجمالي اليوم</span><strong class="v">${money(total)}</strong></div>
        <div class="stat card"><span class="k">ملغي اليوم</span><strong class="v num tone-text-red">${today.length - active.length}</strong></div>
      </div>`;
  }

  ds.listOrders().then((list) => { orders = list; renderSummary(); renderList(); });
  $('#ordQ').focus();
  return () => offs.forEach((f) => f());
}
