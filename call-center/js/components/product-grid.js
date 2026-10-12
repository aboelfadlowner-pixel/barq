/* Product grid + search filtering. */
import { bind, addProduct } from '../store.js';
import { catalog } from '../catalog.js';
import { esc, on } from '../utils/dom.js';
import { formatWeight, normalizeArabic } from '../utils/format.js';
import { perUnitLabel } from '../utils/pricing.js';
import { icon } from './icons.js';
import { money } from './chips.js';

let visible = [];
export const getVisibleProducts = () => visible;

/* Search covers every category (name, code, category name). */
export function filterProducts(categoryId, query) {
  const q = normalizeArabic(query);
  if (q) {
    const terms = q.split(' ');
    const catName = new Map(catalog.categories.map((c) => [c.id, c.name]));
    return catalog.products.filter((p) => {
      const hay = normalizeArabic(`${p.name} ${p.code} ${catName.get(p.categoryId) ?? ''}`);
      return terms.every((t) => hay.includes(t));
    });
  }
  return categoryId === 'all' ? catalog.products : catalog.products.filter((p) => p.categoryId === categoryId);
}

export function selectProduct(product) {
  addProduct(product);
}

function inCartSummary(cart) {
  const map = {};
  for (const l of cart) {
    const m = (map[l.productId] ??= { qty: 0, grams: 0 });
    if (l.unitType === 'weight') m.grams += l.grams; else m.qty += l.qty;
  }
  return map;
}

function card(p, inCart) {
  const badge = !inCart ? ''
    : inCart.qty > 0
      ? `<span class="p-badge num">${inCart.qty}${inCart.grams ? ` + ${formatWeight(inCart.grams)}` : ''}</span>`
      : `<span class="p-badge">${icon('scale')}${formatWeight(inCart.grams)}</span>`;
  const thumb = p.image
    ? `<img src="${esc(p.image)}" alt="" loading="lazy">`
    : icon('package');
  return `
    <button type="button" class="p-card ${inCart ? 'in-cart' : ''}" data-pid="${esc(p.id)}" role="listitem"
      aria-label="${esc(p.name)}">
      ${badge}
      <div class="p-thumb">${thumb}</div>
      <div class="p-name">${esc(p.name)}</div>
      <div class="p-unit">
        ${esc(p.unitLabel)}
        · <span class="ltr-inline">${esc(p.code)}</span>
      </div>
      <div class="p-foot">
        <div class="p-price">${money(p.price)} <small>/ ${perUnitLabel(p.unitType)}</small></div>
      </div>
    </button>`;
}

export function mountProductGrid(gridEl, metaEl) {
  const off = on(gridEl, 'click', '[data-pid]', (e, el) => {
    const product = catalog.productsById.get(el.dataset.pid);
    if (product) selectProduct(product);
  });

  const unbind = bind(
    (s) => ({ cat: s.activeCategory, q: s.search, inCart: inCartSummary(s.cart) }),
    ({ cat, q, inCart }) => {
      visible = filterProducts(cat, q);
      const catName = cat === 'all' ? 'كل المنتجات' : catalog.categories.find((c) => c.id === cat)?.name;
      metaEl.innerHTML = q.trim()
        ? `<span>نتائج البحث عن «<strong>${esc(q.trim())}</strong>» في كل الأقسام: <strong class="num">${visible.length}</strong></span>
           ${visible.length ? '<span>اضغط <span class="kbd">Enter</span> لإضافة أول نتيجة</span>' : ''}`
        : `<span><strong>${esc(catName)}</strong> · <span class="num">${visible.length}</span> منتج</span>
           <span class="muted">الأسعار والمنتجات تجريبية</span>`;

      gridEl.innerHTML = visible.length
        ? visible.map((p) => card(p, inCart[p.id])).join('')
        : `<div class="grid-empty">${icon('search')}<h3>لا توجد نتائج</h3><p>جرّب كلمة أخرى أو اسماً أقصر</p></div>`;
    },
  );

  return () => { off(); unbind(); };
}
