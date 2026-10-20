import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LoginAttempts, StoreData } from "./db";
import { seedStore, upgradeStore } from "./seed";

/**
 * Local data store, used when no database is configured (`DATABASE_URL` unset): development and quick tries.
 *
 * Everything (categories, products, orders) lives in one JSON file, `.data/store.json` (git-ignored).
 * On first use the file is created from the static v29 data in `src/data` (see `seed.ts`). Delete the file to reset.
 * If the file cannot be written (e.g. Vercel's read-only file system), changes stay in memory until the server restarts.
 */
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
  /** Wrong dashboard passwords per address (memory only). */
  logins: Map<string, LoginAttempts>;
}
const globalKey = Symbol.for("abuelfadl.db");
const state: DbState = ((globalThis as Record<symbol, DbState>)[globalKey] ??= {
  cache: null,
  mtime: 0,
  writable: true,
  queue: Promise.resolve(),
  logins: new Map(),
});
state.logins ??= new Map();

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

export async function read(): Promise<StoreData> {
  await state.queue;
  return load();
}

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

export async function getLoginAttempts(key: string): Promise<LoginAttempts | null> {
  return state.logins.get(key) ?? null;
}

export async function setLoginAttempts(key: string, entry: LoginAttempts | null): Promise<void> {
  if (entry) state.logins.set(key, entry);
  else state.logins.delete(key);
  if (state.logins.size > 1000) {
    const now = Date.now();
    for (const [k, e] of state.logins) if (e.lockedUntil <= now && now - e.since > 60 * 60 * 1000) state.logins.delete(k);
  }
}
