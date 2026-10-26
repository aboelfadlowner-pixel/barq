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
export const changePassword = (p) => impl.changePassword(p);
export const signUp     = (email, password) => impl.signUp(email, password);
/* Registration code: a new account types it once to become the call-center account. */
export const joinWithCode        = (code, name) => impl.joinWithCode(code, name);
export const setMyName           = (name) => impl.setMyName(name);
export const setSignupCode       = (code) => impl.setSignupCode(code);
export const getSignupCodeStatus = () => impl.getSignupCodeStatus();

/* Catalog */
// Refresh "by weight / by unit" from the products sheet (Supabase only; at most every 10 min).
export const syncSaleUnits    = () => impl.syncSaleUnits();
export const getProducts      = () => impl.getProducts();
// Data center sync (same as the other tools): last run times, pull from Drive, publish to the product list.
export const lastDataCenterSync = () => impl.lastDataCenterSync();
export const pullDataCenter     = () => impl.pullDataCenter();
export const publishDataCenter  = () => impl.publishDataCenter();
export const getCategories    = () => impl.getCategories();
export const getModifiers     = () => impl.getModifiers();       // add-ons: { groups, links }
export const saveProductModifiers = (sku, links) => impl.saveProductModifiers(sku, links);
export const listStaff        = () => impl.listStaff();
export const listPrepOrders   = () => impl.listPrepOrders();
export const setStage         = (id, stage) => impl.setStage(id, stage);
export const ackEdit          = (id) => impl.ackEdit(id);
export const sendOut          = (id, driver) => impl.sendOut(id, driver);
/* Drivers (18_driver_tracking.sql) */
export const getDriverOrders  = () => impl.getDriverOrders();
export const setPhone         = (userId, phone) => impl.setPhone(userId, phone);
export const driverTake       = (ids) => impl.driverTake(ids);
export const driverUntake     = (id) => impl.driverUntake(id);
export const driverDelivered  = (id, photo, pos) => impl.driverDelivered(id, photo, pos);
export const listDriversOut   = () => impl.listDriversOut();
export const driverReturned   = (userId) => impl.driverReturned(userId);
export const listDrivers      = () => impl.listDrivers();
export const adminDelivery    = (id, what, driverId) => impl.adminDelivery(id, what, driverId);
export const getOrderDelivery = (id) => impl.getOrderDelivery(id);
export const deliveryReport   = (from, to) => impl.deliveryReport(from, to);
export const photoUrl         = (path) => impl.photoUrl(path);
export const listPhones       = () => impl.listPhones();
export const editOrder        = (a) => impl.editOrder(a);
export const setStaff         = (a) => impl.setStaff(a);
export const getAreas         = () => impl.getAreas();          // includes inactive areas
export const getOrderStatuses = () => impl.getOrderStatuses();

/* Customers */
export const findCustomersByPhone      = (query) => impl.findCustomersByPhone(query);
export const findCustomersByExactPhone = (phone) => impl.findCustomersByExactPhone(phone);
export const suggestCustomersByPhone = (p) => impl.suggestCustomersByPhone(p);
export const listCustomerOrders        = (customerId, limit = 5) => impl.listCustomerOrders(customerId, limit);
export const listCustomerSummaries     = (opts) => impl.listCustomerSummaries(opts);   // customers page
export const getCustomerStats          = (customerId) => impl.getCustomerStats(customerId);
/* Blocked numbers (16_blocked_numbers.sql): Map phone → { source, by, at }; null = not installed */
export const getBlocked                = (phones) => impl.getBlocked(phones);
export const listBlocked               = () => impl.listBlocked();
export const setBlocked                = (phones, blocked) => impl.setBlocked(phones, blocked);
export const getCustomer               = (id) => impl.getCustomer(id);
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
