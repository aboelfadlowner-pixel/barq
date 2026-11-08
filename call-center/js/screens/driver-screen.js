/* Driver screen («طيار», on his mobile) — 18_driver_tracking.sql.
   CONFIRMED: the branch picks the driver for each order at the cashier; the driver sees ONLY
   the orders picked for him — the order number and the address.
   «طلباتي»: the orders picked for him → ONE «خرجت» for all of them (one trip).
   «معايا»: each order → «سلّمت»: the camera opens INSIDE the page (no gallery), he takes a
   photo of the bag with the ticket showing, and the server records the time (and his place).
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
import { mountChatBox, contactsHtml, ring } from '../components/chat-box.js';
import { openModal } from '../components/modal.js';

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
    <button type="button" class="dr-chat-fab" data-chat hidden>${icon('chat')}<span>الشات</span><span class="dr-chat-n num" data-chat-n hidden></span></button>`;
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

  function render() {
    const { ready, mine } = data;
    const open = mine.filter((o) => !o.deliveredAt && !o.cancelled);
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
          <article class="card dr-card ${o.deliveredAt ? 'is-done' : ''} ${o.cancelled ? 'is-cancelled' : ''}" data-oid="${esc(o.id)}">
            <header class="dr-head"><strong class="dr-no num">#${esc(o.number)}</strong>
              ${o.tripSize > 1 ? `<span class="tag tag-info">${o.tripSeq} من ${o.tripSize}</span>` : ''}
              <span class="muted">خرج ${esc(formatTime(o.outAt))}</span></header>
            ${addressHtml(o.address)}
            ${!o.deliveredAt && !o.cancelled && o.phones?.length ? `<div class="dr-phones">${o.phones.map((ph, i) => `
              <a class="btn btn-secondary btn-lg dr-call" href="tel:${esc(ph)}">${icon('phone')}<span>${o.phones.length > 1 ? `اتصل بالعميل (${i + 1})` : 'اتصل بالعميل'}</span><span class="ltr-inline num">${esc(ph)}</span></a>`).join('')}</div>` : ''}
            ${!o.deliveredAt && !o.cancelled ? `<button type="button" class="btn btn-soft btn-block dr-msg" data-chat-order="${esc(o.id)}">${icon('chat')}رسالة للكول سنتر عن الطلب ده</button>` : ''}
            ${o.cancelled ? `<div class="alert alert-danger">${icon('alert')}<span>الطلب ده اتلغى — رجّعه للفرع</span></div>` : ''}
            ${o.deliveredAt ? `<div class="dr-done">${icon('check')}اتسلّم ${esc(formatTime(o.deliveredAt))}</div>`
              : o.cancelled ? '' : `
              <button type="button" class="btn btn-primary btn-lg btn-block" data-deliver ${busy ? 'disabled' : ''}>${icon('check')}سلّمت — صوّر الطلب</button>`}
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
  const fab = view.querySelector('[data-chat]');
  const paintUnread = () => {
    const n = view.querySelector('[data-chat-n]');
    n.hidden = !unread; n.textContent = unread > 9 ? '9+' : String(unread);
    fab.classList.toggle('has-new', !!unread);
  };
  const checkUnread = async () => {
    const r = await ds.chatUnread().catch(() => null);
    if (stopped || !r) return;
    fab.hidden = false;
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
  async function openContacts() {
    const m = openModal({ title: `${icon('phone')} اتصل بـ…`, size: 'sm', body: '<p class="muted">جارٍ التحميل…</p>',
      footer: '<button type="button" class="btn btn-secondary" data-close>إغلاق</button>' });
    m.body.innerHTML = `<div class="dr-phones">${await contactsHtml()}</div>`;
  }
  checkUnread().then(scheduleChat);

  const offs = [
    on(view, 'click', '[data-chat]', () => openChat()),
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
    on(view, 'click', '[data-back]', async () => {
      const left = data.mine.filter((o) => !o.deliveredAt && !o.cancelled).length;
      if (left && !window.confirm(left === 1 ? 'فيه طلب لسه ما اتسلّمش — رجعت بيه الفرع؟' : `فيه ${left} طلبات لسه ما اتسلّمتش — رجعت بيهم الفرع؟`)) return;
      busy = true; render();
      const pos = await Promise.race([position(), new Promise((r) => setTimeout(() => r(null), 8000))]);
      busy = false;
      run(() => ds.driverReturned(pos), pos ? 'تم تسجيل رجوعك ✓' : 'تم تسجيل رجوعك ✓ (من غير مكان — شغّل اللوكيشن)');
    }),
    on(view, 'click', '[data-refresh]', () => load()),
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
