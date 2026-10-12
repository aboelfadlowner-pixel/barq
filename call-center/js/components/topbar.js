/* Top bar: brand, navigation, order source selector (POS only), account + logout. */
import { bind, getState, setSource, setUser, resetDraft } from '../store.js';
import { ORDER_SOURCES } from '../constants.js';
import { can, ROLE_LABELS } from '../permissions.js';
import { esc, on } from '../utils/dom.js';
import { icon } from './icons.js';
import { confirmDialog } from './modal.js';

export function sourceButtons(active) {
  return ORDER_SOURCES.map((s) => `
    <button type="button" data-source="${s.id}" class="${active === s.id ? 'active' : ''}" aria-pressed="${active === s.id}">
      ${icon(s.icon)}<span class="seg-label">${esc(s.label)}</span>
    </button>`).join('');
}

const brand = `
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">أ</div>
    <div>
      <div class="brand-name">أبو الفضل</div>
      <div class="brand-sub">مركز الاتصال · طلبات التوصيل</div>
    </div>
  </div>`;

export function mountTopbar(el) {
  on(el, 'click', '[data-source]', (e, btn) => setSource(btn.dataset.source));
  on(el, 'click', '[data-logout]', async () => {
    const s = getState();
    if ((s.cart.length || s.customer) && !(await confirmDialog({
      title: 'تسجيل الخروج', message: 'فيه طلب لسه ما اتأكدش. لو خرجت هيتمسح.', confirmLabel: 'خروج', danger: true,
    }))) return;
    resetDraft();
    setUser(null);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  return bind((s) => ({ route: s.route, source: s.source, user: s.user }), ({ route, source, user }) => {
    if (route === 'login' || !user) {
      el.innerHTML = `${brand}<div class="spacer"></div>
        <div class="top-meta"><span class="demo-pill">${icon('info')}<span class="demo-text">وضع تجريبي</span></span></div>`;
      return;
    }
    const isPos = route === 'pos';
    el.innerHTML = `
      ${brand}
      <nav class="topnav" aria-label="التنقل الرئيسي">
        <a href="#/board" title="مركز الاتصال" class="${route === 'board' ? 'active' : ''}">${icon('headset')}<span>مركز الاتصال</span></a>
        <a href="#/pos" title="الطلب الحالي" class="${isPos ? 'active' : ''}">${icon('cart')}<span>الطلب الحالي</span></a>
        <a href="#/orders" title="سجل الطلبات" class="${route === 'orders' || route === 'order' ? 'active' : ''}">${icon('list')}<span>سجل الطلبات</span></a>
        ${can(user, 'manageAreas') ? `<a href="#/areas" title="المناطق والرسوم" class="${route === 'areas' ? 'active' : ''}">${icon('pin')}<span>المناطق والرسوم</span></a>` : ''}
      </nav>
      ${isPos ? `
        <div class="source-picker">
          <span class="label">مصدر الطلب<span class="req">*</span></span>
          <div class="seg ${source ? '' : 'needs'}" role="group" aria-label="مصدر الطلب">${sourceButtons(source)}</div>
        </div>` : '<div class="spacer"></div>'}
      <div class="top-meta">
        <span class="demo-pill" title="كل البيانات المعروضة وهمية ولا يتم حفظ أي شيء">${icon('info')}<span class="demo-text">وضع تجريبي</span></span>
        <span class="user-chip">${icon('user')}${esc(user.name)}
          <span class="tag ${user.role === 'supervisor' ? 'tag-warn' : 'tag-green'}">${ROLE_LABELS[user.role]}</span></span>
        <button type="button" class="btn btn-ghost btn-sm" data-logout title="تسجيل الخروج">${icon('arrowRight')}<span class="logout-text">خروج</span></button>
      </div>`;
  });
}
