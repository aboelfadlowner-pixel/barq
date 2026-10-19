import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Category } from "../types/category";
import type { Product } from "../types/product";
import type { StoredOrder } from "../types/order";
import type { StoreSettings } from "../types/settings";
import type { SyncRun, UnlinkedSku } from "../types/sync";
import { seedStore, upgradeStore } from "./seed";

/**
 * Temporary data store until a real database is connected.
 *
 * Everything (categories, products, orders) lives in one JSON file, `.data/store.json` (git-ignored).
 * On first use the file is created from the static v29 data in `src/data` (see `seed.ts`). Delete the file to reset.
 * If the file cannot be written (e.g. Vercel's read-only file system), changes stay in memory until the server restarts.
 *
 * Only `src/server/*` modules may import this file. Connecting a database means rewriting
 * `src/server/catalog.ts` and `src/server/orders.ts` on top of it; the API routes and the UI do not change.
 */
export interface StoreData {
  categories: Category[];
  products: Product[];
  orders: StoredOrder[];
  /** Last order sequence number used (order numbers are AF-00001, AF-00002, ...). */
  orderSeq: number;
  /** Imports of the Foodics products sheet, newest last (the last 30 are kept). */
  syncLog: SyncRun[];
  /** Active sheet SKUs that no store product uses, from the latest import. */
  unlinkedSkus: UnlinkedSku[];
  /** Dashboard settings (minimum order, notice strip, WhatsApp, orders paused). Missing in older files: defaults apply. */
  settings?: StoreSettings;
  /** Data version (see `upgradeStore` in seed.ts). */
  schema?: number;
}

const FILE = path.join(process.cwd(), ".data", "store.json");

/**
 * Next.js bundles API routes and pages separately, so each bundle gets its own copy of this module.
 * The state lives on `globalThis` so they all share one cache and one write queue, and the file's
 * modification time is checked on every read so a change saved by another bundle or process is picked up.
 */
interface DbState {
  cache: StoreData | null;
  /** mtime of the file when `cache` was loaded or saved. */
  mtime: number;
  writable: boolean;
  /** Serializes mutations so two requests never interleave a read-modify-write. */
  queue: Promise<unknown>;
}
const globalKey = Symbol.for("abuelfadl.db");
const state: DbState = ((globalThis as Record<symbol, DbState>)[globalKey] ??= {
  cache: null,
  mtime: 0,
  writable: true,
  queue: Promise.resolve(),
});

const fileTime = () => stat(FILE).then((info) => info.mtimeMs, () => 0);

async function load(): Promise<StoreData> {
  if (state.cache && (!state.writable || (await fileTime()) === state.mtime)) return state.cache;
  try {
    state.cache = upgradeStore(JSON.parse(await readFile(FILE, "utf8")) as StoreData);
    state.mtime = await fileTime();
  } catch {
    state.cache = seedStore();
    await persist(state.cache);
  }
  return state.cache;
}

async function persist(data: StoreData) {
  if (!state.writable) return;
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 1));
    await rename(tmp, FILE);
    state.mtime = await fileTime();
  } catch (error) {
    state.writable = false;
    console.warn(`[db] cannot write ${FILE}; changes are kept in memory only.`, error);
  }
}

/** Read-only snapshot. Callers must not mutate the returned objects. */
export async function read(): Promise<StoreData> {
  await state.queue;
  return load();
}

/** Runs `fn` on the data, saves the result, and returns what `fn` returned. If `fn` throws, nothing is saved. */
export function mutate<T>(fn: (data: StoreData) => T): Promise<T> {
  const run = state.queue.then(async () => {
    const draft = structuredClone(await load());
    const result = fn(draft);
    state.cache = draft;
    await persist(draft);
    return result;
  });
  state.queue = run.catch(() => undefined);
  return run;
}
