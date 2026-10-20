/* Order side panel (Foodics-style): order summary card (customer, phone, type,
   address, notes), items, totals, "إرسال الطلب" and "حفظ كمسودة". */
import {
  bind, getState, setState, changeQty, removeLine, updateLine, clearCart, currentDeliveryFee, setOrderNote, setCustomer,
} from '../store.js';
import { openAddressDialog } from './address-dialog.js';
import { catalog, productModifiers } from '../catalog.js';
import { esc, on } from '../utils/dom.js';
import { formatAddress, formatWeight } from '../utils/format.js';
import { PAYMENT_METHOD } from '../constants.js';
import { computeTotals, lineTotal, perUnitLabel, modifiersText, modifiersTotal } from '../utils/pricing.js';
import { icon } from './icons.js';
import { money, totalsRows, estimateNote } from './chips.js';
import { confirmDialog, showToast } from './modal.js';
import { openItemDialog } from './item-dialog.js';
import { openNewOrderDialog, todayWarning } from './new-order-dialog.js';
import { openReviewDialog } from './review-dialog.js';

export function mountCartPanel(el) {
  el.innerHTML = `
    <div class="cart-drawer-head">
      <h2>ملخص الطلب</h2>
      <button type="button" class="btn btn-ghost btn-icon" data-action="close-cart" aria-label="إغلاق">${icon('x')}</button>
    </div>
    <div class="cart-scroll">
      <section class="sum-card" data-sec="summary" aria-label="بيانات الطلب"></section>
      <section class="cart-sec items-sec" data-sec="items" aria-label="الأصناف"></section>
    </div>
    <footer class="cart-foot" data-sec="footer"></footer>`;

  const sec = (name) => el.querySelector(`[data-sec="${name}"]`);
  const openNotes = new Set();

  /* ---------- Order summary card ---------- */
  let noteOpen = false;
  const row = (label, value) => `<div class="sum-row"><span class="k">${label}</span><div class="v">${value}</div></div>`;
  const editBtn = (title) => `<button type="button" class="pen" data-action="edit-customer" title="${title}" aria-label="${title}">${icon('edit')}</button>`;
  const renderSummary = ({ customer, address }) => {
    const box = sec('summary');
    if (!customer) {
      box.innerHTML = `
        <div class="sum-empty">
          <p>ابدأ برقم موبايل العميل — إذا كان مسجلًا ستظهر بياناته وعناوينه تلقائيًا.</p>
          <button type="button" class="btn btn-primary btn-block" data-action="edit-customer">${icon('headset')}بيانات العميل والعنوان</button>
        </div>`;
      return;
    }
    const area = address ? catalog.areasById.get(address.areaId) : null;
    const note = getState().orderNote;
    box.innerHTML = `
      ${row('اسم العميل', `<span class="link-val">${esc(customer.name)}</span>${editBtn('تعديل العميل')}
        ${customer.isNew ? '<span class="tag tag-info">جديد</span>' : ''}`)}
      ${row('هاتف العميل', `<span class="ltr-inline num">${esc(customer.phone)}${customer.phone2 ? ` / ${esc(customer.phone2)}` : ''}</span>`)}
      ${row('نوع الطلب', `<span class="link-val">توصيل</span><span class="muted"> · ${PAYMENT_METHOD.label}</span>`)}
      ${row('العنوان', address ? `
        <div class="addr-val">
          <div><span class="link-val">${esc(address.label || 'العنوان')}</span>${editBtn('تغيير العنوان')}
            ${address.isNew ? '<span class="tag tag-info">جديد</span>' : ''}${address.edited ? '<span class="tag tag-info">معدّل</span>' : ''}</div>
          <div class="addr-extra">${esc(area?.name ?? 'منطقة غير معروفة')}${area ? ` · رسوم ${money(area.fee)}` : ''}</div>
          <div class="addr-extra">${esc(formatAddress(address))}</div>
          ${address.notes ? `<div class="addr-extra">${esc(address.notes)}</div>` : ''}
        </div>` : `<button type="button" class="link-btn" data-action="edit-customer">${icon('plus')}اختر العنوان</button>`)}
      ${row('ملاحظات العميل', noteOpen
        ? `<textarea class="textarea" data-order-note rows="2" maxlength="300" placeholder="مثال: الاتصال قبل الوصول">${esc(note)}</textarea>`
        : note
          ? `<span class="note-val">${esc(note)}</span>${`<button type="button" class="pen" data-action="edit-note" aria-label="تعديل الملاحظات">${icon('edit')}</button>`}`
          : `<button type="button" class="link-btn" data-action="edit-note">${icon('plus')}إضافة ملاحظات العميل</button>`)}
      ${todayWarning(customer.todayOrders)}`;
    if (noteOpen) box.querySelector('[data-order-note]')?.focus();
  };

  /* ---------- Items ---------- */
  const renderItems = () => {
    const { cart } = getState();
    const box = sec('items');
    const head = `
      <div class="sec-head">
        <h3>${icon('cart')}الأصناف ${cart.length ? `<span class="count-pill num">${cart.length}</span>` : ''}</h3>
        ${cart.length ? `<button type="button" class="btn btn-ghost btn-sm" data-action="clear">${icon('trash')}تفريغ</button>` : ''}
      </div>`;
    if (!cart.length) {
      box.innerHTML = `${head}
        <div class="cart-empty">${icon('cart')}<strong>لا توجد أصناف بعد</strong>اختر تصنيفًا أو ابحث باسم الصنف واضغط عليه لإضافته</div>`;
      return;
    }
    box.innerHTML = head + cart.map((l) => {
      const isWeight = l.unitType === 'weight';
      const noteOpen = openNotes.has(l.lineId);
      return `
        <div class="line" data-line="${esc(l.lineId)}">
          <div class="line-top">
            <div>
              <div class="line-name">${esc(l.name)}</div>
              <div class="line-unit">${money(l.price)} / ${perUnitLabel(l.unitType)}${isWeight ? '' : ` · ${esc(l.unitLabel)}`}</div>
              ${productModifiers(l.productId).length || l.modifiers?.length ? `<div class="line-mods">${l.modifiers?.length
                ? `+ ${esc(modifiersText(l.modifiers))} <span class="num">(${money(modifiersTotal(l))}${isWeight ? '' : ' للقطعة'})</span>`
                : 'بدون إضافات'}<button type="button" class="mods-edit" data-action="edit-mods">تعديل الإضافات</button></div>` : ''}
            </div>
            <div class="line-total">${money(lineTotal(l))}${isWeight ? '<span class="est">تقريبي</span>' : ''}</div>
          </div>
          <div class="line-ctrl">
            ${isWeight
              ? `<button type="button" class="weight-pill" data-action="edit-weight" aria-label="تعديل الوزن">
                   ${icon('scale')}<span class="num">${esc(formatWeight(l.grams))}</span><span class="edit">تعديل</span></button>`
              : `<div class="qty-row">
                   <div class="stepper" role="group" aria-label="الكمية">
                     <button type="button" data-action="inc" aria-label="زيادة">${icon('plus')}</button>
                     <span class="val">${l.qty}</span>
                     <button type="button" data-action="dec" aria-label="${l.qty === 1 ? 'حذف' : 'إنقاص'}">${icon(l.qty === 1 ? 'trash' : 'minus')}</button>
                   </div>
                 </div>`}
            <div class="line-actions">
              <button type="button" class="btn btn-ghost btn-icon btn-sm ${l.note ? 'has-note' : ''}" data-action="toggle-note"
                aria-label="ملاحظة على الصنف" title="ملاحظة على الصنف">${icon('note')}</button>
              <button type="button" class="btn btn-danger-ghost btn-icon btn-sm" data-action="remove" aria-label="حذف الصنف" title="حذف">${icon('trash')}</button>
            </div>
          </div>
          ${noteOpen
            ? `<div class="line-note"><input class="input" data-note value="${esc(l.note)}" placeholder="ملاحظة على الصنف، مثال: شرائح رفيعة" maxlength="120"></div>`
            : (l.note ? `<div class="note-text">${icon('note')}${esc(l.note)}</div>` : '')}
        </div>`;
    }).join('');
  };

  /* ---------- Footer ---------- */
  const renderFooter = ({ cart }, s) => {
    const t = computeTotals(cart, currentDeliveryFee(s));
    sec('footer').innerHTML = `
      <div class="totals">${totalsRows(t)}</div>
      ${t.estimated ? estimateNote() : ''}
      <div class="foot-actions stack">
        <button type="button" class="btn btn-primary btn-lg send-btn" data-action="review" ${cart.length && s.customer && s.address ? '' : 'disabled'}>
          <span>${s.editing ? 'مراجعة وحفظ التعديل' : 'إرسال الطلب'}</span>${icon('chevronLeft')}</button>
        ${s.editing ? '' : `<button type="button" class="btn btn-secondary btn-lg" data-action="save-draft" ${cart.length || s.customer ? '' : 'disabled'}>حفظ كمسودة</button>`}
      </div>`;
  };

  const unbinds = [
    bind((s) => ({ customer: s.customer, address: s.address }), renderSummary),
    bind((s) => s.cart, renderItems),
    bind((s) => ({ cart: s.cart, area: s.address?.areaId ?? null, hasCustomer: !!s.customer, hasAddress: !!s.address, editing: !!s.editing }), renderFooter),
  ];

  /* ---------- Events ---------- */
  const lineOf = (btn) => {
    const id = btn.closest('[data-line]')?.dataset.line;
    return getState().cart.find((l) => l.lineId === id);
  };

  const offs = [
    on(el, 'click', '[data-action]', async (e, btn) => {
      const action = btn.dataset.action;
      const line = lineOf(btn);
      switch (action) {
        case 'inc': changeQty(line.lineId, 1); break;
        case 'dec': changeQty(line.lineId, -1); break;
        case 'remove': openNotes.delete(line.lineId); removeLine(line.lineId); break;
        case 'edit-mods':
        case 'edit-weight': {
          const product = catalog.productsById.get(line.productId) ?? { ...line, id: line.productId };
          openItemDialog({ ...product, price: line.price, unitType: line.unitType }, { line });
          break;
        }
        case 'toggle-note':
          if (openNotes.has(line.lineId)) openNotes.delete(line.lineId); else openNotes.add(line.lineId);
          renderItems();
          el.querySelector(`[data-line="${line.lineId}"] [data-note]`)?.focus();
          break;
        case 'edit-customer':
          // Editing a sent order: the customer stays; the pencils change only this order's address.
          if (getState().editing) {
            openAddressDialog({ address: getState().address, onSave: (address) => setCustomer(getState().customer, { ...address, edited: true }) });
          } else openNewOrderDialog({ edit: !!getState().customer });
          break;
        case 'edit-note': noteOpen = true; renderSummary(getState()); break;
        case 'save-draft':
          location.hash = '#/board';
          showToast('تم حفظ الطلب كمسودة — يمكنك استكماله من بطاقة «مسودة»');
          break;
        case 'review': openReviewDialog(); break;
        case 'clear':
          if (await confirmDialog({ title: 'تفريغ السلة', message: 'سيتم حذف كل الأصناف من السلة. بيانات العميل والعنوان ستبقى كما هي.', confirmLabel: 'تفريغ السلة', danger: true })) {
            openNotes.clear();
            clearCart();
          }
          break;
        case 'close-cart': setState({ cartOpen: false }); break;
        default: break;
      }
    }),
    // Order note: typing updates the draft without re-rendering; closing shows the text.
    on(el, 'input', '[data-order-note]', (e, ta) => setOrderNote(ta.value)),
    on(el, 'focusout', '[data-order-note]', () => { noteOpen = false; renderSummary(getState()); }),
    // Line notes save on blur/Enter (Esc cancels) so typing never re-renders the input.
    on(el, 'focusout', '[data-note]', (e, input) => {
      const line = lineOf(input);
      if (!line) return;
      openNotes.delete(line.lineId);
      const value = input.value.trim();
      if (input.dataset.cancel || value === line.note) renderItems();
      else updateLine(line.lineId, { note: value });
    }),
    on(el, 'keydown', '[data-note]', (e, input) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { e.preventDefault(); input.dataset.cancel = '1'; input.blur(); }
    }),
  ];

  return () => { unbinds.forEach((f) => f()); offs.forEach((f) => f()); };
}
