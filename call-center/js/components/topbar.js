/* Top bar: brand, navigation, order source selector (POS only), demo badge. */
import { bind, setSource } from '../store.js';
import { catalog } from '../catalog.js';
import { ORDER_SOURCES } from '../constants.js';
import { esc, on } from '../utils/dom.js';
import { icon } from './icons.js';

export function sourceButtons(active) {
  return ORDER_SOURCES.map((s) => `
    <button type="button" data-source="${s.id}" class="${active === s.id ? 'active' : ''}" aria-pressed="${active === s.id}">
      ${icon(s.icon)}<span class="seg-label">${esc(s.label)}</span>
    </button>`).join('');
}

export function mountTopbar(el) {
  on(el, 'click', '[data-source]', (e, btn) => setSource(btn.dataset.source));

  return bind((s) => ({ route: s.route, source: s.source }), ({ route, source }) => {
    const isPos = route === 'pos';
    const isOrders = route === 'orders' || route === 'order';
    el.innerHTML = `
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">أ</div>
        <div>
          <div class="brand-name">أبو الفضل</div>
          <div class="brand-sub">مركز الاتصال · طلبات التوصيل</div>
        </div>
      </div>
      <nav class="topnav" aria-label="التنقل الرئيسي">
        <a href="#/pos" class="${isPos ? 'active' : ''}">${icon('cart')}<span>طلب جديد</span></a>
        <a href="#/orders" class="${isOrders ? 'active' : ''}">${icon('list')}<span>الطلبات</span></a>
      </nav>
      ${isPos ? `
        <div class="source-picker">
          <span class="label">مصدر الطلب<span class="req">*</span></span>
          <div class="seg ${source ? '' : 'needs'}" role="group" aria-label="مصدر الطلب">${sourceButtons(source)}</div>
        </div>` : '<div class="spacer"></div>'}
      <div class="top-meta">
        <span class="demo-pill" title="كل البيانات المعروضة وهمية ولا يتم حفظ أي شيء">${icon('info')}<span class="demo-text">وضع تجريبي</span></span>
        <span class="user-chip">${icon('user')}${esc(catalog.employee?.name ?? '')}</span>
      </div>`;
  });
}
