/* Top bar: brand, navigation, account name. */
import { bind } from '../store.js';
import { can } from '../permissions.js';
import { esc } from '../utils/dom.js';
import { icon } from './icons.js';

const brand = `
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">أ</div>
    <div>
      <div class="brand-name">أبو الفضل</div>
      <div class="brand-sub">مركز الاتصال · طلبات التوصيل</div>
    </div>
  </div>`;

export function mountTopbar(el) {
  return bind((s) => ({ route: s.route, user: s.user }), ({ route, user }) => {
    if (!user) {
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
      <div class="spacer"></div>
      <div class="top-meta">
        <span class="demo-pill" title="كل البيانات المعروضة وهمية ولا يتم حفظ أي شيء">${icon('info')}<span class="demo-text">وضع تجريبي</span></span>
        <span class="user-chip">${icon('headset')}${esc(user.name)}</span>
      </div>`;
  });
}
