/* Settings (admin): «نسخة احتياطية» — CONFIRMED: one button downloads an Excel file with all the
   call-center data (orders and their lines, customers, addresses, areas, employees, accounts,
   blocked numbers, deliveries), one sheet each. Read only; login secrets are never included
   (22_order_log_backup.sql). Without the Excel library (no internet to it) the same data is
   saved as a .json file.
   CONFIRMED: the nightly job (cc-daily, 23_daily_backup.sql) also keeps a copy of every day for
   30 days; they are listed here and any day downloads as Excel the same way. */
import * as ds from '../data/data-source.js';
import { icon } from './icons.js';
import { showToast } from './modal.js';

const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const SHEETS = [
  ['orders', 'الطلبات'], ['order_items', 'أصناف الطلبات'], ['order_events', 'سجل الحالات'],
  ['customers', 'العملاء'], ['addresses', 'العناوين'], ['areas', 'المناطق'], ['agents', 'أسماء الموظفين'],
  ['staff', 'الحسابات'], ['blocked_phones', 'المحظورين'], ['deliveries', 'التوصيل'],
];

let lib = null;
const loadXlsx = () => {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  lib ??= new Promise((done, fail) => {
    const js = document.createElement('script');
    js.src = XLSX_URL;
    js.onload = () => done(window.XLSX);
    js.onerror = () => { lib = null; fail(new Error('xlsx')); };
    document.head.append(js);
  });
  return lib;
};

const save = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};

// nested values (add-ons, edit lists…) go in one cell as text
const flat = (rows) => (rows || []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) =>
  [k, v != null && typeof v === 'object' ? JSON.stringify(v) : v])));

/* data → Excel file (or .json when the Excel library cannot load) */
async function saveBackup(data, label) {
  try {
    const X = await loadXlsx();
    const wb = X.utils.book_new();
    SHEETS.forEach(([key, title]) => {
      if (!data[key]) return;
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(flat(data[key])), title);
    });
    const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
    save(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `call-center-backup_${label}.xlsx`);
  } catch {
    save(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `call-center-backup_${label}.json`);
  }
}

export function mountBackupButton(el) {
  el.innerHTML = `
    <h2 class="section-title">${icon('copy')}نسخة احتياطية</h2>
    <p class="muted section-sub">ملف Excel فيه كل داتا الكول سنتر (الطلبات وأصنافها، العملاء والعناوين، المناطق، الموظفين، المحظورين، التوصيل).
      احفظيه على جهازك أو Google Drive — مرة في الأسبوع مثلًا، وقبل أي تعديل كبير.</p>
    <div class="card card-pad add-area">
      <button type="button" class="btn btn-primary" data-backup>${icon('copy')}تنزيل نسخة احتياطية</button>
      <span class="muted" data-backup-status></span>
    </div>
    <h3 class="section-title sm">${icon('clock')}النسخ اليومية التلقائية (آخر 30 يوم)</h3>
    <div class="card table-wrap"><table class="table">
      <thead><tr><th>اليوم</th><th class="col-opt">الحجم</th><th></th></tr></thead>
      <tbody data-backup-days><tr><td colspan="3" class="table-empty">جارٍ التحميل…</td></tr></tbody>
    </table></div>`;
  const btn = el.querySelector('[data-backup]');
  const status = el.querySelector('[data-backup-status]');
  const onClick = async () => {
    btn.disabled = true;
    status.textContent = 'جارٍ تجهيز الملف…';
    try {
      const data = await ds.backupExport();
      const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
      await saveBackup(data, stamp);
      const n = (data.orders || []).length;
      status.textContent = `تم — ${n} طلب، ${(data.customers || []).length} عميل`;
      showToast('اتنزّلت النسخة الاحتياطية — احفظيها في مكان آمن');
    } catch (err) {
      status.textContent = '';
      showToast(err.message);
    }
    btn.disabled = false;
  };
  btn.addEventListener('click', onClick);

  // the nightly copies
  const days = el.querySelector('[data-backup-days]');
  const kb = (n) => (n == null ? '—' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  ds.listBackups().then((list) => {
    days.innerHTML = list.length ? list.map((b) => `
      <tr><td class="num">${b.day}</td><td class="col-opt num">${kb(b.size)}</td>
        <td><button type="button" class="btn btn-soft btn-sm" data-backup-day="${b.name}">${icon('copy')}تنزيل Excel</button></td></tr>`).join('')
      : '<tr><td colspan="3" class="table-empty">لسه مفيش نسخ يومية — بتبدأ أول ما المعاد اليومي يتظبط في Supabase</td></tr>';
  }).catch(() => { days.innerHTML = '<tr><td colspan="3" class="table-empty">تعذر تحميل القائمة</td></tr>'; });
  const onDay = async (e) => {
    const b = e.target.closest('[data-backup-day]');
    if (!b) return;
    b.disabled = true;
    try { await saveBackup(await ds.getBackup(b.dataset.backupDay), b.dataset.backupDay.replace('.json', '')); showToast('اتنزّلت النسخة'); }
    catch (err) { showToast(err.message); }
    b.disabled = false;
  };
  days.addEventListener('click', onDay);
  return () => { btn.removeEventListener('click', onClick); days.removeEventListener('click', onDay); };
}
