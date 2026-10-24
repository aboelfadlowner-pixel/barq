/* Sign-in for the one shared call-center account (Supabase mode only).
   Shown once per device: after that the session is remembered by the browser.
   The password goes straight to Supabase Auth and is never stored by the app. */
import * as ds from '../data/data-source.js';
import { ACCOUNT_EMAIL, ALLOW_SIGNUP } from '../config.js';
import { icon } from '../components/icons.js';
import { esc } from '../utils/dom.js';

export function mountLogin(view, onSignedIn, { codeStep = false, email: pendingEmail = '' } = {}) {
  // Signed in already but not linked yet (e.g. reopened after creating the account).
  if (codeStep) { mountCodeStep(view, onSignedIn, pendingEmail); return; }

  view.innerHTML = `
    <div class="login-page">
      <form class="login-card card" novalidate>
        <div class="brand login-brand">
          <img class="login-logo" src="assets/logo.png" alt="أبو الفضل">
          <div><div class="brand-name">أبو الفضل</div><div class="muted">مركز الاتصال · طلبات التوصيل</div></div>
        </div>
        <h1>تسجيل الدخول</h1>
        ${ACCOUNT_EMAIL ? `<input type="email" name="username" autocomplete="username" value="${esc(ACCOUNT_EMAIL)}" hidden>` : `
        <div class="field">
          <label for="lg-email">البريد الإلكتروني</label>
          <input id="lg-email" class="input ltr" name="email" type="email" autocomplete="username" required>
        </div>`}
        <div class="field">
          <label for="lg-password">كلمة المرور</label>
          <input id="lg-password" class="input ltr" name="password" type="password" autocomplete="current-password" required>
        </div>
        <div class="field-error" data-err="login" role="alert"></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" data-submit>${icon('check')}دخول</button>
        <p class="muted login-note">تسجّل الدخول مرة واحدة على هذا الجهاز، وبعدها يفتح البرنامج مباشرة.</p>
        ${ALLOW_SIGNUP ? '<button type="button" class="link-btn signup-link" data-show-signup>أول مرة؟ إنشاء حساب</button>' : ''}
      </form>
      ${ALLOW_SIGNUP ? signupFormHtml() : ''}
    </div>`;

  const form = view.querySelector('form');
  const err = view.querySelector('[data-err="login"]');
  const btn = view.querySelector('[data-submit]');
  (form.querySelector('#lg-email') ?? form.querySelector('#lg-password')).focus();

  if (ALLOW_SIGNUP) wireSignup(view, form, onSignedIn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('#lg-email')?.value.trim() ?? ACCOUNT_EMAIL;
    const password = form.querySelector('#lg-password').value;
    if (!email || !password) { err.textContent = 'أدخل كلمة المرور'; return; }
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'جارٍ الدخول…';
    try {
      const account = await ds.signIn(email, password);
      if (account.pendingCode) mountCodeStep(view, onSignedIn, account.email || email);
      else onSignedIn(account);
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.innerHTML = `${icon('check')}دخول`;
      form.querySelector('#lg-password').select();
    }
  });
}

/* ---------- Registration code: asked once for a new account ---------- */
function mountCodeStep(view, onSignedIn, email) {
  view.innerHTML = `
    <div class="login-page">
      <form class="login-card card" data-code-form novalidate>
        <div class="brand login-brand">
          <img class="login-logo" src="assets/logo.png" alt="أبو الفضل">
          <div><div class="brand-name">أبو الفضل</div><div class="muted">مركز الاتصال · طلبات التوصيل</div></div>
        </div>
        <h1>كود التسجيل</h1>
        <p class="muted">${email ? `الحساب <span class="ltr-inline">${esc(email)}</span> جديد. ` : ''}أدخل اسمك وكود التسجيل الذي حصلت عليه من المسؤول — مرة واحدة فقط.</p>
        <div class="field">
          <label for="cd-name">اسمك (يظهر على الطلبات)</label>
          <input id="cd-name" class="input" name="cc-agent-label" maxlength="40" autocomplete="off" data-lpignore="true" placeholder="مثال: عمر محمد" required>
        </div>
        <div class="field">
          <label for="cd-code">الكود</label>
          <input id="cd-code" class="input ltr-center" name="code" autocomplete="off" required>
        </div>
        <div class="field-error" data-err="code" role="alert"></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" data-code-submit>${icon('check')}تأكيد</button>
        <button type="button" class="link-btn signup-link" data-code-signout>الخروج والدخول بحساب آخر</button>
      </form>
    </div>`;
  const form = view.querySelector('[data-code-form]');
  const err = form.querySelector('[data-err="code"]');
  const btn = form.querySelector('[data-code-submit]');
  const input = form.querySelector('#cd-code');
  const nameInput = form.querySelector('#cd-name');
  nameInput.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (nameInput.value.trim().length < 2) { err.textContent = 'أدخل اسمك'; nameInput.focus(); return; }
    if (!input.value.trim()) { err.textContent = 'أدخل الكود'; input.focus(); return; }
    err.textContent = '';
    btn.disabled = true;
    try {
      const account = await ds.joinWithCode(input.value.trim(), nameInput.value.trim());
      if (!account || account.pendingCode) throw new Error('كود التسجيل غير صحيح');
      onSignedIn(account);
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      input.select();
    }
  });
  form.querySelector('[data-code-signout]').addEventListener('click', async () => {
    await ds.signOut();
    mountLogin(view, onSignedIn);
  });
}

/* ---------- Name: asked once for an account made before names (14_account_names.sql) ---------- */
export function mountNameStep(view, onDone, account) {
  view.innerHTML = `
    <div class="login-page">
      <form class="login-card card" data-name-form novalidate>
        <div class="brand login-brand">
          <img class="login-logo" src="assets/logo.png" alt="أبو الفضل">
          <div><div class="brand-name">أبو الفضل</div><div class="muted">مركز الاتصال · طلبات التوصيل</div></div>
        </div>
        <h1>اكتب اسمك</h1>
        <p class="muted">${account?.email ? `الحساب <span class="ltr-inline">${esc(account.email)}</span>. ` : ''}اسمك يُسجَّل على حسابك ويظهر على الطلبات التي ترسلها — مرة واحدة فقط.</p>
        <div class="field">
          <label for="nm-name">اسمك</label>
          <input id="nm-name" class="input" name="cc-agent-label" maxlength="40" autocomplete="off" data-lpignore="true" placeholder="مثال: عمر محمد" required>
        </div>
        <div class="field-error" data-err="name" role="alert"></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" data-name-submit>${icon('check')}حفظ</button>
        <button type="button" class="link-btn signup-link" data-name-signout>الخروج والدخول بحساب آخر</button>
      </form>
    </div>`;
  const form = view.querySelector('[data-name-form]');
  const err = form.querySelector('[data-err="name"]');
  const btn = form.querySelector('[data-name-submit]');
  const input = form.querySelector('#nm-name');
  input.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (input.value.trim().length < 2) { err.textContent = 'أدخل اسمك'; input.focus(); return; }
    err.textContent = '';
    btn.disabled = true;
    try {
      onDone(await ds.setMyName(input.value.trim()));
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      input.select();
    }
  });
  form.querySelector('[data-name-signout]').addEventListener('click', async () => {
    await ds.signOut();
    mountLogin(view, onDone);
  });
}

/* ---------- Account creation (config ALLOW_SIGNUP) ---------- */
function signupFormHtml() {
  return `
      <form class="login-card card" data-signup hidden novalidate>
        <h1>إنشاء حساب</h1>
        <p class="muted">مرة واحدة على هذا الجهاز. بعد إنشاء الحساب ستُدخل كود التسجيل الذي حصلت عليه من المسؤول.</p>
        <div class="field">
          <label for="su-email">البريد الإلكتروني</label>
          <input id="su-email" class="input ltr" name="email" type="email" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="su-password">كلمة المرور (8 أحرف على الأقل)</label>
          <input id="su-password" class="input ltr" name="password" type="password" autocomplete="new-password" minlength="8" required>
        </div>
        <div class="field">
          <label for="su-password2">تأكيد كلمة المرور</label>
          <input id="su-password2" class="input ltr" name="password2" type="password" autocomplete="new-password" required>
        </div>
        <div class="field-error" data-err="signup" role="alert"></div>
        <div class="alert alert-success" data-signup-done hidden></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" data-signup-submit>${icon('plus')}إنشاء الحساب</button>
        <button type="button" class="link-btn signup-link" data-show-login>العودة لتسجيل الدخول</button>
      </form>`;
}

function wireSignup(view, loginForm, onSignedIn) {
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
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'أدخل بريدًا إلكترونيًا صحيحًا'; return; }
    if (password.length < 8) { err.textContent = 'يجب أن تتكون كلمة المرور من 8 أحرف أو أرقام على الأقل'; return; }
    if (password !== password2) { err.textContent = 'كلمتا المرور غير متطابقتين'; return; }
    btn.disabled = true;
    try {
      const { needsConfirmation } = await ds.signUp(email, password);
      if (!needsConfirmation) { mountCodeStep(view, onSignedIn, email); return; }   // signed in already → code
      done.hidden = false;
      done.textContent = `تم إنشاء الحساب ✔ افتح بريد ${email} واضغط رابط التأكيد في رسالة Supabase. بعدها عد إلى هنا وسجّل الدخول بالبريد وكلمة المرور، وسيُطلب منك كود التسجيل مرة واحدة.`;
      su.querySelectorAll('input').forEach((i) => { i.value = ''; i.disabled = true; });
      btn.hidden = true;
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  });
}
