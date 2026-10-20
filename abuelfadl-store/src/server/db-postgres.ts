import postgres from "postgres";
import type { Category } from "../types/category";
import type { OrderLine, OrderStatus, PaymentMethod, StoredOrder } from "../types/order";
import type { Product } from "../types/product";
import type { StoreSettings } from "../types/settings";
import type { LoginAttempts, StoreData } from "./db";

/**
 * Data store on the Supabase Postgres database, used when `DATABASE_URL` is set.
 *
 * The website owns the "store" schema (supabase/migrations) and connects as its own role, store_app, which can work in
 * that schema only. Product prices are not stored here: they come from the products sheet through the read-only view
 * store.master_prices (see store.catalog), so a price changed in the sheet shows on the website by itself.
 *
 * Same `read` / `mutate` contract as the JSON store, so catalog.ts, orders.ts, settings.ts and reports.ts do not change:
 * - read: one small version query per call; the catalog is reloaded only when it (or a sheet price) changed, and only
 *   new or changed orders are fetched.
 * - mutate: runs in one transaction under an advisory lock (writes never interleave, across server instances too),
 *   on fresh data, then writes only the rows that changed.
 */

interface CatalogCache {
  version: string;
  pricesAt: string | null;
  categories: Category[];
  products: Product[];
  settings: StoreSettings | undefined;
}

interface PgState {
  sql: postgres.Sql | null;
  catalog: CatalogCache | null;
  orders: Map<number, StoredOrder>;
  ordersAt: string | null;
  sortedOrders: StoredOrder[];
  /** One refresh at a time per instance; concurrent reads share it. */
  refreshing: Promise<StoreData> | null;
}

const globalKey = Symbol.for("abuelfadl.db.postgres");
const state: PgState = ((globalThis as Record<symbol, PgState>)[globalKey] ??= {
  sql: null,
  catalog: null,
  orders: new Map(),
  ordersAt: null,
  sortedOrders: [],
  refreshing: null,
});

type Sql = postgres.Sql | postgres.TransactionSql;

function client(): postgres.Sql {
  // prepare: false — Supabase's transaction pooler (port 6543) does not keep prepared statements between queries.
  return (state.sql ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 }));
}

// ---------- rows <-> app objects ----------

const num = (value: unknown) => (value === null || value === undefined ? undefined : Number(value));
const iso = (value: unknown) => (value instanceof Date ? value : new Date(String(value))).toISOString();

function toCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    art: String(row.art),
    tint: String(row.tint),
    ...(row.image_url ? { imageUrl: String(row.image_url) } : {}),
    ...(row.icon_url ? { iconUrl: String(row.icon_url) } : {}),
    ...(row.tagline ? { tagline: String(row.tagline) } : {}),
  };
}

function toProduct(row: Record<string, unknown>): Product {
  const price = num(row.current_price);
  return {
    id: Number(row.id),
    categoryId: String(row.category_id),
    name: String(row.name),
    price: price ?? 0,
    weighed: Boolean(row.weighed),
    ...(row.weight_step !== null ? { weightStep: num(row.weight_step) } : {}),
    ...(row.min_weight !== null ? { minWeight: num(row.min_weight) } : {}),
    ...(row.max_weight !== null ? { maxWeight: num(row.max_weight) } : {}),
    ...(row.sku ? { sku: String(row.sku), priceFromSheet: true } : {}),
    ...(price === undefined ? { priceMissing: true } : {}),
    inStock: Boolean(row.in_stock),
    bestseller: Boolean(row.bestseller),
    offer: Boolean(row.offer),
    ...(row.sale_price !== null ? { salePrice: num(row.sale_price) } : {}),
    ...(row.offer_start ? { offerStart: String(row.offer_start) } : {}),
    ...(row.offer_end ? { offerEnd: String(row.offer_end) } : {}),
    ...(row.description ? { description: String(row.description) } : {}),
    ...(row.image_url ? { imageUrl: String(row.image_url) } : {}),
  };
}

function toOrder(row: Record<string, unknown>, lines: OrderLine[]): StoredOrder {
  return {
    id: Number(row.id),
    number: String(row.number),
    customer: {
      name: String(row.customer_name),
      phone: String(row.customer_phone),
      address: String(row.address),
      note: String(row.note),
    },
    lines,
    subtotal: Number(row.subtotal),
    ...(row.delivery_area !== null ? { deliveryArea: String(row.delivery_area), deliveryFee: Number(row.delivery_fee) } : {}),
    total: Number(row.total),
    paymentMethod: row.payment_method as PaymentMethod,
    status: row.status as OrderStatus,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    staffNote: String(row.staff_note),
  };
}

const categoryRow = (category: Category, position: number) => ({
  id: category.id,
  name: category.name,
  position,
  art: category.art,
  tint: category.tint,
  image_url: category.imageUrl || null,
  icon_url: category.iconUrl || null,
  tagline: category.tagline || null,
});

/** The product's own price is kept only while it has no SKU; linked products take the sheet price. */
const productRow = (product: Product, position: number) => ({
  id: product.id,
  sku: product.sku ?? null,
  category_id: product.categoryId,
  name: product.name,
  price: product.sku ? null : product.price,
  weighed: product.weighed,
  weight_step: product.weightStep ?? null,
  min_weight: product.minWeight ?? null,
  max_weight: product.maxWeight ?? null,
  in_stock: product.inStock,
  bestseller: product.bestseller,
  offer: product.offer,
  sale_price: product.salePrice ?? null,
  offer_start: product.offerStart ?? null,
  offer_end: product.offerEnd ?? null,
  description: product.description ?? null,
  image_url: product.imageUrl ?? null,
  position,
});

const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

// ---------- read ----------

async function refresh(sql: Sql): Promise<StoreData> {
  const [head] = await sql`
    select (select catalog_version from store.meta)::text as version,
           (select max(updated_at) from store.master_prices)::text as prices_at,
           (select max(updated_at) from store.orders)::text as orders_at`;

  const cached = state.catalog;
  if (!cached || cached.version !== head.version || cached.pricesAt !== head.prices_at) {
    const [categories, products, settings] = await Promise.all([
      sql`select * from store.categories order by position, id`,
      sql`select id, sku, category_id, name, weighed, weight_step, min_weight, max_weight, in_stock, bestseller, offer,
                 sale_price, offer_start::text, offer_end::text, description, image_url, current_price
          from store.catalog order by position, id`,
      sql`select data from store.settings where id = 1`,
    ]);
    const data = settings[0]?.data as Partial<StoreSettings> | undefined;
    state.catalog = {
      version: head.version,
      pricesAt: head.prices_at,
      categories: categories.map(toCategory),
      products: products.map(toProduct),
      settings: data && Object.keys(data).length ? (data as StoreSettings) : undefined,
    };
  }

  if (head.orders_at !== state.ordersAt) {
    // New or changed orders only (ids already seen are replaced). The boundary row is fetched again on purpose.
    const since = state.ordersAt;
    const orders = since
      ? await sql`select * from store.orders where updated_at >= ${since}::timestamptz`
      : await sql`select * from store.orders`;
    if (orders.length) {
      const ids = orders.map((row) => row.id);
      const items = await sql`select * from store.order_items where order_id in ${sql(ids)} order by id`;
      const linesOf = new Map<string, OrderLine[]>();
      for (const item of items) {
        const key = String(item.order_id);
        const lines = linesOf.get(key) ?? [];
        lines.push({
          productId: Number(item.product_id),
          name: String(item.name),
          price: Number(item.price),
          weighed: Boolean(item.weighed),
          quantity: Number(item.quantity),
          lineTotal: Number(item.line_total),
        });
        linesOf.set(key, lines);
      }
      for (const row of orders) state.orders.set(Number(row.id), toOrder(row, linesOf.get(String(row.id)) ?? []));
      state.sortedOrders = [...state.orders.values()].sort((a, b) => a.id - b.id);
    }
    state.ordersAt = head.orders_at;
  }

  const catalog = state.catalog!;
  return {
    categories: catalog.categories,
    products: catalog.products,
    orders: state.sortedOrders,
    orderSeq: state.sortedOrders.at(-1)?.id ?? 0,
    syncLog: [],
    unlinkedSkus: [],
    settings: catalog.settings,
  };
}

export function read(): Promise<StoreData> {
  return (state.refreshing ??= refresh(client()).finally(() => (state.refreshing = null)));
}

// ---------- mutate ----------

async function writeChanges(tx: postgres.TransactionSql, base: StoreData, draft: StoreData) {
  // Categories first (products point at them), deletions last.
  const baseCategories = new Map(base.categories.map((category, i) => [category.id, categoryRow(category, i)]));
  for (const [i, category] of draft.categories.entries()) {
    const row = categoryRow(category, i);
    const old = baseCategories.get(category.id);
    if (!old) await tx`insert into store.categories ${tx(row)}`;
    else if (!same(old, row)) await tx`update store.categories set ${tx(row, "name", "position", "art", "tint", "image_url", "icon_url", "tagline")} where id = ${row.id}`;
  }

  const baseProducts = new Map(base.products.map((product, i) => [product.id, productRow(product, i)]));
  const draftIds = new Set(draft.products.map((product) => product.id));
  const removed = base.products.filter((product) => !draftIds.has(product.id)).map((product) => product.id);
  if (removed.length) await tx`delete from store.products where id in ${tx(removed)}`;
  const inserts: ReturnType<typeof productRow>[] = [];
  const moves: [number, number][] = [];
  for (const [i, product] of draft.products.entries()) {
    const row = productRow(product, i);
    const old = baseProducts.get(product.id);
    if (!old) inserts.push(row);
    else if (!same({ ...old, position: 0 }, { ...row, position: 0 })) {
      const { id, ...fields } = row;
      await tx`update store.products set ${tx(fields)} where id = ${id}`;
    } else if (old.position !== row.position) moves.push([row.id, row.position]);
  }
  for (let i = 0; i < inserts.length; i += 500) await tx`insert into store.products ${tx(inserts.slice(i, i + 500))}`;
  if (moves.length) {
    // Reordering moves many rows at once: one statement for all of them.
    await tx`update store.products p set position = v.position::int
             from (values ${tx(moves)}) as v(id, position) where p.id = v.id::bigint`;
  }

  const draftCategories = new Set(draft.categories.map((category) => category.id));
  const removedCategories = base.categories.filter((category) => !draftCategories.has(category.id)).map((category) => category.id);
  if (removedCategories.length) await tx`delete from store.categories where id in ${tx(removedCategories)}`;

  if (!same(base.settings ?? {}, draft.settings ?? {})) {
    await tx`update store.settings set data = ${tx.json(JSON.parse(JSON.stringify(draft.settings ?? {})))} where id = 1`;
  }

  const baseOrders = new Map(base.orders.map((order) => [order.id, order]));
  const skuOf = new Map(draft.products.map((product) => [product.id, product.sku ?? null]));
  for (const order of draft.orders) {
    const old = baseOrders.get(order.id);
    if (!old) {
      await tx`insert into store.orders ${tx({
        id: order.id,
        number: order.number,
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        address: order.customer.address,
        note: order.customer.note,
        delivery_area: order.deliveryArea ?? null,
        delivery_fee: order.deliveryFee ?? 0,
        subtotal: order.subtotal ?? order.total,
        total: order.total,
        payment_method: order.paymentMethod,
        status: order.status,
        staff_note: order.staffNote,
        created_at: order.createdAt,
      })}`;
      const items = order.lines.map((line) => ({
        order_id: order.id,
        product_id: line.productId,
        sku: skuOf.get(line.productId) ?? null,
        name: line.name,
        price: line.price,
        weighed: line.weighed,
        quantity: line.quantity,
        line_total: line.lineTotal,
      }));
      if (items.length) await tx`insert into store.order_items ${tx(items)}`;
    } else if (old.status !== order.status || old.staffNote !== order.staffNote) {
      await tx`update store.orders set status = ${order.status}, staff_note = ${order.staffNote} where id = ${order.id}`;
    }
  }
}

export async function mutate<T>(fn: (data: StoreData) => T): Promise<T> {
  const result = await client().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('abuelfadl.store.mutate'))`;
    const base = await refresh(tx);
    const draft = structuredClone(base);
    const value = fn(draft);
    await writeChanges(tx, base, draft);
    return [value] as const;
  });
  // The rows just written carry new versions and timestamps: the next read picks them up from the database.
  if (state.catalog) state.catalog.version = "";
  return result[0];
}

// ---------- login guard ----------

export async function getLoginAttempts(key: string): Promise<LoginAttempts | null> {
  const [row] = await client()`
    select failures, (extract(epoch from since) * 1000)::float8 as since,
           coalesce(extract(epoch from locked_until) * 1000, 0)::float8 as locked_until
    from store.login_fails where key = ${key}`;
  return row ? { failures: Number(row.failures), since: Number(row.since), lockedUntil: Number(row.locked_until) } : null;
}

export async function setLoginAttempts(key: string, entry: LoginAttempts | null): Promise<void> {
  const sql = client();
  if (!entry) {
    await sql`delete from store.login_fails where key = ${key}`;
    return;
  }
  await sql`
    insert into store.login_fails (key, failures, since, locked_until)
    values (${key}, ${entry.failures}, to_timestamp(${entry.since / 1000}),
            ${entry.lockedUntil ? sql`to_timestamp(${entry.lockedUntil / 1000})` : null})
    on conflict (key) do update set failures = excluded.failures, since = excluded.since, locked_until = excluded.locked_until`;
  if (Math.random() < 0.02) await sql`delete from store.login_fails where coalesce(locked_until, since) < now() - interval '1 day'`;
}

// ---------- uploaded images ----------

export async function putImage(name: string, mime: string, bytes: Uint8Array): Promise<void> {
  await client()`insert into store.images (name, mime, data) values (${name}, ${mime}, ${Buffer.from(bytes)})`;
}

export async function getImage(name: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const [row] = await client()`select mime, data from store.images where name = ${name}`;
  return row ? { bytes: row.data as Buffer, contentType: String(row.mime) } : null;
}
