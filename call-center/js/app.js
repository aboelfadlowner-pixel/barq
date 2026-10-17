/* App bootstrap + hash router.
   Routes: #/board (home), #/pos, #/orders, #/orders/:id, #/areas, #/prep.
   Three roles (permissions.js): the prep account always lands on #/prep and sees nothing else.
   Demo: always signed in. Supabase: the password is asked once per device (login screen),
   then the session is remembered. */
import { loadCatalog } from './catalog.js';
import { startCatalogSync } from './catalog-sync.js';
import { getState, setState, setUser } from './store.js';
import * as ds from './data/data-source.js';
import { can, isPrepOnly } from './permissions.js';
import { mountTopbar } from './components/topbar.js';
import { restoreAgent } from './components/agent-select.js';
import { mountLogin } from './screens/login-screen.js';
import { mountBoard } from './screens/board-screen.js';
import { mountPos } from './screens/pos-screen.js';
import { mountOrders } from './screens/orders-screen.js';
import { mountOrderDetails } from './screens/order-details-screen.js';
import { mountAreas } from './screens/areas-screen.js';
import { mountPrep } from './screens/prep-screen.js';

const view = document.getElementById('view');
let unmount = null;

function parseRoute() {
  const [section, param] = location.hash.replace(/^#\/?/, '').split('/');
  if (section === 'orders' && param) return { route: 'order', param: decodeURIComponent(param) };
  if (section === 'orders') return { route: 'orders', param: null };
  if (section === 'areas') return { route: 'areas', param: null };
  if (section === 'pos') return { route: 'pos', param: null };
  if (section === 'prep') return { route: 'prep', param: null };
  return { route: 'board', param: null };
}

function render() {
  let { route, param } = parseRoute();
  const { user } = getState();
  if (isPrepOnly(user)) route = 'prep';
  else if (route === 'areas' && !can(user, 'manageAreas')) route = 'board';
  else if (route === 'prep' && !can(user, 'prepScreen')) route = 'board';
  else if (route === 'orders' && !can(user, 'ordersLog')) route = 'board';

  if (unmount) unmount();
  view.innerHTML = '';
  setState({ route, routeParam: param, cartOpen: false });
  if (route === 'orders') unmount = mountOrders(view);
  else if (route === 'order') unmount = mountOrderDetails(view, param);
  else if (route === 'areas') unmount = mountAreas(view);
  else if (route === 'pos') unmount = mountPos(view);
  else if (route === 'prep') unmount = mountPrep(view);
  else unmount = mountBoard(view);
}

function showError(title, err) {
  view.innerHTML = `<div class="center-state"><div><h2>${title}</h2><p>${String(err?.message ?? err)}</p></div></div>`;
}

async function startSignedIn(user) {
  setUser(user);
  if (isPrepOnly(user)) {               // the preparation account loads no products, customers or settings
    window.addEventListener('hashchange', render);
    render();
    return;
  }
  let refreshing = null;
  try {
    ({ refresh: refreshing } = await loadCatalog());   // products and areas need a signed-in account
  } catch (err) {
    showError('تعذر تحميل البيانات', err);
    return;
  }
  window.addEventListener('hashchange', render);
  restoreAgent();   // the name picked earlier in this tab, if any (picked from «اختار اسمك» on the board)
  render();
  // Opened with the product list saved on this device → bring it up to date quietly.
  refreshing?.then(() => setState({ catalogVersion: Date.now() })).catch(() => {});
  // Products & prices stay up to date while open (data-center sync like the other tools, every 5 min).
  startCatalogSync(refreshing);
}

async function start() {
  if (!ds.IS_MOCK) document.body.classList.add('live');
  mountTopbar(document.getElementById('topbar'));
  let user;
  try {
    user = await ds.getAccount();
  } catch (err) {
    showError('تعذر الاتصال', err);
    return;
  }
  if (user && !user.pendingCode) startSignedIn(user);
  else mountLogin(view, startSignedIn, { codeStep: !!user?.pendingCode, email: user?.email });
}

start();
