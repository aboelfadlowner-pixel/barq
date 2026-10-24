/* Shown after a demo order is created. */
import { esc, copyText } from '../utils/dom.js';
import { computeTotals } from '../utils/pricing.js';
import { buildOrderSummary } from '../utils/order-summary.js';
import { icon } from './icons.js';
import { money, statusChip } from './chips.js';
import { openModal, showToast } from './modal.js';
import { openPrintPreview } from './print-ticket.js';
import { openNewOrderDialog } from './new-order-dialog.js';
import { orderWaLink } from './whatsapp-dialog.js';

export function openSuccessDialog(order, { edited = false } = {}) {
  const t = computeTotals(order.items, order.deliveryFee);
  const wa = orderWaLink(order, { edited });
  const m = openModal({
    title: `${icon('check')} ${edited ? 'تم حفظ التعديل' : 'تم إنشاء الطلب'}`,
    size: 'sm',
    body: `
      <div class="success">
        <div class="success-icon">${icon('check')}</div>
        <h3>${edited ? 'تم تعديل الطلب' : (order.isDemo ? 'تم إنشاء طلب تجريبي' : 'تم حفظ الطلب')}</h3>
        ${edited ? `<div class="alert alert-warn">${icon('note')}<span>اطبع الورقة الجديدة وأرسلها لفريق التجهيز بدلًا من السابقة — تظهر للفرع علامة «تم التعديل».</span></div>` : ''}
        <div class="order-no ltr-inline">${esc(order.number)}</div>
        <div>الحالة: ${statusChip(order.status)}</div>
        <div class="muted">${esc(order.customer.name)} · ${t.estimated ? 'الإجمالي التقريبي' : 'الإجمالي'} ${money(t.total)}</div>
        ${wa
          ? `<a class="btn btn-whatsapp btn-lg success-wa" href="${esc(wa)}" target="_blank" rel="noopener" data-wa-send>${icon('whatsapp')}${edited ? 'إرسال التعديل للعميل عبر واتساب' : 'إرسال الطلب للعميل عبر واتساب'}</a>
             <div class="hint">ليراجعه العميل ويطلب أي تعديل قبل التجهيز — اضغط «إرسال» داخل واتساب.</div>`
          : `<div class="muted">${icon('info')}رقم العميل ليس رقم موبايل، لا يمكن الإرسال عبر واتساب.</div>`}
        <div class="alert alert-warn demo-only">${icon('info')}<span>طلب تجريبي محفوظ في ذاكرة المتصفح فقط. لم يُرسل إلى أي نظام، ويُحذف عند تحديث الصفحة.</span></div>
      </div>`,
    footer: `
      <button type="button" class="btn btn-primary btn-lg" data-new>${icon('plus')}طلب جديد</button>
      <button type="button" class="btn btn-soft" data-print>${icon('note')}طباعة الطلب</button>
      <button type="button" class="btn btn-secondary" data-copy>${icon('copy')}نسخ الملخص</button>
      <a class="btn btn-ghost" href="#/orders/${encodeURIComponent(order.id)}" data-view>عرض الطلب</a>`,
  });

  m.foot.querySelector('[data-copy]').addEventListener('click', async () => {
    showToast((await copyText(buildOrderSummary(order))) ? 'تم نسخ ملخص الطلب' : 'تعذر النسخ');
  });
  m.foot.querySelector('[data-print]').addEventListener('click', () => openPrintPreview(order));
  m.body.querySelector('[data-wa-send]')?.addEventListener('click', (e) => {
    e.currentTarget.classList.add('is-sent');
    e.currentTarget.lastChild.textContent = 'تم فتح واتساب ✓ — إرسال مرة أخرى';
  });
  m.foot.querySelector('[data-view]').addEventListener('click', () => m.close());
  m.foot.querySelector('[data-new]').addEventListener('click', () => {
    m.close();
    location.hash = '#/board';
    setTimeout(() => openNewOrderDialog(), 0);
  });
  m.onClose(() => { if (location.hash === '#/pos') location.hash = '#/board'; });
  (m.body.querySelector('[data-wa-send]') || (edited ? m.foot.querySelector('[data-print]') : m.foot.querySelector('[data-new]'))).focus();
}
