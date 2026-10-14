/* Product grid + search filtering. */
import { bind, setState } from '../store.js';
import { openItemDialog } from './item-dialog.js';
import { catalog } from '../catalog.js';
import { esc, on } from '../utils/dom.js';
import { formatWeight, normalizeArabic } from '../utils/format.js';
import { perUnitLabel } from '../utils/pricing.js';
import { icon } from './icons.js';
import { money } from './chips.js';

let visible = [];
export const getVisibleProducts = () => visible;

/* Search by the product name as written in the sheet (code and barcode also match), across all
   products. With an empty search the screen shows the category cards (like Foodics); opening one
   lists its products. Results are capped so the grid stays fast with 5,000+ products. */
export const MAX_RESULTS = 60;
export const CATEGORY_PAGE = 120;

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

function categoryCard(c, inCart) {
  const picked = c.productIds.filter((id) => inCart[id]).length;
  return `
    <button type="button" class="c-card" data-cat="${esc(c.id)}" role="listitem" aria-label="${esc(c.name)}">
      ${picked ? `<span class="p-badge num" title="أصناف من التصنيف ده في الطلب">${picked}</span>` : ''}
      <div class="c-tile">${icon('grid')}</div>
      <div class="c-name">${esc(c.name)}</div>
      <div class="c-count"><span class="num">${c.productIds.length}</span> صنف</div>
    </button>`;
}

export function mountProductGrid(gridEl, metaEl) {
  let limit = CATEGORY_PAGE;
  const offs = [
    on(gridEl, 'click', '[data-pid]', (e, el) => {
      const product = catalog.productsById.get(el.dataset.pid);
      if (product) selectProduct(product);
    }),
    on(gridEl, 'click', '[data-cat]', (e, el) => {
      limit = CATEGORY_PAGE;
      setState({ category: el.dataset.cat });
      gridEl.scrollTop = 0;
    }),
    on(metaEl, 'click', '[data-all-categories]', () => { setState({ category: null }); gridEl.scrollTop = 0; }),
    on(gridEl, 'click', '[data-more]', () => { limit += CATEGORY_PAGE; render(); }),
  ];

  let lastArgs = null;
  const render = () => lastArgs && draw(lastArgs);
  const draw = ({ q, inCart, category }) => {
      const query = q.trim();
      const all = filterProducts(query);
      visible = all.slice(0, MAX_RESULTS);

      const cat = !query && category ? catalog.categoriesById.get(category) : null;
      if (cat) {
        const list = cat.productIds.map((id) => catalog.productsById.get(id)).filter(Boolean);
        visible = list.slice(0, limit);
        metaEl.innerHTML = `
          <span class="cat-head">
            <button type="button" class="link-btn back-link" data-all-categories>${icon('arrowRight')}كل التصنيفات</button>
            <strong>${esc(cat.name)}</strong> · <span class="num">${list.length}</span> صنف</span>`;
        gridEl.innerHTML = visible.map((p) => card(p, inCart[p.id])).join('')
          + (list.length > visible.length
            ? `<div class="grid-more"><button type="button" class="btn btn-secondary" data-more>عرض المزيد (${list.length - visible.length})</button></div>`
            : '');
        return;
      }
      if (!query && catalog.categories.length) {
        visible = [];
        metaEl.innerHTML = `<span>اختار تصنيف أو ابحث باسم الصنف · <span class="num">${catalog.products.length}</span> صنف متاح</span>
          <span class="muted demo-only">الأسعار والمنتجات تجريبية</span>`;
        gridEl.innerHTML = catalog.categories.map((c) => categoryCard(c, inCart)).join('');
        return;
      }

      if (!query) {
        metaEl.innerHTML = `<span><span class="num">${catalog.products.length}</span> صنف متاح</span>
          <span class="muted demo-only">الأسعار والمنتجات تجريبية</span>`;
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
  };

  const unbind = bind(
    (s) => ({ q: s.search, inCart: inCartSummary(s.cart), category: s.category, v: s.catalogVersion }),
    (args) => { lastArgs = args; draw(args); },
  );

  return () => { offs.forEach((off) => off()); unbind(); };
}
