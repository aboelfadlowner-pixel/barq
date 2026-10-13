/* Top bar: brand, navigation, account name (+ sign out when connected to the database). */
import { bind, getState, resetDraft } from '../store.js';
import * as ds from '../data/data-source.js';
import { confirmDialog } from './modal.js';
import { can } from '../permissions.js';
import { esc, on } from '../utils/dom.js';
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
  on(el, 'click', '[data-logout]', async () => {
    const s = getState();
    const unsent = s.cart.length || s.customer;
    if (!(await confirmDialog({
      title: 'تسجيل الخروج',
      message: `${unsent ? 'فيه طلب لسه ما اتبعتش وهيتمسح. ' : ''}بعد الخروج هتحتاج كلمة السر عشان تدخل تاني على الجهاز ده.`,
      confirmLabel: 'خروج', danger: true,
    }))) return;
    resetDraft();
    await ds.signOut();
    location.hash = '#/board';
    location.reload();
  });

  return bind((s) => ({ route: s.route, user: s.user, agent: s.agent }), ({ route, user, agent }) => {
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
        ${can(user, 'manageAreas') ? `<a href="#/areas" title="المناطق والموظفين" class="${route === 'areas' ? 'active' : ''}">${icon('pin')}<span>المناطق والموظفين</span></a>` : ''}
      </nav>
      <div class="spacer"></div>
      <div class="top-meta">
        <span class="demo-pill" title="كل البيانات المعروضة وهمية ولا يتم حفظ أي شيء">${icon('info')}<span class="demo-text">وضع تجريبي</span></span>
        <a href="#/board" class="agent-chip ${agent ? '' : 'needs-value'}" title="الطلبات بتتسجل باسم الموظف ده — تغيّره من «اختار اسمك» في شاشة مركز الاتصال">${icon('headset')}<span data-agent-name>${esc(agent?.name ?? 'اختار اسمك')}</span></a>
        ${ds.IS_MOCK ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-logout title="تسجيل الخروج">${icon('arrowRight')}<span class="logout-text">خروج</span></button>`}
      </div>`;
  });
}
