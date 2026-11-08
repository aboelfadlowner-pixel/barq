/* Settings (admin): «أرقام الاتصال للطيارين» — 30_driver_chat.sql.
   CONFIRMED: the numbers a driver can call from his screen («📞 اتصل»): e.g. «الكول سنتر»
   and a person's own number — the driver picks whom to call. Add as many as needed;
   «موقوف» hides a number from the drivers (nothing is deleted). */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { icon } from './icons.js';
import { showToast } from './modal.js';

export function mountContactsSettings(el) {
  el.innerHTML = `
    <div data-contacts-section hidden>
    <h3 class="section-title sm">${icon('phone')}أرقام الاتصال للطيارين</h3>
    <p class="muted section-sub">الأرقام دي بتظهر للطيار في زرار «📞 اتصل» — يدوس على أي واحد والموبايل يتصل بيه على طول. ضيفي رقم الكول سنتر وأي رقم تاني.</p>
    <form class="card card-pad add-area" data-add-contact novalidate>
      <div class="field grow">
        <label for="newContactLabel">الاسم اللي هيظهر للطيار</label>
        <input id="newContactLabel" class="input" name="label" maxlength="40" autocomplete="off" placeholder="مثال: الكول سنتر / أ. حسن">
      </div>
      <div class="field grow">
        <label for="newContactPhone">الرقم</label>
        <input id="newContactPhone" class="input ltr" name="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="01xxxxxxxxx">
      </div>
      <button type="submit" class="btn btn-primary">${icon('plus')}إضافة</button>
      <div class="field-error" data-err="contact"></div>
    </form>
    <div class="card table-wrap">
      <table class="table areas-table">
        <thead><tr><th>الاسم</th><th>الرقم</th><th>الحالة</th><th></th></tr></thead>
        <tbody data-contact-rows></tbody>
      </table>
    </div>
    </div>`;
  const section = el.querySelector('[data-contacts-section]');
  const rows = el.querySelector('[data-contact-rows]');
  let list = [];

  const render = () => {
    rows.innerHTML = list.length ? list.map((c) => `
      <tr data-contact-id="${esc(c.id)}" class="${c.active ? '' : 'row-off'}">
        <td><input class="input" name="contactLabel" maxlength="40" value="${esc(c.label)}" aria-label="الاسم"></td>
        <td><input class="input ltr" name="contactPhone" type="tel" inputmode="tel" value="${esc(c.phone)}" aria-label="الرقم"></td>
        <td><label class="switch"><input type="checkbox" name="contactActive" ${c.active ? 'checked' : ''}><span>${c.active ? 'ظاهر' : 'موقوف'}</span></label></td>
        <td><button type="button" class="btn btn-soft btn-sm" data-save-contact>${icon('check')}حفظ</button></td>
      </tr>`).join('') : '<tr><td colspan="4" class="table-empty">لسه مفيش أرقام — ضيفي رقم الكول سنتر</td></tr>';
  };
  const load = async () => {
    const on_ = await ds.chatUnread().catch(() => null);   // hidden until 30_driver_chat.sql is applied
    section.hidden = !on_;
    if (!on_) return;
    list = await ds.contactNumbers().catch(() => []);
    render();
  };
  load();

  const offs = [
    on(el, 'submit', '[data-add-contact]', async (e, form) => {
      e.preventDefault();
      const err = form.querySelector('[data-err="contact"]');
      err.textContent = '';
      try {
        await ds.saveContactNumber({ label: form.label.value, phone: form.phone.value, active: true, sort: list.length + 1 });
        form.reset();
        showToast('اتضاف الرقم ✓');
        await load();
      } catch (ex) { err.textContent = ex.message; }
    }),
    on(el, 'click', '[data-save-contact]', async (e, btn) => {
      const tr = btn.closest('[data-contact-id]');
      const c = list.find((x) => x.id === tr.dataset.contactId);
      btn.disabled = true;
      try {
        await ds.saveContactNumber({ id: c.id, label: tr.querySelector('[name="contactLabel"]').value,
          phone: tr.querySelector('[name="contactPhone"]').value, active: tr.querySelector('[name="contactActive"]').checked, sort: c.sort });
        showToast('اتحفظ ✓');
        await load();
      } catch (ex) { showToast(ex.message); btn.disabled = false; }
    }),
  ];
  return () => offs.forEach((f) => f());
}
