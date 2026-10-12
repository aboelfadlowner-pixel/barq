/* Plain-text order summary (for pasting into WhatsApp / Facebook chats). */
import { ORDER_SOURCES, PAYMENT_METHOD } from '../constants.js';
import { formatAddress, formatMoney } from './format.js';
import { computeTotals, lineTotal, quantityLabel } from './pricing.js';

export function buildOrderSummary(order) {
  const t = computeTotals(order.items, order.deliveryFee);
  const src = ORDER_SOURCES.find((s) => s.id === order.source)?.label ?? '';
  const lines = [
    `طلب رقم ${order.number}${order.isDemo ? ' (تجريبي)' : ''} — أبو الفضل`,
    `العميل: ${order.customer.name} — ${order.customer.phone}`,
    `العنوان: ${order.address.areaName} — ${formatAddress(order.address)}`,
    order.address.landmark ? `علامة مميزة: ${order.address.landmark}` : null,
    src ? `المصدر: ${src}` : null,
    '',
    'الأصناف:',
    ...order.items.map((it) =>
      `• ${it.name} — ${quantityLabel(it)} — ${formatMoney(lineTotal(it))}${it.unitType === 'weight' ? ' (تقريبي)' : ''}${it.note ? ` [${it.note}]` : ''}`),
    '',
    `المجموع: ${formatMoney(t.subtotal)}`,
    `رسوم التوصيل: ${formatMoney(t.deliveryFee ?? 0)}`,
    `${t.estimated ? 'الإجمالي التقريبي' : 'الإجمالي'}: ${formatMoney(t.total)}`,
    `الدفع: ${PAYMENT_METHOD.label}`,
    t.estimated ? '* السعر النهائي حسب الوزن الفعلي' : null,
    order.note ? `ملاحظات: ${order.note}` : null,
  ];
  return lines.filter((l) => l !== null).join('\n');
}
