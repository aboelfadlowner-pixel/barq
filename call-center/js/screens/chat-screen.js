/* «الشات» — the call center / admin with the drivers (30_driver_chat.sql).
   The drivers on the side (newest conversation first, red number = new messages from him);
   the conversation of the chosen one, with ready replies. #/chat/<driver id> opens one. */
import * as ds from '../data/data-source.js';
import { esc, on } from '../utils/dom.js';
import { formatRelative } from '../utils/format.js';
import { icon } from '../components/icons.js';
import { mountChatBox } from '../components/chat-box.js';
import { refreshChatWatch } from '../components/chat-watch.js';

const REFRESH_MS = 10000;

export function mountChat(view, param = null) {
  view.innerHTML = `
    <div class="page"><div class="page-inner">
      <div class="page-head">
        <div>
          <h1 class="title-icon">${icon('chat')}الشات مع الطيارين</h1>
          <div class="page-sub"><span>رسايل الطيارين للكول سنتر، والرسايل اللي السيستم بيكتبها لوحده (خرج، سلّم، رجع، اتلغى)</span></div>
        </div>
      </div>
      <div class="chat-page">
        <aside class="card chat-side" data-side><p class="muted card-pad">جارٍ التحميل…</p></aside>
        <section class="card chat-main" data-main>
          <div class="center-note card-pad">${icon('chat')}<h3>اختار طيار من القايمة</h3></div>
        </section>
      </div>
    </div></div>`;
  const side = view.querySelector('[data-side]');
  const main = view.querySelector('[data-main]');
  let drivers = [];
  let current = param || null;
  let box = null;
  let timer = null;
  let stopped = false;

  const paintSide = () => {
    side.innerHTML = drivers.length ? `<ul class="chat-drivers">${drivers.map((d) => `
      <li><button type="button" class="chat-driver ${d.id === current ? 'is-on' : ''}" data-driver="${esc(d.id)}">
        <span class="chat-driver-top"><strong>${esc(d.name)}</strong>${d.unread ? `<span class="chat-n num">${d.unread}</span>` : ''}</span>
        <span class="muted chat-driver-last">${d.last ? `${esc(d.last.body)} · ${esc(formatRelative(d.last.at))}` : 'مفيش رسايل'}</span>
      </button></li>`).join('')}</ul>`
      : '<p class="muted card-pad">مفيش طيارين متسجلين</p>';
  };
  const open = (id) => {
    const d = drivers.find((x) => x.id === id);
    if (!d) return;
    current = id;
    history.replaceState(null, '', `#/chat/${encodeURIComponent(id)}`);
    box?.destroy();
    main.innerHTML = `
      <header class="chat-head">
        <strong>${esc(d.name)}</strong>
        ${d.phone ? `<a class="btn btn-secondary btn-sm" href="tel:${esc(d.phone)}">${icon('phone')}<span class="ltr-inline num">${esc(d.phone)}</span></a>` : ''}
      </header>
      <div class="chat-box" data-box></div>`;
    box = mountChatBox(main.querySelector('[data-box]'), { side: 'staff', driverId: id,
      onRead: () => { const x = drivers.find((y) => y.id === id); if (x?.unread) { x.unread = 0; paintSide(); refreshChatWatch(); } } });
    paintSide();
  };

  async function load() {
    const r = await ds.chatUnread().catch(() => null);
    if (stopped) return;
    if (!r) { side.innerHTML = '<p class="muted card-pad">الشات غير مفعّل على قاعدة البيانات بعد</p>'; return; }
    drivers = r.drivers.map((d) => (d.id === current && box ? { ...d, unread: 0 } : d));
    paintSide();
    if (current && !box) open(current);
  }
  const schedule = () => { timer = setTimeout(async () => { if (!document.hidden) await load(); if (!stopped) schedule(); }, REFRESH_MS); };
  load().then(schedule);

  const offs = [on(view, 'click', '[data-driver]', (e, b) => open(b.dataset.driver))];
  return () => { stopped = true; clearTimeout(timer); box?.destroy(); offs.forEach((f) => f()); };
}
