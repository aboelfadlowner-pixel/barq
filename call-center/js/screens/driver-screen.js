/* Driver screen («طيار», on his mobile) — 18_driver_tracking.sql.
   CONFIRMED: the branch picks the driver for each order at the cashier; the driver sees ONLY
   the orders picked for him — the order number and the address.
   «طلباتي»: the orders picked for him → ONE «خرجت» for all of them (one trip).
   «معايا»: each order → «سلّمت»: the camera opens INSIDE the page (no gallery), he takes a
   photo of the bag with the ticket showing, and the server records the time (and his place).
   The branch taps «الطيار رجع» when he is back. */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { formatRelative, formatTime, housingLabel } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { openModal, showToast } from '../components/modal.js';

const REFRESH_MS = 15000;

const addressHtml = (a) => `
  <div class="dr-addr">${icon('pin')}<div><strong>${esc(a.areaName)}</strong> · ${esc(a.street)}
    ${housingLabel(a.housingType) ? ` · ${esc(housingLabel(a.housingType))}` : ''}
    ${a.label ? `<div class="muted">${esc(a.label)}</div>` : ''}${a.notes ? `<div class="muted">${esc(a.notes)}</div>` : ''}</div></div>`;

/* His place when he taps «سلّمت» (not a map, not tracking). null when the phone does not give it. */
const position = () => new Promise((done) => {
  if (!navigator.geolocation) { done(null); return; }
  navigator.geolocation.getCurrentPosition(
    (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    () => done(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
});

/* CONFIRMED: the photo comes from the camera only — the live camera opens inside the page,
   so there is no way to pick a picture from the gallery. Resolves with a small JPEG (about
   150 KB, 1280 px at most), or null if he closes it. */
function takePhoto(orderNumber) {
  return new Promise((done) => {
    let stream = null;
    let result = null;
    const m = openModal({
      title: `${icon('check')} تسليم طلب <span class="ltr-inline">#${esc(orderNumber)}</span>`,
      size: 'sm',
      body: `
        <div class="dr-cam">
          <video class="dr-video" autoplay playsinline muted data-video></video>
          <img class="dr-preview" alt="صورة التسليم" data-shot hidden>
        </div>
        <p class="muted" data-hint>صوّر الكيس وورقة الطلب باينين.</p>
        <div class="field-error" data-err="cam" role="alert"></div>`,
      footer: `
        <button type="button" class="btn btn-primary btn-lg" data-snap disabled>${icon('check')}صوّر</button>
        <button type="button" class="btn btn-primary btn-lg" data-use hidden>${icon('check')}تمام — سلّمت</button>
        <button type="button" class="btn btn-secondary btn-lg" data-again hidden>صوّر تاني</button>`,
    });
    const video = m.body.querySelector('[data-video]');
    const shot = m.body.querySelector('[data-shot]');
    const err = m.body.querySelector('[data-err="cam"]');
    const [snap, use, again] = ['[data-snap]', '[data-use]', '[data-again]'].map((s) => m.foot.querySelector(s));
    let blob = null;
    let shotUrl = null;
    const stop = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
    const live = () => {
      shot.hidden = true; video.hidden = false;
      snap.hidden = false; use.hidden = true; again.hidden = true;
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      err.textContent = 'الموبايل ده مش بيفتح الكاميرا من الصفحة — افتح اللينك من Chrome';
    } else {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
        .then((s) => { stream = s; video.srcObject = s; snap.disabled = false; })
        .catch(() => { err.textContent = 'اسمح للصفحة تستخدم الكاميرا (من علامة القفل جنب اللينك) وجرّب تاني'; });
    }

    snap.addEventListener('click', () => {
      const w = video.videoWidth; const h = video.videoHeight;
      if (!w || !h) return;
      const scale = Math.min(1, 1280 / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      c.toBlob((b) => {
        blob = b;
        if (shotUrl) URL.revokeObjectURL(shotUrl);
        shotUrl = URL.createObjectURL(b);
        shot.src = shotUrl; shot.hidden = false; video.hidden = true;
        snap.hidden = true; use.hidden = false; again.hidden = false;
      }, 'image/jpeg', 0.7);
    });
    again.addEventListener('click', live);
    use.addEventListener('click', () => { result = blob; m.close(); });
    m.onClose(() => { stop(); if (shotUrl) URL.revokeObjectURL(shotUrl); done(result); });
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
        <div class="board-actions"><button type="button" class="btn btn-secondary" data-refresh>${icon('repeat')}تحديث</button></div>
      </div>
      <div data-body><p class="muted">جارٍ التحميل…</p></div>
    </div></div>`;
  const body = view.querySelector('[data-body]');
  let data = null;
  let busy = false;
  let timer = null;
  let stopped = false;

  function render() {
    if (!data.phone) {
      body.innerHTML = `
        <form class="card card-pad dr-phone" data-phone-form novalidate>
          <h2>رقم موبايلك</h2>
          <p class="muted">بيتكتب مرة واحدة، ويظهر للفرع على الطلبات اللي خرجت معاك.</p>
          <input class="input input-lg ltr" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx">
          <div class="field-error" data-err="phone"></div>
          <button type="submit" class="btn btn-primary btn-lg btn-block">${icon('check')}حفظ</button>
        </form>`;
      return;
    }
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
            ${o.cancelled ? `<div class="alert alert-danger">${icon('alert')}<span>الطلب ده اتلغى — رجّعه للفرع</span></div>` : ''}
            ${o.deliveredAt ? `<div class="dr-done">${icon('check')}اتسلّم ${esc(formatTime(o.deliveredAt))}</div>`
              : o.cancelled ? '' : `
              <button type="button" class="btn btn-primary btn-lg btn-block" data-deliver ${busy ? 'disabled' : ''}>${icon('check')}سلّمت — صوّر الطلب</button>`}
          </article>`).join('')
          : `<p class="muted dr-empty">${ready.length ? 'اضغط «خرجت» الأول' : 'مفيش طلبات معاك دلوقتي — الفرع هيحدّدلك الطلبات'}</p>`}
      </section>`;
  }

  async function load() {
    try {
      const d = await ds.getDriverOrders();
      if (stopped) return;
      data = d;
      render();
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

  const offs = [
    on(view, 'submit', '[data-phone-form]', async (e, form) => {
      e.preventDefault();
      try { await ds.setPhone(null, form.phone.value); await load(); }
      catch (err) { form.querySelector('[data-err="phone"]').textContent = err.message; }
    }),
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
    on(view, 'click', '[data-refresh]', () => load()),
  ];
  const onVisible = () => { if (!document.hidden && !busy) load(); };
  document.addEventListener('visibilitychange', onVisible);

  load().then(schedule);
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    offs.forEach((f) => f());
  };
}
