/* «التقارير» — admin only. Two tabs:
   «المبيعات والموظفين» (27_reports.sql): summary cards with ⬆️⬇️ against the period before,
     rush hours / weekdays, call-center employees, cancellations;
   «التشغيل والأصناف» (29_reports_ops.sql): speed of each step, slowest orders, areas,
     products, add-ons. Excel has both. Days are working days (2 AM → 2 AM). */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { dayLabel, formatTime, formatMoney, shiftIso, workDayIso } from '../utils/format.js';
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
const TABS = [
  { id: 'sales', label: 'المبيعات والموظفين' },
  { id: 'ops', label: 'التشغيل والأصناف' },
];
const state = { period: 'today', from: null, to: null, tab: 'sales' };

function range() {
  const today = workDayIso();                  // the working day (from 2 AM)
  const back = (n) => shiftIso(today, n);
  if (state.period === 'yesterday') return [back(1), back(1)];
  if (state.period === 'week') return [back(6), today];
  if (state.period === 'month') return [back(29), today];
  if (state.period === 'custom' && state.from && state.to) return [state.from, state.to];
  return [today, today];
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

/* ---------- «التشغيل والأصناف» ---------- */
const STEPS = [
  { k: 'to_prep', label: 'لحد ما التجهيز بدأ', hint: 'من تسجيل الطلب لحد «بدأ التجهيز»' },
  { k: 'prep', label: 'التجهيز', hint: 'من «بدأ التجهيز» لحد «عند الكاشير»' },
  { k: 'wait', label: 'استنى الطيار', hint: 'من «عند الكاشير» لحد ما خرج' },
  { k: 'deliver', label: 'التوصيل للعميل', hint: 'من ما خرج لحد «سلّمت»' },
  { k: 'total', label: 'من الطلب لحد ما خرج', hint: 'الوقت كله جوه الفرع' },
];
const mins = (m) => (m == null ? '—' : `${m} د`);
const kgText = (kg) => (Number(kg) ? `${Number(kg).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} كجم` : '');
const amount = (it) => [it.qty ? `${it.qty} قطعة` : '', kgText(it.kg)].filter(Boolean).join(' + ') || '—';

function renderOps(el, r) {
  const sp = r.speed;
  const totalSales = r.areas.reduce((t, a) => t + Number(a.sales || 0), 0);
  const byOrders = [...r.items].sort((a, b) => b.orders - a.orders).slice(0, 10);
  const slowest = STEPS.slice(0, 3).filter((x) => sp[x.k].mid != null).sort((a, b) => sp[b.k].mid - sp[a.k].mid)[0];
  el.innerHTML = `
    <section class="card card-pad rp-sec">
      <h2 class="section-title">${icon('clock')}سرعة التشغيل</h2>
      <p class="rp-hint">${sp.orders ? `من ${sp.orders} طلب · الرقم الكبير هو <strong>الوقت العادي</strong> (نص الطلبات أسرع منه ونصها أبطأ)، وتحته المتوسط${slowest ? ` · أبطأ خطوة: <strong>${esc(slowest.label)}</strong>` : ''}` : 'مفيش طلبات في الفترة دي'}</p>
      <div class="rp-cards">${STEPS.map((x) => `
        <div class="card rp-card ${slowest && slowest.k === x.k ? 'is-warn' : ''}" title="${esc(x.hint)}">
          <div class="rp-k">${esc(x.label)}</div>
          <div class="rp-v num">${mins(sp[x.k].mid)}</div>
          <span class="rp-chg muted">${sp[x.k].n ? `المتوسط ${mins(sp[x.k].avg)} · ${sp[x.k].n} طلب` : 'مفيش داتا'}</span>
        </div>`).join('')}</div>
      ${r.slow.length ? `
      <h3 class="rp-sub">أبطأ ${r.slow.length} طلبات لحد ما خرجت</h3>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>الطلب</th><th>الوقت</th><th>المنطقة</th><th>لحد التجهيز</th><th>التجهيز</th><th>استنى الطيار</th><th>الإجمالي</th></tr></thead>
        <tbody>${r.slow.map((o) => `<tr><td><a class="link-btn ltr-inline" href="#/orders/${encodeURIComponent(o.id)}">#${esc(o.order_no)}</a></td>
          <td>${esc(dayLabel(o.at))} ${esc(formatTime(o.at))}</td><td>${esc(o.area || '—')}</td>
          <td class="num">${mins(o.to_prep)}</td><td class="num">${mins(o.prep)}</td><td class="num">${mins(o.wait)}</td>
          <td class="num"><strong>${mins(o.total)}</strong></td></tr>`).join('')}</tbody>
      </table></div>` : ''}
    </section>

    <section class="card rp-sec">
      <div class="card-pad"><h2 class="section-title">${icon('package')}المناطق</h2></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>المنطقة</th><th>الطلبات</th><th>المبيعات</th><th>من المبيعات</th><th>رسوم التوصيل</th></tr></thead>
        <tbody>${r.areas.length ? r.areas.map((a) => {
          const sh = totalSales ? Math.round((Number(a.sales) / totalSales) * 100) : 0;
          return `<tr><td><strong>${esc(a.name)}</strong></td><td class="num">${a.orders}</td><td>${money(a.sales)}</td>
            <td><span class="rp-share"><span style="width:${sh}%"></span></span> <span class="num">${sh}%</span></td><td>${money(a.fees)}</td></tr>`;
        }).join('') : '<tr><td colspan="5" class="table-empty">مفيش طلبات في الفترة دي</td></tr>'}</tbody>
      </table></div>
    </section>

    <section class="card rp-sec">
      <div class="card-pad">
        <h2 class="section-title">${icon('cart')}الأصناف</h2>
        <p class="rp-hint">${r.items_count ? `${r.items_count} صنف اتباع في الفترة دي · مترتبين من الأكتر فلوس${r.items_count > r.items.length ? ` (أول ${r.items.length} — الباقي في Excel)` : ''}` : 'مفيش أصناف في الفترة دي'}</p>
      </div>
      ${r.items.length ? `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>#</th><th>الصنف</th><th>في كام طلب</th><th>الكمية</th><th>المبيعات</th></tr></thead>
        <tbody>${r.items.slice(0, 20).map((it, i) => `<tr><td class="num muted">${i + 1}</td><td><strong>${esc(it.name)}</strong></td>
          <td class="num">${it.orders}</td><td>${esc(amount(it))}</td><td>${money(it.sales)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="card-pad"><h3 class="rp-sub">أكتر أصناف بتتطلب (عدد الطلبات)</h3>
        <ul class="rp-list">${byOrders.map((it) => `<li><span>${esc(it.name)}</span><strong class="num">${it.orders} طلب</strong></li>`).join('')}</ul></div>` : ''}
    </section>

    <section class="card rp-sec">
      <div class="card-pad"><h2 class="section-title">${icon('note')}الإضافات</h2></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>الإضافة</th><th>المجموعة</th><th>اتطلبت كام مرة</th><th>فلوسها</th></tr></thead>
        <tbody>${r.modifiers.length ? r.modifiers.map((m) => `<tr><td><strong>${esc(m.name)}</strong></td><td class="muted">${esc(m.group || '—')}</td>
          <td class="num">${m.times}</td><td>${money(m.sales)}</td></tr>`).join('') : '<tr><td colspan="4" class="table-empty">مفيش إضافات في الفترة دي</td></tr>'}</tbody>
      </table></div>
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
async function toExcel(r, o) {
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
  if (o) {
    add('السرعة', STEPS.map((x) => ({ 'الخطوة': x.label, 'الوقت العادي (دقيقة)': o.speed[x.k].mid ?? '', 'المتوسط (دقيقة)': o.speed[x.k].avg ?? '', 'عدد الطلبات': o.speed[x.k].n })));
    add('أبطأ الطلبات', o.slow.map((x) => ({ 'الطلب': x.order_no, 'الوقت': new Date(x.at).toLocaleString('ar-EG'), 'المنطقة': x.area || '', 'لحد التجهيز': x.to_prep ?? '', 'التجهيز': x.prep ?? '', 'استنى الطيار': x.wait ?? '', 'الإجمالي': x.total })));
    add('المناطق', o.areas.map((a) => ({ 'المنطقة': a.name, 'الطلبات': a.orders, 'المبيعات': a.sales, 'رسوم التوصيل': a.fees })));
    add('الأصناف', o.items.map((it) => ({ 'الصنف': it.name, 'الكود': it.sku, 'في كام طلب': it.orders, 'قطع': it.qty, 'كيلو': it.kg, 'المبيعات': it.sales })));
    add('الإضافات', o.modifiers.map((m) => ({ 'الإضافة': m.name, 'المجموعة': m.group || '', 'المرات': m.times, 'فلوسها': m.sales })));
  }
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
          <div class="page-sub"><span>المبيعات والموظفين والإلغاء، والتشغيل والمناطق والأصناف — للإدارة بس</span></div>
        </div>
        <div class="board-actions"><button type="button" class="btn btn-secondary" data-excel>${icon('note')}تنزيل Excel</button></div>
      </div>
      <div class="seg rp-tabs" role="tablist">${TABS.map((t) => `
        <button type="button" class="${t.id === state.tab ? 'active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${t.id === state.tab}">${t.label}</button>`).join('')}</div>
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
  let data = null;       // «المبيعات والموظفين» of the period shown
  let ops = null;        // «التشغيل والأصناف» of the period shown
  let seq = 0;

  async function load() {
    const my = ++seq;
    const [from, to] = range();
    const key = `${from}|${to}`;
    if (data?.key !== key) data = null;
    if (ops?.key !== key) ops = null;
    body.innerHTML = '<p class="muted">جارٍ التحميل…</p>';
    try {
      if (state.tab === 'ops') {
        ops ??= { key, r: await ds.reportOps(from, to) };
        if (my !== seq) return;
        renderOps(body, ops.r);
      } else {
        data ??= { key, r: await ds.report(from, to) };
        if (my !== seq) return;
        render(body, data.r);
      }
    } catch (err) {
      if (my !== seq) return;
      body.innerHTML = `<div class="card card-pad center-note">${icon('alert')}<h3>${esc(err.message)}</h3></div>`;
    }
  }
  load();

  const offs = [
    on(view, 'click', '[data-tab]', (e, btn) => {
      state.tab = btn.dataset.tab;
      view.querySelectorAll('[data-tab]').forEach((b) => { const onNow = b === btn; b.classList.toggle('active', onNow); b.setAttribute('aria-selected', onNow); });
      load();
    }),
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
      const [from, to] = range();
      const key = `${from}|${to}`;
      btn.disabled = true;
      try {
        if (data?.key !== key) data = { key, r: await ds.report(from, to) };
        if (ops?.key !== key) ops = { key, r: await ds.reportOps(from, to) };
        await toExcel(data.r, ops.r);
      } catch { showToast('تعذر تحميل Excel — جرّب تاني'); }
      btn.disabled = false;
    }),
  ];
  return () => offs.forEach((f) => f());
}
