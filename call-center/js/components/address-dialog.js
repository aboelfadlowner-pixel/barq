/* "إنشاء العنوان" / "تعديل العنوان" dialog. Calls onSave(address) and closes. */
import { icon } from './icons.js';
import { openModal } from './modal.js';
import { addressFormHtml, readAddressForm, validateAddress, showErrors, clearErrorsOnEdit } from './address-form.js';

export function openAddressDialog({ address = null, onSave }) {
  const m = openModal({
    title: `${icon('pin')} ${address ? 'تعديل العنوان' : 'إنشاء العنوان'}`,
    size: 'md',
    body: addressFormHtml(address ?? {}),
    footer: `
      <button type="button" class="btn btn-primary btn-lg" data-save>${icon('check')}حفظ</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>`,
  });
  const save = () => {
    const values = readAddressForm(m.body);
    const errors = validateAddress(values);
    showErrors(m.body, errors);
    if (Object.keys(errors).length) return;
    onSave({ ...(address ?? {}), ...values });
    m.close();
  };
  clearErrorsOnEdit(m.body);
  m.foot.querySelector('[data-save]').addEventListener('click', save);
  m.body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); }
  });
  m.body.querySelector('[name="label"]').focus();
}
