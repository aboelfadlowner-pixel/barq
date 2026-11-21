/* «الحضور» — admin only (47_attendance.sql). The call center's punch in / out:
   who is working now, and every shift of the period (in, out, hours, orders), with
   «مقفلش» (closed by itself at the end of the working day, 2 AM) and «من غير بصمة»
   (orders made without punching in). Days are working days (2 AM → 2 AM). */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { dayLabel, formatTime, shiftIso, workDayIso } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { hoursText } from '../components/shift-chip.js';

const PERIODS = [
  { id: 'today', label: 'النهارده' },
  { id: 'yesterday', label: 'إمبارح' },
  { id: 'week', label: 'آخر 7 أيام' },
  { id: 'month', label: 'آخر 30 يوم' },
];
const state = { period: 'today' };

function range() {
  const today = workDayIso();
  const back = (n) => shiftIso(today, n);
  if (state.period === 'yesterday') return [back(1), back(1)];
  if (state.period === 'week') return [back(6), today];
  if (state.period === 'month') return [back(29), today];
  return [today, today];
}
const sinceMins = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
const dayText = (day) => dayLabel(`${day}T12:00:00+02:00`);

function nowCards(list) {
  if (!list.length) return '<p class="muted">مفيش موظفين كول سنتر</p>';
  return `<div class="att-now">${list.map((p) => `
    <div class="card att-person ${p.start ? 'is-on' : ''}">
      <div class="att-name">${icon('user')}${esc(p.name)}</div>
      ${p.start
        ? `<span class="tag tag-green"><span class="shift-dot"></span>شغال من ${esc(formatTime(p.start))}</span>
           <div class="muted">بقاله ${hoursText(sinceMins(p.start))}</div>`
        : `<span class="tag">مش شغال دلوقتي</span>
           <div class="muted">${p.lastEnd ? `آخر خروج: ${esc(dayLabel(p.lastEnd))} · ${esc(formatTime(p.lastEnd))}` : 'لسه مبصمش قبل كده'}</div>`}
    </div>`).join('')}</div>`;
}

function summary(rows) {
  const by = new Map();
  for (const r of rows) {
    const a = by.get(r.userId) ?? { name: r.name, days: new Set(), minutes: 0, orders: 0, noPunch: 0, auto: 0, outside: 0 };
    if (!r.noPunch) { a.days.add(r.day); a.minutes += r.minutes || 0; a.orders += r.orders; }
    if (r.noPunch) a.noPunch += 1;
    if (r.autoClosed) a.auto += 1;
    a.outside += r.outside;
    by.set(r.userId, a);
  }
  const list = [...by.values()].sort((a, b) => b.minutes - a.minutes);
  return `
    <section class="card rp-sec">
      <div class="card-pad"><h2 class="section-title">${icon('chart')}الإجمالي في الفترة</h2></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>الموظف</th><th>أيام الشغل</th><th>الساعات</th><th>الطلبات في الشيفت</th><th>طلبات من غير بصمة</th><th>مقفلش</th></tr></thead>
        <tbody>${list.length ? list.map((a) => `<tr>
          <td><strong>${esc(a.name)}</strong></td><td class="num">${a.days.size}</td><td class="num"><strong>${hoursText(a.minutes)}</strong></td>
          <td class="num">${a.orders}</td>
          <td class="num ${a.outside ? 'text-danger' : ''}">${a.outside || '—'}</td>
          <td class="num ${a.auto ? 'text-danger' : ''}">${a.auto || '—'}</td></tr>`).join('')
          : '<tr><td colspan="6" class="table-empty">مفيش بصمات في الفترة دي</td></tr>'}</tbody>
      </table></div>
    </section>`;
}

function detail(rows) {
  return `
    <section class="card rp-sec">
      <div class="card-pad"><h2 class="section-title">${icon('clock')}الدخول والخروج</h2></div>
      <div class="table-wrap"><table class="table att-table">
        <thead><tr><th>اليوم</th><th>الموظف</th><th>دخول</th><th>خروج</th><th>الساعات</th><th>الطلبات</th><th>ملاحظات</th></tr></thead>
        <tbody>${rows.length ? rows.map((r) => {
          const notes = [
            r.open ? '<span class="tag tag-green"><span class="shift-dot"></span>شغال دلوقتي</span>' : '',
            r.autoClosed ? `<span class="tag tag-danger" title="ماداسش «إنهاء الشيفت» — اتقفل لوحده آخر يوم الشغل">${icon('alert')}مقفلش — اتقفل لوحده 2 بالليل</span>` : '',
            r.noPunch ? `<span class="tag tag-danger">${icon('alert')}اشتغل من غير بصمة</span>` : '',
            !r.noPunch && r.outside ? `<span class="tag tag-amber" title="طلبات عملها قبل ما يبدأ الشيفت أو بعد ما خلّصه">${r.outside} طلب برا الشيفت</span>` : '',
          ].filter(Boolean).join(' ');
          return `<tr class="${r.noPunch ? 'att-nopunch' : ''}">
            <td class="nowrap">${esc(dayText(r.day))}</td>
            <td><strong>${esc(r.name)}</strong></td>
            <td class="num nowrap">${r.start ? esc(formatTime(r.start)) : '—'}</td>
            <td class="num nowrap">${r.end ? esc(formatTime(r.end)) : r.open ? '<span class="muted">لسه</span>' : '—'}</td>
            <td class="num nowrap">${r.minutes != null ? `<strong>${hoursText(r.minutes)}</strong>` : '—'}</td>
            <td class="num">${r.noPunch ? r.outside : r.orders}</td>
            <td>${notes || '<span class="muted">—</span>'}</td></tr>`;
        }).join('') : '<tr><td colspan="7" class="table-empty">مفيش بصمات في الفترة دي</td></tr>'}</tbody>
      </table></div>
    </section>`;
}

export function mountAttendance(view) {
  view.innerHTML = `
    <div class="page"><div class="page-inner">
      <div class="page-head">
        <div>
          <h1 class="title-icon">${icon('clock')}الحضور</h1>
          <div class="page-sub"><span>بصمة دخول وخروج موظفين الكول سنتر — الوقت من السيرفر، ويوم الشغل من 2 بالليل لـ 2 بالليل</span></div>
        </div>
      </div>
      <h2 class="section-title att-h">${icon('headset')}دلوقتي</h2>
      <div data-now><p class="muted">جارٍ التحميل…</p></div>
      <div class="chips period-chips" role="tablist">${PERIODS.map((p) => `
        <button type="button" class="chip ${p.id === state.period ? 'is-on' : ''}" data-period="${p.id}" role="tab" aria-selected="${p.id === state.period}">${p.label}</button>`).join('')}</div>
      <div data-body></div>
    </div></div>`;
  let seq = 0;
  let alive = true;
  async function load() {
    const my = ++seq;
    const [from, to] = range();
    try {
      const r = await ds.attendance(from, to);
      if (!alive || my !== seq) return;
      if (!r) { view.querySelector('[data-now]').innerHTML = '<p class="muted">الحضور لسه متركبش على قاعدة البيانات</p>'; view.querySelector('[data-body]').innerHTML = ''; return; }
      view.querySelector('[data-now]').innerHTML = nowCards(r.now);
      view.querySelector('[data-body]').innerHTML = summary(r.rows) + detail(r.rows);
    } catch (err) {
      if (alive && my === seq) view.querySelector('[data-body]').innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    }
  }
  const off = on(view, 'click', '[data-period]', (e, b) => {
    state.period = b.dataset.period;
    view.querySelectorAll('[data-period]').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    load();
  });
  load();
  const timer = setInterval(load, 60000);
  return () => { alive = false; clearInterval(timer); off(); };
}
