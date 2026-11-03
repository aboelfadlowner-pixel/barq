/* «التقارير» — admin only (27_reports.sql). Phase 1:
   summary cards with ⬆️⬇️ against the period before, rush hours / weekdays,
   call-center employees, cancellations (reasons, who, the orders), and Excel. */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { formatTime, formatMoney } from '../utils/format.js';
import { money } from '../components/chips.js';
import { icon } from '../components/icons.js';
import { showToast } from '../components/modal.js';

const PERIODS = [
  { id: 'today', label: 'النهارده' },
  { id: 'yesterday', label: 'إمبارح' },
  { id: 'week', label: 'آخر 7 أيام' },
  { id: 'month', label: 'آخر 30 يوم' },
  { id: 'custom', label: 'من تاريخ لتاريخ' },
];
const DAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
const state = { period: 'today', from: null, to: null };

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function range() {
  const today = new Date();
  const back = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  if (state.period === 'yesterday') return [iso(back(1)), iso(back(1))];
  if (state.period === 'week') return [iso(back(6)), iso(today)];
  if (state.period === 'month') return [iso(back(29)), iso(today)];
  if (state.period === 'custom' && state.from && state.to) return [state.from, state.to];
  return [iso(today), iso(today)];
}
const prevLabel = () => ({ today: 'عن إمبارح', yesterday: 'عن اليوم اللي قبله', week: 'عن الـ 7 أيام اللي قبلها', month: 'عن الـ 30 يوم اللي قبلها' }[state.period] || 'عن الفترة اللي قبلها');
const hourLabel = (h) => { const t = h % 12 || 12; return `${t} ${h < 12 ? 'ص' : 'م'}`; };
const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

function change(cur, prev, { lowerIsBetter = false } = {}) {
  const p = pct(Number(cur) || 0, Number(prev) || 0);
  if (p === null) return (Number(cur) || 0) > 0 ? '<span class="rp-chg muted">جديد</span>' : '';
  if (p === 0) return '<span class="rp-chg muted">زي ما هو</span>';
  const good = lowerIsBetter ? p < 0 : p > 0;
  return `<span class="rp-chg ${good ? 'is-good' : 'is-bad'}">${p > 0 ? '⬆️' : '⬇️'} ${Math.abs(p)}% ${good ? '' : ''}</span>`;
}

function bars(list, labelOf, { highlight = true } = {}) {
  const max = Math.max(1, ...list.map((x) => x.n));
  const top = Math.max(...list.map((x) => x.n));
  return `<div class="rp-bars">${list.map((x) => `
    <div class="rp-bar ${highlight && x.n === top && top > 0 ? 'is-top' : ''}" title="${esc(labelOf(x))}: ${x.n} طلب · ${esc(formatMoney(x.sales || 0))}">
      <span class="rp-bar-n num">${x.n || ''}</span>
      <span class="rp-bar-fill" style="height:${Math.round((x.n / max) * 100)}%"></span>
      <span class="rp-bar-l">${esc(labelOf(x))}</span>
    </div>`).join('')}</div>`;
}

/* «أكتر ضغط: من 8 م لـ 10 م» — the best 2-hour window. */
function rushText(hours) {
  let best = null;
  for (let h = 0; h < 24; h += 1) {
    const n = hours[h].n + (hours[(h + 1) % 24]?.n || 0);
    if (n > 0 && (!best || n > best.n)) best = { h, n };
  }
  return best ? `أكتر ضغط: من ${hourLabel(best.h)} لـ ${hourLabel((best.h + 2) % 24)} (${best.n} طلب)` : 'مفيش طلبات في الفترة دي';
}

function render(el, r) {
  const s = r.summary, p = r.previous;
  const share = s.all ? Math.round((s.cancelled / s.all) * 100) : 0;
  const multiDay = r.from !== r.to;
  const topDay = r.weekdays.reduce((a, b) => (b.n > a.n ? b : a), { n: 0 });
  el.innerHTML = `
    <div class="rp-cards">
      <div class="card rp-card"><div class="rp-k">${icon('clipboard')}عدد الطلبات</div><div class="rp-v num">${s.orders}</div>${change(s.orders, p.orders)}</div>
      <div class="card rp-card"><div class="rp-k">${icon('chart')}المبيعات</div><div class="rp-v">${money(s.sales)}</div>${change(s.sales, p.sales)}</div>
      <div class="card rp-card"><div class="rp-k">${icon('cart')}متوسط الطلب</div><div class="rp-v">${money(s.avg)}</div>${change(s.avg, p.avg)}</div>
      <div class="card rp-card"><div class="rp-k">${icon('package')}رسوم التوصيل</div><div class="rp-v">${money(s.fees)}</div>${change(s.fees, p.fees)}</div>
      <div class="card rp-card ${share >= 10 ? 'is-warn' : ''}"><div class="rp-k">${icon('x')}الملغي</div><div class="rp-v num">${s.cancelled} <small>(${share}%)</small></div>${change(s.cancelled, p.cancelled, { lowerIsBetter: true })}</div>
    </div>
    <p class="muted rp-note">المقارنة ${esc(prevLabel())} · المبيعات والمتوسط من غير الطلبات الملغية</p>

    <section class="card card-pad rp-sec">
      <h2 class="section-title">${icon('clock')}أوقات الضغط</h2>
      <p class="rp-hint"><strong>${esc(rushText(r.hours))}</strong>${multiDay && topDay.n ? ` · أكتر يوم: <strong>${esc(DAYS[topDay.d])}</strong> (${topDay.n} طلب)` : ''}</p>
      ${bars(r.hours.filter((x) => x.h >= 8 || x.n > 0), (x) => hourLabel(x.h))}
      ${multiDay ? `<h3 class="rp-sub">أيام الأسبوع</h3>${bars(r.weekdays, (x) => DAYS[x.d])}` : ''}
    </section>

    <section class="card rp-sec">
      <div class="card-pad"><h2 class="section-title">${icon('headset')}موظفين الكول سنتر</h2></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>الموظف</th><th>الطلبات</th><th>المبيعات</th><th>متوسط الطلب</th><th>الملغي</th></tr></thead>
        <tbody>${r.agents.length ? r.agents.map((a) => {
          const sh = a.orders + a.cancelled ? Math.round((a.cancelled / (a.orders + a.cancelled)) * 100) : 0;
          return `<tr><td><strong>${esc(a.name)}</strong></td><td class="num">${a.orders}</td><td>${money(a.sales)}</td><td>${money(a.avg)}</td>
            <td class="num ${a.cancelled && sh >= 10 ? 'text-danger' : ''}">${a.cancelled}${a.cancelled ? ` (${sh}%)` : ''}${a.cancelled && sh >= 10 ? ' ⚠️' : ''}</td></tr>`;
        }).join('') : '<tr><td colspan="5" class="table-empty">مفيش طلبات في الفترة دي</td></tr>'}</tbody>
      </table></div>
    </section>

    <section class="card card-pad rp-sec">
      <h2 class="section-title">${icon('x')}الإلغاء</h2>
      ${s.cancelled ? `
      <div class="rp-two">
        <div><h3 class="rp-sub">الأسباب</h3>
          <ul class="rp-list">${r.cancel.reasons.map((x) => `<li><span>${esc(x.reason)}</span><strong class="num">${x.n}</strong></li>`).join('')}</ul></div>
        <div><h3 class="rp-sub">مين لغى</h3>
          <ul class="rp-list">${r.cancel.by.map((x) => `<li><span>${esc(x.name)}</span><strong class="num">${x.n}</strong></li>`).join('')}</ul></div>
      </div>
      <h3 class="rp-sub">الطلبات الملغية</h3>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>الطلب</th><th>الوقت</th><th>السبب</th><th>مين لغى</th><th>القيمة</th></tr></thead>
        <tbody>${r.cancel.orders.map((c) => `<tr><td><a class="link-btn ltr-inline" href="#/orders/${encodeURIComponent(c.id)}">#${esc(c.order_no)}</a></td>
          <td>${esc(formatTime(c.at))}${multiDay ? ` · ${esc(new Date(c.at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }))}` : ''}</td>
          <td>${esc(c.reason || '—')}</td><td>${esc(c.by || '—')}</td><td>${money(c.total)}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">مفيش طلبات اتلغت في الفترة دي 👏</p>'}
    </section>`;
}

/* Excel: the same numbers, one sheet each. */
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let lib = null;
const loadXlsx = () => {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  lib ??= new Promise((done, fail) => {
    const js = document.createElement('script');
    js.src = XLSX_URL; js.onload = () => done(window.XLSX); js.onerror = () => { lib = null; fail(new Error('xlsx')); };
    document.head.append(js);
  });
  return lib;
};
async function toExcel(r) {
  const X = await loadXlsx();
  const wb = X.utils.book_new();
  const add = (name, rows) => X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{ '': 'مفيش داتا' }]), name);
  const s = r.summary, p = r.previous;
  add('الملخص', [
    { 'البند': 'عدد الطلبات', 'الفترة': s.orders, 'الفترة اللي قبلها': p.orders },
    { 'البند': 'المبيعات', 'الفترة': s.sales, 'الفترة اللي قبلها': p.sales },
    { 'البند': 'متوسط الطلب', 'الفترة': s.avg, 'الفترة اللي قبلها': p.avg },
    { 'البند': 'رسوم التوصيل', 'الفترة': s.fees, 'الفترة اللي قبلها': p.fees },
    { 'البند': 'الملغي', 'الفترة': s.cancelled, 'الفترة اللي قبلها': p.cancelled },
  ]);
  add('الساعات', r.hours.map((x) => ({ 'الساعة': hourLabel(x.h), 'الطلبات': x.n, 'المبيعات': x.sales })));
  add('الأيام', r.weekdays.map((x) => ({ 'اليوم': DAYS[x.d], 'الطلبات': x.n, 'المبيعات': x.sales })));
  add('الموظفين', r.agents.map((a) => ({ 'الموظف': a.name, 'الطلبات': a.orders, 'المبيعات': a.sales, 'متوسط الطلب': a.avg, 'الملغي': a.cancelled })));
  add('الإلغاء', r.cancel.orders.map((c) => ({ 'الطلب': c.order_no, 'الوقت': new Date(c.at).toLocaleString('ar-EG'), 'السبب': c.reason || '', 'مين لغى': c.by || '', 'القيمة': c.total })));
  const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `call-center-report_${r.from}${r.to !== r.from ? `_${r.to}` : ''}.xlsx`;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function mountReports(view) {
  view.innerHTML = `
    <div class="page"><div class="page-inner">
      <div class="page-head">
        <div>
          <h1 class="title-icon">${icon('chart')}التقارير</h1>
          <div class="page-sub"><span>الطلبات والمبيعات وأوقات الضغط والموظفين والإلغاء — للإدارة بس</span></div>
        </div>
        <div class="board-actions"><button type="button" class="btn btn-secondary" data-excel>${icon('note')}تنزيل Excel</button></div>
      </div>
      <div class="chips period-chips" role="tablist">${PERIODS.map((p) => `
        <button type="button" class="chip ${p.id === state.period ? 'is-on' : ''}" data-period="${p.id}" role="tab" aria-selected="${p.id === state.period}">${p.label}</button>`).join('')}</div>
      <form class="rp-custom" data-custom ${state.period === 'custom' ? '' : 'hidden'}>
        <label>من <input class="input" type="date" name="from" value="${esc(state.from || '')}" required></label>
        <label>لـ <input class="input" type="date" name="to" value="${esc(state.to || '')}" required></label>
        <button type="submit" class="btn btn-primary btn-sm">عرض</button>
        <span class="muted">لحد 3 شهور</span>
      </form>
      <div data-body><p class="muted">جارٍ التحميل…</p></div>
    </div></div>`;
  const body = view.querySelector('[data-body]');
  let data = null;
  let seq = 0;

  async function load() {
    const my = ++seq;
    const [from, to] = range();
    body.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
    try {
      const r = await ds.report(from, to);
      if (my !== seq) return;
      data = r;
      render(body, r);
    } catch (err) {
      if (my !== seq) return;
      body.innerHTML = `<div class="card card-pad center-note">${icon('alert')}<h3>${esc(err.message)}</h3></div>`;
    }
  }
  load();

  const offs = [
    on(view, 'click', '[data-period]', (e, btn) => {
      state.period = btn.dataset.period;
      view.querySelectorAll('[data-period]').forEach((b) => { const onNow = b === btn; b.classList.toggle('is-on', onNow); b.setAttribute('aria-selected', onNow); });
      view.querySelector('[data-custom]').hidden = state.period !== 'custom';
      if (state.period !== 'custom' || (state.from && state.to)) load();
    }),
    on(view, 'submit', '[data-custom]', (e, form) => {
      e.preventDefault();
      if (form.from.value > form.to.value) { showToast('تاريخ البداية لازم يكون قبل النهاية'); return; }
      state.from = form.from.value; state.to = form.to.value;
      load();
    }),
    on(view, 'click', '[data-excel]', async (e, btn) => {
      if (!data) return;
      btn.disabled = true;
      try { await toExcel(data); } catch { showToast('تعذر تحميل Excel — جرّب تاني'); }
      btn.disabled = false;
    }),
  ];
  return () => offs.forEach((f) => f());
}
