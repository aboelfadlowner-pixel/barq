import type { LoginAttempts, StoreData } from "../../src/server/db";
import { seedStore, upgradeStore } from "../../src/server/seed";
import { DB_SNAPSHOT } from "../db-snapshot";

/**
 * Browser version of `src/server/db.ts` for the demo build: same `read` / `mutate` API,
 * data kept in the viewer's localStorage (each viewer has their own copy).
 */
const KEY = "abuelfadl_demo_db_v1"; // older saved data is upgraded by `upgradeStore`

const SNAPSHOT_KEY = "abuelfadl_demo_db_snapshot";

/** SKUs and prices from the database snapshot (demo/db-snapshot.ts), applied once per snapshot version. */
function applySnapshot(data: StoreData): StoreData {
  try {
    if (localStorage.getItem(SNAPSHOT_KEY) === DB_SNAPSHOT.version) return data;
  } catch {
    // no storage: apply every time (the data is not kept anyway)
  }
  const rows = new Map(DB_SNAPSHOT.rows.split(";").map((row) => {
    const [id, sku, price] = row.split(",");
    return [Number(id), { sku, price: Number(price) }] as const;
  }));
  for (const product of data.products) {
    const row = rows.get(product.id);
    if (!row) continue;
    if (row.sku) product.sku = row.sku;
    else delete product.sku;
    product.price = row.price;
  }
  try {
    localStorage.setItem(SNAPSHOT_KEY, DB_SNAPSHOT.version);
  } catch {
    // ignore
  }
  return data;
}

function load(): StoreData {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return applySnapshot(upgradeStore(JSON.parse(saved) as StoreData));
  } catch {
    // unreadable or blocked storage: start from the original data
  }
  return applySnapshot(seedStore());
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage blocked: changes stay in memory until the page is closed
  }
}

// Saved right away so the snapshot's SKUs and prices survive the next visit (the marker alone would skip them).
let cache: StoreData = load();
persist();

export async function read(): Promise<StoreData> {
  return cache;
}

export async function mutate<T>(fn: (data: StoreData) => T): Promise<T> {
  const draft = structuredClone(cache);
  const result = fn(draft);
  cache = draft;
  persist();
  return result;
}

/** The demo has no database: prices are the products' own (sheet import works), images stay in the browser. */
export const usingDatabase = false;
export const pricesFromSheet = false;

const logins = new Map<string, LoginAttempts>();
export async function getLoginAttempts(key: string): Promise<LoginAttempts | null> {
  return logins.get(key) ?? null;
}
export async function setLoginAttempts(key: string, entry: LoginAttempts | null): Promise<void> {
  if (entry) logins.set(key, entry);
  else logins.delete(key);
}

/** Synchronous snapshot for the demo shell (the real app loads this on the server). */
export function snapshot(): StoreData {
  return cache;
}

/** Back to the original 621 products and no orders. */
export function resetData() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // ignore
  }
  cache = applySnapshot(seedStore());
  persist();
}
