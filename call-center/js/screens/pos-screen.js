/* Order screen (Foodics-style): order summary panel on the side | product search. */
import { bind, getState, setState } from '../store.js';
import { isTypingTarget, on } from '../utils/dom.js';
import { computeTotals } from '../utils/pricing.js';
import { currentDeliveryFee } from '../store.js';
import { icon } from '../components/icons.js';
import { money } from '../components/chips.js';
import { mountProductGrid, getVisibleProducts, selectProduct } from '../components/product-grid.js';
import { mountCartPanel } from '../components/cart-panel.js';
import { openNewOrderDialog } from '../components/new-order-dialog.js';
import { confirmDialog } from '../components/modal.js';
import { resetDraft, setCustomer } from '../store.js';
import { openAddressDialog } from '../components/address-dialog.js';
import { esc } from '../utils/dom.js';

export function mountPos(view) {
  view.innerHTML = `
    <div class="pos" data-pos>
      <aside class="pos-cart" aria-label="ملخص الطلب"></aside>
      <section class="pos-products" aria-label="المنتجات">
        <div class="pos-title">
          <button type="button" class="back-link link-btn" data-cancel-order>${icon('arrowRight')}${getState().editing ? 'إلغاء التعديل' : 'إلغاء'}</button>
          <h1>${getState().editing ? `تعديل طلب <span class="ltr-inline">${esc(getState().editing.number)}</span>` : 'طلب جديد لمركز الاتصال'}</h1>
        </div>
        ${getState().editing ? `<div class="alert alert-warn edit-banner">${icon('edit')}<span>أنت تعدّل طلبًا أُرسل للفرع. التعديل مسموح حتى مرحلة «على الكاشير»،
          وستظهر للفرع علامة «تم التعديل». بعد الحفظ اطبع الورقة الجديدة وأرسلها بدلًا من السابقة.</span></div>` : ''}
        <div class="products-head">
          <div class="search-row">
          <div class="search" data-search>
            ${icon('search')}
            <input id="productSearch" type="search" autocomplete="off" spellcheck="false"
              placeholder="ابحث باسم الصنف…" aria-label="بحث عن منتج">
            <span class="search-end">
              <span class="kbd" title="اختصار: اضغط / للبحث">/</span>
              <button type="button" class="btn btn-ghost btn-icon btn-sm clear-btn" data-clear-search aria-label="مسح البحث">${icon('x')}</button>
            </span>
          </div>
          ${getState().editing
            ? `<button type="button" class="btn btn-secondary btn-lg" data-edit-address>${icon('pin')}تعديل العنوان</button>`
            : `<button type="button" class="btn btn-secondary btn-lg" data-customer-info>${icon('user')}معلومات العميل</button>`}
          </div>
          <div class="results-meta"></div>
        </div>
        <div class="product-grid" role="list"></div>
      </section>
      <div class="cart-backdrop" data-close-cart></div>
      <button type="button" class="cart-bar" data-open-cart></button>
    </div>`;

  const root = view.querySelector('[data-pos]');
  const input = root.querySelector('#productSearch');
  const searchBox = root.querySelector('[data-search]');
  input.value = getState().search;

  const cleanups = [
    mountProductGrid(root.querySelector('.product-grid'), root.querySelector('.results-meta')),
    mountCartPanel(root.querySelector('.pos-cart')),

    // Keep the static search input in sync (e.g. after Enter adds a product).
    bind((s) => s.search, (q) => {
      if (input.value !== q) input.value = q;
      searchBox.classList.toggle('has-value', q !== '');
    }),
    bind((s) => s.cartOpen, (open) => root.classList.toggle('cart-open', open)),

    // Tablet bottom bar
    bind((s) => ({ cart: s.cart, area: s.address?.areaId ?? null }), ({ cart }, s) => {
      const t = computeTotals(cart, currentDeliveryFee(s));
      const bar = root.querySelector('[data-open-cart]');
      bar.innerHTML = `${icon('cart')}<span>السلة (${cart.length})</span>
        <span class="total">${t.estimated ? '≈ ' : ''}${money(t.total)}</span>${icon('chevronLeft')}`;
    }),

    on(root, 'click', '[data-open-cart]', () => setState({ cartOpen: true })),
    on(root, 'click', '[data-customer-info]', () => openNewOrderDialog({ edit: !!getState().customer })),
    // Editing a sent order: the customer stays; only the delivery address of this order can change.
    on(root, 'click', '[data-edit-address]', () => openAddressDialog({
      address: getState().address,
      onSave: (address) => setCustomer(getState().customer, { ...address, edited: true }),
    })),
    on(root, 'click', '[data-cancel-order]', async () => {
      const s = getState();
      if (s.editing) {
        if (!(await confirmDialog({ title: 'إلغاء التعديل', message: 'سيبقى الطلب كما هو دون أي تغيير.', confirmLabel: 'إلغاء التعديل', cancelLabel: 'رجوع' }))) return;
        const id = s.editing.orderId;
        resetDraft();
        location.hash = `#/orders/${encodeURIComponent(id)}`;
        return;
      }
      if ((s.cart.length || s.customer) && !(await confirmDialog({
        title: 'إلغاء الطلب', message: 'سيتم حذف العميل والأصناف في هذا الطلب. لاستكماله لاحقًا اختر «حفظ كمسودة».',
        confirmLabel: 'إلغاء الطلب', cancelLabel: 'رجوع', danger: true,
      }))) return;
      resetDraft();
      location.hash = '#/board';
    }),
    on(root, 'click', '[data-close-cart]', () => setState({ cartOpen: false })),
    on(root, 'click', '[data-clear-search]', () => { setState({ search: '' }); input.focus(); }),
  ];

  input.addEventListener('input', () => setState({ search: input.value }));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = getVisibleProducts()[0];
      if (input.value.trim() && first) {
        selectProduct(first);
        setState({ search: '' });
      }
    } else if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      setState({ search: '' });
    }
  });

  // Shortcut: "/" or F2 focuses product search (when not typing elsewhere / no dialog open).
  const onKey = (e) => {
    if (document.querySelector('dialog[open]')) return;
    if ((e.key === '/' && !isTypingTarget(e.target)) || e.key === 'F2') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  };
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));

  if (!document.querySelector('dialog[open]')) input.focus();
  // CONFIRMED: «الطلب الحالي» opened with no customer yet → the customer step opens first
  // (the same window as «طلب جديد لمركز الاتصال»), so no order starts without the customer.
  let stopped = false;
  const askCustomer = setTimeout(() => {
    const s = getState();
    if (!stopped && !s.editing && !s.customer && !document.querySelector('dialog[open]')) openNewOrderDialog();
  }, 0);
  cleanups.push(() => { stopped = true; clearTimeout(askCustomer); });
  return () => cleanups.forEach((fn) => fn());
}
