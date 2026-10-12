/* App bootstrap + hash router.
   Routes: #/board (home), #/pos, #/orders, #/orders/:id, #/areas (supervisor). Login comes first. */
import { loadCatalog } from './catalog.js';
import { getState, setState } from './store.js';
import { can } from './permissions.js';
import { mountTopbar } from './components/topbar.js';
import { mountLogin } from './screens/login-screen.js';
import { mountBoard } from './screens/board-screen.js';
import { mountPos } from './screens/pos-screen.js';
import { mountOrders } from './screens/orders-screen.js';
import { mountOrderDetails } from './screens/order-details-screen.js';
import { mountAreas } from './screens/areas-screen.js';

const view = document.getElementById('view');
let unmount = null;

function parseRoute() {
  const [section, param] = location.hash.replace(/^#\/?/, '').split('/');
  if (section === 'orders' && param) return { route: 'order', param: decodeURIComponent(param) };
  if (section === 'orders') return { route: 'orders', param: null };
  if (section === 'areas') return { route: 'areas', param: null };
  if (section === 'pos') return { route: 'pos', param: null };
  return { route: 'board', param: null };
}

function render() {
  let { route, param } = parseRoute();
  const { user } = getState();
  if (!user) route = 'login';
  else if (route === 'areas' && !can(user, 'manageAreas')) route = 'board';

  if (unmount) unmount();
  view.innerHTML = '';
  setState({ route, routeParam: param, cartOpen: false });
  if (route === 'login') unmount = mountLogin(view);
  else if (route === 'orders') unmount = mountOrders(view);
  else if (route === 'order') unmount = mountOrderDetails(view, param);
  else if (route === 'areas') unmount = mountAreas(view);
  else if (route === 'pos') unmount = mountPos(view);
  else unmount = mountBoard(view);
}

async function start() {
  try {
    await loadCatalog();
  } catch (err) {
    view.innerHTML = `<div class="center-state"><div><h2>تعذر تحميل البيانات</h2><p>${String(err.message)}</p></div></div>`;
    return;
  }
  mountTopbar(document.getElementById('topbar'));
  window.addEventListener('hashchange', render);
  render();
}

start();
