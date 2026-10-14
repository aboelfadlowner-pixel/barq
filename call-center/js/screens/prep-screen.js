/* Preparation screen (branch): the orders sent by the call center, with one big button per
   order to move it on (جديد ← بيتجهز ← على الكاشير ← خرج مع الطيار). The call center prints
   the ticket; this screen does not print. Coming in the next step. */
import { getState } from '../store.js';
import { esc } from '../utils/dom.js';
import { icon } from '../components/icons.js';

export function mountPrep(view) {
  const { user } = getState();
  view.innerHTML = `
    <div class="page"><div class="page-inner page-narrow">
      <div class="page-head"><div>
        <h1>شاشة التجهيز</h1>
        <div class="page-sub"><span>${esc(user?.email || '')}</span></div>
      </div></div>
      <div class="card card-pad center-note">
        ${icon('clipboard')}
        <h3>الطلبات هتظهر هنا في الخطوة الجاية</h3>
        <p class="muted">كل طلب بزرار واحد كبير: استلمت وبدأت ← على الكاشير ← خرج مع الطيار. الكول سنتر هيشوف الحالة على طول.</p>
      </div>
    </div></div>`;
  return () => {};
}
