/* Products & prices stay up to date while the screen is open — no closing and reopening.
   CONFIRMED: uploading the products sheet to Drive is enough; within about 10–15 minutes every open
   call-center / admin screen shows the new prices and products.

   Every 5 minutes (and from the «تحديث» button):
     1. read when the data center last pulled the sheets from Drive (dc_sync_log, read only);
     2. only if that was 10+ minutes ago: run the data-center sync exactly as the other tools do
        (dc-sync, then publish to products_master — the server publishes at most every 10 min).
        So the heavy pull runs at most about once every 10 minutes, however many screens are open;
     3. refresh "by weight / by unit" and the categories (cc-sale-unit, call-center only);
     4. reload the product list; if anything changed the screen updates without losing the order
        being typed (prices are always re-checked by the database when the order is sent). */
import * as ds from './data/data-source.js';
import { catalog, reloadProducts } from './catalog.js';
import { getState, setState } from './store.js';

export const CHECK_EVERY_MS = 5 * 60000;
export const PULL_GAP_MS = 10 * 60000;

const ago = (iso) => (iso ? Date.now() - new Date(iso).getTime() : Infinity);
const signature = () => new Map(catalog.products.map((p) => [p.id, `${p.price}|${p.name}|${p.unitType}`]));
const patch = (p) => setState({ catalogSync: { ...getState().catalogSync, ...p } });

let running = null;

/* Returns { pulled, pulledAt, nextPullInMs, added, changed, failed } — never throws. */
export function syncCatalog({ manual = false } = {}) {
  if (running) return running;
  running = (async () => {
    patch({ busy: true });
    const result = { pulled: false, pulledAt: null, nextPullInMs: 0, added: 0, changed: 0, failed: null };
    try {
      // "by weight / by unit" and categories (call-center only) run alongside the data-center pull.
      const saleUnits = ds.syncSaleUnits().catch(() => null);
      let log = await ds.lastDataCenterSync().catch(() => null);
      if (log && log.pulledAt && ago(log.pulledAt) >= PULL_GAP_MS && !manual) {
        // Two screens checking at the same moment: wait a little and look again before pulling.
        await new Promise((r) => setTimeout(r, Math.random() * 8000));
        log = await ds.lastDataCenterSync().catch(() => null);
      }
      if (log && ago(log.pulledAt) >= PULL_GAP_MS) {
        const pull = await ds.pullDataCenter();
        if (pull.failed.length) result.failed = pull.failed;
        result.pulled = true;
        log = { ...log, pulledAt: new Date().toISOString() };
      }
      // Pulled data not published yet (by us or by another tool) → publish (the server limits it to every 10 min).
      if (log && log.pulledAt && (!log.publishedAt || new Date(log.publishedAt) < new Date(log.pulledAt))) {
        await ds.publishDataCenter().catch(() => null);
      }
      result.pulledAt = log?.pulledAt ?? null;
      result.nextPullInMs = Math.max(0, PULL_GAP_MS - ago(result.pulledAt));
      await saleUnits;

      const before = signature();
      await reloadProducts();
      const after = signature();
      for (const [id, sig] of after) {
        if (!before.has(id)) result.added += 1;
        else if (before.get(id) !== sig) result.changed += 1;
      }
      if (result.added || result.changed) setState({ catalogVersion: Date.now() });
    } catch (err) {
      result.failed = [err.message];
    }
    patch({ busy: false, at: new Date().toISOString(), pulledAt: result.pulledAt });
    return result;
  })().finally(() => { running = null; });
  return running;
}

/* Starts the 5-minute refresh (and one right away). Skips while the tab is hidden; catches up when it shows. */
export function startCatalogSync(after = null) {
  Promise.resolve(after).catch(() => {}).then(() => syncCatalog());
  setInterval(() => { if (!document.hidden) syncCatalog(); }, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ago(getState().catalogSync.at) >= CHECK_EVERY_MS) syncCatalog();
  });
}
