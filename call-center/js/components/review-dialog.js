/* Order review before confirmation. Re-renders live if the draft changes. */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { bind, getState, setOrderNote, resetDraft, currentDeliveryFee } from '../store.js';
import { esc, on } from '../utils/dom.js';
import { formatAddress } from '../utils/format.js';
import { computeTotals, lineTotal, quantityLabel, perUnitLabel } from '../utils/pricing.js';
import { icon } from './icons.js';
import { money, totalsRows, estimateNote } from './chips.js';
import { openModal, showToast } from './modal.js';
import { PAYMENT_METHOD } from '../constants.js';
import { openNewOrderDialog, todayWarning } from './new-order-dialog.js';
import { openSuccessDialog } from './success-dialog.js';
import { openAgentPicker } from './agent-dialog.js';

export function missingFields(s) {
  const missing = [];
  if (!s.customer) missing.push('حدد العميل');
  if (!s.address) missing.push('حدد عنوان التوصيل');
  else if (!catalog.areasById.get(s.address.areaId)?.active) missing.push('منطقة التوصيل موقوفة أو غير معروفة — اختر عنواناً آخر');
  if (!s.cart.length) missing.push('أضف صنفاً واحداً على الأقل');
  return missing;
}

export function openReviewDialog() {
  const m = openModal({ title: `${icon('clipboard')} مراجعة الطلب قبل التأكيد`, size: 'lg' });
  let saving = false;

  const render = (_, s) => {
    const t = computeTotals(s.cart, currentDeliveryFee(s));
    const missing = missingFields(s);
    const area = s.address ? catalog.areasById.get(s.address.areaId) : null;

    m.body.innerHTML = `
      <div class="review">
        ${missing.length ? `
          <div class="alert alert-danger missing">${icon('alert')}
            <div><strong>أكمل البيانات التالية قبل التأكيد:</strong><ul>${missing.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
          </div>` : ''}

        <div class="review-row">
          <span class="label">طريقة الدفع</span>
          <span class="tag tag-green">${PAYMENT_METHOD.label}</span>
        </div>

        <div class="review-grid">
          <div class="info-card">
            <h4><span>${icon('user')}العميل</span>
              <button type="button" class="btn btn-ghost btn-sm" data-edit-customer>${icon('edit')}${s.customer ? 'تغيير' : 'تحديد'}</button></h4>
            ${s.customer ? `
              <div class="big">${esc(s.customer.name)} ${s.customer.isNew ? '<span class="tag tag-info">عميل جديد</span>' : ''}</div>
              <div class="big-phone ltr-inline">${esc(s.customer.phone)}</div>
              ${s.customer.phone2 ? `<div class="muted ltr-inline">${esc(s.customer.phone2)}</div>` : ''}
              ${s.customer.todayOrders?.length ? `<div style="margin-top:8px">${todayWarning(s.customer.todayOrders)}</div>` : ''}`
              : '<p class="muted">لم يتم تحديد العميل</p>'}
          </div>
          <div class="info-card">
            <h4><span>${icon('pin')}عنوان التوصيل</span>
              ${s.customer ? `<button type="button" class="btn btn-ghost btn-sm" data-edit-customer>${icon('edit')}تغيير</button>` : ''}</h4>
            ${s.address ? `
              ${s.address.label ? `<div class="addr-label">${esc(s.address.label)}</div>` : ''}
              <div class="big">${esc(area?.name ?? 'منطقة غير معروفة')} ${area ? `<span class="fee-chip">${money(area.fee)}</span>` : ''}</div>
              <div class="addr-text">${esc(formatAddress(s.address))}</div>
              ${s.address.landmark ? `<div class="addr-extra">علامة مميزة: ${esc(s.address.landmark)}</div>` : ''}
              ${s.address.notes ? `<div class="addr-extra">ملاحظات: ${esc(s.address.notes)}</div>` : ''}`
              : '<p class="muted">لم يتم تحديد العنوان</p>'}
          </div>
        </div>

        <div class="card table-wrap">
          <table class="table">
            <thead><tr><th>#</th><th>الصنف</th><th>الكمية / الوزن</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
            <tbody>
              ${s.cart.map((l, i) => `
                <tr>
                  <td class="num">${i + 1}</td>
                  <td><strong>${esc(l.name)}</strong>${l.note ? `<div class="item-note">${icon('note')} ${esc(l.note)}</div>` : ''}</td>
                  <td class="nowrap"><strong class="num">${esc(quantityLabel(l))}</strong></td>
                  <td class="nowrap">${money(l.price)} / ${perUnitLabel(l.unitType)}</td>
                  <td class="nowrap"><strong>${money(lineTotal(l))}</strong>${l.unitType === 'weight' ? ' <span class="est">تقريبي</span>' : ''}</td>
                </tr>`).join('') || '<tr><td colspan="5" class="table-empty">السلة فارغة</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="review-bottom">
          <div class="field">
            <label for="orderNote">ملاحظات الطلب</label>
            <textarea id="orderNote" class="textarea" data-order-note maxlength="300"
              placeholder="مثال: الاتصال قبل الوصول بـ 10 دقائق">${esc(s.orderNote)}</textarea>
          </div>
          <div class="totals-box">
            ${totalsRows(t, { detailed: true })}
            ${t.estimated ? estimateNote() : ''}
          </div>
        </div>

        <div class="alert alert-warn demo-only">${icon('info')}<span>وضع تجريبي: التأكيد ينشئ طلباً في ذاكرة المتصفح فقط. لا يتم إرسال أو حفظ أي شيء في أي نظام حقيقي.</span></div>
      </div>`;

    m.foot.innerHTML = `
      <button type="button" class="btn btn-primary btn-lg" data-confirm ${missing.length || saving ? 'disabled' : ''}>
        ${icon('check')}${saving ? 'جارٍ الإنشاء…' : 'تأكيد الطلب'}</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>${icon('edit')}رجوع للتعديل</button>
      <div class="foot-total push">
        <span>${t.estimated ? 'الإجمالي التقريبي' : 'الإجمالي'}</span>${money(t.total)}
      </div>`;
  };

  // orderNote is excluded so typing in the textarea never re-renders it.
  const unbind = bind((s) => ({ cart: s.cart, customer: s.customer, address: s.address }), render);
  m.onClose(unbind);

  on(m.el, 'click', '[data-edit-customer]', () => openNewOrderDialog({ edit: !!getState().customer }));
  on(m.el, 'input', '[data-order-note]', (e, ta) => setOrderNote(ta.value));
  on(m.el, 'click', '[data-confirm]', async (e, btn) => {
    const s = getState();
    if (saving || missingFields(s).length) return;
    if (!s.agent) { openAgentPicker({ required: true }); return; }
    saving = true;                       // lock: one click = one order
    btn.disabled = true;
    btn.innerHTML = `${icon('check')}جارٍ الإنشاء…`;
    try {
      const order = await ds.createOrder({
        requestId: s.requestId, cart: s.cart, customer: s.customer, address: s.address,
        orderNote: s.orderNote.trim(), agent: s.agent,
      });
      m.close();
      resetDraft();
      openSuccessDialog(order);
    } catch (err) {
      saving = false;
      btn.disabled = false;
      btn.innerHTML = `${icon('check')}إعادة المحاولة`;
      showToast(`تعذر إنشاء الطلب: ${err.message}`);
    }
  });

  m.foot.querySelector('[data-confirm]')?.focus();
}
