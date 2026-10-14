/* Reference data loaded once at startup through the data-source adapter. */
import * as ds from './data/data-source.js';

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

/* Categories never block the app: if they can't be loaded the screen falls back to search only. */
const fetchCategories = () => ds.getCategories().catch(() => []);

function setCategories(list) {
  const categories = list
    .map((c) => ({ ...c, productIds: c.productIds.filter((id) => catalog.productsById.has(id)) }))
    .filter((c) => c.productIds.length);
  Object.assign(catalog, { categories, categoriesById: new Map(categories.map((c) => [c.id, c])) });
}

export async function loadCatalog() {
  const [products, areas, statuses, agents, categories] = await Promise.all([
    ds.getProducts(), ds.getAreas(), ds.getOrderStatuses(), ds.getAgents(), fetchCategories(),
  ]);
  setAgents(agents);
  Object.assign(catalog, {
    products,
    productsById: new Map(products.map((p) => [p.id, p])),
    allAreas: areas,
    areas: areas.filter((a) => a.active),            // selectable for new addresses
    areasById: new Map(areas.map((a) => [a.id, a])), // includes inactive (old addresses)
    statuses,
    statusesById: new Map(statuses.map((s) => [s.id, s])),
  });
  setCategories(categories);
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
  Object.assign(catalog, { products, productsById: new Map(products.map((p) => [p.id, p])) });
  setCategories(categories);
}
