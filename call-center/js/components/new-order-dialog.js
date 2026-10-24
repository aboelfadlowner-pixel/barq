/* "طلب جديد لمركز الاتصال" — Foodics-style start of an order:
   customer phone (+ optional extra number) → existing customer's data appears,
   or a new customer is entered → delivery address
   (saved addresses, edit, or "إضافة عنوان جديد"). "حفظ" opens the product search. */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, setState } from '../store.js';
import { CUSTOMER_NAME_MAX } from '../constants.js';
import { esc, on } from '../utils/dom.js';
import {
  formatAddress, formatMoney, formatTime, formatDateTime, normalizePhone, isValidPhone,
} from '../utils/format.js';
import { computeTotals } from '../utils/pricing.js';
import { icon } from './icons.js';
import { money, statusChip } from './chips.js';
import { openModal } from './modal.js';
import { openAddressDialog } from './address-dialog.js';
import { clearErrorsOnEdit } from './address-form.js';

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

const areaOf = (id) => catalog.areasById.get(id);
let tempSeq = 0;

export function openNewOrderDialog({ edit = false, phone = '' } = {}) {
  const s0 = getState();
  const st = {
    phone: '', phone2: '', showPhone2: false,
    status: 'idle',          // idle | searching | found | choose | new
    matches: [],
    customer: null,          // saved customer (full record) when found
    name: '',
    addresses: [],           // working list: saved copies + new/edited ones
    addressId: null,
    todayOrders: [],
  };

  const m = openModal({
    title: `${icon('headset')} طلب جديد لمركز الاتصال`,
    size: 'md',
    body: `
      <div class="no-form">
        <div class="field has-suggest">
          <label for="no-phone">هاتف العميل<span class="req">*</span></label>
          <input id="no-phone" class="input input-lg ltr" name="phone" type="tel" inputmode="tel" autocomplete="off"
            placeholder="01xxxxxxxxx" role="combobox" aria-autocomplete="list" aria-controls="no-suggest">
          <div class="phone-suggest" id="no-suggest" data-suggest role="listbox" hidden></div>
          <div class="field-error" data-err="phone"></div>
        </div>
        <div data-phone2></div>
        <div data-details></div>
      </div>`,
    footer: `
      <button type="button" class="btn btn-primary btn-lg" data-save>${icon('check')}حفظ</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>`,
  });
  const $ = (sel) => m.el.querySelector(sel);
  const phoneInput = $('#no-phone');

  /* ---------- Rendering ---------- */
  function renderPhone2() {
    $('[data-phone2]').innerHTML = st.showPhone2 ? `
      <div class="field">
        <label for="no-phone2">رقم إضافي</label>
        <div class="input-row">
          <input id="no-phone2" class="input ltr" name="phone2" type="tel" inputmode="tel" autocomplete="off"
            placeholder="01xxxxxxxxx" value="${esc(st.phone2)}">
          <button type="button" class="btn btn-ghost btn-icon" data-remove-phone2 aria-label="إزالة الرقم الإضافي">${icon('x')}</button>
        </div>
        <div class="field-error" data-err="phone2"></div>
      </div>`
      : `<button type="button" class="link-btn" data-add-phone2>${icon('plus')}إضافة رقم إضافي</button>`;
  }

  function addressCards() {
    if (!st.addresses.length) {
      return `<div class="addr-empty">${icon('pin')}<span>لا توجد عناوين محفوظة — اضغط «إضافة عنوان جديد».</span></div>`;
    }
    return st.addresses.map((a) => {
      const area = areaOf(a.areaId);
      const off = area && !area.active;
      return `
        <label class="addr-card ${off ? 'is-off' : ''}">
          <input type="radio" name="addr" value="${esc(a.id)}" ${a.id === st.addressId ? 'checked' : ''} ${off ? 'disabled' : ''}>
          <div class="grow">
            <div class="t">${esc(a.label || 'عنوان')}
              ${a.isNew ? '<span class="tag tag-info">جديد</span>' : ''}${a.edited ? '<span class="tag tag-info">معدّل</span>' : ''}
              ${area ? `<span class="fee-chip">${esc(area.name)} · ${formatMoney(area.fee)}</span>` : '<span class="tag tag-danger">منطقة غير معروفة</span>'}
              ${off ? '<span class="tag tag-danger">المنطقة موقوفة</span>' : ''}</div>
            <div class="addr-text">${esc(formatAddress(a))}</div>
            ${a.landmark ? `<div class="addr-extra">${esc(a.landmark)}</div>` : ''}
            ${a.notes ? `<div class="addr-extra">${esc(a.notes)}</div>` : ''}
          </div>
          <button type="button" class="btn btn-soft btn-icon edit-addr" data-edit-addr="${esc(a.id)}" aria-label="تعديل العنوان">${icon('edit')}</button>
        </label>`;
    }).join('');
  }

  function renderDetails() {
    const box = $('[data-details]');
    if (st.status === 'idle') {
      box.innerHTML = `<p class="hint">اكتب رقم الموبايل — بعد أول 3 أرقام سيظهر العملاء المسجلون، اختر منهم أو أكمل الرقم لعميل جديد.</p>`;
      return;
    }
    if (st.status === 'searching') { box.innerHTML = '<p class="hint">جارٍ البحث…</p>'; return; }
    if (st.status === 'choose') {
      box.innerHTML = `
        <div class="alert alert-warn">${icon('alert')}<span>هذا الرقم مسجل لدى ${st.matches.length} عملاء. تأكد من الاسم والعنوان مع العميل واختر الصحيح.</span></div>
        <div class="results">${st.matches.map((c) => {
          const main = normalizePhone(c.phones[0]) === normalizePhone(st.phone);
          return `
          <button type="button" class="result-card" data-cid="${esc(c.id)}">
            <div class="avatar">${esc(c.name.charAt(0))}</div>
            <div class="grow">
              <div class="cust-name">${esc(c.name)} <span class="tag ${main ? 'tag-green' : 'tag-warn'}">${main ? 'الرقم الأساسي' : 'رقم إضافي'}</span></div>
              <div class="meta"><span class="ltr-inline">${c.phones.map(esc).join(' / ')}</span>
                <span>${c.addresses.length} ${c.addresses.length === 1 ? 'عنوان' : 'عناوين'}</span></div>
            </div>
            <span class="chev">${icon('chevronLeft')}</span>
          </button>`;
        }).join('')}</div>`;
      return;
    }

    const existing = st.status === 'found';
    box.innerHTML = `
      ${existing && st.matches.length > 1 ? `<button type="button" class="link-btn" data-rechoose>${icon('arrowRight')}اختيار عميل آخر بنفس الرقم</button>` : ''}
      <div class="field">
        <div class="label-row">
          <label for="no-name">اسم العميل${existing ? '' : '<span class="req">*</span>'}</label>
          ${existing ? `<button type="button" class="link-btn" data-recent>${icon('list')}عرض الطلبات الأخيرة</button>` : ''}
        </div>
        <div class="input-row">
          <input id="no-name" class="input" name="name" value="${esc(st.name)}" maxlength="${CUSTOMER_NAME_MAX}" autocomplete="off"
            ${existing ? 'readonly' : 'placeholder="اسم العميل"'}>
          <span class="tag ${existing ? 'tag-green' : 'tag-info'}">${existing ? 'عميل مسجل' : 'عميل جديد'}</span>
        </div>
        <div class="field-error" data-err="name"></div>
      </div>
      ${todayWarning(st.todayOrders)}

      <div class="field">
        <label>نوع الطلب</label>
        <div class="fixed-value">${icon('package')}توصيل <span class="muted">· الدفع كاش عند الاستلام</span></div>
      </div>

      <div class="field">
        <div class="label-row">
          <label>العنوان<span class="req">*</span></label>
          <button type="button" class="link-btn" data-add-addr>${icon('plus')}إضافة عنوان جديد</button>
        </div>
        <div class="addr-cards">${addressCards()}</div>
        <div class="field-error" data-err="address"></div>
      </div>`;
  }

  const render = () => { renderPhone2(); renderDetails(); };

  /* ---------- Suggestions while typing (CONFIRMED): from 3 digits, «الاسم (الرقم)» in one line ---------- */
  const suggestBox = $('[data-suggest]');
  let suggestions = [];
  let active = -1;
  let suggestSeq = 0;
  const shownPhone = (c, q) => c.phones.find((ph) => normalizePhone(ph).startsWith(q)) ?? c.phones[0];
  function hideSuggest() { suggestBox.hidden = true; suggestions = []; active = -1; }
  function paintSuggest(q) {
    if (!suggestions.length) { hideSuggest(); return; }
    suggestBox.innerHTML = suggestions.map((c, i) => `
      <button type="button" class="suggest-row ${i === active ? 'is-active' : ''}" role="option" data-sug="${i}" tabindex="-1">
        <strong>${esc(c.name)}</strong> <span class="ltr-inline">(${esc(shownPhone(c, q))})</span></button>`).join('');
    suggestBox.hidden = false;
  }
  async function suggest() {
    const q = normalizePhone(st.phone);
    if (q.length < 3 || isValidPhone(q)) { hideSuggest(); return; }   // full number → the exact lookup takes over
    const seq = ++suggestSeq;
    const list = await ds.suggestCustomersByPhone(q).catch(() => []);
    if (seq !== suggestSeq) return;
    suggestions = list; active = -1;
    paintSuggest(q);
  }
  async function pickSuggestion(i) {
    const c = suggestions[i];
    if (!c) return;
    const q = normalizePhone(st.phone);
    st.phone = normalizePhone(shownPhone(c, q));
    phoneInput.value = st.phone;
    hideSuggest();
    clearTimeout(timer);
    ++lookupSeq; ++suggestSeq;
    st.matches = [c];
    await choose(c);
  }
  suggestBox.addEventListener('mousedown', (e) => e.preventDefault());   // keep the focus in the phone field
  suggestBox.addEventListener('click', (e) => { const b = e.target.closest('[data-sug]'); if (b) pickSuggestion(Number(b.dataset.sug)); });
  phoneInput.addEventListener('blur', () => setTimeout(hideSuggest, 150));

  /* ---------- Lookup ---------- */
  let lookupSeq = 0;
  async function lookup() {
    const norm = normalizePhone(st.phone);
    if (!isValidPhone(norm)) {
      st.status = 'idle'; st.customer = null;
      renderDetails();
      return;
    }
    const seq = ++lookupSeq;
    st.status = 'searching'; renderDetails();
    const found = await ds.findCustomersByExactPhone(norm);
    if (seq !== lookupSeq) return;
    st.matches = found;
    if (found.length === 1) await choose(found[0]);
    else if (found.length > 1) { st.status = 'choose'; st.customer = null; renderDetails(); }
    else {
      st.status = 'new'; st.customer = null;
      if (!edit || !s0.customer?.isNew) { st.addresses = st.addresses.filter((a) => a.isNew); st.name = st.name || ''; }
      st.addressId = st.addresses.find((a) => a.id === st.addressId)?.id ?? st.addresses[0]?.id ?? null;
      st.todayOrders = [];
      renderDetails();
    }
  }

  async function choose(c, preferAddressId = null) {
    st.customer = c;
    st.status = 'found';
    st.name = c.name;
    const pending = st.addresses.filter((a) => a.isNew);
    st.addresses = [...c.addresses.map((a) => ({ ...a })), ...pending];
    const usable = st.addresses.filter((a) => areaOf(a.areaId)?.active);
    st.addressId = (preferAddressId && st.addresses.some((a) => a.id === preferAddressId))
      ? preferAddressId : usable[0]?.id ?? null;
    st.todayOrders = await todayOrdersFor(c.phones);
    renderDetails();
  }

  /* ---------- Save ---------- */
  function save() {
    const errors = {};
    const phone = normalizePhone(st.phone);
    const phone2 = st.showPhone2 && st.phone2.trim() ? normalizePhone(st.phone2) : '';
    if (!isValidPhone(phone)) errors.phone = 'رقم غير صحيح — مثال: 01012345678';
    if (phone2 && !isValidPhone(phone2)) errors.phone2 = 'الرقم الإضافي غير صحيح';
    if (phone2 && phone2 === phone) errors.phone2 = 'الرقم الإضافي مطابق للرقم الأساسي';
    if (st.status === 'choose') errors.phone = 'اختر العميل الصحيح من القائمة';
    if (st.status === 'new' && !st.name.trim()) errors.name = 'أدخل اسم العميل';
    const address = st.addresses.find((a) => a.id === st.addressId);
    if (st.status !== 'idle' && st.status !== 'choose' && !address) errors.address = 'اختر عنوانًا أو أضف عنوانًا جديدًا';

    m.el.querySelectorAll('[data-err]').forEach((el) => { el.textContent = errors[el.dataset.err] ?? ''; });
    if (Object.keys(errors).length) {
      const first = Object.keys(errors)[0];
      m.el.querySelector(`[name="${first}"]`)?.focus();
      return;
    }

    const existing = st.status === 'found';
    const customer = existing
      ? { id: st.customer.id, name: st.customer.name, phone, phone2, isNew: false, todayOrders: st.todayOrders }
      : { id: null, name: st.name.trim(), phone, phone2, isNew: true, todayOrders: st.todayOrders };
    const { id, isNew, edited, ...fields } = address;
    const addr = { ...fields, id: isNew ? null : id, isNew: !!isNew, edited: !!edited };
    setState({ customer, address: addr });
    m.close();
    if (location.hash !== '#/pos') location.hash = '#/pos';
    else document.getElementById('productSearch')?.focus();
  }

  /* ---------- Events ---------- */
  let timer;
  let suggestTimer;
  phoneInput.addEventListener('input', () => {
    st.phone = phoneInput.value;
    clearTimeout(timer);
    timer = setTimeout(lookup, 200);
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(suggest, 150);
  });
  phoneInput.addEventListener('keydown', (e) => {
    if (!suggestBox.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
      paintSuggest(normalizePhone(st.phone));
      return;
    }
    if (e.key === 'Escape' && !suggestBox.hidden) { e.preventDefault(); e.stopPropagation(); hideSuggest(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!suggestBox.hidden && active >= 0) { pickSuggestion(active); return; }
      clearTimeout(timer); lookup();
    }
  });

  m.el.addEventListener('input', (e) => {
    if (e.target.name === 'phone2') st.phone2 = e.target.value;
    if (e.target.name === 'name' && st.status === 'new') st.name = e.target.value;
  });
  m.el.addEventListener('change', (e) => { if (e.target.name === 'addr') st.addressId = e.target.value; });

  on(m.el, 'click', '[data-add-phone2]', () => { st.showPhone2 = true; renderPhone2(); $('#no-phone2')?.focus(); });
  on(m.el, 'click', '[data-remove-phone2]', () => { st.showPhone2 = false; st.phone2 = ''; renderPhone2(); });
  on(m.el, 'click', '[data-cid]', (e, b) => choose(st.matches.find((c) => c.id === b.dataset.cid)));
  on(m.el, 'click', '[data-rechoose]', () => { st.status = 'choose'; st.customer = null; renderDetails(); });
  on(m.el, 'click', '[data-recent]', () => st.customer && openRecentOrders(st.customer, m));
  on(m.el, 'click', '[data-add-addr]', () => openAddressDialog({
    onSave: (a) => {
      const id = `tmp-${++tempSeq}`;
      st.addresses.push({ ...a, id, isNew: true });
      st.addressId = id;
      renderDetails();
    },
  }));
  on(m.el, 'click', '[data-edit-addr]', (e, b) => {
    e.preventDefault();
    const current = st.addresses.find((a) => a.id === b.dataset.editAddr);
    openAddressDialog({
      address: current,
      onSave: (a) => {
        Object.assign(current, a, current.isNew ? {} : { edited: true });
        st.addressId = current.id;
        renderDetails();
      },
    });
  });
  clearErrorsOnEdit(m.body);
  m.foot.querySelector('[data-save]').addEventListener('click', save);

  /* ---------- Start (prefill when changing the current draft) ---------- */
  render();
  if (edit && s0.customer) {
    st.phone = s0.customer.phone;
    phoneInput.value = st.phone;
    if (s0.customer.phone2) { st.showPhone2 = true; st.phone2 = s0.customer.phone2; renderPhone2(); }
    if (s0.customer.isNew) {
      st.name = s0.customer.name;
      if (s0.address) st.addresses = [{ ...s0.address, id: `tmp-${++tempSeq}`, isNew: true }];
      st.addressId = st.addresses[0]?.id ?? null;
      st.status = 'new';
      renderDetails();
    } else {
      ds.findCustomersByExactPhone(st.phone).then(async (found) => {
        st.matches = found;
        const c = found.find((x) => x.id === s0.customer.id);
        if (c) {
          await choose(c, s0.address?.id);
          const cur = st.addresses.find((a) => a.id === s0.address?.id);
          if (cur && s0.address.edited) Object.assign(cur, s0.address, { edited: true });
          renderDetails();
        } else lookup();
      });
    }
  }
  if (phone && !edit) {            // opened from a customer's page: their number is filled in
    phoneInput.value = phone;
    st.phone = phone;
    lookup();
  }
  phoneInput.focus();
}

/* "عرض الطلبات الأخيرة" — the customer's latest orders. */
async function openRecentOrders(customer, parent) {
  const list = await ds.listCustomerOrders(customer.id, 5);
  const m = openModal({
    title: `${icon('list')} آخر طلبات ${esc(customer.name)}`,
    size: 'sm',
    body: list.length ? `<div class="recent-list">${list.map((o) => {
      const t = computeTotals(o.items, o.deliveryFee);
      return `
        <a class="recent-row" href="#/orders/${encodeURIComponent(o.id)}" data-go>
          <div><strong class="ltr-inline">${esc(o.number)}</strong> ${statusChip(o.status)}
            <div class="addr-extra">${formatDateTime(o.createdAt)} · ${o.items.length} أصناف · ${esc(o.address.areaName)}</div></div>
          <strong>${money(t.total)}</strong>
        </a>`;
    }).join('')}</div>` : '<p class="muted">لا توجد طلبات سابقة لهذا العميل.</p>',
    footer: '<button type="button" class="btn btn-secondary" data-close>رجوع</button>',
  });
  on(m.el, 'click', '[data-go]', () => { m.close(); parent.close(); });
}
