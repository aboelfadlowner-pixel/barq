/* «واتساب للعميل»: opens WhatsApp (Web / Desktop / phone) on the customer's
   number with the message already written. The employee reviews it and taps
   «إرسال» inside WhatsApp — nothing is sent automatically and nothing is saved
   in the database. The message goes out from whatever WhatsApp is signed in on
   this device (the branch number). */
import { esc } from '../utils/dom.js';
import { normalizePhone } from '../utils/format.js';
import { buildOrderSummary } from '../utils/order-summary.js';
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

/* The ready message (CONFIRMED): the same plain order summary as «نسخ الملخص» — no emojis,
   no extra text. Sent when the order goes to the branch so the customer can check it. */
export function buildWhatsAppMessage(order, { edited = false } = {}) {
  return buildOrderSummary(order, { edited: edited || !!order.editCount });
}

/* Direct link for the first mobile of the order (null when there is none). */
export function orderWaLink(order, opts) {
  const p = waPhones(order)[0];
  return p ? waLink(waNumber(p), buildWhatsAppMessage(order, opts)) : null;
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
