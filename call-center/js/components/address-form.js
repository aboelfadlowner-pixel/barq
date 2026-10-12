/* Delivery address form (used for new customers and new addresses). */
import { catalog } from '../catalog.js';
import { esc } from '../utils/dom.js';
import { formatMoney } from '../utils/format.js';

/* PROPOSED: required fields are area, street and building. */
const REQUIRED = { areaId: 'اختر منطقة التوصيل', street: 'اكتب اسم الشارع', building: 'اكتب رقم العمارة' };

const text = (name, label, value, { span = '', required = false, placeholder = '' } = {}) => `
  <div class="field ${span}">
    <label for="af-${name}">${label}${required ? '<span class="req">*</span>' : ''}</label>
    <input id="af-${name}" class="input" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">
    <div class="field-error" data-err="${name}"></div>
  </div>`;

export function addressFormHtml(v = {}) {
  const options = catalog.areas.map((a) => `
    <option value="${esc(a.id)}" ${a.id === v.areaId ? 'selected' : ''}>${esc(a.name)} — رسوم ${formatMoney(a.fee)}</option>`).join('');
  return `
    <div class="form-grid" data-address-form>
      <div class="field span-3">
        <label for="af-areaId">منطقة التوصيل<span class="req">*</span></label>
        <select id="af-areaId" class="select" name="areaId">
          <option value="">اختر المنطقة…</option>${options}
        </select>
        <div class="field-error" data-err="areaId"></div>
      </div>
      ${text('street', 'الشارع', v.street, { span: 'span-3', required: true, placeholder: 'اسم الشارع أو المنطقة السكنية' })}
      ${text('building', 'رقم العمارة', v.building, { required: true })}
      ${text('floor', 'الدور', v.floor)}
      ${text('apartment', 'الشقة', v.apartment)}
      ${text('landmark', 'علامة مميزة', v.landmark, { span: 'span-3', placeholder: 'مثال: بجوار صيدلية…' })}
      ${text('notes', 'ملاحظات للتوصيل', v.notes, { span: 'span-3' })}
    </div>`;
}

export function readAddressForm(root) {
  const form = root.querySelector('[data-address-form]');
  const val = (n) => form.querySelector(`[name="${n}"]`).value.trim();
  return {
    areaId: val('areaId'), street: val('street'), building: val('building'),
    floor: val('floor'), apartment: val('apartment'), landmark: val('landmark'), notes: val('notes'),
  };
}

export function validateAddress(values) {
  const errors = {};
  for (const [k, msg] of Object.entries(REQUIRED)) if (!values[k]) errors[k] = msg;
  return errors;
}

/* Paints errors onto any fields inside root that have data-err / name attributes. */
export function showErrors(root, errors) {
  root.querySelectorAll('[data-err]').forEach((el) => {
    const msg = errors[el.dataset.err] ?? '';
    el.textContent = msg;
    const input = el.parentElement.querySelector('.input, .select');
    input?.classList.toggle('invalid', !!msg);
  });
  const first = Object.keys(errors)[0];
  if (first) root.querySelector(`[name="${first}"]`)?.focus();
}
