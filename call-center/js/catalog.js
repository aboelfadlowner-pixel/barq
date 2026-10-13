/* Reference data loaded once at startup through the data-source adapter. */
import * as ds from './data/data-source.js';

export const catalog = {
  products: [],
  productsById: new Map(),
  areas: [],
  areasById: new Map(),
  statuses: [],
  statusesById: new Map(),
  agents: [],          // active employee names (picker)
  allAgents: [],       // including inactive (settings screen)
};

const setAgents = (list) => Object.assign(catalog, {
  allAgents: list,
  agents: list.filter((a) => a.active).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
});

export async function loadCatalog() {
  const [products, areas, statuses, agents] = await Promise.all([
    ds.getProducts(), ds.getAreas(), ds.getOrderStatuses(), ds.getAgents(),
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
  const products = await ds.getProducts();
  Object.assign(catalog, { products, productsById: new Map(products.map((p) => [p.id, p])) });
}
