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
export const signUp     = (email, password) => impl.signUp(email, password);
/* Registration code: a new account types it once to become the call-center account. */
export const joinWithCode        = (code) => impl.joinWithCode(code);
export const setSignupCode       = (code) => impl.setSignupCode(code);
export const getSignupCodeStatus = () => impl.getSignupCodeStatus();

/* Catalog */
// Refresh "by weight / by unit" from the products sheet (Supabase only; at most every 10 min).
export const syncSaleUnits    = () => impl.syncSaleUnits();
export const getProducts      = () => impl.getProducts();
export const getCategories    = () => impl.getCategories();
export const listStaff        = () => impl.listStaff();
export const listPrepOrders   = () => impl.listPrepOrders();
export const setStage         = (id, stage) => impl.setStage(id, stage);
export const setStaff         = (a) => impl.setStaff(a);
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
export const cancelOrder = (orderId, reason, agent) => impl.cancelOrder(orderId, reason, agent);

/* Employee names (picked after signing in; managed in settings) */
export const getAgents = () => impl.getAgents();                 // includes inactive names
export const saveAgent = (agent) => impl.saveAgent(agent);

/* Delivery areas */
export const saveArea = (area) => impl.saveArea(area);
