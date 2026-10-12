/* Persistent cart panel: customer, items, delivery, totals, actions. */
import {
  bind, getState, setState, changeQty, removeLine, updateLine, clearCart, clearCustomer, currentDeliveryFee,
} from '../store.js';
import { catalog } from '../catalog.js';
import { esc, on } from '../utils/dom.js';
import { formatAddress, formatWeight } from '../utils/format.js';
import { computeTotals, lineTotal, perUnitLabel } from '../utils/pricing.js';
import { icon } from './icons.js';
import { money, totalsRows, estimateNote } from './chips.js';
import { confirmDialog } from './modal.js';
import { openWeightDialog } from './weight-dialog.js';
import { openCustomerDialog, todayWarning } from './customer-dialog.js';
import { openReviewDialog } from './review-dialog.js';

export function mountCartPanel(el) {
  el.innerHTML = `
    <div class="cart-drawer-head">
      <h2>السلة والعميل</h2>
      <button type="button" class="btn btn-ghost btn-icon" data-action="close-cart" aria-label="إغلاق السلة">${icon('x')}</button>
    </div>
    <div class="cart-scroll">
      <section class="cart-sec" data-sec="customer" aria-label="العميل"></section>
      <section class="cart-sec" data-sec="items" aria-label="الأصناف"></section>
      <section class="cart-sec" data-sec="delivery" aria-label="التوصيل"></section>
    </div>
    <footer class="cart-foot" data-sec="footer"></footer>`;

  const sec = (name) => el.querySelector(`[data-sec="${name}"]`);
  const openNotes = new Set();

  /* ---------- Customer ---------- */
  const renderCustomer = ({ customer }) => {
    const box = sec('customer');
    if (!customer) {
      box.innerHTML = `
        <div class="sec-head"><h3>${icon('user')}العميل</h3></div>
        <form class="phone-search" data-form="phone" novalidate>
          <input class="input ltr" name="phone" type="tel" inputmode="tel" autocomplete="off"
            placeholder="01xxxxxxxxx" aria-label="رقم موبايل العميل">
          <button type="submit" class="btn btn-soft">${icon('search')}بحث</button>
        </form>
        <p class="hint">ابحث برقم الموبايل لاختيار عميل مسجل أو إضافة عميل جديد.</p>`;
      return;
    }
    box.innerHTML = `
      <div class="sec-head">
        <h3>${icon('user')}العميل</h3>
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit-customer">${icon('edit')}تغيير</button>
      </div>
      <div class="cust-card">
        <div class="avatar">${esc(customer.name.charAt(0))}</div>
        <div class="grow">
          <div class="cust-name">${esc(customer.name)}
            ${customer.isNew ? '<span class="tag tag-info">عميل جديد</span>' : '<span class="tag tag-green">مسجل</span>'}</div>
          <div class="cust-phone ltr-inline">${esc(customer.phone)}</div>
        </div>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="remove-customer" aria-label="إزالة العميل" title="إزالة العميل">${icon('x')}</button>
      </div>
      ${todayWarning(customer.todayOrders)}`;
  };

  /* ---------- Items ---------- */
  const renderItems = () => {
    const { cart } = getState();
    const box = sec('items');
    const head = `
      <div class="sec-head">
        <h3>${icon('cart')}الأصناف ${cart.length ? `<span class="count-pill num">${cart.length}</span>` : ''}</h3>
      </div>`;
    if (!cart.length) {
      box.innerHTML = `${head}
        <div class="cart-empty">${icon('cart')}<strong>السلة فارغة</strong>اختر المنتجات من القائمة أو ابحث بالاسم</div>`;
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
            </div>
            <div class="line-total">${money(lineTotal(l))}${isWeight ? '<span class="est">تقريبي</span>' : ''}</div>
          </div>
          <div class="line-ctrl">
            ${isWeight
              ? `<button type="button" class="weight-pill" data-action="edit-weight" aria-label="تعديل الوزن">
                   ${icon('scale')}<span class="num">${esc(formatWeight(l.grams))}</span><span class="edit">تعديل</span></button>`
              : `<div class="stepper" role="group" aria-label="الكمية">
                   <button type="button" data-action="inc" aria-label="زيادة">${icon('plus')}</button>
                   <span class="val">${l.qty}</span>
                   <button type="button" data-action="dec" aria-label="${l.qty === 1 ? 'حذف' : 'نقص'}">${icon(l.qty === 1 ? 'trash' : 'minus')}</button>
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

  /* ---------- Delivery ---------- */
  const renderDelivery = ({ customer, address }) => {
    const box = sec('delivery');
    const head = (btn = '') => `<div class="sec-head"><h3>${icon('pin')}التوصيل</h3>${btn}</div>`;
    const note = `<div class="unconfirmed">${icon('info')}<span>الرسوم حسب منطقة التوصيل. المناطق والرسوم المعروضة تجريبية وقواعدها لم تُعتمد بعد.</span></div>`;
    if (!customer) {
      box.innerHTML = `${head()}<p class="hint" style="margin:0">حدد العميل أولاً لاختيار عنوان التوصيل.</p>`;
      return;
    }
    if (!address) {
      box.innerHTML = `${head()}<button type="button" class="btn btn-soft btn-block" data-action="edit-customer">${icon('pin')}اختر عنوان التوصيل</button>${note}`;
      return;
    }
    const area = catalog.areasById.get(address.areaId);
    box.innerHTML = `
      ${head(`<button type="button" class="btn btn-ghost btn-sm" data-action="edit-customer">${icon('edit')}تغيير</button>`)}
      <div class="addr-box">
        <div class="addr-area"><span>${esc(area?.name ?? 'منطقة غير معروفة')}</span>
          ${area ? `<span class="fee-chip">${money(area.fee)}</span>` : ''}</div>
        <div class="addr-text">${esc(formatAddress(address))}</div>
        ${address.landmark ? `<div class="addr-extra">علامة مميزة: ${esc(address.landmark)}</div>` : ''}
        ${address.notes ? `<div class="addr-extra">${esc(address.notes)}</div>` : ''}
        ${address.isNew ? '<div class="addr-extra"><span class="tag tag-info">عنوان جديد</span></div>' : ''}
      </div>
      ${note}`;
  };

  /* ---------- Footer ---------- */
  const renderFooter = ({ cart }, s) => {
    const t = computeTotals(cart, currentDeliveryFee(s));
    sec('footer').innerHTML = `
      <div class="totals">${totalsRows(t)}</div>
      ${t.estimated ? estimateNote() : ''}
      <div class="foot-actions">
        <button type="button" class="btn btn-primary btn-lg" data-action="review" ${cart.length ? '' : 'disabled'}>
          ${icon('clipboard')}مراجعة الطلب</button>
        <button type="button" class="btn btn-secondary btn-lg" data-action="clear" ${cart.length ? '' : 'disabled'}
          title="تفريغ السلة">${icon('trash')}تفريغ</button>
      </div>`;
  };

  const unbinds = [
    bind((s) => ({ customer: s.customer }), renderCustomer),
    bind((s) => s.cart, renderItems),
    bind((s) => ({ customer: s.customer, address: s.address }), renderDelivery),
    bind((s) => ({ cart: s.cart, area: s.address?.areaId ?? null }), renderFooter),
  ];

  /* ---------- Events ---------- */
  const lineOf = (btn) => {
    const id = btn.closest('[data-line]')?.dataset.line;
    return getState().cart.find((l) => l.lineId === id);
  };

  const offs = [
    on(el, 'submit', '[data-form="phone"]', (e, form) => {
      e.preventDefault();
      openCustomerDialog({ phone: form.phone.value.trim() });
    }),
    on(el, 'click', '[data-action]', async (e, btn) => {
      const action = btn.dataset.action;
      const line = lineOf(btn);
      switch (action) {
        case 'inc': changeQty(line.lineId, 1); break;
        case 'dec': changeQty(line.lineId, -1); break;
        case 'remove': openNotes.delete(line.lineId); removeLine(line.lineId); break;
        case 'edit-weight': {
          const product = catalog.productsById.get(line.productId) ?? { ...line, id: line.productId };
          openWeightDialog({ ...product, price: line.price }, { line });
          break;
        }
        case 'toggle-note':
          if (openNotes.has(line.lineId)) openNotes.delete(line.lineId); else openNotes.add(line.lineId);
          renderItems();
          el.querySelector(`[data-line="${line.lineId}"] [data-note]`)?.focus();
          break;
        case 'edit-customer': openCustomerDialog({ edit: true }); break;
        case 'remove-customer': clearCustomer(); break;
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
    // Notes save on blur/Enter (Esc cancels) so typing never re-renders the input.
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
