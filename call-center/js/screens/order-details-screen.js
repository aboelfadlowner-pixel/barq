/* Read-only order details + "repeat order" and "copy summary". */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, loadDraftFromOrder } from '../store.js';
import { esc, on, copyText } from '../utils/dom.js';
import { formatAddress, formatDateTime, formatTime, dayLabel } from '../utils/format.js';
import { computeTotals, lineTotal, quantityLabel, perUnitLabel } from '../utils/pricing.js';
import { buildOrderSummary } from '../utils/order-summary.js';
import { icon } from '../components/icons.js';
import { money, statusChip, totalsRows, estimateNote } from '../components/chips.js';
import { confirmDialog, openModal, showToast } from '../components/modal.js';
import { can } from '../permissions.js';
import { openPrintPreview } from '../components/print-ticket.js';
import { PAYMENT_METHOD } from '../constants.js';

export function mountOrderDetails(view, orderId) {
  view.innerHTML = '<div class="page"><div class="page-inner"><p class="muted">جارٍ التحميل…</p></div></div>';
  let offs = [];
  let alive = true;

  ds.getOrder(orderId).then((order) => {
    if (!alive) return;
    if (!order) {
      view.innerHTML = `
        <div class="page"><div class="page-inner">
          <a href="#/orders" class="back-link">${icon('arrowRight')}رجوع للطلبات</a>
          <div class="card card-pad"><h2>الطلب غير موجود</h2>
            <p class="muted demo-only">الطلبات التجريبية الجديدة تُحذف عند تحديث الصفحة.</p></div>
        </div></div>`;
      return;
    }
    const t = computeTotals(order.items, order.deliveryFee);
    const a = order.address;

    view.innerHTML = `
      <div class="page"><div class="page-inner">
        <a href="#/orders" class="back-link">${icon('arrowRight')}رجوع للطلبات</a>
        <div class="page-head">
          <div>
            <h1>طلب <span class="ltr-inline">${esc(order.number)}</span></h1>
            <div class="meta-row">
              ${statusChip(order.status)}
              <span>${icon('clock')} ${formatDateTime(order.createdAt)}</span>
              <span>${icon('headset')} أخد الطلب: <strong>${esc(order.employee)}</strong></span>
              <span class="tag tag-green">${PAYMENT_METHOD.label}</span>
              ${order.isDemo ? '<span class="demo-pill">طلب تجريبي</span>' : ''}
            </div>
          </div>
          <div class="page-actions">
            <button type="button" class="btn btn-primary" data-print>${icon('note')}طباعة</button>
            <button type="button" class="btn btn-soft" data-repeat>${icon('repeat')}تكرار الطلب</button>
            <button type="button" class="btn btn-secondary" data-copy>${icon('copy')}نسخ الملخص</button>
            ${order.status !== 'cancelled' && can(getState().user, 'cancelOrder')
              ? `<button type="button" class="btn btn-danger-ghost" data-cancel>${icon('x')}إلغاء الطلب</button>` : ''}
          </div>
        </div>

        ${order.status === 'cancelled' ? `
          <div class="alert alert-danger" style="margin-bottom:14px">${icon('alert')}
            <span>الطلب ده ملغي. السبب: ${esc(order.cancelReason || '—')}</span></div>` : ''}
        <div class="details-grid">
          <div class="card">
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>#</th><th>الصنف</th><th>الكمية / الوزن</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
                <tbody>
                  ${order.items.map((l, i) => `
                    <tr>
                      <td class="num">${i + 1}</td>
                      <td><strong>${esc(l.name)}</strong>${l.note ? `<div class="item-note">${icon('note')} ${esc(l.note)}</div>` : ''}</td>
                      <td class="nowrap"><strong class="num">${esc(quantityLabel(l))}</strong></td>
                      <td class="nowrap">${money(l.price)} / ${perUnitLabel(l.unitType)}</td>
                      <td class="nowrap"><strong>${money(lineTotal(l))}</strong>${l.unitType === 'weight' ? ' <span class="est">تقريبي</span>' : ''}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
            <div class="details-totals">
              <div class="totals-box">${totalsRows(t, { detailed: true })}${t.estimated ? estimateNote() : ''}</div>
            </div>
          </div>

          <div class="side-stack">
            <div class="card card-pad">
              <h4 class="block-title" style="margin:0 0 6px">${icon('user')}العميل</h4>
              <div class="big">${esc(order.customer.name)}</div>
              <div class="big-phone ltr-inline">${esc(order.customer.phone)}</div>
            </div>
            <div class="card card-pad">
              <h4 class="block-title" style="margin:0 0 8px">${icon('pin')}عنوان التوصيل</h4>
              <div class="addr-area"><span>${esc(a.areaName)}</span><span class="fee-chip">${money(order.deliveryFee)}</span></div>
              <div class="addr-text">${esc(formatAddress(a))}</div>
              ${a.landmark ? `<div class="addr-extra">علامة مميزة: ${esc(a.landmark)}</div>` : ''}
              ${a.notes ? `<div class="addr-extra">${esc(a.notes)}</div>` : ''}
            </div>
            ${order.note ? `
              <div class="card card-pad">
                <h4 class="block-title" style="margin:0 0 6px">${icon('note')}ملاحظات الطلب</h4>
                <p>${esc(order.note)}</p>
              </div>` : ''}
            <div class="card card-pad">
              <h4 class="block-title" style="margin:0 0 10px">${icon('clock')}سجل الحالة</h4>
              <ul class="timeline">
                ${order.statusHistory.map((h) => `
                  <li>
                    <div>${statusChip(h.status)}
                      ${h.reason ? `<div class="addr-extra">السبب: ${esc(h.reason)}</div>` : ''}</div>
                    <span class="muted num">${h.by ? `${esc(h.by)} · ` : ''}${dayLabel(h.at)} · ${formatTime(h.at)}</span>
                  </li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      </div></div>`;

    offs = [
      on(view, 'click', '[data-print]', () => openPrintPreview(order)),
      on(view, 'click', '[data-cancel]', () => openCancelDialog(order)),
      on(view, 'click', '[data-copy]', async () => {
        showToast((await copyText(buildOrderSummary(order))) ? 'تم نسخ ملخص الطلب' : 'تعذر النسخ');
      }),
      on(view, 'click', '[data-repeat]', async () => {
        const s = getState();
        if ((s.cart.length || s.customer) && !(await confirmDialog({
          title: 'تكرار الطلب',
          message: 'يوجد طلب قيد الإنشاء. سيتم استبدال السلة والعميل الحاليين بأصناف وبيانات هذا الطلب.',
          confirmLabel: 'استبدال وتكرار',
        }))) return;
        const today = await ds.findTodayOrdersByPhone(order.customer.phone);
        const { skipped } = loadDraftFromOrder(order, today);
        location.hash = '#/pos';
        showToast(skipped.length
          ? `تم نسخ الأصناف — ${skipped.length} صنف غير متاح حالياً`
          : 'تم نسخ الأصناف بالأسعار الحالية — اختر مصدر الطلب وراجع قبل التأكيد');
      }),
    ];
  });

  return () => { alive = false; offs.forEach((f) => f()); };
}

/* Supervisor only: cancel with a required reason. */
function openCancelDialog(order) {
  const m = openModal({
    title: `${icon('alert')} إلغاء الطلب <span class="ltr-inline">${esc(order.number)}</span>`,
    size: 'sm',
    body: `
      <div class="field">
        <label for="cancelReason">سبب الإلغاء<span class="req">*</span></label>
        <textarea id="cancelReason" class="textarea" maxlength="200" placeholder="مثال: العميل لغى الطلب"></textarea>
        <div class="field-error" data-err="reason"></div>
      </div>
      <p class="hint">الإلغاء نهائي، والطلب هيفضل ظاهر في القائمة بحالة «ملغي».</p>`,
    footer: `
      <button type="button" class="btn btn-danger btn-lg" data-ok>${icon('x')}إلغاء الطلب</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>رجوع</button>`,
  });
  const ta = m.body.querySelector('#cancelReason');
  ta.focus();
  m.foot.querySelector('[data-ok]').addEventListener('click', async (e) => {
    const reason = ta.value.trim();
    if (!reason) { m.body.querySelector('[data-err="reason"]').textContent = 'اكتب سبب الإلغاء'; ta.focus(); return; }
    e.currentTarget.disabled = true;
    try {
      await ds.cancelOrder(order.id, reason, getState().agent);
      m.close();
      showToast(`تم إلغاء الطلب ${order.number}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err) {
      e.currentTarget.disabled = false;
      showToast(err.message);
    }
  });
}
