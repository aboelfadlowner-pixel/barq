/* For the admin (26_driver_devices.sql): «⚠️ لينك أحمد اتفتح من جهاز تاني» with the phone types.
   Nothing is blocked; «تمام، شفته» hides it, «لينك جديد» is in «الطيارين» (المناطق والموظفين). */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { formatRelative, formatTime } from '../utils/format.js';
import { icon } from './icons.js';
import { showToast } from './modal.js';

export function mountDeviceAlerts(el, { linkToDrivers = true } = {}) {
  let stopped = false;
  const render = (list) => {
    el.innerHTML = list.length ? `
      <div class="device-alerts">${list.map((a) => `
        <div class="alert alert-danger device-alert" data-alert-user="${esc(a.userId)}">
          ${icon('alert')}
          <div class="da-body">
            <strong>لينك ${esc(a.name)} اتفتح من جهاز تاني</strong>
            ${a.others.map((d) => `<div class="da-line">📱 <b>${esc(d.label || 'جهاز غير معروف')}</b> · أول مرة ${esc(formatTime(d.firstSeen))} (${esc(formatRelative(d.firstSeen))}) · آخر مرة ${esc(formatTime(d.lastSeen))}${d.opens > 1 ? ` · ${d.opens} مرات` : ''}</div>`).join('')}
            <div class="da-line muted">الجهاز الأساسي: ${esc(a.main.label || 'غير معروف')}</div>
            <div class="da-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-alert-seen="${esc(a.userId)}">${icon('check')}تمام، شفته</button>
              ${linkToDrivers ? `<a class="btn btn-soft btn-sm" href="#/areas">لينك جديد من «الطيارين»</a>` : '<span class="muted">لو مش هو: اعمليله «لينك جديد» من هنا تحت والقديم يقف</span>'}
            </div>
          </div>
        </div>`).join('')}</div>` : '';
  };
  const load = () => ds.driverDeviceAlerts().then((list) => { if (!stopped) render(list || []); }).catch(() => {});
  load();
  const timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
  const off = on(el, 'click', '[data-alert-seen]', async (e, btn) => {
    btn.disabled = true;
    try { await ds.driverDeviceSeen(btn.dataset.alertSeen); showToast('تمام — اتشال التنبيه'); load(); }
    catch (err) { showToast(err.message); btn.disabled = false; }
  });
  return () => { stopped = true; clearInterval(timer); off(); };
}
