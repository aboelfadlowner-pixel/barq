/* Top bar: brand, navigation, account name (+ sign out when connected to the database). */
import { bind, getState, resetDraft } from '../store.js';
import * as ds from '../data/data-source.js';
import { clearCatalogCache } from '../catalog.js';
import { syncCatalog } from '../catalog-sync.js';
import { formatTime } from '../utils/format.js';
import { confirmDialog, openModal, showToast } from './modal.js';
import { can, isPrepOnly, ROLES } from '../permissions.js';
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
  on(el, 'click', '[data-change-password]', () => openChangePassword());
  on(el, 'click', '[data-logout]', async () => {
    const s = getState();
    const unsent = s.cart.length || s.customer;
    if (!(await confirmDialog({
      title: 'تسجيل الخروج',
      message: `${unsent ? 'فيه طلب لسه ما اتبعتش وهيتمسح. ' : ''}بعد الخروج هتحتاج كلمة السر عشان تدخل تاني على الجهاز ده.`,
      confirmLabel: 'خروج', danger: true,
    }))) return;
    resetDraft();
    clearCatalogCache();
    await ds.signOut();
    location.hash = '#/board';
    location.reload();
  });

  // «تحديث»: products & prices now (same steps as the automatic 5-minute refresh).
  on(el, 'click', '[data-sync]', async (e, btn) => {
    btn.disabled = true;
    const r = await syncCatalog({ manual: true });
    const mins = (ms) => Math.max(1, Math.round(ms / 60000));
    const what = r.added || r.changed
      ? `${r.added ? `${r.added} منتج جديد` : ''}${r.added && r.changed ? ' و' : ''}${r.changed ? `${r.changed} منتج اتغيّر سعره أو اسمه` : ''}`
      : 'مفيش تغيير في المنتجات والأسعار';
    if (r.failed && !r.pulled) showToast(`تعذّر التحديث — ${r.failed.join('، ')}`);
    else if (r.pulled) showToast(`اتسحبت الشيتات من الدرايف ✓ — ${what}`);
    else showToast(`المنتجات اتحدّثت ✓ — ${what}. آخر سحب من الدرايف كان من ${mins(Date.now() - new Date(r.pulledAt).getTime())} دقيقة، والسحب الجاي بعد ${mins(r.nextPullInMs)} دقيقة.`);
  });

  const syncChip = (sync) => `
    <button type="button" class="btn btn-ghost btn-sm sync-chip ${sync.busy ? 'is-busy' : ''}" data-sync ${sync.busy ? 'disabled' : ''}
      title="${sync.pulledAt ? `آخر سحب للشيتات من الدرايف: ${formatTime(sync.pulledAt)}. ` : ''}بيتحدّث لوحده كل 5 دقايق — اضغط للتحديث دلوقتي">
      ${icon('repeat')}<span class="sync-text">${sync.busy ? 'بيحدّث…' : sync.at ? `الأسعار ${formatTime(sync.at)}` : 'تحديث الأسعار'}</span></button>`;

  return bind((s) => ({ route: s.route, user: s.user, agent: s.agent, sync: s.catalogSync }), ({ route, user, agent, sync }) => {
    if (!user) {
      el.innerHTML = `${brand}<div class="spacer"></div>
        <div class="top-meta"><span class="demo-pill">${icon('info')}<span class="demo-text">وضع تجريبي</span></span></div>`;
      return;
    }
    const logout = ds.IS_MOCK ? '' : `
      <button type="button" class="btn btn-ghost btn-sm btn-icon" data-change-password title="تغيير كلمة السر" aria-label="تغيير كلمة السر">${icon('key')}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-logout title="تسجيل الخروج">${icon('arrowRight')}<span class="logout-text">خروج</span></button>`;
    if (isPrepOnly(user)) {               // branch preparation account: its screen only
      el.innerHTML = `${brand}
        <nav class="topnav" aria-label="التنقل الرئيسي">
          <a href="#/prep" class="active">${icon('clipboard')}<span>شاشة التجهيز</span></a>
        </nav>
        <div class="spacer"></div>
        <div class="top-meta">
          <span class="demo-pill">${icon('info')}<span class="demo-text">وضع تجريبي</span></span>
          <span class="role-pill">${icon('user')}${ROLES.find((r) => r.id === user.role)?.label ?? ''}</span>
          ${logout}
        </div>`;
      return;
    }
    const isPos = route === 'pos';
    el.innerHTML = `
      ${brand}
      <nav class="topnav" aria-label="التنقل الرئيسي">
        <a href="#/board" title="مركز الاتصال" class="${route === 'board' ? 'active' : ''}">${icon('headset')}<span>مركز الاتصال</span></a>
        <a href="#/pos" title="الطلب الحالي" class="${isPos ? 'active' : ''}">${icon('cart')}<span>الطلب الحالي</span></a>
        ${can(user, 'ordersLog') ? `<a href="#/orders" title="سجل الطلبات" class="${route === 'orders' || route === 'order' ? 'active' : ''}">${icon('list')}<span>سجل الطلبات</span></a>` : ''}
        ${can(user, 'manageAreas') ? `<a href="#/areas" title="المناطق والموظفين" class="${route === 'areas' ? 'active' : ''}">${icon('pin')}<span>المناطق والموظفين</span></a>` : ''}
      </nav>
      <div class="spacer"></div>
      <div class="top-meta">
        <span class="demo-pill" title="كل البيانات المعروضة وهمية ولا يتم حفظ أي شيء">${icon('info')}<span class="demo-text">وضع تجريبي</span></span>
        ${syncChip(sync)}
        <a href="#/board" class="agent-chip ${agent ? '' : 'needs-value'}" title="الطلبات بتتسجل باسم الموظف ده — تغيّره من «اختار اسمك» في شاشة مركز الاتصال">${icon('headset')}<span data-agent-name>${esc(agent?.name ?? 'اختار اسمك')}</span></a>
        ${user.role === 'admin' ? `<span class="role-pill role-pill-admin" title="الأدمن بيشوف الإعدادات والحسابات">${icon('user')}أدمن</span>` : ''}
        ${logout}
      </div>`;
  });
}

/* Change the password of the account signed in on this device. */
function openChangePassword() {
  const m = openModal({
    title: `${icon('key')} تغيير كلمة السر`,
    size: 'sm',
    body: `
      <form data-pw novalidate>
        <div class="field">
          <label for="pw-new">كلمة السر الجديدة (8 على الأقل)</label>
          <input id="pw-new" class="input ltr" type="password" autocomplete="new-password" minlength="8">
        </div>
        <div class="field">
          <label for="pw-new2">تأكيد كلمة السر</label>
          <input id="pw-new2" class="input ltr" type="password" autocomplete="new-password">
        </div>
        <p class="muted">الجهاز ده هيفضل داخل. الأجهزة التانية اللي داخلة بنفس الأكونت هتحتاج كلمة السر الجديدة لما تدخل تاني.</p>
        <div class="field-error" data-err="pw" role="alert"></div>
      </form>`,
    footer: `
      <button type="button" class="btn btn-primary btn-lg" data-save>${icon('check')}حفظ كلمة السر</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>إلغاء</button>`,
  });
  const err = m.body.querySelector('[data-err="pw"]');
  const save = async () => {
    const a = m.body.querySelector('#pw-new').value;
    const b = m.body.querySelector('#pw-new2').value;
    if (a.length < 8) { err.textContent = 'كلمة السر لازم تكون 8 حروف/أرقام على الأقل'; return; }
    if (a !== b) { err.textContent = 'كلمتين السر مش زي بعض'; return; }
    const btn = m.foot.querySelector('[data-save]');
    btn.disabled = true;
    try {
      await ds.changePassword(a);
      m.close();
      showToast('تم تغيير كلمة السر');
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  };
  m.foot.querySelector('[data-save]').addEventListener('click', save);
  m.body.querySelector('[data-pw]').addEventListener('submit', (e) => { e.preventDefault(); save(); });
  m.body.querySelector('#pw-new').focus();
}
