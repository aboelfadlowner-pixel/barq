import type { Category } from "../types/category";
import type { Product } from "../types/product";
import type { StoredOrder } from "../types/order";
import type { StoreSettings } from "../types/settings";
import type { SyncRun, UnlinkedSku } from "../types/sync";
import * as json from "./db-json";
import * as pg from "./db-postgres";

/**
 * The data store. With `DATABASE_URL` set, data lives in the Supabase database ("store" schema, see db-postgres.ts);
 * without it, in a local JSON file (db-json.ts) for development. Both keep the same `read` / `mutate` contract.
 *
 * Only `src/server/*` modules may import this file; the API routes and the UI do not know which store is used.
 */
export interface StoreData {
  categories: Category[];
  products: Product[];
  orders: StoredOrder[];
  /** Last order sequence number used (order numbers are AF-00001, AF-00002, ...). */
  orderSeq: number;
  /** Imports of the Foodics products sheet, newest last (the last 30 are kept). Always empty with the database. */
  syncLog: SyncRun[];
  /** Active sheet SKUs that no store product uses, from the latest import. Always empty with the database. */
  unlinkedSkus: UnlinkedSku[];
  /** Dashboard settings (minimum order, notice strip, WhatsApp, orders paused). Missing in older files: defaults apply. */
  settings?: StoreSettings;
  /** Data version of the JSON file (see `upgradeStore` in seed.ts). */
  schema?: number;
}

/** Wrong dashboard passwords from one address (see loginGuard.ts). Times in ms. */
export interface LoginAttempts {
  failures: number;
  /** When the first failure of the current window happened. */
  since: number;
  /** 0 when not locked. */
  lockedUntil: number;
}

/** True when the Supabase database is used. */
export const usingDatabase = Boolean(process.env.DATABASE_URL);

/**
 * True when product prices come from the products sheet in the database (store.master_prices): a product with a SKU
 * takes the sheet price and its own price is not used, and the sheet import page is not needed.
 */
export const pricesFromSheet = usingDatabase;

const store = usingDatabase ? pg : json;

/** Read-only snapshot. Callers must not mutate the returned objects. */
export const read = (): Promise<StoreData> => store.read();

/** Runs `fn` on the data, saves the result, and returns what `fn` returned. If `fn` throws, nothing is saved. */
export const mutate = <T>(fn: (data: StoreData) => T): Promise<T> => store.mutate(fn);

export const getLoginAttempts = (key: string) => store.getLoginAttempts(key);
export const setLoginAttempts = (key: string, entry: LoginAttempts | null) => store.setLoginAttempts(key, entry);

/** Uploaded images in the database (storage.ts uses the local disk when there is no database). */
export const putImage = pg.putImage;
export const getImage = pg.getImage;
