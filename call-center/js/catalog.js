/* Reference data loaded once at startup through the data-source adapter. */
import * as ds from './data/data-source.js';
import { normalizeArabic } from './utils/format.js';

export const catalog = {
  products: [],
  productsById: new Map(),
  areas: [],
  areasById: new Map(),
  statuses: [],
  statusesById: new Map(),
  categories: [],      // like Foodics: { id, name, productIds } — only products in the list, empty ones left out
  categoriesById: new Map(),
  agents: [],          // active employee names (picker)
  allAgents: [],       // including inactive (settings screen)
};

const setAgents = (list) => Object.assign(catalog, {
  allAgents: list,
  agents: list.filter((a) => a.active).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
});

/* Speed (the customer is on the phone):
   • every product gets its search text prepared once, so typing never re-processes 5,000+ names;
   • the product list and categories are kept on this device, so the app opens at once with the last
     list and refreshes it quietly in the background (prices are always re-checked by the database
     when the order is sent). */
const CACHE_KEY = 'cc-catalog-v1';
const readCache = () => {
  if (ds.IS_MOCK) return null;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return Array.isArray(c?.products) && c.products.length ? c : null;
  } catch { return null; }
};
const writeCache = (products, categories) => {
  if (ds.IS_MOCK) return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ products, categories, savedAt: Date.now() })); } catch { /* full or blocked: fine */ }
};
export const clearCatalogCache = () => { try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ } };

/* CONFIRMED: like Foodics, the newest product first (higher code number = added later: sk-8588 before sk-8540).
   Applies to search results and to the products inside a category. */
const codeNumber = (p) => Number(String(p.code ?? p.id).match(/(\d+)\D*$/)?.[1] ?? -1);
const newestFirst = (a, b) => codeNumber(b) - codeNumber(a);

function setProducts(products) {
  products.sort(newestFirst);
  for (const p of products) p.searchKey = normalizeArabic(`${p.name} ${p.code ?? ''} ${p.barcode ?? ''}`);
  Object.assign(catalog, { products, productsById: new Map(products.map((p) => [p.id, p])) });
}

/* Categories never block the app: if they can't be loaded the screen falls back to search only. */
const fetchCategories = () => ds.getCategories().catch(() => []);

function setCategories(list) {
  const categories = list
    .map((c) => ({ ...c, productIds: c.productIds.filter((id) => catalog.productsById.has(id))
      .sort((a, b) => newestFirst(catalog.productsById.get(a), catalog.productsById.get(b))) }))
    .filter((c) => c.productIds.length)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));   // CONFIRMED: alphabetical
  Object.assign(catalog, { categories, categoriesById: new Map(categories.map((c) => [c.id, c])) });
}

/* Returns { refresh } — a promise for the background refresh when the saved list was used
   (wrapped in an object so awaiting loadCatalog() does not wait for it). */
export async function loadCatalog() {
  const cached = readCache();
  const fresh = cached ? null : Promise.all([ds.getProducts(), fetchCategories()]);
  const [areas, statuses, agents, [products, categories]] = await Promise.all([
    ds.getAreas(), ds.getOrderStatuses(), ds.getAgents(), fresh ?? [cached.products, cached.categories || []],
  ]);
  if (fresh) writeCache(products, categories);
  setAgents(agents);
  setProducts(products);
  Object.assign(catalog, {
    allAreas: areas,
    areas: areas.filter((a) => a.active),            // selectable for new addresses
    areasById: new Map(areas.map((a) => [a.id, a])), // includes inactive (old addresses)
    statuses,
    statusesById: new Map(statuses.map((s) => [s.id, s])),
  });
  setCategories(categories);
  return { refresh: cached ? reloadProducts() : null };
}

export async function reloadAreas() {
  const areas = await ds.getAreas();
  Object.assign(catalog, {
    allAreas: areas,
    areas: areas.filter((a) => a.active),
    areasById: new Map(areas.map((a) => [a.id, a])),
  });
}

export async function reloadAgents() {
  setAgents(await ds.getAgents());
}

/* Products again (after the products sheet changed how some are sold). */
export async function reloadProducts() {
  const [products, categories] = await Promise.all([ds.getProducts(), fetchCategories()]);
  writeCache(products, categories);
  setProducts(products);
  setCategories(categories);
}
