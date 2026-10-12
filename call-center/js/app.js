/* App bootstrap + hash router. Routes: #/pos, #/orders, #/orders/:id */
import { loadCatalog } from './catalog.js';
import { setState } from './store.js';
import { mountTopbar } from './components/topbar.js';
import { mountPos } from './screens/pos-screen.js';
import { mountOrders } from './screens/orders-screen.js';
import { mountOrderDetails } from './screens/order-details-screen.js';

const view = document.getElementById('view');
let unmount = null;

function parseRoute() {
  const [section, param] = location.hash.replace(/^#\/?/, '').split('/');
  if (section === 'orders' && param) return { route: 'order', param: decodeURIComponent(param) };
  if (section === 'orders') return { route: 'orders', param: null };
  return { route: 'pos', param: null };
}

function render() {
  const { route, param } = parseRoute();
  if (unmount) unmount();
  view.innerHTML = '';
  setState({ route, routeParam: param, cartOpen: false });
  if (route === 'orders') unmount = mountOrders(view);
  else if (route === 'order') unmount = mountOrderDetails(view, param);
  else unmount = mountPos(view);
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
