/* Main POS screen: categories | products | cart. */
import { bind, getState, setState } from '../store.js';
import { isTypingTarget, on } from '../utils/dom.js';
import { computeTotals } from '../utils/pricing.js';
import { currentDeliveryFee } from '../store.js';
import { icon } from '../components/icons.js';
import { money } from '../components/chips.js';
import { mountCategoryNav } from '../components/category-nav.js';
import { mountProductGrid, getVisibleProducts, selectProduct } from '../components/product-grid.js';
import { mountCartPanel } from '../components/cart-panel.js';

export function mountPos(view) {
  view.innerHTML = `
    <div class="pos" data-pos>
      <aside class="pos-cats" aria-label="الأقسام"></aside>
      <section class="pos-products" aria-label="المنتجات">
        <div class="products-head">
          <div class="search" data-search>
            ${icon('search')}
            <input id="productSearch" type="search" autocomplete="off" spellcheck="false"
              placeholder="ابحث باسم المنتج أو الكود…" aria-label="بحث عن منتج">
            <span class="search-end">
              <span class="kbd" title="اختصار: اضغط / للبحث">/</span>
              <button type="button" class="btn btn-ghost btn-icon btn-sm clear-btn" data-clear-search aria-label="مسح البحث">${icon('x')}</button>
            </span>
          </div>
          <div class="results-meta"></div>
        </div>
        <div class="product-grid" role="list"></div>
      </section>
      <aside class="pos-cart" aria-label="السلة"></aside>
      <div class="cart-backdrop" data-close-cart></div>
      <button type="button" class="cart-bar" data-open-cart></button>
    </div>`;

  const root = view.querySelector('[data-pos]');
  const input = root.querySelector('#productSearch');
  const searchBox = root.querySelector('[data-search]');
  input.value = getState().search;

  const cleanups = [
    mountCategoryNav(root.querySelector('.pos-cats')),
    mountProductGrid(root.querySelector('.product-grid'), root.querySelector('.results-meta')),
    mountCartPanel(root.querySelector('.pos-cart')),

    // Keep the static search input in sync (e.g. a category click clears the search).
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
  return () => cleanups.forEach((fn) => fn());
}
