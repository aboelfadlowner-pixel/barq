/* Call-center home (Foodics-style board): today's orders in columns — draft in progress,
   then the preparation stages set by the branch (جديد / بيتجهز / على الكاشير / خرج مع الطيار),
   then cancelled — plus "طلب جديد لمركز الاتصال". Checks for changes every few seconds. */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, resetDraft, currentDeliveryFee } from '../store.js';
import { esc, on } from '../utils/dom.js';
import { formatRelative, inWorkDay, normalizeArabic, normalizePhone } from '../utils/format.js';
import { can } from '../permissions.js';
import { computeTotals } from '../utils/pricing.js';
import { icon } from '../components/icons.js';
import { money, orderStateChip } from '../components/chips.js';
import { STAGES, PREP_REFRESH_MS } from '../constants.js';
import { confirmDialog } from '../components/modal.js';
import { openNewOrderDialog } from '../components/new-order-dialog.js';
import { agentSelectHtml, initAgentSelect, requireAgent } from '../components/agent-select.js';
import { openPrintPreview } from '../components/print-ticket.js';
import { openWhatsAppDialog } from '../components/whatsapp-dialog.js';

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
      title: 'يوجد طلب قيد الإنشاء',
      message: 'إذا بدأت طلبًا جديدًا سيتم حذف الطلب غير المؤكد. يمكنك استكماله من بطاقة «مسودة».',
      confirmLabel: 'حذف وبدء طلب جديد', danger: true,
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
    <div class="o-card" role="button" tabindex="0" data-id="${esc(o.id)}" aria-label="فتح الطلب ${esc(o.number)}">
      <div class="o-head">
        <strong class="o-no ltr-inline">#${esc(o.number)}</strong>
        <span class="o-head-end">${orderStateChip(o)}
          ${o.status !== 'cancelled' ? `<button type="button" class="btn btn-ghost btn-icon btn-sm o-wa" data-wa-order="${esc(o.id)}" title="واتساب للعميل" aria-label="واتساب للعميل — طلب ${esc(o.number)}">${icon('whatsapp')}</button>` : ''}
          <button type="button" class="btn btn-ghost btn-icon btn-sm o-print" data-print-order="${esc(o.id)}" title="إعادة طباعة الطلب" aria-label="طباعة الطلب ${esc(o.number)}">${icon('printer')}</button></span>
      </div>
      ${o.editCount ? `<div class="o-edited">${icon('edit')}تم التعديل${o.editSeenAt && o.editSeenAt >= o.editedAt ? ' · اطّلع عليه الفرع' : ' · لم يطّلع عليه الفرع بعد'}</div>` : ''}
      <div class="o-row">${icon('user')}<div><div class="o-strong">${esc(o.customer.name)}</div>
        <div class="ltr-inline o-muted">${esc(o.customer.phone)}</div></div></div>
      <div class="o-row">${icon('clock')}<span>${formatRelative(o.createdAt)}${stageSince(o)}</span></div>
      <div class="o-row">${icon('pin')}<span>${esc(o.address.areaName)}</span></div>
      ${o.stage === 'out' && o.driver ? `<div class="o-row o-driver">${icon('user')}<span>الطيار: <strong>${esc(o.driver)}</strong></span></div>` : ''}
      <div class="o-row">${icon('headset')}<span>${esc(o.employee)}</span></div>
      <div class="o-total">${money(t.total)}${t.estimated ? ' <span class="est">تقريبي</span>' : ''}</div>
    </div>`;
}

/* "· على الكاشير من 3 دقايق" — how long the order has been in its stage. */
function stageSince(o) {
  if (o.status === 'cancelled') return '';
  const at = { preparing: o.preparingAt, at_cashier: o.atCashierAt, out: o.outAt }[o.stage];
  return at ? ` · <span class="o-stage-since">${o.stage === 'out' ? 'خرج' : 'في هذه المرحلة'} ${formatRelative(at)}</span>` : '';
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
          <div class="page-sub"><span>طلبات التوصيل التي يسجلها مركز الاتصال</span>
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
        ${can(getState().user, 'ordersLog') ? '<a href="#/orders">كل الطلبات</a>' : ''}
      </nav>
      <div class="board-cols" data-cols><p class="muted">جارٍ التحميل…</p></div>
    </div></div>`;

  const cols = view.querySelector('[data-cols]');
  let orders = [];
  const render = () => {
    const today = orders.filter((o) => inWorkDay(o.createdAt) && matches(o));   // until 2 AM
    const active = today.filter((o) => o.status !== 'cancelled');
    const cancelled = today.filter((o) => o.status === 'cancelled');
    const draft = draftCard();
    const empty = { new: 'لا توجد طلبات جديدة', preparing: 'لا توجد طلبات قيد التجهيز', at_cashier: 'لا توجد طلبات على الكاشير', out: 'لم يخرج أي طلب بعد' };
    cols.innerHTML =
      column('مسودة', draft ? 1 : 0, draft, 'لا يوجد طلب قيد الإنشاء') +
      STAGES.map((st) => {
        const list = active.filter((o) => (o.stage || 'new') === st.id);
        return column(st.label, list.length, list.map(orderCard).join(''), empty[st.id], `is-${st.id}`);
      }).join('') +
      column('ملغي', cancelled.length, cancelled.map(orderCard).join(''), 'لا توجد طلبات ملغاة اليوم', 'is-cancelled');
  };

  view.querySelector('#boardQ').addEventListener('input', (e) => { filters.q = e.target.value; render(); });
  const offs = [
    on(view, 'click', '[data-new-order]', () => startNewOrder()),
    // Print again straight from the card (in case the first ticket got lost).
    on(view, 'click', '[data-print-order]', (e, btn) => {
      e.stopPropagation();
      const o = orders.find((x) => x.id === btn.dataset.printOrder);
      if (o) openPrintPreview(o);
    }),
    // Ready WhatsApp message to the customer (the employee presses «إرسال» in WhatsApp).
    on(view, 'click', '[data-wa-order]', (e, btn) => {
      e.stopPropagation();
      const o = orders.find((x) => x.id === btn.dataset.waOrder);
      if (o) openWhatsAppDialog(o);
    }),
    on(view, 'click', '.o-card[data-id]', (e, el) => {
      if (e.target.closest('[data-print-order], [data-wa-order]')) return;
      location.hash = `#/orders/${encodeURIComponent(el.dataset.id)}`;
    }),
    on(view, 'keydown', '.o-card[data-id]', (e, el) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); location.hash = `#/orders/${encodeURIComponent(el.dataset.id)}`; }
    }),
    on(view, 'click', '[data-discard]', async () => {
      if (await confirmDialog({ title: 'إلغاء المسودة', message: 'سيتم حذف العميل والأصناف في الطلب غير المؤكد.', confirmLabel: 'إلغاء المسودة', danger: true })) {
        resetDraft();
        render();
      }
    }),
  ];

  const nameList = initAgentSelect(view);
  offs.push(nameList.destroy);
  if (openNameListOnBoard) { openNameListOnBoard = false; nameList.open(); }

  // The branch moves orders on: check every few seconds (only while this screen is visible).
  let stopped = false;
  let timer = null;
  const load = () => ds.listOrders().then((list) => { if (!stopped) { orders = list; render(); } }).catch(() => {});
  const schedule = () => { timer = setTimeout(async () => { if (!document.hidden) await load(); if (!stopped) schedule(); }, PREP_REFRESH_MS); };
  load().then(schedule);
  return () => { stopped = true; clearTimeout(timer); offs.forEach((f) => f()); };
}
