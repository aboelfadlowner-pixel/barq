/* App state: a tiny observable store plus the order-draft actions. */
import { catalog } from './catalog.js';
import { MAX_PIECE_QTY } from './constants.js';

const emptyDraft = () => ({
  source: null,     // 'phone' | 'whatsapp' | 'facebook'
  cart: [],         // { lineId, productId, name, unitType, unitLabel, price, qty|grams, note }
  customer: null,   // { id|null, name, phone, phone2, isNew, todayOrders: [] }
  address: null,    // { id|null, isNew, areaId, street, building, floor, apartment, landmark, notes }
  orderNote: '',
});

let state = {
  route: 'pos',
  routeParam: null,
  activeCategory: 'all',
  search: '',
  cartOpen: false,
  ...emptyDraft(),
};

const listeners = new Set();

export const getState = () => state;

export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  [...listeners].forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* Re-render only when the selected slice actually changes. Returns unsubscribe. */
export function bind(selector, render) {
  let last;
  const run = (s) => {
    const slice = selector(s);
    const key = JSON.stringify(slice);
    if (key === last) return;
    last = key;
    render(slice, s);
  };
  run(state);
  return subscribe(run);
}

/* ---------- Derived ---------- */
export function currentDeliveryFee(s = state) {
  if (!s.address?.areaId) return null;
  return catalog.areasById.get(s.address.areaId)?.fee ?? null;
}

/* ---------- Cart actions ---------- */
let seq = 0;
const newLineId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export function addProduct(product) {
  const base = {
    productId: product.id, name: product.name, unitType: product.unitType, baseUnitType: product.unitType,
    unitLabel: product.unitLabel, price: product.price, note: '',
  };
  setState((s) => {
    // Lines already switched to weight stay separate; tapping again adds a piece line.
    const existing = s.cart.find((l) => l.productId === product.id && l.unitType !== 'weight');
    if (existing) {
      return { cart: s.cart.map((l) => (l === existing ? { ...l, qty: Math.min(l.qty + 1, MAX_PIECE_QTY) } : l)) };
    }
    return { cart: [...s.cart, { ...base, lineId: newLineId(), qty: 1 }] };
  });
}

export function updateLine(lineId, patch) {
  setState((s) => ({ cart: s.cart.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)) }));
}

export function changeQty(lineId, delta) {
  setState((s) => ({
    cart: s.cart
      .map((l) => (l.lineId === lineId ? { ...l, qty: Math.min(l.qty + delta, MAX_PIECE_QTY) } : l))
      .filter((l) => l.unitType === 'weight' || l.qty > 0),
  }));
}

/* The agent chooses a weight: the line is priced as price-per-kg × weight. */
export const setLineWeight = (lineId, grams) => updateLine(lineId, { unitType: 'weight', grams });

export function setLineByPiece(lineId) {
  setState((s) => ({
    cart: s.cart.map((l) => (l.lineId === lineId
      ? { ...l, unitType: l.baseUnitType ?? 'piece', qty: 1, grams: undefined }
      : l)),
  }));
}

export const removeLine = (lineId) => setState((s) => ({ cart: s.cart.filter((l) => l.lineId !== lineId) }));
export const clearCart = () => setState({ cart: [] });

/* ---------- Draft actions ---------- */
export const setSource = (source) => setState({ source });
export const setCustomer = (customer, address) => setState({ customer, address });
export const clearCustomer = () => setState({ customer: null, address: null });
export const setOrderNote = (orderNote) => setState({ orderNote });

export function resetDraft() {
  setState({ ...emptyDraft(), search: '', activeCategory: 'all', cartOpen: false });
}

/* Repeat an old order: current catalog prices are used, missing products are skipped. */
export function loadDraftFromOrder(order, todayOrders = []) {
  const skipped = [];
  const cart = [];
  for (const it of order.items) {
    const prod = catalog.productsById.get(it.productId);
    if (!prod) { skipped.push(it.name); continue; }
    const base = {
      lineId: newLineId(), productId: prod.id, name: prod.name, unitType: prod.unitType,
      baseUnitType: prod.unitType, unitLabel: prod.unitLabel, price: prod.price, note: it.note || '',
    };
    cart.push(it.unitType === 'weight'
      ? { ...base, unitType: 'weight', grams: it.grams }
      : { ...base, qty: it.qty ?? 1 });
  }
  const { areaName, ...address } = order.address;
  setState({
    ...emptyDraft(),
    cart,
    customer: { id: order.customer.id, name: order.customer.name, phone: order.customer.phone, phone2: '', isNew: false, todayOrders },
    address: { ...address, isNew: false },
  });
  return { skipped };
}
