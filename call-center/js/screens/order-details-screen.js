/* Read-only order details + "repeat order" and "copy summary". */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, loadDraftFromOrder } from '../store.js';
import { esc, on, copyText } from '../utils/dom.js';
import { formatAddress, formatDateTime, formatTime, dayLabel } from '../utils/format.js';
import { computeTotals, lineTotal, quantityLabel, perUnitLabel } from '../utils/pricing.js';
import { buildOrderSummary } from '../utils/order-summary.js';
import { icon } from '../components/icons.js';
import { money, statusChip, sourceChip, totalsRows, estimateNote } from '../components/chips.js';
import { confirmDialog, showToast } from '../components/modal.js';

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
            <p class="muted">الطلبات التجريبية الجديدة تُحذف عند تحديث الصفحة.</p></div>
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
              ${statusChip(order.status)} ${sourceChip(order.source)}
              <span>${icon('clock')} ${formatDateTime(order.createdAt)}</span>
              <span>أنشأه: ${esc(order.employee)}</span>
              ${order.isDemo ? '<span class="demo-pill">طلب تجريبي</span>' : ''}
            </div>
          </div>
          <div class="page-actions">
            <button type="button" class="btn btn-soft" data-repeat>${icon('repeat')}تكرار الطلب</button>
            <button type="button" class="btn btn-secondary" data-copy>${icon('copy')}نسخ الملخص</button>
          </div>
        </div>

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
                  <li>${statusChip(h.status)}<span class="muted num">${dayLabel(h.at)} · ${formatTime(h.at)}</span></li>`).join('')}
              </ul>
              <div class="unconfirmed">${icon('info')}<span>تغيير الحالة غير متاح بعد — الحالات النهائية والصلاحيات في انتظار الاعتماد.</span></div>
            </div>
          </div>
        </div>
      </div></div>`;

    offs = [
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
