/* Sign-in for the one shared call-center account (Supabase mode only).
   Shown once per device: after that the session is remembered by the browser.
   The password goes straight to Supabase Auth and is never stored by the app. */
import * as ds from '../data/data-source.js';
import { ACCOUNT_EMAIL, ALLOW_SIGNUP } from '../config.js';
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
        ${ALLOW_SIGNUP ? '<button type="button" class="link-btn signup-link" data-show-signup>أول مرة؟ إنشاء الأكونت</button>' : ''}
      </form>
      ${ALLOW_SIGNUP ? signupFormHtml() : ''}
    </div>`;

  const form = view.querySelector('form');
  const err = view.querySelector('[data-err="login"]');
  const btn = view.querySelector('[data-submit]');
  (form.querySelector('#lg-email') ?? form.querySelector('#lg-password')).focus();

  if (ALLOW_SIGNUP) wireSignup(view, form);

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

/* ---------- One-time account creation (config ALLOW_SIGNUP) ---------- */
function signupFormHtml() {
  return `
      <form class="login-card card" data-signup hidden novalidate>
        <h1>إنشاء أكونت مركز الاتصال</h1>
        <p class="muted">مرة واحدة بس. الأكونت مش هيشوف أي بيانات لحد ما يتفعّل لمركز الاتصال.</p>
        <div class="field">
          <label for="su-email">الإيميل</label>
          <input id="su-email" class="input ltr" name="email" type="email" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="su-password">كلمة السر (8 على الأقل)</label>
          <input id="su-password" class="input ltr" name="password" type="password" autocomplete="new-password" minlength="8" required>
        </div>
        <div class="field">
          <label for="su-password2">تأكيد كلمة السر</label>
          <input id="su-password2" class="input ltr" name="password2" type="password" autocomplete="new-password" required>
        </div>
        <div class="field-error" data-err="signup" role="alert"></div>
        <div class="alert alert-success" data-signup-done hidden></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" data-signup-submit>${icon('plus')}إنشاء الأكونت</button>
        <button type="button" class="link-btn signup-link" data-show-login>رجوع لتسجيل الدخول</button>
      </form>`;
}

function wireSignup(view, loginForm) {
  const su = view.querySelector('[data-signup]');
  const err = su.querySelector('[data-err="signup"]');
  const done = su.querySelector('[data-signup-done]');
  const btn = su.querySelector('[data-signup-submit]');
  const show = (signup) => {
    loginForm.hidden = signup;
    su.hidden = !signup;
    (signup ? su.querySelector('#su-email') : loginForm.querySelector('input:not([hidden])'))?.focus();
  };
  view.querySelector('[data-show-signup]').addEventListener('click', () => show(true));
  su.querySelector('[data-show-login]').addEventListener('click', () => show(false));

  su.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = su.querySelector('#su-email').value.trim();
    const password = su.querySelector('#su-password').value;
    const password2 = su.querySelector('#su-password2').value;
    err.textContent = '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'اكتب إيميل صحيح'; return; }
    if (password.length < 8) { err.textContent = 'كلمة السر لازم تكون 8 حروف/أرقام على الأقل'; return; }
    if (password !== password2) { err.textContent = 'كلمتين السر مش زي بعض'; return; }
    btn.disabled = true;
    try {
      const { needsConfirmation } = await ds.signUp(email, password);
      done.hidden = false;
      done.textContent = needsConfirmation
        ? `الأكونت اتعمل ✔ افتح إيميل ${email} واضغط رابط التأكيد. بعدها ابعت الإيميل ده عشان يتفعّل لمركز الاتصال، وبعدين ادخل بكلمة السر.`
        : `الأكونت اتعمل ✔ ابعت الإيميل ${email} عشان يتفعّل لمركز الاتصال، وبعدين ادخل بكلمة السر.`;
      su.querySelectorAll('input').forEach((i) => { i.value = ''; i.disabled = true; });
      btn.hidden = true;
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  });
}
