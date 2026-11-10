/* Call-center home (Foodics-style board): today's orders in columns — draft in progress,
   then the preparation stages set by the branch (جديد / بيتجهز / على الكاشير / خرج مع الطيار),
   then cancelled — plus "طلب جديد لمركز الاتصال". Checks for changes every few seconds. */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, resetDraft, currentDeliveryFee } from '../store.js';
import { esc, on } from '../utils/dom.js';
import { keepColumnScroll } from '../components/pager.js';
import { formatRelative, inWorkDay, normalizeArabic, normalizePhone, workDayStart } from '../utils/format.js';
import { can } from '../permissions.js';
import { computeTotals } from '../utils/pricing.js';
import { icon } from '../components/icons.js';
import { money, orderStateChip } from '../components/chips.js';
import { STAGES, PREP_REFRESH_MS } from '../constants.js';
import { confirmDialog, openModal, showToast } from '../components/modal.js';
import { draftsOn, flushDraft, listDrafts, openDraft, discardDraft } from '../drafts-sync.js';
import { formatTime } from '../utils/format.js';
import { quantityLabel } from '../utils/pricing.js';
import { openNewOrderDialog } from '../components/new-order-dialog.js';
import { agentSelectHtml, initAgentSelect, requireAgent } from '../components/agent-select.js';
import { openPrintPreview } from '../components/print-ticket.js';
import { openWhatsAppDialog } from '../components/whatsapp-dialog.js';

const filters = { q: '' };
let refused = new Map();   // order id → { reason, at } — «متسلّمش» while the driver is still out (35_board_refused.sql)
let openNameListOnBoard = false;   // set when someone tries to start an order before picking a name

/* Opens the new-order dialog; if a draft is in progress, asks before discarding it. */
export async function startNewOrder({ phone = '' } = {}) {
  if (!getState().agent) {
    requireAgent();
    openNameListOnBoard = true;
    if (location.hash !== '#/board') location.hash = '#/board';
    else window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  const s = getState();
  if ((s.customer || s.cart.length) && draftsOn() && !s.editing) {
    // 33_drafts.sql: the order being written stays in «مسودة» — nothing is lost
    await flushDraft();
    resetDraft();
    showToast('الطلب اللي كان مفتوح اتحفظ في «مسودة» — تقدر تكمّله بعدين');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (s.customer || s.cart.length) {
    const ok = await confirmDialog({
      title: 'يوجد طلب قيد الإنشاء',
      message: 'إذا بدأت طلبًا جديدًا سيتم حذف الطلب غير المؤكد. يمكنك استكماله من بطاقة «مسودة».',
      confirmLabel: 'حذف وبدء طلب جديد', danger: true,
    });
    if (!ok) return;
    resetDraft();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  openNewOrderDialog({ phone });
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
    <a class="o-card" href="#/orders/${encodeURIComponent(o.id)}" data-id="${esc(o.id)}" aria-label="فتح الطلب ${esc(o.number)}">
      <div class="o-head">
        <strong class="o-no ltr-inline">#${esc(o.number)}</strong>
        <span class="o-head-end">${orderStateChip(o)}
          ${o.status !== 'cancelled' ? `<button type="button" class="btn btn-ghost btn-icon btn-sm o-wa" data-wa-order="${esc(o.id)}" title="واتساب للعميل" aria-label="واتساب للعميل — طلب ${esc(o.number)}">${icon('whatsapp')}</button>` : ''}
          <button type="button" class="btn btn-ghost btn-icon btn-sm o-print" data-print-order="${esc(o.id)}" title="إعادة طباعة الطلب" aria-label="طباعة الطلب ${esc(o.number)}">${icon('printer')}</button></span>
      </div>
      ${o.prepName && o.status !== 'cancelled' && ['preparing', 'at_cashier'].includes(o.stage) ? `<div class="o-prep">${icon('clipboard')}${o.stage === 'preparing' ? 'بيجهزه' : 'جهّزه'}: <strong>${esc(o.prepName)}</strong></div>` : ''}
      ${refused.has(o.id) && o.status !== 'cancelled' ? `<div class="o-refused">${icon('x')}<span><strong>متسلّمش</strong> — ${esc(refused.get(o.id).reason)} · ${esc(formatTime(refused.get(o.id).at))}</span></div>` : ''}
      ${(getState().chatOrders || []).includes(o.id) ? `<button type="button" class="o-chat" data-chat-go>${icon('chat')}رسالة جديدة من الطيار عن الطلب ده</button>` : ''}
      ${o.editCount ? `<div class="o-edited">${icon('edit')}تم التعديل${o.editSeenAt && o.editSeenAt >= o.editedAt ? ' · اطّلع عليه الفرع' : ' · لم يطّلع عليه الفرع بعد'}</div>` : ''}
      <div class="o-row">${icon('user')}<div><div class="o-strong">${esc(o.customer.name)}</div>
        <div class="ltr-inline o-muted">${esc(o.customer.phone)}</div></div></div>
      <div class="o-row">${icon('clock')}<span>${formatRelative(o.createdAt)}${stageSince(o)}</span></div>
      <div class="o-row">${icon('pin')}<span>${esc(o.address.areaName)}</span></div>
      ${o.stage === 'out' && o.driver === 'استلام من الفرع' ? `<div class="o-row o-driver">${icon('home')}<span><strong>العميل استلم من الفرع</strong></span></div>`
        : o.stage === 'out' && o.driver ? `<div class="o-row o-driver">${icon('user')}<span>الطيار: <strong>${esc(o.driver)}</strong></span></div>` : ''}
      <div class="o-row">${icon('headset')}<span>${esc(o.employee)}</span></div>
      <div class="o-total">${money(t.total)}${t.estimated ? ' <span class="est">تقريبي</span>' : ''}</div>
    </a>`;
}

/* "· على الكاشير من 3 دقايق" — how long the order has been in its stage. */
function stageSince(o) {
  if (o.status === 'cancelled') return '';
  const at = { preparing: o.preparingAt, at_cashier: o.atCashierAt, out: o.outAt }[o.stage];
  return at ? ` · <span class="o-stage-since">${o.stage === 'out' ? 'خرج' : 'في هذه المرحلة'} ${formatRelative(at)}</span>` : '';
}

/* «مسودة» from the database (33_drafts.sql): my drafts (continue / cancel) and, for the admin,
   everyone's with the employee's name (look only). The one open on this screen is marked. */
const draftTotal = (d) => {
  const fee = d.address?.areaId ? catalog.areasById.get(d.address.areaId)?.fee ?? null : null;
  return computeTotals(d.cart || [], fee).total;
};
function dbDraftCard(d, openId) {
  const x = d.data || {};
  const open = d.mine && d.id === openId;
  return `
    <div class="o-card o-draft ${open ? 'is-open' : ''} ${d.mine ? '' : 'is-other'}" data-draft="${esc(d.id)}">
      <div class="o-head"><strong>${open ? 'مفتوح دلوقتي' : 'مسودة'}</strong>
        <span class="status tone-amber">${d.mine ? 'مسودتي' : esc(d.agentName || 'موظف')}</span></div>
      <div class="o-row">${icon('user')}<div><div class="o-strong">${esc(x.customer?.name ?? 'لم يتم تحديد العميل')}</div>
        ${x.customer ? `<div class="ltr-inline o-muted">${esc(x.customer.phone || '')}</div>` : ''}</div></div>
      <div class="o-row">${icon('cart')}<span>${(x.cart || []).length} أصناف</span></div>
      ${x.address?.areaId ? `<div class="o-row">${icon('pin')}<span>${esc(catalog.areasById.get(x.address.areaId)?.name ?? '')}</span></div>` : ''}
      <div class="o-row o-muted">${icon('clock')}<span>آخر تعديل ${esc(formatRelative(d.updatedAt))}${d.mine ? '' : ` · ${esc(d.agentName)}`}</span></div>
      <div class="o-total">${money(draftTotal(x))}</div>
      <div class="o-actions">
        ${d.mine ? `<button type="button" class="btn btn-primary btn-sm" data-draft-open>${icon('edit')}استكمال الطلب</button>
          <button type="button" class="btn btn-danger-ghost btn-sm" data-draft-discard>${icon('trash')}إلغاء المسودة</button>`
          : `<button type="button" class="btn btn-secondary btn-sm" data-draft-view>${icon('note')}عرض</button>`}
      </div>
    </div>`;
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
          <a href="#/pos/new" class="btn btn-primary btn-lg" data-new-order title="كليك يمين ← فتح في تاب جديد: طلب تاني في نفس الوقت">${icon('headset')}طلب جديد لمركز الاتصال</a>
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
  let dbDrafts = null;      // null = drafts not in the database (33_drafts.sql not applied)
  const render = () => {
    const today = orders.filter((o) => inWorkDay(o.createdAt) && matches(o));   // until 2 AM
    const active = today.filter((o) => o.status !== 'cancelled');
    const cancelled = today.filter((o) => o.status === 'cancelled');
    // drafts from the database when installed; else the one on this screen (as before)
    const s = getState();
    let draftHtml; let draftCount;
    if (dbDrafts) {
      const list = dbDrafts.slice();
      const live = (s.customer || s.cart.length) && !s.editing && !list.some((d) => d.id === s.requestId);
      if (live) list.unshift({ id: s.requestId, mine: true, agentName: '', updatedAt: new Date().toISOString(), data: { customer: s.customer, address: s.address, cart: s.cart, orderNote: s.orderNote } });
      draftHtml = list.map((d) => dbDraftCard(d, s.requestId)).join('');
      draftCount = list.length;
    } else {
      draftHtml = draftCard();
      draftCount = draftHtml ? 1 : 0;
    }
    const empty = { new: 'لا توجد طلبات جديدة', preparing: 'لا توجد طلبات قيد التجهيز', at_cashier: 'لا توجد طلبات على الكاشير', out: 'لم يخرج أي طلب بعد' };
    keepColumnScroll(cols, '.b-col-body', () => { cols.innerHTML =
      column('مسودة', draftCount, draftHtml, 'لا يوجد طلب قيد الإنشاء') +
      STAGES.map((st) => {
        const list = active.filter((o) => (o.stage || 'new') === st.id);
        return column(st.label, list.length, list.map(orderCard).join(''), empty[st.id], `is-${st.id}`);
      }).join('') +
      column('ملغي', cancelled.length, cancelled.map(orderCard).join(''), 'لا توجد طلبات ملغاة اليوم', 'is-cancelled'); });
  };

  view.querySelector('#boardQ').addEventListener('input', (e) => { filters.q = e.target.value; render(); });
  const offs = [
    on(view, 'click', '[data-new-order]', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;   // the browser opens it in a new tab
      e.preventDefault(); startNewOrder();
    }),
    // Print again straight from the card (in case the first ticket got lost).
    on(view, 'click', '[data-print-order]', (e, btn) => {
      e.preventDefault(); e.stopPropagation();   // the card is a link: don't open the order
      const o = orders.find((x) => x.id === btn.dataset.printOrder);
      if (o) openPrintPreview(o);
    }),
    // Ready WhatsApp message to the customer (the employee presses «إرسال» in WhatsApp).
    on(view, 'click', '[data-wa-order]', (e, btn) => {
      e.preventDefault(); e.stopPropagation();
      const o = orders.find((x) => x.id === btn.dataset.waOrder);
      if (o) openWhatsAppDialog(o);
    }),
    on(view, 'click', '[data-chat-go]', (e) => { e.preventDefault(); e.stopPropagation(); location.hash = '#/chat'; }),
    on(view, 'click', '[data-draft-open]', async (e, b) => {
      const d = dbDrafts?.find((x) => x.id === b.closest('[data-draft]').dataset.draft);
      if (d && d.id !== getState().requestId) await openDraft(d);
      location.hash = '#/pos';
    }),
    on(view, 'click', '[data-draft-discard]', async (e, b) => {
      const id = b.closest('[data-draft]').dataset.draft;
      if (!(await confirmDialog({ title: 'إلغاء المسودة', message: 'سيتم حذف العميل والأصناف في المسودة دي.', confirmLabel: 'إلغاء المسودة', danger: true }))) return;
      await discardDraft(id);
      dbDrafts = (dbDrafts || []).filter((x) => x.id !== id);
      render();
    }),
    on(view, 'click', '[data-draft-view]', (e, b) => {
      const d = dbDrafts?.find((x) => x.id === b.closest('[data-draft]').dataset.draft);
      if (!d) return;
      const x = d.data || {};
      openModal({
        title: `${icon('note')} مسودة ${esc(d.agentName)}`,
        size: 'sm',
        body: `<p><strong>${esc(x.customer?.name ?? 'لم يتم تحديد العميل')}</strong> <span class="ltr-inline">${esc(x.customer?.phone ?? '')}</span></p>
          ${x.address?.areaId ? `<p class="muted">${esc(catalog.areasById.get(x.address.areaId)?.name ?? '')} · ${esc(x.address.street ?? '')}</p>` : ''}
          <ul class="draft-items">${(x.cart || []).map((l) => `<li><span class="num">${esc(quantityLabel(l))}</span> ${esc(l.name)}</li>`).join('') || '<li class="muted">لسه مفيش أصناف</li>'}</ul>
          ${x.orderNote ? `<p class="muted">ملاحظات: ${esc(x.orderNote)}</p>` : ''}
          <p><strong>الإجمالي: ${money(draftTotal(x))}</strong></p>
          <p class="muted">آخر تعديل ${esc(formatTime(d.updatedAt))} — المسودة دي بتاعة ${esc(d.agentName)}، هو اللي يكمّلها.</p>`,
        footer: '<button type="button" class="btn btn-secondary" data-close>إغلاق</button>',
      });
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
  // CONFIRMED: only this working day's orders are loaded (the board shows nothing older) — light on every check.
  const load = () => Promise.all([ds.listOrders({ since: workDayStart() }), listDrafts(), ds.refusedOrders().catch(() => new Map())])
    .then(([list, drafts, rf]) => { if (!stopped) { orders = list; dbDrafts = drafts; refused = rf; render(); } }).catch(() => {});
  const schedule = () => { timer = setTimeout(async () => { if (!document.hidden) await load(); if (!stopped) schedule(); }, PREP_REFRESH_MS); };
  load().then(schedule);
  return () => { stopped = true; clearTimeout(timer); offs.forEach((f) => f()); };
}
