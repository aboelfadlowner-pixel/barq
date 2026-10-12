/* Address fields — same layout as the Foodics "إنشاء العنوان" form:
   name, delivery area, street, housing type, extra information. */
import { catalog } from '../catalog.js';
import { esc } from '../utils/dom.js';
import { formatMoney } from '../utils/format.js';
import { ADDRESS_LIMITS, HOUSING_TYPES } from '../constants.js';

/* Area is required for the delivery fee; street for the driver. */
const REQUIRED = {
  label: 'اكتب اسم للعنوان (مثال: البيت، الشغل)',
  areaId: 'اختر منطقة التوصيل',
  street: 'اكتب اسم الشارع',
};

export function addressFormHtml(v = {}) {
  const areas = catalog.areas.map((a) => `
    <option value="${esc(a.id)}" ${a.id === v.areaId ? 'selected' : ''}>${esc(a.name)} — رسوم ${formatMoney(a.fee)}</option>`).join('');
  const housing = HOUSING_TYPES.map((h) => `
    <option value="${h.id}" ${h.id === (v.housingType ?? '') ? 'selected' : ''}>${esc(h.label)}</option>`).join('');
  return `
    <div class="stack-form" data-address-form>
      <div class="field">
        <label for="af-label">الاسم<span class="req">*</span></label>
        <input id="af-label" class="input" name="label" value="${esc(v.label ?? '')}" maxlength="${ADDRESS_LIMITS.label.max}"
          placeholder="مثال: البيت، الشغل، بيت الوالدة" autocomplete="off">
        <div class="field-error" data-err="label"></div>
      </div>
      <div class="field">
        <label for="af-areaId">منطقة التوصيل<span class="req">*</span></label>
        <select id="af-areaId" class="select" name="areaId">
          <option value="">اختر…</option>${areas}
        </select>
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
  const val = (n) => form.querySelector(`[name="${n}"]`).value.trim();
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
    const input = el.parentElement.querySelector('.input, .select, .textarea');
    input?.classList.toggle('invalid', !!msg);
  });
  const first = Object.keys(errors)[0];
  if (first) root.querySelector(`[name="${first}"]`)?.focus();
}
