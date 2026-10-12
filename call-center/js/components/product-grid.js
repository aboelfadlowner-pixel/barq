/* Product grid + search filtering. */
import { bind } from '../store.js';
import { openItemDialog } from './item-dialog.js';
import { catalog } from '../catalog.js';
import { esc, on } from '../utils/dom.js';
import { formatWeight, normalizeArabic } from '../utils/format.js';
import { perUnitLabel } from '../utils/pricing.js';
import { icon } from './icons.js';
import { money } from './chips.js';

let visible = [];
export const getVisibleProducts = () => visible;

/* CONFIRMED: no categories — the agent searches by the product name as written in the sheet.
   Code and barcode also match. Results are capped so the grid stays fast with 5,000+ products. */
export const MAX_RESULTS = 60;

export function filterProducts(query) {
  const q = normalizeArabic(query);
  if (!q) return [];
  const terms = q.split(' ');
  return catalog.products.filter((p) => {
    const hay = normalizeArabic(`${p.name} ${p.code ?? ''} ${p.barcode ?? ''}`);
    return terms.every((t) => hay.includes(t));
  });
}

export function selectProduct(product) {
  openItemDialog(product);
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
        ${p.unitType === 'weight' ? `<span class="tag tag-warn">${icon('scale')}بالوزن</span>` : esc(p.unitLabel)}
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
    (s) => ({ q: s.search, inCart: inCartSummary(s.cart) }),
    ({ q, inCart }) => {
      const query = q.trim();
      const all = filterProducts(query);
      visible = all.slice(0, MAX_RESULTS);

      if (!query) {
        metaEl.innerHTML = `<span><span class="num">${catalog.products.length}</span> صنف متاح</span>
          <span class="muted">الأسعار والمنتجات تجريبية</span>`;
        gridEl.innerHTML = `<div class="grid-empty grid-start">${icon('search')}
          <h3>اكتب اسم الصنف زي ما هو في الشيت</h3>
          <p>مثال: «رومي» أو «لبن» — تقدر كمان تبحث بالكود أو الباركود</p></div>`;
        return;
      }
      metaEl.innerHTML = `
        <span>نتائج «<strong>${esc(query)}</strong>»: <strong class="num">${all.length}</strong>
          ${all.length > MAX_RESULTS ? `<span class="muted">(أول ${MAX_RESULTS} — اكتب أكتر لتضييق النتايج)</span>` : ''}</span>
        ${visible.length ? '<span>اضغط <span class="kbd">Enter</span> لاختيار أول نتيجة</span>' : ''}`;
      gridEl.innerHTML = visible.length
        ? visible.map((p) => card(p, inCart[p.id])).join('')
        : `<div class="grid-empty">${icon('search')}<h3>لا توجد نتائج</h3><p>جرّب كلمة أخرى أو جزء من الاسم</p></div>`;
    },
  );

  return () => { off(); unbind(); };
}
