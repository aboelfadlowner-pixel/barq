/* Supervisor: delivery areas and fees (add, rename, change fee, stop/resume). */
import * as ds from '../data/data-source.js';
import { catalog, reloadAreas } from '../catalog.js';
import { esc, on } from '../utils/dom.js';
import { toWesternDigits } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { showToast } from '../components/modal.js';

const parseFee = (v) => {
  const n = parseFloat(toWesternDigits(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

export function mountAreas(view) {
  view.innerHTML = `
    <div class="page"><div class="page-inner page-narrow">
      <div class="page-head">
        <div>
          <h1>مناطق التوصيل والرسوم</h1>
          <div class="page-sub"><span>المناطق النشطة بس هي اللي بتظهر للموظف عند إضافة عنوان.</span>
            <span class="demo-pill">${icon('info')}بيانات تجريبية</span></div>
        </div>
      </div>

      <form class="card card-pad add-area" data-add novalidate>
        <div class="field grow">
          <label for="newAreaName">منطقة جديدة</label>
          <input id="newAreaName" class="input" name="name" autocomplete="off" placeholder="اسم المنطقة">
        </div>
        <div class="field fee-field">
          <label for="newAreaFee">الرسوم (ج.م)</label>
          <input id="newAreaFee" class="input ltr-center" name="fee" inputmode="decimal" autocomplete="off" placeholder="0">
        </div>
        <button type="submit" class="btn btn-primary">${icon('plus')}إضافة</button>
        <div class="field-error" data-err="add"></div>
      </form>

      <div class="card table-wrap">
        <table class="table areas-table">
          <thead><tr><th>المنطقة</th><th>الرسوم (ج.م)</th><th>الحالة</th><th></th></tr></thead>
          <tbody data-rows></tbody>
        </table>
      </div>
    </div></div>`;

  const rows = view.querySelector('[data-rows]');
  const render = () => {
    rows.innerHTML = catalog.allAreas.map((a) => `
      <tr data-id="${esc(a.id)}" class="${a.active ? '' : 'row-off'}">
        <td><input class="input" name="name" value="${esc(a.name)}" aria-label="اسم المنطقة"></td>
        <td class="fee-cell"><input class="input ltr-center" name="fee" inputmode="decimal" value="${a.fee}" aria-label="الرسوم"></td>
        <td><label class="switch"><input type="checkbox" name="active" ${a.active ? 'checked' : ''}>
          <span>${a.active ? 'نشطة' : 'موقوفة'}</span></label></td>
        <td><button type="button" class="btn btn-soft btn-sm" data-save>${icon('check')}حفظ</button></td>
      </tr>`).join('');
  };
  render();

  const offs = [
    on(view, 'submit', '[data-add]', async (e, form) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const fee = parseFee(form.fee.value);
      const err = form.querySelector('[data-err="add"]');
      if (!name) { err.textContent = 'اكتب اسم المنطقة'; form.name.focus(); return; }
      if (Number.isNaN(fee)) { err.textContent = 'اكتب الرسوم بالأرقام'; form.fee.focus(); return; }
      if (catalog.allAreas.some((a) => a.name === name)) { err.textContent = 'المنطقة دي موجودة بالفعل'; return; }
      err.textContent = '';
      await ds.saveArea({ name, fee, active: true });
      await reloadAreas();
      form.reset();
      render();
      showToast(`تمت إضافة «${name}»`);
    }),
    on(view, 'change', 'input[name="active"]', (e, box) => {
      box.nextElementSibling.textContent = box.checked ? 'نشطة' : 'موقوفة';
    }),
    on(view, 'click', '[data-save]', async (e, btn) => {
      const tr = btn.closest('tr');
      const name = tr.querySelector('[name="name"]').value.trim();
      const fee = parseFee(tr.querySelector('[name="fee"]').value);
      if (!name || Number.isNaN(fee)) { showToast('اكتب اسم المنطقة والرسوم بالأرقام'); return; }
      await ds.saveArea({ id: tr.dataset.id, name, fee, active: tr.querySelector('[name="active"]').checked });
      await reloadAreas();
      render();
      showToast('تم حفظ التعديل');
    }),
  ];
  view.querySelector('#newAreaName').focus();
  return () => offs.forEach((f) => f());
}
