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
  employee: null,
};

export async function loadCatalog() {
  const [categories, products, areas, statuses, employee] = await Promise.all([
    ds.getCategories(), ds.getProducts(), ds.getAreas(), ds.getOrderStatuses(), ds.getCurrentEmployee(),
  ]);
  Object.assign(catalog, {
    categories,
    products,
    productsById: new Map(products.map((p) => [p.id, p])),
    areas,
    areasById: new Map(areas.map((a) => [a.id, a])),
    statuses,
    statusesById: new Map(statuses.map((s) => [s.id, s])),
    employee,
  });
}
