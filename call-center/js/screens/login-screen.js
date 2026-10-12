/* Sign-in for the one shared call-center account (Supabase mode only).
   Shown once per device: after that the session is remembered by the browser.
   The password goes straight to Supabase Auth and is never stored by the app. */
import * as ds from '../data/data-source.js';
import { ACCOUNT_EMAIL } from '../config.js';
import { icon } from '../components/icons.js';
import { esc } from '../utils/dom.js';

export function mountLogin(view, onSignedIn) {
  view.innerHTML = `
    <div class="login-page">
      <form class="login-card card" novalidate>
        <div class="brand login-brand">
          <div class="brand-mark" aria-hidden="true">أ</div>
          <div><div class="brand-name">أبو الفضل</div><div class="muted">مركز الاتصال · طلبات التوصيل</div></div>
        </div>
        <h1>تسجيل الدخول</h1>
        ${ACCOUNT_EMAIL ? `<input type="email" name="username" autocomplete="username" value="${esc(ACCOUNT_EMAIL)}" hidden>` : `
        <div class="field">
          <label for="lg-email">البريد الإلكتروني</label>
          <input id="lg-email" class="input ltr" name="email" type="email" autocomplete="username" required>
        </div>`}
        <div class="field">
          <label for="lg-password">كلمة السر</label>
          <input id="lg-password" class="input ltr" name="password" type="password" autocomplete="current-password" required>
        </div>
        <div class="field-error" data-err="login" role="alert"></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" data-submit>${icon('check')}دخول</button>
        <p class="muted login-note">بتدخل مرة واحدة على الجهاز ده، وبعدها البرنامج بيفتح على طول.</p>
      </form>
    </div>`;

  const form = view.querySelector('form');
  const err = view.querySelector('[data-err="login"]');
  const btn = view.querySelector('[data-submit]');
  (form.querySelector('#lg-email') ?? form.querySelector('#lg-password')).focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('#lg-email')?.value.trim() ?? ACCOUNT_EMAIL;
    const password = form.querySelector('#lg-password').value;
    if (!email || !password) { err.textContent = 'اكتب كلمة السر'; return; }
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'جارٍ الدخول…';
    try {
      const account = await ds.signIn(email, password);
      onSignedIn(account);
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.innerHTML = `${icon('check')}دخول`;
      form.querySelector('#lg-password').select();
    }
  });
}
