/* Foodics-style "add product" dialog: quantity (with + / −) and notes.
   • Sold by unit  → whole numbers only; a decimal shows the red rule message.
   • Sold by weight → quantity in kg, decimals allowed (0.125 = 125 g); priced
     as price-per-kg × weight. Quick chips for common weights.
   Used for adding a product and for editing a cart line. */
import { addProduct, updateLine } from '../store.js';
import { WEIGHT_PRESETS, WEIGHT_MIN_GRAMS, WEIGHT_MAX_GRAMS, MAX_PIECE_QTY } from '../constants.js';
import { esc } from '../utils/dom.js';
import { formatMoney, formatWeight, toWesternDigits } from '../utils/format.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';

export const DECIMAL_RULE = 'لا يمكن أن تحتوي الكمية على أرقام عشرية في المنتجات التي يتم بيعها بالوحدة.';

const parseQty = (v) => {
  const n = parseFloat(toWesternDigits(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const kgText = (grams) => String(Math.round(grams) / 1000);

export function openItemDialog(product, { line = null } = {}) {
  const byWeight = product.unitType === 'weight';
  const step = byWeight ? 0.25 : 1;
  const startQty = line ? (byWeight ? kgText(line.grams) : String(line.qty)) : (byWeight ? '' : '1');

  const m = openModal({
    title: esc(product.name),
    size: 'md',
    body: `
      <div class="item-form">
        <div class="item-error" data-rule hidden>${icon('alert')}<span></span></div>
        <div class="field">
          <label for="it-qty">${byWeight ? 'الكمية (بالكيلو)' : 'الكمية'}<span class="req">*</span>
            <span class="tag ${byWeight ? 'tag-warn' : 'tag-green'}">${byWeight ? `${icon('scale')}بالوزن` : `${icon('package')}بالوحدة`}</span></label>
          <div class="qty-input">
            <div class="input-wrap">
              <input id="it-qty" class="input ltr-center" name="qty" inputmode="decimal" autocomplete="off"
                value="${esc(startQty)}" placeholder="${byWeight ? '0.5' : '1'}">
              ${byWeight ? '<span class="suffix">كجم</span>' : ''}
            </div>
            <button type="button" class="btn btn-secondary" data-step="-1" aria-label="نقص">${icon('minus')}</button>
            <button type="button" class="btn btn-secondary" data-step="1" aria-label="زيادة">${icon('plus')}</button>
          </div>
          ${byWeight ? `<div class="chips">${WEIGHT_PRESETS.map((p) => `
            <button type="button" class="chip" data-kg="${p.grams / 1000}">${esc(p.label)}</button>`).join('')}</div>` : ''}
          <div class="item-calc" data-calc></div>
        </div>
        <div class="field">
          <label for="it-note">ملاحظات</label>
          <textarea id="it-note" class="textarea" name="note" rows="3" maxlength="120"
            placeholder="${byWeight ? 'مثال: شرائح رفيعة' : 'مثال: نوع معين'}">${esc(line?.note ?? '')}</textarea>
        </div>
      </div>`,
    footer: `
      <button type="button" class="btn btn-primary btn-lg" data-ok>${icon(line ? 'check' : 'plus')}${line ? 'حفظ' : 'إضافة'}</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>`,
  });

  const $ = (sel) => m.el.querySelector(sel);
  const qtyInput = $('#it-qty');
  const rule = $('[data-rule]');

  const showRule = (msg) => { rule.hidden = !msg; rule.querySelector('span').textContent = msg || ''; };

  /* Returns { ok, qty|grams } or { ok:false, msg } */
  function check() {
    const raw = qtyInput.value.trim();
    const n = parseQty(raw);
    if (!raw || Number.isNaN(n) || n <= 0) return { ok: false, msg: 'اكتب كمية أكبر من صفر.' };
    if (!byWeight) {
      if (!Number.isInteger(n)) return { ok: false, msg: DECIMAL_RULE };
      if (n > MAX_PIECE_QTY) return { ok: false, msg: `أقصى كمية ${MAX_PIECE_QTY}.` };
      return { ok: true, qty: n };
    }
    const grams = Math.round(n * 1000);
    if (grams < WEIGHT_MIN_GRAMS || grams > WEIGHT_MAX_GRAMS) {
      return { ok: false, msg: `الوزن لازم يكون بين ${formatWeight(WEIGHT_MIN_GRAMS)} و${formatWeight(WEIGHT_MAX_GRAMS)}.` };
    }
    return { ok: true, grams };
  }

  function refresh({ showErrors = false } = {}) {
    const r = check();
    const calc = $('[data-calc]');
    if (r.ok) {
      showRule('');
      calc.innerHTML = byWeight
        ? `${formatWeight(r.grams)} × ${formatMoney(product.price)}/كجم = <strong>${formatMoney(product.price * r.grams / 1000)}</strong> <span class="est">تقريبي</span>`
        : `${r.qty} × ${formatMoney(product.price)} = <strong>${formatMoney(product.price * r.qty)}</strong>`;
    } else {
      calc.textContent = '';
      // The decimal rule is shown as soon as it is typed (as in Foodics); other errors on submit.
      showRule(showErrors || r.msg === DECIMAL_RULE ? r.msg : '');
    }
    m.el.querySelectorAll('[data-kg]').forEach((c) => c.classList.toggle('active', r.ok && Math.round(Number(c.dataset.kg) * 1000) === r.grams));
    return r;
  }

  function commit() {
    const r = refresh({ showErrors: true });
    if (!r.ok) { qtyInput.focus(); return; }
    const note = $('#it-note').value.trim();
    if (line) updateLine(line.lineId, byWeight ? { grams: r.grams, note } : { qty: r.qty, note });
    else addProduct(product, byWeight ? { grams: r.grams, note } : { qty: r.qty, note });
    m.close();
  }

  m.el.addEventListener('click', (e) => {
    const st = e.target.closest('[data-step]');
    if (st) {
      const cur = parseQty(qtyInput.value) || 0;
      const next = Math.max(byWeight ? step : 1, Math.round((cur + Number(st.dataset.step) * step) * 1000) / 1000);
      qtyInput.value = byWeight ? String(next) : String(Math.round(next));
      refresh();
      return;
    }
    const chip = e.target.closest('[data-kg]');
    if (chip) { qtyInput.value = chip.dataset.kg; refresh(); }
  });
  qtyInput.addEventListener('input', () => refresh());
  m.el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); commit(); }
  });
  $('[data-ok]').addEventListener('click', commit);

  refresh();
  qtyInput.focus();
  qtyInput.select();
}
