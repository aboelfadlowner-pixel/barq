/* App state: a tiny observable store plus the order-draft actions. */
import { catalog } from './catalog.js';
import { MAX_PIECE_QTY } from './constants.js';

const emptyDraft = () => ({
  cart: [],         // { lineId, productId, name, unitType, unitLabel, price, qty|grams, note }
  customer: null,   // { id|null, name, phone, phone2, isNew, todayOrders: [] }
  address: null,    // { id|null, isNew, areaId, street, building, floor, apartment, landmark, notes }
  orderNote: '',
});

let state = {
  user: null,       // { id, role: 'agent' | 'supervisor', name }
  route: 'pos',
  routeParam: null,
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

/* Adds a product. Unit products: whole qty (merged with the same product + same note).
   Weight products: grams, always a separate line (each cut can have its own note). */
export function addProduct(product, { qty = 1, grams = null, note = '' } = {}) {
  const base = {
    productId: product.id, name: product.name, unitType: product.unitType,
    unitLabel: product.unitLabel, price: product.price, note,
  };
  setState((s) => {
    if (product.unitType === 'weight') {
      return { cart: [...s.cart, { ...base, lineId: newLineId(), grams }] };
    }
    const existing = s.cart.find((l) => l.productId === product.id && l.unitType !== 'weight' && (l.note || '') === note);
    if (existing) {
      return { cart: s.cart.map((l) => (l === existing ? { ...l, qty: Math.min(l.qty + qty, MAX_PIECE_QTY) } : l)) };
    }
    return { cart: [...s.cart, { ...base, lineId: newLineId(), qty: Math.min(qty, MAX_PIECE_QTY) }] };
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

export const removeLine = (lineId) => setState((s) => ({ cart: s.cart.filter((l) => l.lineId !== lineId) }));
export const clearCart = () => setState({ cart: [] });

/* ---------- Draft actions ---------- */
export const setUser = (user) => setState({ user });
export const setCustomer = (customer, address) => setState({ customer, address });
export const clearCustomer = () => setState({ customer: null, address: null });
export const setOrderNote = (orderNote) => setState({ orderNote });

export function resetDraft() {
  setState({ ...emptyDraft(), search: '', cartOpen: false });
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
      unitLabel: prod.unitLabel, price: prod.price, note: it.note || '',
    };
    cart.push(prod.unitType === 'weight'
      ? { ...base, grams: it.grams ?? Math.round((it.qty ?? 1) * 1000) }
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
