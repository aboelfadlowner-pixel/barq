/* Settings (admin): «الطيارين» — 18_driver_tracking.sql + the cc-drivers function.
   CONFIRMED: the admin adds each driver (name + mobile); every driver gets his OWN link with no
   password, and the admin sends it to him on WhatsApp. A new link stops the old one; stopping a
   driver ends his link. The branch place (set once) is what «رجعت الفرع» is measured from:
   farther than 300 m → «بعيد عن الفرع» in the admin's report. */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { formatRelative, toWesternDigits } from '../utils/format.js';
import { icon } from './icons.js';
import { openModal, showToast } from './modal.js';

/* His personal link: this same page + #d=<secret>. */
const driverLink = (token) => `${location.href.split('#')[0]}#d=${token}`;
const waNumber = (phone) => `2${String(phone).replace(/\D/g, '')}`;   // 01xxxxxxxxx → 201xxxxxxxxx
const waText = (name, link) => `أهلاً ${name} 👋\nده اللينك بتاعك لشغل التوصيل — افتحه من Chrome على موبايلك واحفظه (من غير باسورد).\nمتبعتوش لحد تاني:\n${link}`;

function showLink({ name, phone }, token) {
  const link = driverLink(token);
  const text = waText(name, link);
  const m = openModal({
    title: `${icon('check')} لينك ${esc(name)}`,
    size: 'sm',
    body: `
      <p>ابعتي اللينك ده لـ <strong>${esc(name)}</strong> بس — هو اللي بيدخله على شاشة الطيار من غير باسورد.</p>
      <input class="input ltr dl-link" readonly value="${esc(link)}" aria-label="اللينك">
      <p class="muted">اللينك بيظهر هنا مرة واحدة. لو ضاع أو اتبعت لحد غلط: «لينك جديد» — والقديم يقف.</p>`,
    footer: `
      <a class="btn btn-primary" data-wa href="https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${icon('whatsapp')}ابعتيه واتساب</a>
      <button type="button" class="btn btn-secondary" data-copy>${icon('copy')}نسخ الرسالة</button>
      <button type="button" class="btn btn-secondary" data-close>تم</button>`,
  });
  m.foot.querySelector('[data-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); showToast('اتنسخت — الصقيها في واتساب'); }
    catch { m.body.querySelector('.dl-link').select(); showToast('انسخي اللينك من الخانة'); }
  });
}

export function mountDriversSettings(el) {
  el.innerHTML = `
    <div data-drivers-section hidden>
    <h2 class="section-title">${icon('package')}الطيارين</h2>
    <p class="muted section-sub">ضيفي الطيار باسمه ورقمه، وابعتيله لينكه على واتساب — بيفتح شاشة الطيار على موبايله من غير باسورد.
      لو وقفتيه أو عملتيله لينك جديد، القديم مبيفتحش.</p>
    <form class="card card-pad add-area" data-add-driver novalidate>
      <div class="field grow">
        <label for="newDriverName">اسم الطيار</label>
        <input id="newDriverName" class="input" name="name" maxlength="40" autocomplete="off" placeholder="مثال: أحمد">
      </div>
      <div class="field grow">
        <label for="newDriverPhone">موبايله</label>
        <input id="newDriverPhone" class="input ltr" name="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="01xxxxxxxxx">
      </div>
      <button type="submit" class="btn btn-primary">${icon('plus')}إضافة</button>
      <div class="field-error" data-err="driver"></div>
    </form>
    <div class="card table-wrap">
      <table class="table areas-table drivers-table">
        <thead><tr><th>الطيار</th><th>الموبايل</th><th>الحالة</th><th></th></tr></thead>
        <tbody data-driver-rows></tbody>
      </table>
    </div>

    <h3 class="section-title sm">${icon('pin')}مكان الفرع</h3>
    <p class="muted section-sub">لما الطيار يدوس «رجعت الفرع» بنقارن مكانه بمكان الفرع — لو أبعد من <span class="num" data-radius>300</span> متر يظهرلك «بعيد عن الفرع».</p>
    <div class="card card-pad add-area branch-place">
      <div class="grow" data-branch-now></div>
      <button type="button" class="btn btn-secondary" data-branch-here>${icon('pin')}استخدمي مكاني الحالي</button>
      <form class="branch-paste" data-branch-paste novalidate>
        <input class="input ltr" name="coords" autocomplete="off" placeholder="أو الصقي الإحداثيات: 31.1234, 29.8123" aria-label="الإحداثيات">
        <button type="submit" class="btn btn-soft">حفظ</button>
      </form>
      <div class="field-error" data-err="branch"></div>
    </div>
    </div>`;

  const section = el.querySelector('[data-drivers-section]');
  const rows = el.querySelector('[data-driver-rows]');
  let drivers = [];

  const render = () => {
    rows.innerHTML = drivers.length ? drivers.map((d) => `
      <tr data-driver-id="${esc(d.userId)}" class="${d.active ? '' : 'row-off'}">
        <td><input class="input" name="driverName" maxlength="40" value="${esc(d.name)}" aria-label="اسم الطيار">
          <div class="muted dl-meta">${d.active ? (d.hasLink ? 'معاه لينك' : 'من غير لينك — اعمليله «لينك جديد»') : 'موقوف'}${d.lastOutAt ? ` · آخر خروج ${esc(formatRelative(d.lastOutAt))}` : ''}</div></td>
        <td><input class="input ltr" name="driverPhone" type="tel" inputmode="tel" value="${esc(d.phone)}" aria-label="موبايل الطيار"></td>
        <td><label class="switch"><input type="checkbox" name="driverActive" ${d.active ? 'checked' : ''}>
          <span>${d.active ? 'شغال' : 'موقوف'}</span></label></td>
        <td class="dl-actions"><button type="button" class="btn btn-soft btn-sm" data-save-driver>${icon('check')}حفظ</button>
          ${d.active ? `<button type="button" class="btn btn-secondary btn-sm" data-new-link>لينك جديد</button>` : ''}</td>
      </tr>`).join('') : '<tr><td colspan="4" class="table-empty">لسه مفيش طيارين — ضيفي أول طيار</td></tr>';
  };
  const load = () => ds.adminDrivers().then((list) => {
    section.hidden = !list;              // hidden until 18_driver_tracking.sql is applied
    drivers = list || [];
    render();
  }).catch(() => { section.hidden = true; });

  const branchNow = el.querySelector('[data-branch-now]');
  const branchErr = el.querySelector('[data-err="branch"]');
  const showBranch = () => ds.branchPlace().then((b) => {
    if (b?.radius) el.querySelector('[data-radius]').textContent = b.radius;
    branchNow.innerHTML = b?.lat != null
      ? `<strong>متسجل</strong> · <a href="https://www.google.com/maps?q=${b.lat},${b.lng}" target="_blank" rel="noopener" class="ltr-inline">${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}</a>`
      : '<strong class="text-danger">لسه مش متسجل</strong> — من غيره مش هنعرف الطيار رجع فين';
  }).catch(() => {});
  const saveBranch = async (lat, lng) => {
    try { await ds.setBranchPlace(lat, lng); branchErr.textContent = ''; showToast('اتسجل مكان الفرع'); showBranch(); return true; }
    catch (err) { branchErr.textContent = err.message; return false; }
  };

  load();
  showBranch();

  const offs = [
    on(el, 'submit', '[data-add-driver]', async (e, form) => {
      e.preventDefault();
      const err = form.querySelector('[data-err="driver"]');
      const name = form.name.value.trim();
      const phone = toWesternDigits(form.phone.value).trim();
      if (!name) { err.textContent = 'اكتبي اسم الطيار'; form.name.focus(); return; }
      if (!phone) { err.textContent = 'اكتبي موبايل الطيار'; form.phone.focus(); return; }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        const { token } = await ds.addDriver(name, phone);
        err.textContent = '';
        form.reset();
        await load();
        showLink({ name, phone }, token);
      } catch (ex) { err.textContent = ex.message; }
      btn.disabled = false;
    }),
    on(el, 'change', 'input[name="driverActive"]', (e, box) => {
      box.nextElementSibling.textContent = box.checked ? 'شغال' : 'موقوف';
    }),
    on(el, 'click', '[data-save-driver]', async (e, btn) => {
      const tr = btn.closest('tr');
      const d = drivers.find((x) => x.userId === tr.dataset.driverId);
      const active = tr.querySelector('[name="driverActive"]').checked;
      if (d.active && !active && !window.confirm(`إيقاف ${d.name}؟ لينكه هيقف ومش هيظهر في «اختيار الطيار».`)) return;
      try {
        await ds.updateDriver({ userId: d.userId, name: tr.querySelector('[name="driverName"]').value,
          phone: toWesternDigits(tr.querySelector('[name="driverPhone"]').value), active });
        await load();
        showToast(!active && d.active ? `اتوقف ${d.name} — لينكه وقف` : 'تم الحفظ');
      } catch (ex) { showToast(ex.message); }
    }),
    on(el, 'click', '[data-new-link]', async (e, btn) => {
      const d = drivers.find((x) => x.userId === btn.closest('tr').dataset.driverId);
      if (d.hasLink && !window.confirm(`لينك جديد لـ ${d.name}؟ اللينك القديم هيقف فورًا.`)) return;
      btn.disabled = true;
      try {
        const token = await ds.newDriverLink(d.userId);
        await load();
        showLink(d, token);
      } catch (ex) { showToast(ex.message); btn.disabled = false; }
    }),
    on(el, 'click', '[data-branch-here]', (e, btn) => {
      if (!navigator.geolocation) { branchErr.textContent = 'الجهاز ده مش بيدي المكان — الصقي الإحداثيات'; return; }
      btn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (p) => { btn.disabled = false; saveBranch(p.coords.latitude, p.coords.longitude); },
        () => { btn.disabled = false; branchErr.textContent = 'اسمحي للصفحة بالمكان، أو الصقي الإحداثيات من خرائط جوجل'; },
        { enableHighAccuracy: true, timeout: 15000 });
    }),
    on(el, 'submit', '[data-branch-paste]', (e, form) => {
      e.preventDefault();
      const nums = toWesternDigits(form.coords.value).match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
      if (nums.length < 2) { branchErr.textContent = 'الصقي الإحداثيات كده: 31.1234, 29.8123'; return; }
      saveBranch(nums[0], nums[1]).then((saved) => { if (saved) form.reset(); });
    }),
  ];
  return () => offs.forEach((f) => f());
}
