/* «الطيارين دلوقتي» (admin, on the «التوصيل» page): the drivers out now on a map, each with how
   old his last place is. The place comes from his screen while he is out (18_driver_tracking.sql);
   a locked phone stops sending, so an old place is shown in red. Refreshes every 20 seconds.
   The map follows the drivers (close zoom) until the admin moves it; «على الخريطة» zooms to one
   driver, «كل الطيارين» shows them all again. The light circle = how exact the phone's place is.
   CONFIRMED «خط سير المشوار»: each driver's line since he left (20_driver_trail.sql, kept 7 days);
   his dot glides to each new place. CONFIRMED «علامات التسليم»: a ✓ with the order number where
   each order of the trip was delivered.
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
  let follow = true;          // the map follows the drivers until the admin moves / zooms it
  let rowsNow = [];
  let timer = null;
  let stopped = false;

  // one set of layers per driver, kept between updates so the dot can glide to its new place
  const drawn = new Map();   // userId → { dot, ring, line, stops }
  let branchDot = null;
  const COLORS = ['#d97706', '#2563eb', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];
  const glide = (dot, ring, to) => {
    const from = dot.getLatLng();
    if (from.lat === to[0] && from.lng === to[1]) return;
    const t0 = performance.now();
    const step = (t) => {
      const f = Math.min(1, (t - t0) / 1500);
      const at = [from.lat + (to[0] - from.lat) * f, from.lng + (to[1] - from.lng) * f];
      dot.setLatLng(at); ring?.setLatLng(at);
      if (f < 1 && !stopped) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const paintMap = async (rows, branch, trails) => {
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
    }
    if (branch?.lat != null && !branchDot) {
      branchDot = L.circleMarker([branch.lat, branch.lng], { radius: 8, color: '#1f5c3a', fillColor: '#1f5c3a', fillOpacity: 1 })
        .bindTooltip('الفرع', { permanent: true, direction: 'top' }).addTo(map);
    }
    const pts = [];
    const seen = new Set();
    placed.forEach((r, i) => {
      seen.add(r.userId);
      const old = agoMin(r.seenAt) > STALE_MIN;
      const color = COLORS[i % COLORS.length];
      const label = `<strong>${esc(r.name)}</strong> · ${agoText(agoMin(r.seenAt))}`;
      // «خط سير المشوار»: the line since he left the branch (+ his place now at the end)
      const trail = trails.get(r.userId) || { points: [], stops: [] };
      const line = trail.points.map((p) => [p.lat, p.lng]);
      const last = line[line.length - 1];
      if (!last || last[0] !== r.lat || last[1] !== r.lng) line.push([r.lat, r.lng]);
      let d = drawn.get(r.userId);
      if (!d) {
        d = {
          line: L.polyline(line, { color, weight: 4, opacity: 0.75 }).addTo(map),
          ring: L.circle([r.lat, r.lng], { radius: Math.min(r.accuracy || 0, 500), color, weight: 1, fillOpacity: 0.08 }).addTo(map),
          dot: L.circleMarker([r.lat, r.lng], { radius: 10, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 })
            .bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -8] }).addTo(map),
        };
        drawn.set(r.userId, d);
      } else {
        d.line.setLatLngs(line);
        d.ring.setRadius(Math.min(r.accuracy || 0, 500));
        d.dot.setTooltipContent(label);
        glide(d.dot, d.ring, [r.lat, r.lng]);
      }
      d.dot.setStyle({ fillColor: old ? '#f04438' : color });
      // ✓ where he delivered each order of this trip
      d.stops?.remove();
      d.stops = L.layerGroup(trail.stops.filter((x) => x.lat != null).map((x) => L.marker([x.lat, x.lng], {
        icon: L.divIcon({ className: 'dn-stop', html: `<span style="border-color:${color}">✓ ${esc(String(x.number).replace(/^CC-/, ''))}</span>`, iconSize: null }),
        zIndexOffset: -100,
      }).bindTooltip(`طلب <span class="ltr-inline">#${esc(x.number)}</span> · اتسلّم ${formatTime(x.at)}`, { direction: 'top' }))).addTo(map);
      trail.stops.forEach((x) => { if (x.lat != null) pts.push([x.lat, x.lng]); });
      pts.push(...line);                 // the whole line in view, not just his dot
    });
    drawn.forEach((d, id) => {          // back at the branch: off the map
      if (seen.has(id)) return;
      d.line.remove(); d.ring.remove(); d.dot.remove(); d.stops?.remove(); drawn.delete(id);
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
    let trails = new Map();
    try {
      [rows, branch, trails] = await Promise.all([ds.driversNow(), ds.branchPlace().catch(() => null), ds.driverTrails().catch(() => new Map())]);
    } catch { return; }
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
    if (rows.some((r) => r.lat != null)) paintMap(rows, branch, trails);
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
