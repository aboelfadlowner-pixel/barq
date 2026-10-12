/* Customer selection: search by phone → pick customer → pick/enter address,
   or register a new customer with an address. */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, setCustomer } from '../store.js';
import { esc, on } from '../utils/dom.js';
import { formatAddress, formatMoney, formatTime, dayLabel, normalizePhone, isValidPhone } from '../utils/format.js';
import { icon } from './icons.js';
import { openModal, showToast } from './modal.js';
import { addressFormHtml, readAddressForm, validateAddress, showErrors } from './address-form.js';

const initial = (name) => esc((name || '؟').trim().charAt(0));

async function todayOrdersFor(phones) {
  const lists = await Promise.all(phones.filter(Boolean).map((p) => ds.findTodayOrdersByPhone(p)));
  const seen = new Set();
  return lists.flat().filter((o) => (seen.has(o.id) ? false : seen.add(o.id)));
}

export function todayWarning(todayOrders) {
  if (!todayOrders?.length) return '';
  const list = todayOrders.map((o) => `<span class="ltr-inline">${esc(o.number)}</span> (${formatTime(o.createdAt)})`).join('، ');
  return `<div class="alert alert-warn">${icon('alert')}<span>تنبيه: لهذا العميل ${todayOrders.length === 1 ? 'طلب' : 'طلبات'} اليوم: ${list}. تأكد أنه ليس طلباً مكرراً.</span></div>`;
}

function areaLabel(areaId) {
  const a = catalog.areasById.get(areaId);
  return a
    ? `${esc(a.name)} <span class="fee-chip num">${formatMoney(a.fee)}</span>`
    : '<span class="tag tag-danger">منطقة غير معروفة</span>';
}

export async function openCustomerDialog({ phone = '', edit = false } = {}) {
  const m = openModal({ title: `${icon('user')} العميل وعنوان التوصيل`, size: 'md' });
  const st = { step: 'search', query: phone, results: null, customer: null, todayOrders: [], prefill: null };
  let searchTimer;

  /* ---------- Step renderers ---------- */
  function renderSearch() {
    m.body.innerHTML = `
      <form class="phone-search" data-form="search" novalidate>
        <input class="input input-lg ltr" name="phone" type="tel" inputmode="tel" autocomplete="off"
          placeholder="01xxxxxxxxx" value="${esc(st.query)}" aria-label="رقم موبايل العميل">
        <button class="btn btn-primary btn-lg" type="submit">${icon('search')}بحث</button>
      </form>
      <p class="hint">يمكن كتابة الرقم بأي صيغة: 010… أو ‎+20… أو بالأرقام العربية.</p>
      <div class="results" data-results></div>`;
    m.foot.innerHTML = `
      <button type="button" class="btn btn-soft" data-new>${icon('userPlus')}عميل جديد</button>
      <button type="button" class="btn btn-secondary push" data-close>إلغاء</button>`;
    renderResults();
    const input = m.body.querySelector('[name="phone"]');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function renderResults() {
    const box = m.body.querySelector('[data-results]');
    if (!box) return;
    if (st.results === null) {
      box.innerHTML = '<p class="muted">اكتب 3 أرقام على الأقل لعرض العملاء المسجلين.</p>';
      return;
    }
    if (!st.results.length) {
      box.innerHTML = `
        <div class="results-empty">
          <p>لا يوجد عميل مسجل بالرقم <strong class="ltr-inline">${esc(st.query)}</strong></p>
          <button type="button" class="btn btn-primary" data-new>${icon('userPlus')}تسجيل عميل جديد بهذا الرقم</button>
        </div>`;
      return;
    }
    box.innerHTML = st.results.map((c) => `
      <button type="button" class="result-card" data-cid="${esc(c.id)}">
        <div class="avatar">${initial(c.name)}</div>
        <div class="grow">
          <div class="cust-name">${esc(c.name)}</div>
          <div class="meta">
            <span class="ltr-inline">${c.phones.map(esc).join(' / ')}</span>
            <span>${c.addresses.length ? `${c.addresses.length} ${c.addresses.length === 1 ? 'عنوان محفوظ' : 'عناوين محفوظة'}` : 'لا توجد عناوين'}</span>
            ${c.lastOrderAt ? `<span>آخر طلب: ${dayLabel(c.lastOrderAt)}</span>` : ''}
          </div>
        </div>
        <span class="chev">${icon('chevronLeft')}</span>
      </button>`).join('');
  }

  function renderAddressStep() {
    const c = st.customer;
    const s = getState();
    const currentId = s.customer?.id === c.id ? s.address?.id : null;
    const selected = c.addresses.some((a) => a.id === currentId) ? currentId : (c.addresses[0]?.id ?? 'new');
    const orderPhone = s.customer?.id === c.id ? s.customer.phone : (st.matchedPhone ?? c.phones[0]);

    m.body.innerHTML = `
      <div class="cust-card">
        <div class="avatar">${initial(c.name)}</div>
        <div class="grow">
          <div class="cust-name">${esc(c.name)} <span class="tag tag-green">عميل مسجل</span></div>
          <div class="cust-phone ltr-inline">${c.phones.map(esc).join(' / ')}</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-back>${icon('edit')}تغيير العميل</button>
      </div>
      ${todayWarning(st.todayOrders) ? `<div style="margin-top:10px">${todayWarning(st.todayOrders)}</div>` : ''}

      ${c.phones.length > 1 ? `
        <div class="field" style="margin-top:14px">
          <label for="orderPhone">رقم التواصل لهذا الطلب</label>
          <select id="orderPhone" class="select ltr" name="orderPhone">
            ${c.phones.map((ph) => `<option value="${esc(ph)}" ${normalizePhone(ph) === normalizePhone(orderPhone) ? 'selected' : ''}>${esc(ph)}</option>`).join('')}
          </select>
        </div>` : ''}

      <h3 class="block-title" style="margin-top:18px">${icon('pin')}عنوان التوصيل</h3>
      <div class="addr-options">
        ${c.addresses.map((a) => `
          <label class="addr-option">
            <input type="radio" name="addr" value="${esc(a.id)}" ${a.id === selected ? 'checked' : ''}>
            <div class="grow">
              <div class="t">${areaLabel(a.areaId)}</div>
              <div class="addr-text">${esc(formatAddress(a))}</div>
              ${a.landmark ? `<div class="addr-extra">علامة مميزة: ${esc(a.landmark)}</div>` : ''}
              ${a.notes ? `<div class="addr-extra">${esc(a.notes)}</div>` : ''}
            </div>
          </label>`).join('')}
        <label class="addr-option">
          <input type="radio" name="addr" value="new" ${selected === 'new' ? 'checked' : ''}>
          <div class="grow">
            <div class="t">${icon('plus')}عنوان جديد</div>
            <div class="addr-extra">${c.addresses.length ? 'إضافة عنوان توصيل آخر لهذا العميل' : 'لا توجد عناوين محفوظة لهذا العميل'}</div>
          </div>
        </label>
      </div>
      <div class="addr-form" data-new-addr ${selected === 'new' ? '' : 'hidden'}>${addressFormHtml()}</div>`;

    m.foot.innerHTML = `
      <button type="button" class="btn btn-primary btn-lg" data-confirm>${icon('check')}اعتماد العميل والعنوان</button>
      <button type="button" class="btn btn-secondary btn-lg" data-back>رجوع للبحث</button>`;
  }

  function renderNewStep() {
    const p = st.prefill ?? {};
    m.body.innerHTML = `
      <h3 class="block-title">${icon('userPlus')}بيانات العميل الجديد</h3>
      <div class="form-grid" data-cust-form>
        <div class="field span-3">
          <label for="nc-name">اسم العميل<span class="req">*</span></label>
          <input id="nc-name" class="input" name="name" value="${esc(p.name ?? '')}" autocomplete="off">
          <div class="field-error" data-err="name"></div>
        </div>
        <div class="field">
          <label for="nc-phone">رقم الموبايل<span class="req">*</span></label>
          <input id="nc-phone" class="input ltr" name="phone" type="tel" inputmode="tel" value="${esc(p.phone ?? st.query)}" autocomplete="off">
          <div class="field-error" data-err="phone"></div>
        </div>
        <div class="field">
          <label for="nc-phone2">رقم إضافي</label>
          <input id="nc-phone2" class="input ltr" name="phone2" type="tel" inputmode="tel" value="${esc(p.phone2 ?? '')}" autocomplete="off">
          <div class="field-error" data-err="phone2"></div>
        </div>
      </div>
      <h3 class="block-title">${icon('pin')}عنوان التوصيل</h3>
      ${addressFormHtml(p.address ?? {})}
      <div class="alert alert-info dialog-note">${icon('info')}<span>يُحفظ العميل الجديد عند تأكيد الطلب فقط. في الوضع التجريبي يُحفظ في ذاكرة المتصفح ويُحذف عند تحديث الصفحة.</span></div>`;
    m.foot.innerHTML = `
      <button type="button" class="btn btn-primary btn-lg" data-confirm>${icon('check')}اعتماد العميل والعنوان</button>
      <button type="button" class="btn btn-secondary btn-lg" data-back>رجوع للبحث</button>`;
    m.body.querySelector(p.name ? '[name="street"]' : '[name="name"]').focus();
  }

  function render() {
    if (st.step === 'search') renderSearch();
    else if (st.step === 'address') renderAddressStep();
    else renderNewStep();
  }

  /* ---------- Actions ---------- */
  async function runSearch(q) {
    st.query = q;
    const norm = normalizePhone(q);
    st.results = norm.length >= 3 ? await ds.findCustomersByPhone(q) : null;
    renderResults();
  }

  async function chooseCustomer(c) {
    const norm = normalizePhone(st.query);
    st.customer = c;
    st.matchedPhone = c.phones.find((ph) => norm && normalizePhone(ph).includes(norm)) ?? c.phones[0];
    st.todayOrders = await todayOrdersFor(c.phones);
    st.step = 'address';
    render();
  }

  async function confirmExisting() {
    const c = st.customer;
    const choice = m.body.querySelector('[name="addr"]:checked')?.value;
    let address;
    if (!choice || choice === 'new') {
      const values = readAddressForm(m.body);
      const errors = validateAddress(values);
      showErrors(m.body, errors);
      if (Object.keys(errors).length) return;
      address = { ...values, id: null, isNew: true };
    } else {
      address = { ...c.addresses.find((a) => a.id === choice), isNew: false };
    }
    const phone = m.body.querySelector('[name="orderPhone"]')?.value ?? st.matchedPhone ?? c.phones[0];
    setCustomer({ id: c.id, name: c.name, phone, phone2: '', isNew: false, todayOrders: st.todayOrders }, address);
    m.close();
  }

  async function confirmNew() {
    const form = m.body.querySelector('[data-cust-form]');
    const name = form.querySelector('[name="name"]').value.trim();
    const phone = normalizePhone(form.querySelector('[name="phone"]').value);
    const phone2Raw = form.querySelector('[name="phone2"]').value.trim();
    const phone2 = phone2Raw ? normalizePhone(phone2Raw) : '';
    const values = readAddressForm(m.body);

    const errors = validateAddress(values);
    if (!name) errors.name = 'اكتب اسم العميل';
    if (!isValidPhone(phone)) errors.phone = 'رقم غير صحيح — مثال: 01012345678';
    else {
      const owner = await ds.phoneBelongsToCustomer(phone);
      if (owner) errors.phone = `هذا الرقم مسجل باسم «${owner.name}» — ارجع للبحث واختره`;
    }
    if (phone2 && !isValidPhone(phone2)) errors.phone2 = 'رقم غير صحيح';
    // Show customer errors first so focus lands on the top-most problem.
    const ordered = Object.fromEntries(['name', 'phone', 'phone2', 'areaId', 'street', 'building']
      .filter((k) => errors[k]).map((k) => [k, errors[k]]));
    showErrors(m.body, ordered);
    if (Object.keys(ordered).length) return;

    const todayOrders = await todayOrdersFor([phone, phone2]);
    setCustomer({ id: null, name, phone, phone2, isNew: true, todayOrders }, { ...values, id: null, isNew: true });
    m.close();
    showToast('تم اعتماد العميل الجديد لهذا الطلب');
  }

  /* ---------- Events ---------- */
  m.el.addEventListener('submit', (e) => {
    if (e.target.matches('[data-form="search"]')) {
      e.preventDefault();
      clearTimeout(searchTimer);
      runSearch(e.target.phone.value.trim());
    }
  });
  m.el.addEventListener('input', (e) => {
    if (e.target.name === 'phone' && st.step === 'search') {
      clearTimeout(searchTimer);
      const q = e.target.value.trim();
      searchTimer = setTimeout(() => runSearch(q), 200);
    }
  });
  m.el.addEventListener('change', (e) => {
    if (e.target.name === 'addr') {
      const box = m.body.querySelector('[data-new-addr]');
      box.hidden = e.target.value !== 'new';
      if (!box.hidden) box.querySelector('select')?.focus();
    }
  });
  on(m.el, 'click', '[data-cid]', (e, el) => {
    const c = st.results?.find((x) => x.id === el.dataset.cid);
    if (c) chooseCustomer(c);
  });
  on(m.el, 'click', '[data-new]', () => {
    const q = m.body.querySelector('[name="phone"]')?.value.trim() ?? st.query;
    st.query = q;
    st.prefill = { phone: isValidPhone(q) ? normalizePhone(q) : q };
    st.step = 'new';
    render();
  });
  on(m.el, 'click', '[data-back]', () => { st.step = 'search'; st.prefill = null; render(); });
  on(m.el, 'click', '[data-confirm]', () => (st.step === 'new' ? confirmNew() : confirmExisting()));

  /* ---------- Initial step ---------- */
  const s = getState();
  if (edit && s.customer?.isNew) {
    st.step = 'new';
    st.prefill = { name: s.customer.name, phone: s.customer.phone, phone2: s.customer.phone2, address: s.address ?? {} };
    render();
  } else if (edit && s.customer?.id) {
    const found = (await ds.findCustomersByPhone(s.customer.phone)).find((c) => c.id === s.customer.id);
    if (found) { st.query = s.customer.phone; await chooseCustomer(found); } else { st.query = s.customer.phone; render(); runSearch(st.query); }
  } else {
    render();
    if (normalizePhone(st.query).length >= 3) runSearch(st.query);
  }
}
