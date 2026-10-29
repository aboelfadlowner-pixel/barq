/* «الطيارين دلوقتي» (admin, on the «التوصيل» page): the drivers out now on a map, each with how
   old his last place is. The place comes from his screen while he is out (18_driver_tracking.sql);
   a locked phone stops sending, so an old place is shown in red. Refreshes every 20 seconds.
   The map follows the drivers (close zoom) until the admin moves it; «على الخريطة» zooms to one
   driver, «كل الطيارين» shows them all again. The light circle = how exact the phone's place is.
   The map is OpenStreetMap (free, no key); without it the list still works, with map links. */
import * as ds from '../data/data-source.js';
import { esc } from '../utils/dom.js';
import { formatTime } from '../utils/format.js';
import { icon } from './icons.js';

const REFRESH_MS = 20000;
const STALE_MIN = 5;   // older than this: shown in red
const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';

let leaflet = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  leaflet ??= new Promise((done, fail) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = `${LEAFLET}leaflet.css`;
    document.head.append(css);
    const js = document.createElement('script');
    js.src = `${LEAFLET}leaflet.js`;
    js.onload = () => done(window.L);
    js.onerror = () => { leaflet = null; fail(new Error('map')); };
    document.head.append(js);
  });
  return leaflet;
}

const agoMin = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)) : null);
const agoText = (m) => (m == null ? 'لسه مبعتش مكانه' : m < 1 ? 'دلوقتي' : `من ${m} دقيقة`);

export function mountDriversNow(el) {
  el.innerHTML = `
    <section class="dn card card-pad" data-dn hidden>
      <h2 class="section-title dn-title">${icon('pin')}الطيارين دلوقتي <span class="b-count num" data-dn-count>0</span>
        <span class="muted dn-sub">بيتحدث كل 20 ثانية</span>
        <button type="button" class="btn btn-soft btn-sm dn-all" data-dn-all hidden>${icon('pin')}كل الطيارين</button></h2>
      <div class="dn-map" data-dn-map hidden></div>
      <ul class="dn-list" data-dn-list></ul>
    </section>`;
  const box = el.querySelector('[data-dn]');
  const list = el.querySelector('[data-dn-list]');
  const mapEl = el.querySelector('[data-dn-map]');
  let map = null;
  let layer = null;
  let follow = true;          // the map follows the drivers until the admin moves / zooms it
  let rowsNow = [];
  let timer = null;
  let stopped = false;

  const paintMap = async (rows, branch) => {
    const placed = rows.filter((r) => r.lat != null);
    let L;
    try { L = await loadLeaflet(); } catch { mapEl.hidden = true; return; }
    if (stopped) return;
    mapEl.hidden = false;
    if (!map) {
      map = L.map(mapEl, { zoomControl: true, attributionControl: true });
      // the admin moved or zoomed the map: stop following (until «كل الطيارين»)
      const stopFollow = () => { follow = false; el.querySelector('[data-dn-all]').hidden = false; };
      map.on('dragstart', stopFollow);
      map.on('zoomstart', () => { if (!fitting) stopFollow(); });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      layer = L.layerGroup().addTo(map);
    }
    layer.clearLayers();
    const pts = [];
    if (branch?.lat != null) {
      L.circleMarker([branch.lat, branch.lng], { radius: 8, color: '#1f5c3a', fillColor: '#1f5c3a', fillOpacity: 1 })
        .bindTooltip('الفرع', { permanent: true, direction: 'top' }).addTo(layer);
    }
    placed.forEach((r) => {
      const old = agoMin(r.seenAt) > STALE_MIN;
      const color = old ? '#b42318' : '#b7791f';
      if (r.accuracy) L.circle([r.lat, r.lng], { radius: Math.min(r.accuracy, 500), color, weight: 1, fillOpacity: 0.08 }).addTo(layer);
      L.circleMarker([r.lat, r.lng], { radius: 10, color: '#fff', weight: 3, fillColor: old ? '#f04438' : '#f5b301', fillOpacity: 1 })
        .bindTooltip(`<strong>${esc(r.name)}</strong> · ${agoText(agoMin(r.seenAt))}`, { permanent: true, direction: 'top', offset: [0, -8] }).addTo(layer);
      pts.push([r.lat, r.lng]);
    });
    map.invalidateSize();
    if (follow && pts.length) fitAll(pts);
  };
  // close on the drivers (one driver: street level); the branch is shown but not forced in view
  let fitting = false;        // our own zoom (not the admin's)
  const fitAll = (pts) => {
    fitting = true;
    if (pts.length === 1) map.setView(pts[0], 17, { animate: false });
    else map.fitBounds(pts, { padding: [50, 50], maxZoom: 17, animate: false });
    fitting = false;
  };

  const load = async () => {
    let rows;
    let branch = null;
    try { [rows, branch] = await Promise.all([ds.driversNow(), ds.branchPlace().catch(() => null)]); } catch { return; }
    if (stopped || rows == null) return;   // not installed yet: the section stays hidden
    box.hidden = false;
    rowsNow = rows;
    el.querySelector('[data-dn-count]').textContent = rows.length;
    list.innerHTML = rows.length ? rows.map((r) => {
      const m = agoMin(r.seenAt);
      const old = m == null || m > STALE_MIN;
      return `
        <li class="dn-row">
          <div class="grow"><strong>${esc(r.name)}</strong>
            <div class="muted">${r.orders} ${r.orders === 1 ? 'طلب' : 'طلبات'} · اتسلّم ${r.delivered} · خرج <span class="num">${formatTime(r.outAt)}</span></div></div>
          <span class="tag ${old ? 'tag-far' : 'tag-green'}">${icon('clock')}${agoText(m)}</span>
          ${r.lat != null ? `<button type="button" class="btn btn-soft btn-sm" data-dn-focus="${esc(r.userId)}">${icon('pin')}على الخريطة</button>
            <a class="link-btn" href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank" rel="noopener">جوجل ماب</a>` : ''}
          ${r.phone ? `<a class="link-btn ltr-inline" href="tel:${esc(r.phone)}">${icon('phone')}${esc(r.phone)}</a>` : ''}
        </li>`;
    }).join('') : '<li class="muted dn-empty">مفيش طيارين بره دلوقتي</li>';
    if (rows.some((r) => r.lat != null)) paintMap(rows, branch);
    else mapEl.hidden = true;
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => { if (!document.hidden) await load(); if (!stopped) schedule(); }, REFRESH_MS);
  };
  el.addEventListener('click', (e) => {
    const f = e.target.closest('[data-dn-focus]');
    if (f && map) {
      const r = rowsNow.find((x) => x.userId === f.dataset.dnFocus);
      if (r?.lat != null) {
        follow = false;
        el.querySelector('[data-dn-all]').hidden = false;
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        fitting = true; map.setView([r.lat, r.lng], 18, { animate: false }); fitting = false;
      }
    }
    if (e.target.closest('[data-dn-all]') && map) {
      follow = true;
      el.querySelector('[data-dn-all]').hidden = true;
      const pts = rowsNow.filter((r) => r.lat != null).map((r) => [r.lat, r.lng]);
      if (pts.length) fitAll(pts);
    }
  });
  load().then(schedule);
  return () => { stopped = true; clearTimeout(timer); map?.remove(); };
}
