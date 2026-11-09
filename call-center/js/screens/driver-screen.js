/* Driver screen («طيار», on his mobile) — 18_driver_tracking.sql.
   CONFIRMED: the branch picks the driver for each order at the cashier; the driver sees ONLY
   the orders picked for him — the order number and the address.
   «طلباتي»: the orders picked for him → ONE «خرجت» for all of them (one trip).
   «معايا»: each order → «سلّمت»: the camera opens INSIDE the page (no gallery), he takes a
   photo of the bag with the ticket showing, and the server records the time (and his place).
   CONFIRMED: «متسلّمش» — the customer did not take it: he picks the reason (or writes it), the
   time and his place are recorded, the call center gets it in the chat, and the card says «رجّعه للفرع».
   CONFIRMED: back at the branch HE taps «رجعت الفرع» — his place is recorded, and the admin
   sees «بعيد عن الفرع» when it is far from the branch. He opens this screen with his own link
   (no password); the admin adds him with his mobile.
   CONFIRMED: while he has orders out (between «خرجت» and «رجعت الفرع») this screen sends his
   place about once a minute for «الطيارين دلوقتي» (admin only). A web page stops sending when the
   phone is locked — the admin then sees how old the last place is. */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { formatRelative, formatTime, housingLabel } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { showToast } from '../components/modal.js';
import { deviceId, deviceLabel } from '../utils/device.js';
import { mountChatBox, openContactsSheet, ring } from '../components/chat-box.js';

const REFRESH_MS = 15000;
const PING_MS = 30000;   // his place, about every 30 seconds while he is out

const addressHtml = (a) => `
  <div class="dr-addr">${icon('pin')}<div><strong>${esc(a.areaName)}</strong> · ${esc(a.street)}
    ${housingLabel(a.housingType) ? ` · ${esc(housingLabel(a.housingType))}` : ''}
    ${a.label ? `<div class="muted">${esc(a.label)}</div>` : ''}${a.notes ? `<div class="muted">${esc(a.notes)}</div>` : ''}</div></div>`;

/* His place when he taps «سلّمت» / «رجعت الفرع» (not a map, not tracking). null when the phone does not give it. */
const position = () => new Promise((done) => {
  if (!navigator.geolocation) { done(null); return; }
  navigator.geolocation.getCurrentPosition(
    (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    () => done(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
});

/* CONFIRMED: the photo comes from the camera only — the live camera opens FULL SCREEN inside the
   page (the same on iPhone and Android), so he sees exactly what he is taking and cannot pick a
   picture from the gallery. Resolves with a small JPEG (1280 px at most), or null if he closes it. */
function takePhoto(orderNumber) {
  return new Promise((done) => {
    let stream = null;
    let blob = null;
    let shotUrl = null;
    const el = document.createElement('div');
    el.className = 'cam-full';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'تصوير التسليم');
    el.innerHTML = `
      <div class="cam-top">
        <button type="button" class="cam-close" data-cancel aria-label="إغلاق">${icon('x')}</button>
        <strong>تسليم طلب <span class="ltr-inline">#${esc(orderNumber)}</span></strong>
      </div>
      <div class="cam-view">
        <video class="cam-video" autoplay playsinline muted data-video></video>
        <img class="cam-shot" alt="صورة التسليم" data-shot hidden>
        <p class="cam-msg" data-err role="alert" hidden></p>
      </div>
      <p class="cam-hint" data-hint>صوّر الكيس وورقة الطلب باينين</p>
      <div class="cam-bar">
        <button type="button" class="cam-snap" data-snap disabled aria-label="صوّر"><span></span></button>
        <button type="button" class="btn btn-secondary btn-lg" data-again hidden>صوّر تاني</button>
        <button type="button" class="btn btn-primary btn-lg" data-use hidden>${icon('check')}تمام — سلّمت</button>
      </div>`;
    document.body.append(el);
    document.body.classList.add('cam-open');
    const $ = (q) => el.querySelector(q);
    const video = $('[data-video]'); const shot = $('[data-shot]'); const err = $('[data-err]'); const hint = $('[data-hint]');
    const snap = $('[data-snap]'); const use = $('[data-use]'); const again = $('[data-again]');
    const showErr = (t) => { err.textContent = t; err.hidden = false; };
    const close = (result) => {
      stream?.getTracks().forEach((t) => t.stop());
      if (shotUrl) URL.revokeObjectURL(shotUrl);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('cam-open');
      el.remove();
      done(result);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    const live = () => {
      shot.hidden = true; video.hidden = false; hint.hidden = false;
      snap.hidden = false; use.hidden = true; again.hidden = true;
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      showErr('الموبايل ده مش بيفتح الكاميرا من الصفحة — افتح اللينك من Chrome أو Safari');
    } else {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
        .then((s) => { stream = s; video.srcObject = s; video.play?.().catch(() => {}); snap.disabled = false; })
        .catch(() => showErr('اسمح للصفحة تستخدم الكاميرا (من إعدادات المتصفح) وجرّب تاني'));
    }

    snap.addEventListener('click', () => {
      const w = video.videoWidth; const h = video.videoHeight;
      if (!w || !h) return;
      const scale = Math.min(1, 1280 / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        if (!b) return;
        blob = b;
        if (shotUrl) URL.revokeObjectURL(shotUrl);
        shotUrl = URL.createObjectURL(b);
        shot.src = shotUrl; shot.hidden = false; video.hidden = true; hint.hidden = true;
        snap.hidden = true; use.hidden = false; again.hidden = false;
      }, 'image/jpeg', 0.7);
    });
    again.addEventListener('click', live);
    use.addEventListener('click', () => close(blob));
    $('[data-cancel]').addEventListener('click', () => close(null));
  });
}

/* «متسلّمش» (34_driver_refused.sql): he picks why — or writes it — and confirms. Resolves with the reason, or null. */
const REFUSE_REASONS = ['العميل رفض يستلم', 'مش بيرد ومش موجود', 'العنوان غلط', 'العميل غيّر رأيه'];
function askRefuseReason(orderNumber) {
  return new Promise((done) => {
    document.querySelector('.call-sheet-wrap')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'call-sheet-wrap';
    wrap.innerHTML = `
      <div class="call-sheet" role="dialog" aria-modal="true" aria-label="الطلب متسلّمش">
        <div class="call-sheet-grip" aria-hidden="true"></div>
        <div class="call-sheet-head"><strong>${icon('alert')}طلب <span class="ltr-inline">#${esc(orderNumber)}</span> متسلّمش — ليه؟</strong>
          <button type="button" class="btn btn-ghost btn-icon" data-sheet-close aria-label="إغلاق">${icon('x')}</button></div>
        <div class="call-sheet-list">
          <div class="rf-reasons">${REFUSE_REASONS.map((q) => `<button type="button" class="rf-reason" data-reason="${esc(q)}">${esc(q)}</button>`).join('')}</div>
          <input class="input" data-other maxlength="200" placeholder="سبب تاني — اكتبه هنا" aria-label="سبب تاني" autocomplete="off">
          <p class="field-error" data-err role="alert"></p>
          <button type="button" class="btn btn-danger btn-lg btn-block" data-ok disabled>${icon('x')}تأكيد — متسلّمش</button>
        </div>
      </div>`;
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-open'));
    let reason = '';
    const other = wrap.querySelector('[data-other]');
    const okBtn = wrap.querySelector('[data-ok]');
    const sync = () => { okBtn.disabled = !(other.value.trim() || reason); };
    const close = (v) => { wrap.classList.remove('is-open'); document.removeEventListener('keydown', onKey); setTimeout(() => wrap.remove(), 200); done(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    other.addEventListener('input', () => {
      if (other.value.trim()) { reason = ''; wrap.querySelectorAll('[data-reason]').forEach((b) => b.classList.remove('is-on')); }
      sync();
    });
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-sheet-close]')) { close(null); return; }
      const r = e.target.closest('[data-reason]');
      if (r) {
        reason = r.dataset.reason; other.value = '';
        wrap.querySelectorAll('[data-reason]').forEach((b) => b.classList.toggle('is-on', b === r));
        sync();
      }
      if (e.target.closest('[data-ok]')) close(other.value.trim() || reason);
    });
  });
}

export function mountDriver(view) {
  view.innerHTML = `
    <div class="page driver-page"><div class="page-inner">
      <div class="page-head">
        <div>
          <h1 class="title-icon">${icon('package')}الطيار</h1>
          <div class="page-sub"><span class="muted" data-updated></span>
            <span class="demo-pill">${icon('info')}بيانات تجريبية</span></div>
        </div>
        <div class="board-actions">
          <button type="button" class="btn btn-secondary" data-contacts>${icon('phone')}اتصل</button>
          <button type="button" class="btn btn-secondary" data-refresh>${icon('repeat')}تحديث</button>
        </div>
      </div>
      <div data-body><p class="muted">جارٍ التحميل…</p></div>
    </div></div>
    <button type="button" class="dr-side" data-trip hidden aria-label="الطلبات اللي خرجت بيها"><span class="dr-side-n num" data-trip-n></span><span>طلباتي</span></button>`;
  const body = view.querySelector('[data-body]');
  let data = null;
  let busy = false;
  let timer = null;
  let stopped = false;
  let watchId = null;
  let lastPos = null;
  let lastSent = 0;

  // His place while he is out: watch the GPS, send at most once a minute; stop when he is back.
  const sendPlace = () => {
    if (!lastPos || Date.now() - lastSent < PING_MS) return;
    lastSent = Date.now();
    ds.driverPing(lastPos).catch(() => {});
  };
  const syncTracking = () => {
    const out = !stopped && !!data?.mine.length;
    if (out && watchId == null && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (p) => { lastPos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }; sendPlace(); },
        () => {}, { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 });
    } else if (!out && watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null; lastPos = null;
    }
  };

  // «طلباتي» on the side: every order he went out with today (also after «رجعت الفرع») —
  // how many, how many delivered / not, and their numbers, trip by trip. Tap → a small list.
  const todayList = () => data?.today ?? data?.mine ?? [];
  const paintTrip = () => {
    const n = todayList().length;
    view.querySelector('[data-trip]').hidden = !n;
    view.querySelector('[data-trip-n]').textContent = n || '';
  };
  const openTrip = () => {
    const list = todayList();
    const withMe = new Set((data?.mine || []).map((o) => o.id));
    const state = (o) => (o.deliveredAt ? ['is-done', 'اتسلّم'] : o.cancelled ? ['is-off', 'اتلغى']
      : o.refusedAt ? ['is-off', 'متسلّمش'] : withMe.has(o.id) ? ['', 'معاك'] : ['is-off', 'رجع بيه الفرع']);
    const done = list.filter((o) => o.deliveredAt).length;
    const notDone = list.filter((o) => !o.deliveredAt && (o.refusedAt || o.cancelled || !withMe.has(o.id))).length;
    const still = list.length - done - notDone;
    const trips = [];
    list.forEach((o) => { let t = trips.find((x) => x.id === (o.tripId || o.id)); if (!t) trips.push(t = { id: o.tripId || o.id, at: o.outAt, orders: [] }); t.orders.push(o); });
    document.querySelector('.call-sheet-wrap')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'call-sheet-wrap';
    wrap.innerHTML = `
      <div class="call-sheet" role="dialog" aria-modal="true" aria-label="طلباتي النهارده">
        <div class="call-sheet-grip" aria-hidden="true"></div>
        <div class="call-sheet-head"><strong>${icon('package')}طلباتي النهارده: <span class="num">${list.length}</span> ${list.length === 1 ? 'طلب' : 'طلبات'}</strong>
          <button type="button" class="btn btn-ghost btn-icon" data-sheet-close aria-label="إغلاق">${icon('x')}</button></div>
        <div class="trip-sum">
          <span class="is-done">${icon('check')}اتسلّم <b class="num">${done}</b></span>
          <span class="is-off">${icon('x')}متسلّمش <b class="num">${notDone}</b></span>
          ${still ? `<span>${icon('package')}لسه معاك <b class="num">${still}</b></span>` : ''}
        </div>
        <div class="call-sheet-list">${trips.map((t, i) => `
          ${trips.length > 1 ? `<p class="trip-head">المشوار ${i + 1} — خرجت ${esc(formatTime(t.at))} بـ ${t.orders.length} ${t.orders.length === 1 ? 'طلب' : 'طلبات'}</p>` : ''}
          ${t.orders.map((o) => { const [cls, txt] = state(o); return `
          <button type="button" class="trip-row ${cls}" ${withMe.has(o.id) ? `data-go="${esc(o.id)}"` : ''}>
            <strong class="ltr-inline num">#${esc(o.number)}</strong><span class="trip-area">${esc(o.areaName ?? o.address?.areaName ?? '')}</span><span class="trip-st">${txt}</span>
          </button>`; }).join('')}`).join('')}</div>
      </div>`;
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-open'));
    const close = () => { wrap.classList.remove('is-open'); document.removeEventListener('keydown', onKey); setTimeout(() => wrap.remove(), 200); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { close(); view.querySelector(`[data-oid="${CSS.escape(go.dataset.go)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (e.target === wrap || e.target.closest('[data-sheet-close]')) close();
    });
  };

  function render() {
    paintTrip();
    const { ready, mine } = data;
    const open = mine.filter((o) => !o.deliveredAt && !o.cancelled && !o.refusedAt);
    body.innerHTML = `
      ${ready.length ? `
      <section class="dr-section">
        <h2 class="section-title">${icon('clipboard')}طلباتي — جاهزة تخرج <span class="b-count num">${ready.length}</span></h2>
        <p class="muted">الفرع حدّد الطلبات دي ليك. خدها كلها واضغط «خرجت».</p>
        ${ready.map((o) => `
          <article class="card dr-card">
            <header class="dr-head"><strong class="dr-no num">#${esc(o.number)}</strong>
              <span class="muted">اتحددت ليك ${esc(formatRelative(o.assignedAt))}</span></header>
            ${addressHtml(o.address)}
          </article>`).join('')}
        <button type="button" class="btn btn-primary btn-lg btn-block dr-go" data-take ${busy ? 'disabled' : ''}>${icon('chevronLeft')}خرجت (${ready.length} ${ready.length === 1 ? 'طلب' : 'طلبات'})</button>
      </section>` : ''}
      <section class="dr-section">
        <h2 class="section-title">${icon('package')}معايا <span class="b-count num">${open.length}</span></h2>
        ${mine.length ? mine.map((o) => `
          <article class="card dr-card ${o.deliveredAt ? 'is-done' : ''} ${o.cancelled ? 'is-cancelled' : ''} ${o.refusedAt && !o.deliveredAt ? 'is-refused' : ''}" data-oid="${esc(o.id)}">
            <header class="dr-head"><strong class="dr-no num">#${esc(o.number)}</strong>
              ${o.tripSize > 1 ? `<span class="tag tag-info">${o.tripSeq} من ${o.tripSize}</span>` : ''}
              <span class="muted">خرج ${esc(formatTime(o.outAt))}</span></header>
            ${addressHtml(o.address)}
            ${!o.deliveredAt && !o.cancelled && o.phones?.length ? `<div class="dr-phones">${o.phones.map((ph, i) => `
              <a class="btn btn-secondary btn-lg dr-call" href="tel:${esc(ph)}">${icon('phone')}<span>${o.phones.length > 1 ? `اتصل بالعميل (${i + 1})` : 'اتصل بالعميل'}</span><span class="ltr-inline num">${esc(ph)}</span></a>`).join('')}</div>` : ''}
            ${!o.deliveredAt && !o.cancelled ? `<button type="button" class="btn btn-soft btn-block dr-msg" data-chat-order="${esc(o.id)}" ${chatOn ? '' : 'hidden'}>${icon('chat')}<span data-chat-label>رسالة للكول سنتر عن الطلب ده</span></button>` : ''}
            ${o.cancelled ? `<div class="alert alert-danger">${icon('alert')}<span>الطلب ده اتلغى — رجّعه للفرع</span></div>` : ''}
            ${o.deliveredAt ? `<div class="dr-done">${icon('check')}اتسلّم ${esc(formatTime(o.deliveredAt))}</div>`
              : o.cancelled ? '' : o.refusedAt ? `
              <div class="alert alert-danger dr-refused">${icon('x')}<span><strong>متسلّمش</strong> — ${esc(o.refusedReason)} · ${esc(formatTime(o.refusedAt))}<br>رجّعه للفرع</span></div>
              <button type="button" class="btn btn-ghost btn-block dr-late" data-deliver ${busy ? 'disabled' : ''}>${icon('check')}العميل استلم في الآخر؟ صوّر الطلب</button>` : `
              <div class="dr-actions">
                <button type="button" class="btn btn-primary btn-lg" data-deliver ${busy ? 'disabled' : ''}>${icon('check')}سلّمت — صوّر الطلب</button>
                <button type="button" class="btn btn-danger-soft btn-lg" data-refuse ${busy ? 'disabled' : ''}>${icon('x')}متسلّمش</button>
              </div>`}
          </article>`).join('')
          : `<p class="muted dr-empty">${ready.length ? 'اضغط «خرجت» الأول' : 'مفيش طلبات معاك دلوقتي — الفرع هيحدّدلك الطلبات'}</p>`}
        ${mine.length ? `
        <button type="button" class="btn ${open.length ? 'btn-secondary' : 'btn-primary'} btn-lg btn-block dr-back" data-back ${busy ? 'disabled' : ''}>${icon('arrowRight')}رجعت الفرع</button>` : ''}
      </section>`;
  }

  async function load() {
    try {
      const d = await ds.getDriverOrders();
      if (stopped) return;
      data = d;
      render();
      paintUnread();
      syncTracking();
      view.querySelector('[data-updated]').textContent = `آخر تحديث ${formatTime(new Date().toISOString())}`;
    } catch (err) {
      if (stopped) return;
      if (!data) body.innerHTML = `<div class="card card-pad center-note">${icon('alert')}<h3>${esc(err.message)}</h3></div>`;
      else view.querySelector('[data-updated]').textContent = 'تعذر التحديث — جارٍ المحاولة مرة أخرى';
    }
  }
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => { if (!document.hidden && !busy) await load(); if (!stopped) schedule(); }, REFRESH_MS);
  };
  const run = async (fn, done) => {
    busy = true; render();
    try { await fn(); if (done) showToast(done); } catch (err) { showToast(err.message); }
    busy = false;
    await load();
  };

  // «الشات» with the call center + «اتصل بـ…» (30_driver_chat.sql). Hidden until the database has it.
  let chatBox = null;
  let chatEl = null;
  let unread = 0;
  let chatTimer = null;
  // No floating «الشات» button: a new message from the call center turns «رسالة في الشات» red on his orders.
  let chatOn = false;
  const paintUnread = () => {
    view.querySelectorAll('[data-chat-order]').forEach((b) => {
      b.hidden = !chatOn;
      b.classList.toggle('has-new', !!unread);
      const label = b.querySelector('[data-chat-label]');
      if (label) label.textContent = unread ? `رسالة جديدة من الكول سنتر (${unread > 9 ? '9+' : unread})` : 'رسالة للكول سنتر عن الطلب ده';
    });
  };
  const checkUnread = async () => {
    const r = await ds.chatUnread().catch(() => null);
    if (stopped || !r) return;
    chatOn = true;
    if (r.unread > unread && !chatEl) { ring(); showToast('💬 رسالة جديدة من الكول سنتر'); }
    unread = chatEl ? 0 : r.unread;
    paintUnread();
  };
  const scheduleChat = () => { chatTimer = setTimeout(async () => { if (!document.hidden) await checkUnread(); if (!stopped) scheduleChat(); }, REFRESH_MS); };
  const closeChat = () => {
    chatBox?.destroy(); chatBox = null;
    chatEl?.remove(); chatEl = null;
    document.body.classList.remove('cam-open');
    checkUnread();
  };
  const openChat = (orderId = null) => {
    if (chatEl) { chatBox?.setOrder(orderId); return; }
    chatEl = document.createElement('div');
    chatEl.className = 'chat-full';
    chatEl.setAttribute('role', 'dialog');
    chatEl.setAttribute('aria-label', 'الشات مع الكول سنتر');
    chatEl.innerHTML = `
      <div class="chat-top">
        <button type="button" class="btn btn-ghost btn-icon" data-chat-close aria-label="رجوع">${icon('arrowRight')}</button>
        <strong>الشات مع الكول سنتر</strong>
        <button type="button" class="btn btn-secondary btn-sm" data-contacts>${icon('phone')}اتصل</button>
      </div>
      <div class="chat-box" data-box></div>`;
    document.body.append(chatEl);
    document.body.classList.add('cam-open');
    const open = (data?.mine || []).filter((o) => !o.deliveredAt && !o.cancelled).map((o) => ({ id: o.id, number: o.number }));
    chatBox = mountChatBox(chatEl.querySelector('[data-box]'), { side: 'driver', orders: open, orderId,
      onRead: () => { unread = 0; paintUnread(); } });
    chatEl.querySelector('[data-chat-close]').addEventListener('click', closeChat);
    chatEl.querySelector('[data-contacts]').addEventListener('click', openContacts);
  };
  const openContacts = () => openContactsSheet();
  checkUnread().then(scheduleChat);

  const offs = [
    on(view, 'click', '[data-chat-order]', (e, b) => openChat(b.dataset.chatOrder)),
    on(view, 'click', '[data-contacts]', () => openContacts()),
    on(view, 'click', '[data-take]', () => {
      const n = data.ready.length;
      run(() => ds.driverTake(), n === 1 ? 'خرجت بطلب واحد' : `خرجت بـ ${n} طلبات`);
    }),
    on(view, 'click', '[data-deliver]', async (e, btn) => {
      const id = btn.closest('[data-oid]').dataset.oid;
      const o = data.mine.find((x) => x.id === id);
      busy = true;
      const placing = position();              // his place, while he takes the photo
      const photo = await takePhoto(o?.number ?? '');
      busy = false;
      if (!photo) return;
      const pos = await Promise.race([placing, new Promise((r) => setTimeout(() => r(null), 4000))]);
      run(() => ds.driverDelivered(id, photo, pos), pos ? 'تم تسجيل التسليم ✓' : 'تم تسجيل التسليم ✓ (من غير مكان)');
    }),
    on(view, 'click', '[data-refuse]', async (e, btn) => {
      const id = btn.closest('[data-oid]').dataset.oid;
      const o = data.mine.find((x) => x.id === id);
      const placing = position();              // his place, while he picks the reason
      const reason = await askRefuseReason(o?.number ?? '');
      if (!reason) return;
      const pos = await Promise.race([placing, new Promise((r) => setTimeout(() => r(null), 4000))]);
      run(() => ds.driverRefused(id, reason, pos), 'اتسجّل إن الطلب متسلّمش — رجّعه للفرع');
    }),
    on(view, 'click', '[data-back]', async () => {
      const left = data.mine.filter((o) => !o.deliveredAt && !o.cancelled && !o.refusedAt).length;
      if (left && !window.confirm(left === 1 ? 'فيه طلب لسه ما اتسلّمش — رجعت بيه الفرع؟' : `فيه ${left} طلبات لسه ما اتسلّمتش — رجعت بيهم الفرع؟`)) return;
      busy = true; render();
      const pos = await Promise.race([position(), new Promise((r) => setTimeout(() => r(null), 8000))]);
      busy = false;
      run(() => ds.driverReturned(pos), pos ? 'تم تسجيل رجوعك ✓' : 'تم تسجيل رجوعك ✓ (من غير مكان — شغّل اللوكيشن)');
    }),
    on(view, 'click', '[data-refresh]', () => load()),
    on(view, 'click', '[data-trip]', () => openTrip()),
  ];
  const onVisible = () => {
    if (document.hidden) return;
    lastSent = 0; sendPlace();               // back on the screen: send his place now
    if (!busy) load();
  };
  document.addEventListener('visibilitychange', onVisible);

  load().then(schedule);
  // Which phone opened this link (the admin is alerted if it's not his usual phone — nothing is blocked).
  const id = deviceId();
  if (id) deviceLabel().then((label) => ds.driverDevice(id, label)).catch(() => {});
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(chatTimer);
    if (chatEl) closeChat();
    syncTracking();
    document.removeEventListener('visibilitychange', onVisible);
    offs.forEach((f) => f());
  };
}
