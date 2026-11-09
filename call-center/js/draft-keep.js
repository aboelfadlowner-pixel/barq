/* CONFIRMED: the order being written (customer, address, items, notes) is kept on THIS device,
   so it is not lost on a refresh, when the page is closed and opened again, or when the browser
   restarts — «استكمال الطلب» brings it back. One draft per account on the device; it is cleared
   when the order is sent or the draft is cancelled, and forgotten after 12 hours.
   A sent order being edited is not kept (it is in the database already). */
import { getState, setState, subscribe } from './store.js';

const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const FIELDS = ['requestId', 'cart', 'customer', 'address', 'orderNote'];
const keyOf = (user) => `cc-draft-${user?.id || 'device'}`;
const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const write = (key, v) => { try { if (v) localStorage.setItem(key, JSON.stringify(v)); else localStorage.removeItem(key); } catch { /* storage off: in memory only, as before */ } };

export function startDraftKeep(user) {
  const key = keyOf(user);
  const s = getState();
  const saved = read(key);
  if (saved && Date.now() - (saved.savedAt || 0) < MAX_AGE_MS && !s.customer && !s.cart.length && !s.editing
      && (saved.customer || saved.cart?.length)) {
    setState(Object.fromEntries(FIELDS.filter((f) => f in saved).map((f) => [f, saved[f]])));
  } else if (saved && Date.now() - (saved.savedAt || 0) >= MAX_AGE_MS) {
    write(key, null);
  }
  let last = '';
  return subscribe((st) => {
    if (st.editing) return;                                   // editing a sent order: nothing to keep
    const has = !!(st.customer || st.cart.length);
    const snap = has ? JSON.stringify(FIELDS.map((f) => st[f])) : '';
    if (snap === last) return;
    last = snap;
    write(key, has ? { ...Object.fromEntries(FIELDS.map((f) => [f, st[f]])), savedAt: Date.now() } : null);
  });
}
