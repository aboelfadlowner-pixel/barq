/* Address fields — same layout as the Foodics "إنشاء العنوان" form:
   name, delivery area, street, housing type, extra information. */
import { catalog } from '../catalog.js';
import { esc } from '../utils/dom.js';
import { formatMoney, normalizeArabic } from '../utils/format.js';
import { icon } from './icons.js';
import { ADDRESS_LIMITS, HOUSING_TYPES } from '../constants.js';

/* Area is required for the delivery fee; street for the driver. */
const REQUIRED = {
  label: 'اكتب اسم للعنوان (مثال: البيطاش، الهانوفيل)',
  areaId: 'اختر منطقة التوصيل',
  street: 'اكتب اسم الشارع',
};

/* Delivery area picker with a search box (Foodics style). Active areas only,
   plus the address's current area if it was switched off since. */
const areaOptions = (selectedId) => catalog.areas.filter((a) => a.active !== false || a.id === selectedId);
const areaText = (a) => `${a.name} — رسوم ${formatMoney(a.fee)}`;

function areaPickerHtml(selectedId) {
  const sel = catalog.areas.find((a) => a.id === selectedId);
  return `
    <div class="combo" data-combo>
      <input type="hidden" name="areaId" value="${esc(sel?.id ?? '')}">
      <button type="button" id="af-areaId" class="select combo-btn ${sel ? '' : 'placeholder'}" aria-haspopup="listbox" aria-expanded="false">
        <span data-combo-label>${sel ? esc(areaText(sel)) : 'اختر'}</span></button>
      <div class="combo-pop" hidden>
        <input type="search" class="input combo-search" placeholder="ابدأ الكتابة للبحث" aria-label="بحث عن منطقة" autocomplete="off">
        <ul class="combo-list" role="listbox" aria-label="منطقة التوصيل">
          ${areaOptions(selectedId).map((a) => `
            <li role="option" data-value="${esc(a.id)}" data-search="${esc(normalizeArabic(a.name))}" aria-selected="${a.id === selectedId}">${esc(areaText(a))}</li>`).join('')}
          <li class="combo-empty" hidden>مفيش منطقة بالاسم ده</li>
        </ul>
      </div>
    </div>`;
}

/* Opens/closes the picker, filters as you type, keyboard: ↑ ↓ Enter Esc. */
export function initAreaPicker(root) {
  const box = root.querySelector('[data-combo]');
  if (!box) return;
  const btn = box.querySelector('.combo-btn');
  const pop = box.querySelector('.combo-pop');
  const search = box.querySelector('.combo-search');
  const hidden = box.querySelector('[name="areaId"]');
  const items = () => [...box.querySelectorAll('[data-value]')].filter((li) => !li.hidden);
  let active = -1;
  const highlight = (i) => {
    const list = items();
    active = list.length ? (i + list.length) % list.length : -1;
    list.forEach((li, n) => li.classList.toggle('active', n === active));
    list[active]?.scrollIntoView({ block: 'nearest' });
  };
  const open = () => {
    pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
    search.value = ''; filter(); search.focus();
    highlight(Math.max(0, items().findIndex((li) => li.dataset.value === hidden.value)));
  };
  const close = (focusBtn = true) => {
    pop.hidden = true; btn.setAttribute('aria-expanded', 'false');
    if (focusBtn) btn.focus();
  };
  const filter = () => {
    const q = normalizeArabic(search.value.trim());
    box.querySelectorAll('[data-value]').forEach((li) => { li.hidden = !!q && !li.dataset.search.includes(q); });
    box.querySelector('.combo-empty').hidden = items().length > 0;
    // Enter picks the best match: a name that starts with what was typed beats one that only contains it.
    highlight(Math.max(0, items().findIndex((li) => li.dataset.search.startsWith(q))));
  };
  const choose = (li) => {
    hidden.value = li.dataset.value;
    box.querySelector('[data-combo-label]').textContent = li.textContent.trim();
    btn.classList.remove('placeholder');
    box.querySelectorAll('[data-value]').forEach((x) => x.setAttribute('aria-selected', String(x === li)));
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };
  btn.addEventListener('click', () => (pop.hidden ? open() : close()));
  search.addEventListener('input', filter);
  box.addEventListener('click', (e) => { const li = e.target.closest('[data-value]'); if (li) choose(li); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const li = items()[active]; if (li) choose(li); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !box.contains(e.target)) close(false); });
}

export function addressFormHtml(v = {}) {
  const housing = HOUSING_TYPES.map((h) => `
    <option value="${h.id}" ${h.id === (v.housingType ?? '') ? 'selected' : ''}>${esc(h.label)}</option>`).join('');
  return `
    <div class="stack-form" data-address-form>
      <div class="field">
        <label for="af-label">الاسم<span class="req">*</span></label>
        <input id="af-label" class="input" name="label" value="${esc(v.label ?? '')}" maxlength="${ADDRESS_LIMITS.label.max}"
          autocomplete="off">
        <div class="field-error" data-err="label"></div>
      </div>
      <div class="field">
        <label for="af-areaId">منطقة التوصيل<span class="req">*</span></label>
        ${areaPickerHtml(v.areaId)}
        <div class="field-error" data-err="areaId"></div>
      </div>
      <div class="field">
        <label for="af-street">الشارع<span class="req">*</span></label>
        <input id="af-street" class="input" name="street" value="${esc(v.street ?? '')}" maxlength="${ADDRESS_LIMITS.street.max}"
          placeholder="اسم الشارع ورقم العمارة" autocomplete="off">
        <div class="field-error" data-err="street"></div>
      </div>
      <div class="field">
        <label for="af-housingType">نوع السكن</label>
        <select id="af-housingType" class="select" name="housingType">${housing}</select>
      </div>
      <div class="field">
        <label for="af-notes">معلومات إضافية</label>
        <textarea id="af-notes" class="textarea" name="notes" rows="3" maxlength="${ADDRESS_LIMITS.notes.max}"
          placeholder="الدور، الشقة، علامة مميزة…">${esc(v.notes ?? '')}</textarea>
        <div class="field-error" data-err="notes"></div>
      </div>
    </div>`;
}

export function readAddressForm(root) {
  const form = root.querySelector('[data-address-form]');
  const val = (n) => form.querySelector(`[name="${n}"]`).value.trim();   // areaId is the picker's hidden input
  return { label: val('label'), areaId: val('areaId'), street: val('street'), housingType: val('housingType'), notes: val('notes') };
}

export function validateAddress(values) {
  const errors = {};
  for (const [k, { max, label }] of Object.entries(ADDRESS_LIMITS)) {
    if ((values[k] ?? '').length > max) errors[k] = `${label} بحد أقصى ${max} حرف`;
  }
  for (const [k, msg] of Object.entries(REQUIRED)) if (!values[k]) errors[k] = msg;
  return errors;
}

/* Clears a field's error message as soon as the user edits that field. */
export function clearErrorsOnEdit(root) {
  const clear = (e) => {
    const field = e.target.closest('.field');
    if (!field) return;
    field.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
    field.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
  };
  root.addEventListener('input', clear);
  root.addEventListener('change', clear);
}

/* Paints errors onto any fields inside root that have data-err / name attributes. */
export function showErrors(root, errors) {
  root.querySelectorAll('[data-err]').forEach((el) => {
    const msg = errors[el.dataset.err] ?? '';
    el.textContent = msg;
    const input = el.parentElement.querySelector('.combo-btn, .input, .select, .textarea');
    input?.classList.toggle('invalid', !!msg);
  });
  const first = Object.keys(errors)[0];
  if (first) (root.querySelector(`[name="${first}"]:not([type=hidden])`) ?? root.querySelector(`#af-${first}`))?.focus();
}
