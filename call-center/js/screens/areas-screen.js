/* Settings: delivery areas and fees, and the employee names list
   (add, rename, stop/resume). */
import * as ds from '../data/data-source.js';
import { catalog, reloadAreas, reloadAgents } from '../catalog.js';
import { getState } from '../store.js';
import { chooseAgent } from '../components/agent-select.js';
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
          <h1>المناطق والموظفين</h1>
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

      <h2 class="section-title">${icon('user')}كود التسجيل للأجهزة الجديدة</h2>
      <p class="muted section-sub">أي حد يعمل أكونت جديد من شاشة الدخول لازم يكتب الكود ده مرة واحدة عشان يدخل. ادّيه للموظفين بس، وغيّره لو اتسرّب — الأكونتات اللي دخلت قبل كده مش هتتأثر.</p>
      <form class="card card-pad add-area" data-signup-code novalidate>
        <div class="field grow">
          <label for="signupCode">كود جديد <span class="muted" data-code-status></span></label>
          <input id="signupCode" class="input ltr" name="code" minlength="8" maxlength="40" autocomplete="off" placeholder="8 حروف/أرقام على الأقل">
        </div>
        <button type="submit" class="btn btn-primary">${icon('check')}حفظ الكود</button>
        <div class="field-error" data-err="code"></div>
      </form>

      <h2 class="section-title">${icon('headset')}أسماء الموظفين</h2>
      <p class="muted section-sub">دي القايمة اللي الموظف بيختار منها اسمه أول ما يفتح البرنامج. الاسم الموقوف مش بيظهر في القايمة، والطلبات القديمة بتفضل باسمه.</p>
      <form class="card card-pad add-area" data-add-agent novalidate>
        <div class="field grow">
          <label for="newAgentName">اسم جديد</label>
          <input id="newAgentName" class="input" name="name" maxlength="40" autocomplete="off" placeholder="اسم الموظف زي ما هيظهر على الطلبات">
        </div>
        <button type="submit" class="btn btn-primary">${icon('plus')}إضافة</button>
        <div class="field-error" data-err="agent"></div>
      </form>
      <div class="card table-wrap">
        <table class="table areas-table">
          <thead><tr><th>الاسم</th><th>الحالة</th><th></th></tr></thead>
          <tbody data-agent-rows></tbody>
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

  const agentRows = view.querySelector('[data-agent-rows]');
  const renderAgents = () => {
    agentRows.innerHTML = catalog.allAgents.length ? catalog.allAgents.map((a) => `
      <tr data-agent-id="${esc(a.id)}" class="${a.active ? '' : 'row-off'}">
        <td><input class="input" name="agentName" maxlength="40" value="${esc(a.name)}" aria-label="اسم الموظف"></td>
        <td><label class="switch"><input type="checkbox" name="agentActive" ${a.active ? 'checked' : ''}>
          <span>${a.active ? 'نشط' : 'موقوف'}</span></label></td>
        <td><button type="button" class="btn btn-soft btn-sm" data-save-agent>${icon('check')}حفظ</button></td>
      </tr>`).join('') : '<tr><td colspan="3" class="table-empty">لسه مفيش أسماء</td></tr>';
  };
  renderAgents();

  const codeStatus = view.querySelector('[data-code-status]');
  const showCodeStatus = () => ds.getSignupCodeStatus()
    .then(({ isSet, updatedAt }) => {
      codeStatus.textContent = isSet
        ? `(فيه كود شغال${updatedAt ? ` من ${new Date(updatedAt).toLocaleDateString('ar-EG')}` : ''})`
        : '(لسه مفيش كود — محدش جديد هيقدر يدخل)';
    })
    .catch(() => { codeStatus.textContent = ''; });
  showCodeStatus();

  const offs = [
    on(view, 'submit', '[data-signup-code]', async (e, form) => {
      e.preventDefault();
      const err = form.querySelector('[data-err="code"]');
      const code = form.code.value.trim();
      if (code.length < 8) { err.textContent = 'الكود لازم يكون 8 حروف/أرقام على الأقل'; form.code.focus(); return; }
      try {
        await ds.setSignupCode(code);
        err.textContent = '';
        form.reset();
        showCodeStatus();
        showToast('تم حفظ كود التسجيل — ادّيه للموظفين الجداد');
      } catch (ex) { err.textContent = ex.message; }
    }),
    on(view, 'submit', '[data-add-agent]', async (e, form) => {
      e.preventDefault();
      const err = form.querySelector('[data-err="agent"]');
      const name = form.name.value.trim();
      if (!name) { err.textContent = 'اكتب الاسم'; form.name.focus(); return; }
      try {
        await ds.saveAgent({ name, active: true });
        err.textContent = '';
        await reloadAgents();
        form.reset();
        renderAgents();
        showToast(`تمت إضافة «${name}»`);
      } catch (ex) { err.textContent = ex.message; }
    }),
    on(view, 'change', 'input[name="agentActive"]', (e, box) => {
      box.nextElementSibling.textContent = box.checked ? 'نشط' : 'موقوف';
    }),
    on(view, 'click', '[data-save-agent]', async (e, btn) => {
      const tr = btn.closest('tr');
      const name = tr.querySelector('[name="agentName"]').value.trim();
      const active = tr.querySelector('[name="agentActive"]').checked;
      if (!name) { showToast('اكتب الاسم'); return; }
      try {
        const saved = await ds.saveAgent({ id: tr.dataset.agentId, name, active });
        await reloadAgents();
        renderAgents();
        // Keep the top bar right if the person working now was renamed or stopped.
        const cur = getState().agent;
        if (cur?.id === saved.id) chooseAgent(saved.active ? saved : null);
        showToast('تم حفظ التعديل');
      } catch (ex) { showToast(ex.message); }
    }),
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
