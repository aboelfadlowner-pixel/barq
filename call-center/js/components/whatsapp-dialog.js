/* «واتساب للعميل»: opens WhatsApp (Web / Desktop / phone) on the customer's
   number with the message already written. The employee reviews it and taps
   «إرسال» inside WhatsApp — nothing is sent automatically and nothing is saved
   in the database. The message goes out from whatever WhatsApp is signed in on
   this device (the branch number). */
import { esc } from '../utils/dom.js';
import { formatMoney, normalizePhone } from '../utils/format.js';
import { computeTotals, quantityLabel } from '../utils/pricing.js';
import { PAYMENT_METHOD } from '../constants.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';

/* Egyptian mobile (010/011/012/015 + 8 digits) → international digits for wa.me; else null. */
export function waNumber(phone) {
  const d = normalizePhone(phone || '');
  return /^01[0125]\d{8}$/.test(d) ? `20${d.slice(1)}` : null;
}

export const waLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

/* Mobile numbers of the order's customer that can receive WhatsApp. */
export function waPhones(order) {
  return [order.customer.phone, order.customer.phone2]
    .filter((p, i, all) => waNumber(p) && all.findIndex((x) => waNumber(x) === waNumber(p)) === i);
}

/* The ready message — changes with where the order is. */
export function buildWhatsAppMessage(order) {
  const t = computeTotals(order.items, order.deliveryFee);
  const out = order.stage === 'out';
  const lines = [
    `أهلًا ${order.customer.name} 👋`,
    out
      ? `طلبك رقم ${order.number} من أبو الفضل خرج مع الطيار${order.driver ? ` ${order.driver}` : ''} وفي الطريق ليك 🛵`
      : `طلبك رقم ${order.number} من أبو الفضل اتسجّل وبيتجهز دلوقتي ✅`,
    '',
    'الأصناف:',
    ...order.items.map((it) => `• ${it.name} — ${quantityLabel(it)}${it.note ? ` (${it.note})` : ''}`),
    '',
    `${t.estimated ? 'الإجمالي التقريبي' : 'الإجمالي'}: ${formatMoney(t.total)} شامل التوصيل — ${PAYMENT_METHOD.label}`,
    t.estimated ? '* السعر النهائي حسب الوزن الفعلي' : null,
    '',
    'شكرًا لاختيارك أبو الفضل 🌿',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export function openWhatsAppDialog(order) {
  const phones = waPhones(order);
  const m = openModal({
    title: `${icon('whatsapp')} واتساب للعميل — <span class="ltr-inline">${esc(order.number)}</span>`,
    size: 'md',
    body: phones.length ? `
      <div class="wa-form">
        <div class="field">
          <label for="wa-to">هيتبعت على</label>
          ${phones.length > 1
            ? `<select id="wa-to" class="input ltr">${phones.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select>`
            : `<div class="wa-to ltr">${esc(phones[0])}</div>`}
        </div>
        <div class="field">
          <label for="wa-text">الرسالة (تقدر تعدّل فيها)</label>
          <textarea id="wa-text" class="input wa-text" rows="11" dir="rtl">${esc(buildWhatsAppMessage(order))}</textarea>
        </div>
        <p class="hint">${icon('info')}هيفتح الواتساب اللي على الجهاز ده والرسالة جاهزة — راجعها واضغط «إرسال» جوه الواتساب.</p>
      </div>`
      : `<div class="alert alert-warn">${icon('alert')}<span>رقم العميل مش رقم موبايل (لازم يبدأ بـ 010 أو 011 أو 012 أو 015) — مينفعش واتساب.</span></div>`,
    footer: phones.length ? `
      <a class="btn btn-whatsapp btn-lg" data-wa-open target="_blank" rel="noopener">${icon('whatsapp')}افتح الواتساب</a>
      <button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>`
      : '<button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>',
  });
  if (!phones.length) return m;
  const a = m.foot.querySelector('[data-wa-open]');
  const to = () => m.body.querySelector('#wa-to')?.value || phones[0];
  const sync = () => { a.href = waLink(waNumber(to()), m.body.querySelector('#wa-text').value); };
  m.body.addEventListener('input', sync);
  m.body.addEventListener('change', sync);
  a.addEventListener('click', () => setTimeout(m.close, 0));
  sync();
  a.focus();
  return m;
}
