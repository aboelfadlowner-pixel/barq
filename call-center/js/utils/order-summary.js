/* Plain-text order summary (for pasting into WhatsApp / Facebook chats). */
import { PAYMENT_METHOD } from '../constants.js';
import { formatAddress, formatMoney } from './format.js';
import { totalsOf, lineTotal, quantityLabel, modifiersText } from './pricing.js';

export function buildOrderSummary(order, { edited = false } = {}) {
  const t = totalsOf(order);
  const lines = [
    `طلب رقم ${order.number}${edited ? ' (بعد التعديل)' : ''}${order.isDemo ? ' (تجريبي)' : ''} — أبو الفضل`,
    `العميل: ${order.customer.name} — ${order.customer.phone}`,
    `العنوان: ${order.address.areaName} — ${formatAddress(order.address)}`,
    order.address.landmark ? `علامة مميزة: ${order.address.landmark}` : null,
    '',
    'الأصناف:',
    ...order.items.map((it) =>
      `• ${it.name}${it.modifiers?.length ? ` (+ ${modifiersText(it.modifiers)})` : ''} — ${quantityLabel(it)} — ${formatMoney(lineTotal(it))}${it.unitType === 'weight' ? ' (تقريبي)' : ''}${it.note ? ` [${it.note}]` : ''}`),
    '',
    `المجموع: ${formatMoney(t.subtotal)}`,
    t.feeRemoved > 0 ? 'رسوم التوصيل: متشالة' : `رسوم التوصيل: ${formatMoney(t.deliveryFee ?? 0)}`,
    ...(t.discount > 0 ? [`${t.discountSpec?.kind === 'percent' ? `خصم ${t.discountSpec.value}%` : 'خصم'}: − ${formatMoney(t.discount)}`] : []),
    `${t.estimated ? 'الإجمالي التقريبي' : 'الإجمالي'}: ${formatMoney(t.total)}`,
    `الدفع: ${PAYMENT_METHOD.label}`,
    t.estimated ? '* السعر النهائي حسب الوزن الفعلي' : null,
    order.note ? `ملاحظات: ${order.note}` : null,
  ];
  return lines.filter((l) => l !== null).join('\n');
}
