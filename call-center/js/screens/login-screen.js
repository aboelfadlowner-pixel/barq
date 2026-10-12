/* Demo login: choose one of the two accounts. The real version uses
   a username and password per account (Supabase Auth). */
import * as ds from '../data/data-source.js';
import { setUser } from '../store.js';
import { esc, on } from '../utils/dom.js';
import { ROLE_LABELS } from '../permissions.js';
import { icon } from '../components/icons.js';

const ROLE_HINT = {
  agent: 'إنشاء الطلبات، العملاء والعناوين، الطباعة، كل الطلبات',
  supervisor: 'كل صلاحيات الموظف + إلغاء الطلبات، مناطق التوصيل ورسومها، ملخص اليوم',
};

export function mountLogin(view) {
  view.innerHTML = `
    <div class="login-page">
      <div class="login-card card">
        <div class="brand login-brand">
          <div class="brand-mark" aria-hidden="true">أ</div>
          <div><div class="brand-name">أبو الفضل</div><div class="muted">مركز الاتصال · طلبات التوصيل</div></div>
        </div>
        <h1>تسجيل الدخول</h1>
        <div class="login-accounts" data-accounts><p class="muted">جارٍ التحميل…</p></div>
        <div class="alert alert-warn">${icon('info')}<span>دخول تجريبي: اختر الحساب. في النسخة الحقيقية كل حساب له اسم مستخدم وكلمة سر.</span></div>
      </div>
    </div>`;

  ds.getDemoAccounts().then((accounts) => {
    view.querySelector('[data-accounts]').innerHTML = accounts.map((a) => `
      <button type="button" class="account-btn" data-account="${esc(a.id)}">
        <span class="avatar">${icon(a.role === 'supervisor' ? 'clipboard' : 'user')}</span>
        <span class="grow">
          <span class="cust-name">${esc(a.name)} <span class="tag ${a.role === 'supervisor' ? 'tag-warn' : 'tag-green'}">${ROLE_LABELS[a.role]}</span></span>
          <span class="addr-extra">${ROLE_HINT[a.role]}</span>
        </span>
        <span class="chev">${icon('chevronLeft')}</span>
      </button>`).join('');
    view.querySelector('[data-account]')?.focus();
  });

  return on(view, 'click', '[data-account]', async (e, btn) => {
    const user = await ds.demoLogin(btn.dataset.account);
    if (!user) return;
    setUser(user);
    if (location.hash && location.hash !== '#/board') location.hash = '#/board';
    else window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
