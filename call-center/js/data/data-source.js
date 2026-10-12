/* =====================================================================
 *  DATA SOURCE — the only door between the UI and the data.
 *
 *  The UI calls only the functions exported here. They forward to:
 *    mock-source.js      demo data in browser memory (DATA_MODE = 'mock')
 *    supabase-source.js  the cc_* tables and functions (DATA_MODE = 'supabase')
 *  Both return the same shapes, so no screen needs to know which one is used.
 * ===================================================================== */
import { DATA_MODE } from '../config.js';

export const IS_MOCK = DATA_MODE !== 'supabase';

const impl = IS_MOCK ? await import('./mock-source.js') : await import('./supabase-source.js');

/* Account: null when nobody is signed in (Supabase only; the demo is always signed in). */
export const getAccount = () => impl.getAccount();
export const signIn     = (email, password) => impl.signIn(email, password);
export const signOut    = () => impl.signOut();

/* Catalog */
export const getProducts      = () => impl.getProducts();
export const getAreas         = () => impl.getAreas();          // includes inactive areas
export const getOrderStatuses = () => impl.getOrderStatuses();

/* Customers */
export const findCustomersByPhone      = (query) => impl.findCustomersByPhone(query);
export const findCustomersByExactPhone = (phone) => impl.findCustomersByExactPhone(phone);
export const listCustomerOrders        = (customerId, limit = 5) => impl.listCustomerOrders(customerId, limit);
export const findTodayOrdersByPhone    = (phone) => impl.findTodayOrdersByPhone(phone);
export const phoneBelongsToCustomer    = (phone) => impl.phoneBelongsToCustomer(phone);

/* Orders */
export const listOrders  = () => impl.listOrders();
export const getOrder    = (id) => impl.getOrder(id);
export const createOrder = (draft) => impl.createOrder(draft);
export const cancelOrder = (orderId, reason, user) => impl.cancelOrder(orderId, reason, user);

/* Delivery areas */
export const saveArea = (area) => impl.saveArea(area);
