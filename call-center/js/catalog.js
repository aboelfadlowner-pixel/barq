/* Reference data loaded once at startup through the data-source adapter. */
import * as ds from './data/data-source.js';

export const catalog = {
  categories: [],
  products: [],
  productsById: new Map(),
  areas: [],
  areasById: new Map(),
  statuses: [],
  statusesById: new Map(),
};

export async function loadCatalog() {
  const [categories, products, areas, statuses] = await Promise.all([
    ds.getCategories(), ds.getProducts(), ds.getAreas(), ds.getOrderStatuses(),
  ]);
  Object.assign(catalog, {
    categories,
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
