/* «تغيير نوع الطلب» from the order's side panel (39_order_type.sql) — like Foodics.
   CONFIRMED: توصيل → the customer's addresses show at once (pick one, or «إضافة عنوان جديد»);
   استلام من الفرع → no address and no delivery fee. Saved on the draft (sent with the order). */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { getState, setState } from '../store.js';
import { esc, on } from '../utils/dom.js';
import { formatAddress, formatMoney } from '../utils/format.js';
import { icon } from './icons.js';
import { openModal, showToast } from './modal.js';
import { openAddressDialog } from './address-dialog.js';
import { orderTypeToggle } from './new-order-dialog.js';

let tempSeq = 0;

export async function openOrderTypeDialog() {
  const s0 = getState();
  if (!s0.customer) { showToast('حدد العميل الأول'); return; }
  let type = s0.orderType === 'pickup' ? 'pickup' : 'delivery';
  let list = [];
  // the customer's saved addresses (a sent order being edited, or a saved customer) + the draft's own
  if (s0.customer.id) {
    const found = await ds.findCustomersByExactPhone(s0.customer.phone).catch(() => []);
    list = (found.find((c) => c.id === s0.customer.id)?.addresses || []).map((a) => ({ ...a }));
  }
  if (s0.address) {
    const i = list.findIndex((a) => a.id && a.id === s0.address.id);
    if (i >= 0) list[i] = { ...list[i], ...s0.address };
    else list.unshift({ ...s0.address, id: s0.address.id || `tmp-${++tempSeq}`, isNew: !s0.address.id || s0.address.isNew });
  }
  let chosen = s0.address ? (s0.address.id || list[0]?.id) : list[0]?.id ?? null;

  const m = openModal({
    title: `${icon('package')} تغيير نوع الطلب`,
    body: '<div data-body></div>',
    footer: `<button type="button" class="btn btn-primary btn-lg" data-save>${icon('check')}حفظ</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>`,
  });
  const box = m.body.querySelector('[data-body]');
  const render = () => {
    box.innerHTML = `
      <div class="field"><label>نوع الطلب</label>${orderTypeToggle(type)}</div>
      ${type === 'pickup'
        ? `<div class="pickup-note">${icon('home')}<span><strong>استلام من الفرع</strong> — من غير عنوان ومن غير رسوم توصيل</span></div>`
        : `<div class="field">
            <div class="label-row"><label>العنوان<span class="req">*</span></label>
              <button type="button" class="link-btn" data-add-addr>${icon('plus')}إضافة عنوان جديد</button></div>
            <div class="addr-cards">${list.length ? list.map((a) => {
              const area = catalog.areasById.get(a.areaId);
              const off = area && !area.active;
              return `<label class="addr-card ${off ? 'is-off' : ''}">
                <input type="radio" name="otAddr" value="${esc(a.id)}" ${a.id === chosen ? 'checked' : ''} ${off ? 'disabled' : ''}>
                <div class="grow"><div class="t">${esc(a.label || 'عنوان')}${a.isNew ? ' <span class="tag tag-info">جديد</span>' : ''}
                  ${area ? `<span class="fee-chip">${esc(area.name)} · ${formatMoney(area.fee)}</span>` : '<span class="tag tag-danger">منطقة غير معروفة</span>'}</div>
                  <div class="addr-text">${esc(formatAddress(a))}</div></div></label>`;
            }).join('') : `<div class="addr-empty">${icon('pin')}<span>مفيش عناوين محفوظة — اضغط «إضافة عنوان جديد».</span></div>`}</div>
            <div class="field-error" data-err></div>
          </div>`}`;
  };
  render();
  on(m.el, 'click', '[data-order-type]', (e, b) => { type = b.dataset.orderType; render(); });
  m.el.addEventListener('change', (e) => { if (e.target.name === 'otAddr') chosen = e.target.value; });
  on(m.el, 'click', '[data-add-addr]', () => openAddressDialog({
    onSave: (a) => { const id = `tmp-${++tempSeq}`; list.push({ ...a, id, isNew: true }); chosen = id; render(); },
  }));
  m.foot.querySelector('[data-save]').addEventListener('click', () => {
    if (type === 'pickup') { setState({ orderType: 'pickup' }); m.close(); return; }
    const a = list.find((x) => x.id === chosen);
    if (!a) { box.querySelector('[data-err]').textContent = 'اختر عنوانًا أو أضف عنوانًا جديدًا'; return; }
    const { id, isNew, edited, ...fields } = a;
    setState({ orderType: 'delivery', address: { ...fields, id: isNew ? null : id, isNew: !!isNew, edited: !!edited } });
    m.close();
  });
}
