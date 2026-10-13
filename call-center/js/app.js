/* App bootstrap + hash router.
   Routes: #/board (home), #/pos, #/orders, #/orders/:id, #/areas.
   One shared account. Demo: always signed in. Supabase: the password is asked
   once per device (login screen), then the session is remembered. */
import { loadCatalog } from './catalog.js';
import { getState, setState, setUser } from './store.js';
import * as ds from './data/data-source.js';
import { can } from './permissions.js';
import { mountTopbar } from './components/topbar.js';
import { openAgentPicker } from './components/agent-dialog.js';
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
  if (route === 'areas' && !can(getState().user, 'manageAreas')) route = 'board';

  if (unmount) unmount();
  view.innerHTML = '';
  setState({ route, routeParam: param, cartOpen: false });
  if (route === 'orders') unmount = mountOrders(view);
  else if (route === 'order') unmount = mountOrderDetails(view, param);
  else if (route === 'areas') unmount = mountAreas(view);
  else if (route === 'pos') unmount = mountPos(view);
  else unmount = mountBoard(view);
}

function showError(title, err) {
  view.innerHTML = `<div class="center-state"><div><h2>${title}</h2><p>${String(err?.message ?? err)}</p></div></div>`;
}

async function startSignedIn(user) {
  setUser(user);
  try {
    await loadCatalog();                 // products and areas need a signed-in account
  } catch (err) {
    showError('تعذر تحميل البيانات', err);
    return;
  }
  window.addEventListener('hashchange', render);
  render();
  // CONFIRMED: every time the app opens, the person working picks their name.
  if (!getState().agent) openAgentPicker({ required: true });
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
  if (user) startSignedIn(user);
  else mountLogin(view, startSignedIn);
}

start();
