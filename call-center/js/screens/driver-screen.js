/* Driver screen («طيار», on his mobile) — 18_driver_tracking.sql.
   CONFIRMED: he sees ONLY the order number and the address.
   «جاهزة للخروج»: the orders at the cashier — he ticks the ones he takes and taps «خرجت»
   (several orders = one trip). «معايا»: his orders — «سلّمت» opens the camera, he takes a photo
   of the bag with the ticket showing, and the server records the time (and his place).
   The branch taps «الطيار رجع» when he is back. */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { formatRelative, formatTime, housingLabel } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { confirmDialog, openModal, showToast } from '../components/modal.js';

const REFRESH_MS = 15000;

const addressHtml = (a) => `
  <div class="dr-addr">${icon('pin')}<div><strong>${esc(a.areaName)}</strong> · ${esc(a.street)}
    ${housingLabel(a.housingType) ? ` · ${esc(housingLabel(a.housingType))}` : ''}
    ${a.label ? `<div class="muted">${esc(a.label)}</div>` : ''}${a.notes ? `<div class="muted">${esc(a.notes)}</div>` : ''}</div></div>`;

/* The photo, made small on the phone before it is sent (about 150 KB). */
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.7));
  } finally { URL.revokeObjectURL(url); }
}

/* His place when he taps «سلّمت» (not a map, not tracking). null when the phone does not give it. */
const position = () => new Promise((done) => {
  if (!navigator.geolocation) { done(null); return; }
  navigator.geolocation.getCurrentPosition(
    (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    () => done(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
});

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
      <input type="file" accept="image/*" capture="environment" data-camera hidden>
    </div></div>`;
  const body = view.querySelector('[data-body]');
  const camera = view.querySelector('[data-camera]');
  let data = null;
  const picked = new Set();
  let busy = false;
  let timer = null;
  let stopped = false;
  let delivering = null;     // order id waiting for its photo

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
    for (const id of [...picked]) if (!data.ready.some((o) => o.id === id)) picked.delete(id);
    const mine = data.mine;
    const open = mine.filter((o) => !o.deliveredAt);
    body.innerHTML = `
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
              <button type="button" class="btn btn-primary btn-lg btn-block" data-deliver ${busy ? 'disabled' : ''}>${icon('check')}سلّمت — صوّر الطلب</button>
              <button type="button" class="link-btn dr-untake" data-untake ${busy ? 'disabled' : ''}>مأخدتهوش — رجّعه للكاشير</button>`}
          </article>`).join('') : '<p class="muted dr-empty">مفيش طلبات معاك دلوقتي</p>'}
      </section>
      <section class="dr-section">
        <h2 class="section-title">${icon('clipboard')}جاهزة للخروج <span class="b-count num">${data.ready.length}</span></h2>
        <p class="muted">علّم على الطلبات اللي هتاخدها، وبعدين اضغط «خرجت».</p>
        ${data.ready.length ? data.ready.map((o) => `
          <label class="card dr-card dr-pick ${picked.has(o.id) ? 'is-picked' : ''}">
            <input type="checkbox" data-pick="${esc(o.id)}" ${picked.has(o.id) ? 'checked' : ''}>
            <div class="grow"><header class="dr-head"><strong class="dr-no num">#${esc(o.number)}</strong>
              <span class="muted">على الكاشير ${esc(formatRelative(o.atCashierAt))}</span></header>
              ${addressHtml(o.address)}</div>
          </label>`).join('') : '<p class="muted dr-empty">مفيش طلبات على الكاشير</p>'}
      </section>
      <div class="dr-bar" ${picked.size ? '' : 'hidden'}>
        <button type="button" class="btn btn-primary btn-lg btn-block" data-take ${busy ? 'disabled' : ''}>${icon('chevronLeft')}خرجت (${picked.size} ${picked.size === 1 ? 'طلب' : 'طلبات'})</button>
      </div>`;
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
    timer = setTimeout(async () => { if (!document.hidden && !busy && !delivering) await load(); if (!stopped) schedule(); }, REFRESH_MS);
  };
  const run = async (fn, done) => {
    busy = true; render();
    try { await fn(); if (done) showToast(done); } catch (err) { showToast(err.message); }
    busy = false;
    await load();
  };

  /* «سلّمت»: photo → (his place) → look at it → «تأكيد». */
  async function confirmPhoto(orderId, file) {
    const o = data.mine.find((x) => x.id === orderId);
    let photo;
    try { photo = await shrink(file); } catch { showToast('الصورة ما اتقرتش — صوّر تاني'); return; }
    const preview = URL.createObjectURL(photo);
    const m = openModal({
      title: `${icon('check')} تسليم طلب <span class="ltr-inline">#${esc(o?.number ?? '')}</span>`,
      size: 'sm',
      body: `<img class="dr-preview" src="${preview}" alt="صورة التسليم">
        <p class="muted">اتأكد إن الكيس وورقة الطلب باينين في الصورة.</p>
        <div class="muted" data-place>${icon('pin')}جارٍ تحديد مكانك…</div>`,
      footer: `
        <button type="button" class="btn btn-primary btn-lg" data-ok>${icon('check')}تأكيد التسليم</button>
        <button type="button" class="btn btn-secondary btn-lg" data-retake>صوّر تاني</button>`,
    });
    let pos = null;
    const placed = position().then((p) => {
      pos = p;
      const el = m.body.querySelector('[data-place]');
      if (el) el.innerHTML = p ? `${icon('check')}اتحدد مكانك` : `${icon('alert')}المكان مش متاح — هيتسجل التسليم من غير مكان`;
    });
    m.onClose(() => URL.revokeObjectURL(preview));
    m.foot.querySelector('[data-retake]').addEventListener('click', () => { m.close(); delivering = orderId; camera.value = ''; camera.click(); });
    m.foot.querySelector('[data-ok]').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      await Promise.race([placed, new Promise((r) => setTimeout(r, 4000))]);
      m.close();
      run(() => ds.driverDelivered(orderId, photo, pos), 'تم تسجيل التسليم ✓');
    });
  }

  const offs = [
    on(view, 'submit', '[data-phone-form]', async (e, form) => {
      e.preventDefault();
      try { await ds.setPhone(null, form.phone.value); await load(); }
      catch (err) { form.querySelector('[data-err="phone"]').textContent = err.message; }
    }),
    on(view, 'change', '[data-pick]', (e, box) => {
      if (box.checked) picked.add(box.dataset.pick); else picked.delete(box.dataset.pick);
      render();
    }),
    on(view, 'click', '[data-take]', () => {
      // keep the order he ticked them in (= the order he will deliver them)
      const ids = [...picked];
      run(async () => { await ds.driverTake(ids); picked.clear(); }, ids.length === 1 ? 'خرجت بطلب واحد' : `خرجت بـ ${ids.length} طلبات`);
    }),
    on(view, 'click', '[data-deliver]', (e, btn) => { delivering = btn.closest('[data-oid]').dataset.oid; camera.value = ''; camera.click(); }),
    on(view, 'click', '[data-untake]', async (e, btn) => {
      const id = btn.closest('[data-oid]').dataset.oid;
      if (!(await confirmDialog({ title: 'مأخدتهوش', message: 'الطلب هيرجع «على الكاشير» لطيار تاني.', confirmLabel: 'رجّعه' }))) return;
      run(() => ds.driverUntake(id), 'رجع على الكاشير');
    }),
    on(view, 'click', '[data-refresh]', () => load()),
  ];
  camera.addEventListener('change', () => {
    const file = camera.files?.[0];
    const id = delivering;
    delivering = null;
    if (file && id) confirmPhoto(id, file);
  });
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
