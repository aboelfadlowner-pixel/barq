/* Preparation screen (branch, prep account): the orders sent by the call center in three
   columns — جديد / بيتجهز / على الكاشير — with ONE big button per order that moves it on:
   استلمت وبدأت التجهيز → وصل الكاشير → خرج مع الطيار. A wrong tap can be undone one step.
   The call center sees every change on its board. This screen does not print (the call
   center prints the ticket and hands it over). It checks for changes every few seconds and
   rings when a new order arrives. */
import * as ds from '../data/data-source.js';
import { getState } from '../store.js';
import { STAGES, PREP_REFRESH_MS } from '../constants.js';
import { esc, on } from '../utils/dom.js';
import { formatRelative, formatTime, formatWeight, housingLabel, inWorkDay } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { confirmDialog, openModal, showToast } from '../components/modal.js';

const SOUND_KEY = 'cc-prep-sound';
const DRIVERS_KEY = 'cc-recent-drivers';   // the last drivers typed on this device (quick pick)
const recentDrivers = () => { try { return JSON.parse(localStorage.getItem(DRIVERS_KEY) || '[]'); } catch { return []; } };
const rememberDriver = (d) => {
  try { localStorage.setItem(DRIVERS_KEY, JSON.stringify([d, ...recentDrivers().filter((x) => x !== d)].slice(0, 6))); } catch { /* ignore */ }
};

/* «خرج مع الطيار»: the driver in ONE field — «الاسم (الرقم)». Resolves with the text, or null. */
function askDriver(order) {
  return new Promise((done) => {
    const recent = recentDrivers();
    const m = openModal({
      title: `${icon('check')} خرج مع الطيار — طلب <span class="ltr-inline">#${esc(order.number)}</span>`,
      size: 'sm',
      body: `
        <div class="field">
          <label for="driver">اسم الطيار ورقمه</label>
          <input id="driver" class="input" maxlength="80" autocomplete="off" placeholder="مثال: محمد (01012345678)" value="${esc(order.driver || '')}">
        </div>
        ${recent.length ? `<div class="chips driver-chips">${recent.map((d) => `<button type="button" class="chip" data-driver="${esc(d)}">${esc(d)}</button>`).join('')}</div>` : ''}
        <div class="field-error" data-err="driver" role="alert"></div>`,
      footer: `
        <button type="button" class="btn btn-primary btn-lg" data-save>${icon('check')}خرج</button>
        <button type="button" class="btn btn-secondary btn-lg" data-close>إلغاء</button>`,
    });
    let result = null;
    const input = m.body.querySelector('#driver');
    const save = () => {
      const v = input.value.replace(/\s+/g, ' ').trim();
      if (v.length < 2) { m.body.querySelector('[data-err="driver"]').textContent = 'اكتب اسم الطيار ورقمه — مثال: محمد (01012345678)'; input.focus(); return; }
      result = v;
      m.close();
    };
    m.body.addEventListener('click', (e) => { const c = e.target.closest('[data-driver]'); if (c) { input.value = c.dataset.driver; save(); } });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    input.addEventListener('input', () => { m.body.querySelector('[data-err="driver"]').textContent = ''; });
    m.foot.querySelector('[data-save]').addEventListener('click', save);
    m.onClose(() => done(result));
    input.focus();
  });
}
const stageOf = (id) => STAGES.find((s) => s.id === id) ?? STAGES[0];
const nextOf = (id) => STAGES[STAGES.findIndex((s) => s.id === id) + 1] ?? null;
const prevOf = (id) => STAGES[STAGES.findIndex((s) => s.id === id) - 1] ?? null;

/* Short two-tone ring (no sound file needed). Browsers allow sound only after a tap on the page. */
let audio = null;
function ring() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [1175, 0.18], [880, 0.5], [1175, 0.68]].forEach(([f, t]) => {
      const o = audio.createOscillator(); const g = audio.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.16);
      o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.18);
    });
  } catch { /* no sound available */ }
}
const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; } };
const setSound = (v) => { try { localStorage.setItem(SOUND_KEY, v ? '1' : '0'); } catch { /* ignore */ } };

/* CONFIRMED: the person preparing ticks each item when it is ready — kept on THIS device only.
   The key holds the line's name and amount, so an item changed by an edit comes back unticked. */
const CHECKS_KEY = 'cc-prep-checks';
const readChecks = () => { try { return JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}'); } catch { return {}; } };
const writeChecks = (c) => { try { localStorage.setItem(CHECKS_KEY, JSON.stringify(c)); } catch { /* ignore */ } };
const itemKey = (it, i) => `${i}|${it.name}|${it.unitType === 'weight' ? `${it.grams}g` : it.qty}`;
const checkedCount = (o, checks) => o.items.filter((it, i) => checks[o.id]?.[itemKey(it, i)]).length;

function itemLine(it, i, o, checks, canTick) {
  const amount = it.unitType === 'weight'
    ? `<strong class="num">${esc(formatWeight(it.grams))}</strong>`
    : `<strong class="num">${esc(String(it.qty))}</strong> ×`;
  const done = !!checks[o.id]?.[itemKey(it, i)];
  return `<li class="${done ? 'is-done' : ''} ${canTick ? 'can-tick' : ''}" ${canTick ? `data-tick="${esc(itemKey(it, i))}" role="checkbox" aria-checked="${done}" tabindex="0"` : ''}>
    ${canTick ? `<span class="pi-check" aria-hidden="true">${done ? icon('check') : ''}</span>` : ''}
    <span class="pi-amount">${amount}</span><span class="pi-name">${esc(it.name)}</span>
    ${it.note ? `<div class="pi-note">${icon('note')}${esc(it.note)}</div>` : ''}</li>`;
}

const amountText = (a) => (a?.grams ? formatWeight(a.grams) : a?.qty != null ? `${a.qty}` : '');
function changeLine(c) {
  switch (c.kind) {
    case 'added': return `<li><strong>اتضاف:</strong> ${esc(c.name)} <span class="num">${esc(amountText(c.to))}</span></li>`;
    case 'removed': return `<li class="chg-removed"><strong>اتشال:</strong> ${esc(c.name)}</li>`;
    case 'amount': return `<li><strong>${esc(c.name)}:</strong> كان <span class="num">${esc(amountText(c.from))}</span> ← بقى <strong class="num">${esc(amountText(c.to))}</strong></li>`;
    case 'note': return `<li><strong>${esc(c.name)}:</strong> ملاحظة «${esc(c.to)}»</li>`;
    case 'address': return `<li><strong>العنوان اتغيّر:</strong> ${esc(c.to?.area || '')} · ${esc(c.to?.street || '')}</li>`;
    case 'order_note': return `<li><strong>ملاحظات الطلب:</strong> ${esc(c.to || '—')}</li>`;
    default: return '';
  }
}
const editUnseen = (o) => o.editedAt && o.status !== 'cancelled' && (!o.editSeenAt || o.editSeenAt < o.editedAt);

function prepCard(o, busy, checks = {}) {
  const cancelled = o.status === 'cancelled';
  const next = cancelled ? null : nextOf(o.stage);
  const prev = cancelled ? null : prevOf(o.stage);
  const since = { preparing: o.preparingAt, at_cashier: o.atCashierAt }[o.stage];
  const out = o.stage === 'out';
  const canTick = !cancelled && !out;   // an order that left is for reference only
  const a = o.address;
  return `
    <article class="p-order ${cancelled ? 'is-cancelled' : ''} ${editUnseen(o) ? 'is-edited' : ''}" data-oid="${esc(o.id)}">
      <header class="po-head">
        <strong class="po-no num">#${esc(o.number)}</strong>
        ${canTick && o.items.length ? `<span class="po-progress ${checkedCount(o, checks) === o.items.length ? 'is-full' : ''}">تم <span class="num">${checkedCount(o, checks)}</span> من <span class="num">${o.items.length}</span></span>` : ''}
        <span class="po-time">${icon('clock')}<span class="num">${formatTime(o.createdAt)}</span> · ${formatRelative(o.createdAt)}</span>
      </header>
      ${cancelled ? `<div class="po-cancel">${icon('alert')}<div><strong>الطلب ده اتلغى — متكملش تجهيزه</strong>
        ${o.cancelReason ? `<div>السبب: ${esc(o.cancelReason)}</div>` : ''}</div></div>` : ''}
      ${editUnseen(o) ? `<div class="po-edited">
        <div class="po-edited-head">${icon('edit')}<strong>اتعدّل${o.editCount > 1 ? ` (${o.editCount})` : ''} — الكول سنتر هيبعت ورقة جديدة</strong></div>
        <ul>${(o.editChanges || []).map(changeLine).join('')}</ul>
        <button type="button" class="btn btn-soft po-ack" data-ack ${busy ? 'disabled' : ''}>${icon('check')}شُفت التعديل</button>
      </div>` : ''}
      <ul class="po-items">${o.items.map((it, i) => itemLine(it, i, o, checks, canTick)).join('')}</ul>
      ${o.note ? `<div class="po-note">${icon('note')}<span>${esc(o.note)}</span></div>` : ''}
      <div class="po-addr">${icon('pin')}<div><strong>${esc(a.areaName)}</strong> · ${esc(a.street)}
        ${housingLabel(a.housingType) ? ` · ${esc(housingLabel(a.housingType))}` : ''}${a.notes ? `<div class="muted">${esc(a.notes)}</div>` : ''}</div></div>
      <div class="po-cust">${icon('user')}<span>${esc(o.customer.name)}</span>
        <span class="ltr-inline num">${esc(o.customer.phone)}</span></div>
      ${since ? `<div class="po-since muted">${stageOf(o.stage).label} من ${formatRelative(since)}</div>` : ''}
      ${out ? `<div class="po-out">${icon('check')}<span>خرج <span class="num">${o.outAt ? formatTime(o.outAt) : ''}</span>${o.driver ? ` مع <strong>${esc(o.driver)}</strong>` : ''}</span></div>` : ''}
      ${next ? `<button type="button" class="btn btn-primary po-next tone-btn-${next.id}" data-next="${next.id}" ${busy ? 'disabled' : ''}>
        ${icon(next.id === 'out' ? 'check' : 'chevronLeft')}${esc(stageOf(o.stage).next)}</button>` : ''}
      ${prev ? `<button type="button" class="link-btn po-back" data-back="${prev.id}" ${busy ? 'disabled' : ''}>رجوع لـ «${esc(prev.label)}»</button>` : ''}
    </article>`;
}

function column(stage, list, busyId) {
  const st = stageOf(stage);
  return `
    <section class="p-col">
      <header class="b-col-head p-col-head tone-head-${st.id}"><h2>${st.label}</h2><span class="b-count num">${list.length}</span></header>
      <div class="p-col-body">${list.length ? list.map((o) => prepCard(o, o.id === busyId, readChecks())).join('') : '<div class="b-empty">مفيش طلبات</div>'}</div>
    </section>`;
}

export function mountPrep(view) {
  const { user } = getState();
  view.innerHTML = `
    <div class="page prep-page"><div class="page-inner">
      <div class="page-head">
        <div>
          <h1 class="title-icon">${icon('clipboard')}شاشة التجهيز</h1>
          <div class="page-sub"><span>${esc(user?.email || '')}</span><span class="muted" data-updated></span>
            <span class="demo-pill">${icon('info')}بيانات تجريبية</span></div>
        </div>
        <div class="board-actions">
          <button type="button" class="btn btn-secondary" data-sound></button>
          <button type="button" class="btn btn-secondary" data-refresh>${icon('repeat')}تحديث</button>
        </div>
      </div>
      <div class="prep-cols" data-cols><p class="muted">جارٍ التحميل…</p></div>
    </div></div>`;

  const cols = view.querySelector('[data-cols]');
  const soundBtn = view.querySelector('[data-sound]');
  let orders = [];
  let known = null;          // order ids seen so far (null until the first load: no ring on open)
  const editsSeen = new Map(); // order id → last edit time already announced
  let busyId = null;
  let timer = null;
  let stopped = false;

  const paintSound = () => {
    soundBtn.innerHTML = soundOn() ? `${icon('check')}صوت التنبيه شغال` : `${icon('alert')}شغّل صوت التنبيه`;
    soundBtn.classList.toggle('needs-value', !soundOn());
  };
  paintSound();

  const render = () => {
    // A cancelled order stays in its column (red, no button) for an hour, so nobody keeps preparing it.
    const recent = (iso) => !iso || Date.now() - new Date(iso).getTime() < 60 * 60000;
    // CONFIRMED: the newest order is on top in every column.
    const by = (stage) => orders.filter((o) => (o.stage || 'new') === stage && stage !== 'out'
      && (o.status !== 'cancelled' || recent(o.cancelledAt)))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    // CONFIRMED: the orders that left with the driver (this working day) stay in their own column, newest first,
    // so the branch knows what went out and can go back to an order.
    const out = orders.filter((o) => o.stage === 'out' && o.status !== 'cancelled')
      .sort((a, b) => String(b.outAt).localeCompare(String(a.outAt)));
    cols.innerHTML = column('new', by('new'), busyId) + column('preparing', by('preparing'), busyId)
      + column('at_cashier', by('at_cashier'), busyId) + column('out', out, busyId);
  };

  const load = async () => {
    try {
      // CONFIRMED: only this working day's orders (it ends at 2 AM) — the screen starts empty after 2 AM,
      // older orders are not shown even if nobody moved them on.
      const list = (await ds.listPrepOrders()).filter((o) => inWorkDay(o.createdAt));
      if (stopped) return;
      const fresh = list.filter((o) => o.status !== 'cancelled' && o.stage === 'new' && known && !known.has(o.id));
      const edited = list.filter((o) => editUnseen(o) && known && editsSeen.get(o.id) !== o.editedAt);
      known = new Set(list.map((o) => o.id));
      // Forget the ticks of orders that are no longer on this screen.
      const checks = readChecks();
      if (Object.keys(checks).some((id) => !known.has(id))) {
        writeChecks(Object.fromEntries(Object.entries(checks).filter(([id]) => known.has(id))));
      }
      list.forEach((o) => editsSeen.set(o.id, o.editedAt || null));
      orders = list;
      render();
      view.querySelector('[data-updated]').textContent = `آخر تحديث ${formatTime(new Date().toISOString())}`;
      if (fresh.length || edited.length) {
        if (soundOn()) ring();
        showToast([fresh.length ? (fresh.length === 1 ? `طلب جديد #${fresh[0].number}` : `${fresh.length} طلبات جديدة`) : '',
          edited.length ? `اتعدّل: ${edited.map((o) => `#${o.number}`).join('، ')}` : ''].filter(Boolean).join(' · '));
      }
    } catch (err) {
      if (stopped) return;
      view.querySelector('[data-updated]').textContent = 'تعذر التحديث — بنحاول تاني';
      if (!known) cols.innerHTML = `<div class="card card-pad center-note">${icon('alert')}<h3>${esc(err.message)}</h3></div>`;
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => { if (!document.hidden) await load(); if (!stopped) schedule(); }, PREP_REFRESH_MS);
  };

  const move = async (orderId, stage) => {
    let driver = null;
    if (stage === 'out') {                   // ask for the driver first; cancelling changes nothing
      driver = await askDriver(orders.find((x) => x.id === orderId) ?? { number: '' });
      if (!driver) return;
    }
    busyId = orderId; render();
    try {
      if (driver) { await ds.sendOut(orderId, driver); rememberDriver(driver); }
      else await ds.setStage(orderId, stage);
      const o = orders.find((x) => x.id === orderId);
      if (o) { o.stage = stage; }
    } catch (err) {
      showToast(err.message);
    }
    busyId = null;
    await load();
  };

  const toggleTick = (li) => {
    const id = li.closest('[data-oid]').dataset.oid;
    const checks = readChecks();
    const mine = checks[id] ?? (checks[id] = {});
    if (mine[li.dataset.tick]) delete mine[li.dataset.tick]; else mine[li.dataset.tick] = true;
    writeChecks(checks);
    render();
  };

  const offs = [
    on(view, 'click', '[data-next]', async (e, btn) => {
      const id = btn.closest('[data-oid]').dataset.oid;
      const o = orders.find((x) => x.id === id);
      // Before «وصل الكاشير»: a reminder if some items are not ticked (a reminder only, not a block).
      const left = o ? o.items.length - checkedCount(o, readChecks()) : 0;
      if (btn.dataset.next === 'at_cashier' && left > 0 && !(await confirmDialog({
        title: 'فيه أصناف لسه ما اتعلّمش عليها',
        message: `${left === 1 ? 'صنف واحد' : `${left} أصناف`} لسه ما اتعلّمش عليه. متأكد إن الطلب كله اتجهز؟`,
        confirmLabel: 'أيوه، وصل الكاشير', cancelLabel: 'رجوع',
      }))) return;
      move(id, btn.dataset.next);
    }),
    on(view, 'click', '[data-tick]', (e, li) => toggleTick(li)),
    on(view, 'keydown', '[data-tick]', (e, li) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleTick(li); } }),
    on(view, 'click', '[data-back]', async (e, btn) => {
      const st = stageOf(btn.dataset.back);
      if (!(await confirmDialog({ title: 'رجوع خطوة', message: `الطلب هيرجع لـ «${st.label}». ده لو دوست غلط بس.`, confirmLabel: 'رجّعه' }))) return;
      move(btn.closest('[data-oid]').dataset.oid, btn.dataset.back);
    }),
    on(view, 'click', '[data-refresh]', () => load()),
    on(view, 'click', '[data-ack]', async (e, btn) => {
      const id = btn.closest('[data-oid]').dataset.oid;
      busyId = id; render();
      try { await ds.ackEdit(id); } catch (err) { showToast(err.message); }
      busyId = null;
      await load();
    }),
    on(view, 'click', '[data-sound]', () => { setSound(!soundOn()); paintSound(); if (soundOn()) ring(); }),
  ];
  const onVisible = () => { if (!document.hidden) load(); };
  document.addEventListener('visibilitychange', onVisible);

  load().then(schedule);
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    offs.forEach((f) => f());
  };
}
