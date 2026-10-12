/* Small shared display pieces: status chip, source chip, money. */
import { catalog } from '../catalog.js';
import { esc } from '../utils/dom.js';
import { formatMoney } from '../utils/format.js';
import { icon } from './icons.js';

export function statusChip(statusId) {
  const s = catalog.statusesById.get(statusId);
  return `<span class="status tone-${s?.tone ?? 'gray'}">${esc(s?.label ?? statusId)}</span>`;
}

export const money = (n) => `<span class="num">${formatMoney(n)}</span>`;

/* Totals block used by the cart footer, review dialog and order details. */
export function totalsRows(t, { detailed = false } = {}) {
  const feeCell = t.deliveryFee == null
    ? '<span class="muted">اختر المنطقة</span>'
    : money(t.deliveryFee);
  return `
    ${detailed && t.estimated && t.fixed > 0 ? `<div class="trow sub"><span>أصناف بسعر ثابت</span>${money(t.fixed)}</div>` : ''}
    ${detailed && t.estimated ? `<div class="trow sub"><span>أصناف بالوزن (تقريبي)</span>${money(t.weighted)}</div>` : ''}
    <div class="trow"><span>المجموع (${t.count} ${t.count === 1 ? 'صنف' : 'أصناف'})</span>${money(t.subtotal)}</div>
    <div class="trow"><span>رسوم التوصيل</span>${feeCell}</div>
    <div class="trow total"><span>${t.estimated ? 'الإجمالي التقريبي' : 'الإجمالي'}</span>${money(t.total)}</div>`;
}

export const estimateNote = () =>
  `<div class="est-note">${icon('scale')} السعر النهائي حسب الوزن الفعلي عند التجهيز</div>`;
