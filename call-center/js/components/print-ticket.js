/* Preparation ticket (80mm receipt): who the order is for, where it goes and
   what to prepare. CONFIRMED: no prices, fees or totals on the printed ticket. */
import { esc } from '../utils/dom.js';
import { formatAddress, formatDateTime } from '../utils/format.js';
import { quantityLabel } from '../utils/pricing.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';

export function ticketHtml(order) {
  const a = order.address;
  const phones = [order.customer.phone, order.customer.phone2].filter(Boolean);
  return `
    <div class="ticket" dir="rtl">
      <div class="tk-head">
        <div class="tk-store">أبو الفضل</div>
        <div>طلب توصيل — مركز الاتصال</div>
        ${order.isDemo ? '<div class="tk-demo">طلب تجريبي</div>' : ''}
      </div>
      <div class="tk-no ltr-inline">${esc(order.number)}</div>
      ${order.editCount ? `<div class="tk-edited">معدّل${order.editCount > 1 ? ` (${order.editCount})` : ''} — بدل الورقة القديمة</div>` : ''}
      <div class="tk-rows">
        <div><span>التاريخ</span><span class="num">${formatDateTime(order.createdAt)}</span></div>
        <div><span>الموظف</span><span>${esc(order.employee)}</span></div>
      </div>

      <div class="tk-sec">
        <div class="tk-title">العميل</div>
        <div class="tk-strong">${esc(order.customer.name)}</div>
        ${phones.map((p, i) => `<div class="tk-phone"><span class="tk-phone-label">${i === 0 ? 'موبايل' : 'رقم تاني'}:</span> <bdi dir="ltr">${esc(p)}</bdi></div>`).join('')}
      </div>

      <div class="tk-sec">
        <div class="tk-title">العنوان</div>
        <div class="tk-strong">${a.label ? `${esc(a.label)} — ` : ''}${esc(a.areaName)}</div>
        <div>${esc(formatAddress(a))}</div>
        ${a.landmark ? `<div>${esc(a.landmark)}</div>` : ''}
        ${a.notes ? `<div>${esc(a.notes)}</div>` : ''}
      </div>

      <table class="tk-items">
        <thead><tr><th>الصنف</th><th>الكمية / الوزن</th></tr></thead>
        <tbody>
          ${order.items.map((it) => `
            <tr>
              <td>${esc(it.name)}
                ${it.note ? `<div class="tk-note">* ${esc(it.note)}</div>` : ''}</td>
              <td class="num tk-qty">${esc(quantityLabel(it))}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="tk-count">عدد الأصناف: <span class="num">${order.items.length}</span></div>
      ${order.note ? `<div class="tk-sec"><div class="tk-title">ملاحظات العميل</div><div class="tk-strong">${esc(order.note)}</div></div>` : ''}
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
