/* «الشات» between the call center and one driver (30_driver_chat.sql) — used on the driver's
   phone and on the call center's «الشات» page.
   CONFIRMED: ready messages with one tap + typing; a message can be about one order (it shows
   the order number); the system's automatic lines («خرج», «سلّم», «رجع الفرع», «اتلغى») show in
   the middle. New messages come every few seconds while the conversation is open. */
import * as ds from '../data/data-source.js';
import { esc } from '../utils/dom.js';
import { dayLabel, formatTime } from '../utils/format.js';
import { icon } from './icons.js';
import { showToast } from './modal.js';

export const DRIVER_QUICK = ['العميل مش بيرد 📵', 'العنوان مش واضح 📍', 'العميل مش موجود 🚪', 'هتأخر شوية ⏱️', 'العميل عايز يغيّر حاجة ✏️', 'تمام ✅'];
export const STAFF_QUICK = ['تمام ✅', 'هكلّم العميل وأرد عليك 📞', 'استنى 5 دقايق ⏳', 'العميل نازل 🚶', 'رجّع الطلب للفرع ↩️'];
const POLL_MS = 5000;

const bubble = (m, side) => {
  if (m.from === 'system') {
    return `<div class="ch-sys ${m.notify ? 'is-alert' : ''}" data-mid="${m.id}"><span>${esc(m.body)}</span><time>${esc(formatTime(m.at))}</time></div>`;
  }
  const mine = side === 'driver' ? m.from === 'driver' : m.from === 'staff';
  return `
    <div class="ch-msg ${mine ? 'is-mine' : 'is-theirs'}" data-mid="${m.id}">
      ${!mine && m.name ? `<span class="ch-name">${esc(m.name)}</span>` : ''}
      ${m.orderNo ? `<span class="ch-order ltr-inline">#${esc(m.orderNo)}</span>` : ''}
      <p class="ch-body">${esc(m.body)}</p>
      <time>${esc(formatTime(m.at))}</time>
    </div>`;
};

/* side: 'driver' (his phone) or 'staff' (call center).
   orders: [{ id, number }] he can tag (driver: his open orders; staff: the orders seen in the thread).
   Returns { destroy, setOrder }. */
export function mountChatBox(el, { side, driverId = null, orders = [], orderId = null, onRead = () => {} }) {
  const quick = side === 'driver' ? DRIVER_QUICK : STAFF_QUICK;
  let msgs = [];
  let lastId = 0;
  let timer = null;
  let stopped = false;
  let sending = false;
  let order = orderId;
  let tagOrders = orders.slice();

  el.innerHTML = `
    <div class="ch-list" data-list aria-live="polite"><p class="muted ch-empty">جارٍ التحميل…</p></div>
    <div class="ch-compose">
      <div class="ch-order-row" data-order-row></div>
      <div class="ch-quick" data-quick>${quick.map((q) => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <form class="ch-form" data-form autocomplete="off">
        <input class="input" name="body" maxlength="500" placeholder="اكتب رسالة…" aria-label="رسالة" autocomplete="off">
        <button type="submit" class="btn btn-primary" aria-label="إرسال">${icon('chevronLeft')}إرسال</button>
      </form>
    </div>`;
  const list = el.querySelector('[data-list]');
  const input = el.querySelector('input[name="body"]');
  const orderRow = el.querySelector('[data-order-row]');

  const paintOrders = () => {
    if (!tagOrders.length) { orderRow.innerHTML = ''; return; }
    orderRow.innerHTML = `<label class="muted" for="chOrder">عن طلب:</label>
      <select id="chOrder" class="input input-sm" data-order>
        <option value="">بدون طلب</option>
        ${tagOrders.map((o) => `<option value="${esc(o.id)}" ${o.id === order ? 'selected' : ''}>#${esc(o.number)}</option>`).join('')}
      </select>`;
  };
  const paint = () => {
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    let day = '';
    list.innerHTML = msgs.length ? msgs.map((m) => {
      const d = dayLabel(m.at);
      const sep = d !== day ? `<div class="ch-day">${esc(d)}</div>` : '';
      day = d;
      return sep + bubble(m, side);
    }).join('') : `<p class="muted ch-empty">${side === 'driver' ? 'ابعت للكول سنتر أي حاجة محتاجها — أو اختار رسالة جاهزة تحت' : 'مفيش رسايل لسه'}</p>`;
    if (nearBottom || !paint.done) list.scrollTop = list.scrollHeight;
    paint.done = true;
  };
  const addOrders = (ms) => {   // staff: the orders mentioned in the thread can be picked to answer about
    if (side !== 'staff') return;
    ms.forEach((m) => { if (m.orderId && !tagOrders.some((o) => o.id === m.orderId)) tagOrders.push({ id: m.orderId, number: m.orderNo }); });
  };

  async function load() {
    try {
      const r = await ds.chatThread(driverId, lastId);
      if (stopped) return;
      if (r.messages.length) {
        msgs = [...msgs, ...r.messages.filter((m) => !msgs.some((x) => x.id === m.id))].sort((a, b) => a.id - b.id);
        lastId = msgs[msgs.length - 1].id;
        addOrders(r.messages);
        paintOrders();
      }
      paint();
      onRead();
    } catch (err) {
      if (!stopped && !msgs.length) list.innerHTML = `<p class="muted ch-empty">${esc(err.message)}</p>`;
    }
  }
  const schedule = () => { timer = setTimeout(async () => { if (!document.hidden) await load(); if (!stopped) schedule(); }, POLL_MS); };

  async function send(body) {
    const text = String(body || '').trim();
    if (!text || sending) return;
    sending = true;
    try {
      const m = await ds.chatSend(driverId, text, order || null);
      if (stopped) return;
      if (!msgs.some((x) => x.id === m.id)) msgs.push(m);
      lastId = Math.max(lastId, m.id);
      input.value = '';
      list.scrollTop = list.scrollHeight;
      paint();
      list.scrollTop = list.scrollHeight;
    } catch (err) { showToast(err.message); }
    sending = false;
  }

  const onClick = (e) => {
    const q = e.target.closest('[data-q]');
    if (q) send(q.dataset.q);
  };
  const onSubmit = (e) => { e.preventDefault(); send(input.value); };
  const onChange = (e) => { if (e.target.matches('[data-order]')) order = e.target.value || null; };
  el.addEventListener('click', onClick);
  el.addEventListener('submit', onSubmit);
  el.addEventListener('change', onChange);
  paintOrders();
  load().then(schedule);

  return {
    setOrder(id) { order = id; paintOrders(); },
    destroy() {
      stopped = true; clearTimeout(timer);
      el.removeEventListener('click', onClick); el.removeEventListener('submit', onSubmit); el.removeEventListener('change', onChange);
    },
  };
}

/* «📞 اتصل بـ…»: the numbers the admin keeps. Opens a small list; each line calls on tap. */
export async function contactsHtml() {
  const list = await ds.contactNumbers().catch(() => []);
  return list.length ? list.map((c) => `
    <a class="btn btn-secondary btn-lg btn-block dr-call" href="tel:${esc(c.phone)}">${icon('phone')}<span>${esc(c.label)}</span><span class="ltr-inline num">${esc(c.phone)}</span></a>`).join('')
    : '<p class="muted">مفيش أرقام متسجلة — الإدارة بتضيفها من الإعدادات.</p>';
}

/* Short two-tone ring for a new message (browsers allow sound only after a tap on the page). */
let audio = null;
export function ring() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    [[988, 0], [1319, 0.15]].forEach(([f, t]) => {
      const o = audio.createOscillator(); const g = audio.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.14);
      o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.16);
    });
  } catch { /* no sound available */ }
}
