/* Printable order ticket (80mm receipt layout) + preview dialog. */
import { ORDER_SOURCES, PAYMENT_METHOD } from '../constants.js';
import { esc } from '../utils/dom.js';
import { formatAddress, formatMoney, formatDateTime } from '../utils/format.js';
import { computeTotals, lineTotal, quantityLabel } from '../utils/pricing.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';

export function ticketHtml(order) {
  const t = computeTotals(order.items, order.deliveryFee);
  const a = order.address;
  const source = ORDER_SOURCES.find((s) => s.id === order.source)?.label ?? '—';
  return `
    <div class="ticket" dir="rtl">
      <div class="tk-head">
        <div class="tk-store">أبو الفضل</div>
        <div>طلب توصيل — مركز الاتصال</div>
        ${order.isDemo ? '<div class="tk-demo">طلب تجريبي</div>' : ''}
      </div>
      <div class="tk-no ltr-inline">${esc(order.number)}</div>
      <div class="tk-rows">
        <div><span>التاريخ</span><span class="num">${formatDateTime(order.createdAt)}</span></div>
        <div><span>المصدر</span><span>${esc(source)}</span></div>
        <div><span>الموظف</span><span>${esc(order.employee)}</span></div>
        <div><span>الدفع</span><span>${PAYMENT_METHOD.label}</span></div>
      </div>

      <div class="tk-sec">
        <div class="tk-title">العميل</div>
        <div class="tk-strong">${esc(order.customer.name)}</div>
        <div class="tk-phone ltr-inline">${esc(order.customer.phone)}</div>
      </div>

      <div class="tk-sec">
        <div class="tk-title">العنوان</div>
        <div class="tk-strong">${a.label ? `${esc(a.label)} — ` : ''}${esc(a.areaName)}</div>
        <div>${esc(formatAddress(a))}</div>
        ${a.landmark ? `<div>علامة مميزة: ${esc(a.landmark)}</div>` : ''}
        ${a.notes ? `<div>${esc(a.notes)}</div>` : ''}
      </div>

      <table class="tk-items">
        <thead><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
        <tbody>
          ${order.items.map((it) => `
            <tr>
              <td>${esc(it.name)}
                ${it.note ? `<div class="tk-note">* ${esc(it.note)}</div>` : ''}</td>
              <td class="num">${esc(quantityLabel(it))}</td>
              <td class="num">${formatMoney(lineTotal(it))}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <div class="tk-rows tk-totals">
        <div><span>المجموع</span><span class="num">${formatMoney(t.subtotal)}</span></div>
        <div><span>رسوم التوصيل</span><span class="num">${formatMoney(t.deliveryFee ?? 0)}</span></div>
        <div class="tk-total"><span>${t.estimated ? 'الإجمالي التقريبي' : 'الإجمالي'}</span><span class="num">${formatMoney(t.total)}</span></div>
      </div>
      <div class="tk-cash">المطلوب تحصيله كاش: <span class="num">${formatMoney(t.total)}</span></div>
      ${t.estimated ? '<div class="tk-hint">الأصناف الموزونة تُحسب حسب الوزن الفعلي</div>' : ''}
      ${order.note ? `<div class="tk-sec"><div class="tk-title">ملاحظات الطلب</div><div>${esc(order.note)}</div></div>` : ''}
    </div>`;
}

/* Renders the ticket into a print-only container and opens the print dialog. */
export function printOrder(order) {
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  root.innerHTML = ticketHtml(order);
  window.print();
}

export function openPrintPreview(order) {
  const m = openModal({
    title: `${icon('note')} ورقة الطلب`,
    size: 'sm',
    body: `
      <div class="ticket-preview">${ticketHtml(order)}</div>
      <p class="hint">الطباعة تشتغل لما البرنامج يتفتح من الجهاز أو السيرفر. في لينك العرض على Claude بتظهر المعاينة بس.</p>`,
    footer: `
      <button type="button" class="btn btn-primary btn-lg" data-print>${icon('note')}طباعة</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>`,
  });
  m.foot.querySelector('[data-print]').addEventListener('click', () => printOrder(order));
  m.foot.querySelector('[data-print]').focus();
}
