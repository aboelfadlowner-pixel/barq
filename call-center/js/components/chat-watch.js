/* The call center / admin hear about new driver messages on ANY screen (30_driver_chat.sql):
   every 15 seconds — the red number on «الشات» in the top bar, 💬 on the order cards,
   and a ring + «💬 أحمد: العميل مش بيرد» for each new message (not while that conversation is open). */
import * as ds from '../data/data-source.js';
import { getState, setState } from '../store.js';
import { showToast } from './modal.js';
import { ring } from './chat-box.js';

const EVERY_MS = 15000;
let timer = null;
let lastNewest = null;   // id of the newest unread message already announced

async function check() {
  const r = await ds.chatUnread().catch(() => null);
  if (!r) { setState({ chatOn: false }); return; }
  const n = r.newest;
  const openHere = getState().route === 'chat' && n && location.hash === `#/chat/${encodeURIComponent(n.driverId)}`;
  if (n && lastNewest !== null && n.id > lastNewest && !openHere) {
    ring();
    showToast(`💬 ${n.driverName || 'طيار'}: ${n.body}${n.orderNo ? ` (#${n.orderNo})` : ''}`);
  }
  if (n) lastNewest = Math.max(lastNewest ?? 0, n.id);
  else if (lastNewest === null) lastNewest = 0;
  setState({ chatOn: true, chatUnread: r.unread, chatOrders: r.orders });
}

export function startChatWatch() {
  if (timer) return;
  const loop = async () => { if (!document.hidden) await check(); timer = setTimeout(loop, EVERY_MS); };
  loop();
}
export const refreshChatWatch = () => { check(); };
