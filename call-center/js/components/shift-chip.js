/* «بدء الشيفت» / «إنهاء الشيفت» — the call-center account punches in and out (47_attendance.sql).
   CONFIRMED: on the account itself (each employee has his own); the time is the server's;
   working without punching in is allowed — the admin sees it on «الحضور».
   state.shift: undefined = not installed yet (hidden) · null = not started · { start } = working. */
import * as ds from '../data/data-source.js';
import { setState } from '../store.js';
import { formatTime } from '../utils/format.js';
import { esc, on } from '../utils/dom.js';
import { confirmDialog, showToast } from './modal.js';

export async function loadMyShift() {
  try { setState({ shift: await ds.myShift() }); } catch { setState({ shift: undefined }); }
}

const mins = (from) => Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / 60000));
export const hoursText = (m) => (m == null ? '—' : `${Math.floor(m / 60)} س ${m % 60} د`);

export function shiftChipHtml(shift) {
  if (shift === undefined) return '';
  if (!shift) {
    return `<button type="button" class="btn btn-sm shift-btn shift-start" data-shift-start title="سجّل بداية شغلك النهارده">▶ بدء الشيفت</button>`;
  }
  return `<span class="shift-on" title="بدأت الشيفت ${esc(formatTime(shift.start))}"><span class="shift-dot"></span>شغال من ${esc(formatTime(shift.start))}</span>
    <button type="button" class="btn btn-ghost btn-sm shift-btn" data-shift-end title="سجّل نهاية شغلك">⏹ إنهاء</button>`;
}

export function mountShiftChip(el) {
  on(el, 'click', '[data-shift-start]', async (e, b) => {
    b.disabled = true;
    try { const s = await ds.startShift(); setState({ shift: s }); showToast(`بدأت الشيفت ${formatTime(s.start)} ✓`); }
    catch (err) { b.disabled = false; showToast(err.message); }
  });
  on(el, 'click', '[data-shift-end]', async () => {
    const cur = (await ds.myShift().catch(() => null));
    if (!(await confirmDialog({
      title: 'إنهاء الشيفت',
      message: cur ? `بدأت ${formatTime(cur.start)} — بقالك ${hoursText(mins(cur.start))}. متأكد إنك خلصت شغل النهارده؟` : 'متأكد إنك خلصت شغل النهارده؟',
      confirmLabel: 'إنهاء الشيفت',
    }))) return;
    try { const s = await ds.endShift(); setState({ shift: null }); showToast(`انتهى الشيفت ${formatTime(s.end)} ✓`); }
    catch (err) { showToast(err.message); }
  });
}
