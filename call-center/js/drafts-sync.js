/* «مسودة» in the database (33_drafts.sql). The order being written is saved as a draft a moment
   after each change, under the draft's own id (the id the order gets when sent — a sent draft leaves
   the list by itself). The board shows MY drafts (to continue) and, for the admin, everyone's
   (to look at). Without 33_drafts.sql everything works as before (draft on this device only). */
import * as ds from './data/data-source.js';
import { getState, setState, subscribe, resetDraft } from './store.js';

const WAIT_MS = 1500;
let on = null;          // null = not checked yet, true / false = installed or not
let timer = null;
let lastSaved = '';
let pending = null;

const content = (s) => ({ customer: s.customer, address: s.address, cart: s.cart, orderNote: s.orderNote });
const hasContent = (s) => !!(s.customer || s.cart.length);

export const draftsOn = () => on === true;

/* Save the order being written now (e.g. before opening another draft). */
export async function flushDraft() {
  clearTimeout(timer);
  const s = getState();
  if (!on || s.editing || !hasContent(s)) return;
  const snap = JSON.stringify([s.requestId, content(s)]);
  if (snap === lastSaved) return;
  pending = ds.draftSave(s.requestId, content(s), s.agent?.name || s.user?.name || '')
    .then(() => { lastSaved = snap; }).catch(() => {});
  await pending;
}

export async function listDrafts() {
  const list = await ds.draftList().catch(() => null);
  on = list !== null;
  return list;
}

export function startDraftSync() {
  listDrafts();
  return subscribe((s) => {
    if (!on || s.editing || !hasContent(s)) return;
    const snap = JSON.stringify([s.requestId, content(s)]);
    if (snap === lastSaved) return;
    clearTimeout(timer);
    timer = setTimeout(flushDraft, WAIT_MS);
  });
}

/* «استكمال»: open one of my drafts (the one being written now is saved first). */
export async function openDraft(d) {
  await flushDraft();
  setState({ requestId: d.id, customer: d.data.customer || null, address: d.data.address || null,
    cart: d.data.cart || [], orderNote: d.data.orderNote || '', editing: null });
  lastSaved = JSON.stringify([d.id, content(getState())]);
}

/* «إلغاء المسودة»: remove it everywhere (and clear the screen if it is the one open now). */
export async function discardDraft(id) {
  if (on) await ds.draftDelete(id).catch(() => {});
  if (getState().requestId === id) resetDraft();
}
