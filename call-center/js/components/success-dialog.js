/* Shown after a demo order is created. */
import { esc, copyText } from '../utils/dom.js';
import { computeTotals } from '../utils/pricing.js';
import { buildOrderSummary } from '../utils/order-summary.js';
import { icon } from './icons.js';
import { money, statusChip } from './chips.js';
import { openModal, showToast } from './modal.js';
import { openPrintPreview } from './print-ticket.js';
import { openNewOrderDialog } from './new-order-dialog.js';

export function openSuccessDialog(order) {
  const t = computeTotals(order.items, order.deliveryFee);
  const m = openModal({
    title: `${icon('check')} تم إنشاء الطلب`,
    size: 'sm',
    body: `
      <div class="success">
        <div class="success-icon">${icon('check')}</div>
        <h3>${order.isDemo ? 'تم إنشاء طلب تجريبي' : 'تم حفظ الطلب'}</h3>
        <div class="order-no ltr-inline">${esc(order.number)}</div>
        <div>الحالة: ${statusChip(order.status)}</div>
        <div class="muted">${esc(order.customer.name)} · ${t.estimated ? 'الإجمالي التقريبي' : 'الإجمالي'} ${money(t.total)}</div>
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
  m.foot.querySelector('[data-view]').addEventListener('click', () => m.close());
  m.foot.querySelector('[data-new]').addEventListener('click', () => {
    m.close();
    location.hash = '#/board';
    setTimeout(() => openNewOrderDialog(), 0);
  });
  m.onClose(() => { if (location.hash === '#/pos') location.hash = '#/board'; });
  m.foot.querySelector('[data-new]').focus();
}
