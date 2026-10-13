/* Call-center home (Foodics-style board): today's orders in columns —
   draft in progress, new, cancelled — plus "طلب جديد لمركز الاتصال". */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, resetDraft, currentDeliveryFee } from '../store.js';
import { esc, on } from '../utils/dom.js';
import { formatRelative, isSameDay, normalizeArabic, normalizePhone } from '../utils/format.js';
import { computeTotals } from '../utils/pricing.js';
import { icon } from '../components/icons.js';
import { money, statusChip } from '../components/chips.js';
import { confirmDialog } from '../components/modal.js';
import { openNewOrderDialog } from '../components/new-order-dialog.js';
import { agentSelectHtml, initAgentSelect, requireAgent } from '../components/agent-select.js';

const filters = { q: '' };
let openNameListOnBoard = false;   // set when someone tries to start an order before picking a name

/* Opens the new-order dialog; if a draft is in progress, asks before discarding it. */
export async function startNewOrder() {
  if (!getState().agent) {
    requireAgent();
    openNameListOnBoard = true;
    if (location.hash !== '#/board') location.hash = '#/board';
    else window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  const s = getState();
  if (s.customer || s.cart.length) {
    const ok = await confirmDialog({
      title: 'فيه طلب قيد الإنشاء',
      message: 'لو بدأت طلب جديد، الطلب اللي لسه ما اتأكدش هيتمسح. تقدر تكمّله من كارت «مسودة».',
      confirmLabel: 'امسح وابدأ طلب جديد', danger: true,
    });
    if (!ok) return;
    resetDraft();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  openNewOrderDialog();
}

function matches(o) {
  const q = filters.q.trim();
  if (!q) return true;
  const digits = normalizePhone(q);
  return normalizeArabic(o.number).includes(normalizeArabic(q))
    || normalizeArabic(o.customer.name).includes(normalizeArabic(q))
    || (digits.length >= 3 && normalizePhone(o.customer.phone).includes(digits));
}

function orderCard(o) {
  const t = computeTotals(o.items, o.deliveryFee);
  return `
    <button type="button" class="o-card" data-id="${esc(o.id)}">
      <div class="o-head">
        <strong class="o-no ltr-inline">#${esc(o.number)}</strong>
        ${statusChip(o.status)}
      </div>
      <div class="o-row">${icon('user')}<div><div class="o-strong">${esc(o.customer.name)}</div>
        <div class="ltr-inline o-muted">${esc(o.customer.phone)}</div></div></div>
      <div class="o-row">${icon('clock')}<span>${formatRelative(o.createdAt)}</span></div>
      <div class="o-row">${icon('pin')}<span>${esc(o.address.areaName)}</span></div>
      <div class="o-row">${icon('headset')}<span>${esc(o.employee)}</span></div>
      <div class="o-total">${money(t.total)}${t.estimated ? ' <span class="est">تقريبي</span>' : ''}</div>
    </button>`;
}

function draftCard() {
  const s = getState();
  if (!s.customer && !s.cart.length) return '';
  const t = computeTotals(s.cart, currentDeliveryFee(s));
  return `
    <div class="o-card o-draft">
      <div class="o-head"><strong>طلب قيد الإنشاء</strong><span class="status tone-amber">مسودة</span></div>
      <div class="o-row">${icon('user')}<div><div class="o-strong">${esc(s.customer?.name ?? 'لم يتم تحديد العميل')}</div>
        ${s.customer ? `<div class="ltr-inline o-muted">${esc(s.customer.phone)}</div>` : ''}</div></div>
      <div class="o-row">${icon('cart')}<span>${s.cart.length} أصناف</span></div>
      ${s.address ? `<div class="o-row">${icon('pin')}<span>${esc(catalog.areasById.get(s.address.areaId)?.name ?? '')}</span></div>` : ''}
      <div class="o-total">${money(t.total)}</div>
      <div class="o-actions">
        <a href="#/pos" class="btn btn-primary btn-sm">${icon('edit')}استكمال الطلب</a>
        <button type="button" class="btn btn-danger-ghost btn-sm" data-discard>${icon('trash')}إلغاء المسودة</button>
      </div>
    </div>`;
}

function column(title, count, body, emptyText, tone = '') {
  return `
    <section class="b-col">
      <header class="b-col-head ${tone}">
        <h2>${title}</h2><span class="b-count num">${count}</span>
      </header>
      <div class="b-col-body">${body || `<div class="b-empty">${emptyText}</div>`}</div>
    </section>`;
}

export function mountBoard(view) {
  view.innerHTML = `
    <div class="page"><div class="page-inner board">
      <div class="page-head">
        <div>
          <h1 class="title-icon">${icon('headset')}مركز الاتصال</h1>
          <div class="page-sub"><span>طلبات التوصيل اللي بيعملها مركز الاتصال</span>
            <span class="demo-pill">${icon('info')}بيانات تجريبية</span></div>
        </div>
        <div class="board-actions">
          <div class="search search-sm">${icon('search')}
            <input id="boardQ" type="search" autocomplete="off" placeholder="رقم الطلب أو الموبايل أو الاسم" value="${esc(filters.q)}" aria-label="بحث في طلبات اليوم">
          </div>
          ${agentSelectHtml()}
          <button type="button" class="btn btn-primary btn-lg" data-new-order>${icon('headset')}طلب جديد لمركز الاتصال</button>
        </div>
      </div>
      <nav class="tabs" aria-label="عرض الطلبات">
        <a href="#/board" class="active">طلبات اليوم</a>
        <a href="#/orders">كل الطلبات</a>
      </nav>
      <div class="board-cols" data-cols><p class="muted">جارٍ التحميل…</p></div>
    </div></div>`;

  const cols = view.querySelector('[data-cols]');
  let orders = [];
  const render = () => {
    const today = orders.filter((o) => isSameDay(o.createdAt, new Date()) && matches(o));
    const fresh = today.filter((o) => o.status === 'new');
    const cancelled = today.filter((o) => o.status === 'cancelled');
    const draft = draftCard();
    cols.innerHTML =
      column('مسودة', draft ? 1 : 0, draft, 'مفيش طلب قيد الإنشاء') +
      column('جديد', fresh.length, fresh.map(orderCard).join(''), 'مفيش طلبات جديدة النهارده', 'is-new') +
      column('ملغي', cancelled.length, cancelled.map(orderCard).join(''), 'مفيش طلبات ملغية النهارده', 'is-cancelled');
  };

  view.querySelector('#boardQ').addEventListener('input', (e) => { filters.q = e.target.value; render(); });
  const offs = [
    on(view, 'click', '[data-new-order]', () => startNewOrder()),
    on(view, 'click', '.o-card[data-id]', (e, el) => { location.hash = `#/orders/${encodeURIComponent(el.dataset.id)}`; }),
    on(view, 'click', '[data-discard]', async () => {
      if (await confirmDialog({ title: 'إلغاء المسودة', message: 'هيتمسح العميل والأصناف اللي في الطلب اللي لسه ما اتأكدش.', confirmLabel: 'إلغاء المسودة', danger: true })) {
        resetDraft();
        render();
      }
    }),
  ];

  const nameList = initAgentSelect(view);
  offs.push(nameList.destroy);
  if (openNameListOnBoard) { openNameListOnBoard = false; nameList.open(); }

  ds.listOrders().then((list) => { orders = list; render(); });
  return () => offs.forEach((f) => f());
}
