/* Preparation ticket (80mm receipt): who the order is for, where it goes and
   what to prepare. CONFIRMED: no prices, fees or totals on the printed ticket. */
import { esc } from '../utils/dom.js';
import { formatAddress, formatDateTime } from '../utils/format.js';
import { quantityLabel, modifiersText } from '../utils/pricing.js';
import { TICKET_LOGO } from '../brand-logo.js';
import { icon } from './icons.js';
import { openModal, showToast } from './modal.js';

export function ticketHtml(order) {
  const a = order.address;
  const phones = [order.customer.phone, order.customer.phone2].filter(Boolean);
  return `
    <div class="ticket" dir="rtl">
      <div class="tk-head">
        <img class="tk-logo" src="${TICKET_LOGO}" alt="">
        <div class="tk-store">أبو الفضل</div>
        <div>طلب توصيل — مركز الاتصال</div>
        ${order.isDemo ? '<div class="tk-demo">طلب تجريبي</div>' : ''}
      </div>
      <div class="tk-no ltr-inline">${esc(order.number)}</div>
      ${order.editCount ? `<div class="tk-edited">معدّل${order.editCount > 1 ? ` (${order.editCount})` : ''} — بدلًا من الورقة السابقة</div>` : ''}
      <div class="tk-rows">
        <div><span>التاريخ</span><span class="num">${formatDateTime(order.createdAt)}</span></div>
        <div><span>الموظف</span><span>${esc(order.employee)}</span></div>
      </div>

      <div class="tk-sec">
        <div class="tk-title">العميل</div>
        <div class="tk-strong">${esc(order.customer.name)}</div>
        ${phones.map((p, i) => `<div class="tk-phone"><span class="tk-phone-label">${i === 0 ? 'موبايل' : 'رقم إضافي'}:</span> <bdi dir="ltr">${esc(p)}</bdi></div>`).join('')}
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
                ${it.modifiers?.length ? `<div class="tk-mods">+ ${esc(modifiersText(it.modifiers))}</div>` : ''}
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

/* CONFIRMED: a ✓ next to the print icon on the board card once the ticket was printed — kept on THIS
   device only (each employee sees what they printed), for two days. */
const PRINTED_KEY = 'cc-printed';
const readPrinted = () => { try { return JSON.parse(localStorage.getItem(PRINTED_KEY) || '{}') || {}; } catch { return {}; } };
export const printedAt = (orderId) => readPrinted()[orderId] || null;
function markPrinted(orderId) {
  if (!orderId) return;
  const all = readPrinted();
  const keepFrom = Date.now() - 2 * 86400000;
  for (const [id, at] of Object.entries(all)) if (new Date(at).getTime() < keepFrom) delete all[id];
  all[orderId] = new Date().toISOString();
  try { localStorage.setItem(PRINTED_KEY, JSON.stringify(all)); } catch { /* full or blocked: fine */ }
  window.dispatchEvent(new CustomEvent('cc-printed', { detail: orderId }));
}

/* «ورقة الطلب»: the preview, then «طباعة». After printing the preview closes by itself
   and a short «تم طباعة الطلب ✓» shows — the employee is back where they were. */
export function openPrintPreview(order) {
  const m = openModal({
    title: `${icon('note')} ورقة الطلب`,
    size: 'sm',
    body: `
      <div class="ticket-preview">${ticketHtml(order)}</div>
      <p class="hint">تعمل الطباعة عند فتح البرنامج من الجهاز أو الخادم. في رابط العرض تظهر المعاينة فقط.</p>`,
    footer: `
      <button type="button" class="btn btn-primary btn-lg" data-print>${icon('note')}طباعة</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>`,
  });
  m.foot.querySelector('[data-print]').addEventListener('click', () => {
    printOrder(order);                     // returns when the browser's print window is closed
    markPrinted(order.id);
    m.close();
    showToast(order.number ? `تم طباعة الطلب ${order.number} ✓` : 'تم طباعة الطلب ✓');
  });
  m.foot.querySelector('[data-print]').focus();
}
