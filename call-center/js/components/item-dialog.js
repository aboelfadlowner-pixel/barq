/* Foodics-style "add product" dialog: quantity (with + / −), add-ons and notes.
   • Sold by unit  → whole numbers only; a decimal shows the red rule message.
   • Sold by weight → quantity in kg, decimals allowed (0.125 = 125 g); priced
     as price-per-kg × weight. Quick chips for common weights.
   • Add-ons (like Foodics): each group of the product with its options, prices and limit
     («لا تزيد عن 5»); tap an option to add one, − to remove. A group with a minimum must be
     chosen before adding (e.g. the ice-cream flavour). Counted per piece.
   Used for adding a product and for editing a cart line. */
import { addProduct, updateLine } from '../store.js';
import { WEIGHT_PRESETS, WEIGHT_MIN_GRAMS, WEIGHT_MAX_GRAMS, MAX_PIECE_QTY } from '../constants.js';
import { esc } from '../utils/dom.js';
import { formatMoney, formatWeight, toWesternDigits } from '../utils/format.js';
import { productModifiers } from '../catalog.js';
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
  const groups = productModifiers(product.id);
  // Chosen add-ons: option id → count. On a cart line the price it already has is kept (edit keeps prices).
  const chosen = new Map((line?.modifiers || []).map((m) => [m.id, m.qty]));
  const keptPrice = new Map((line?.modifiers || []).map((m) => [m.id, m.price]));
  const priceOf = (o) => keptPrice.get(o.id) ?? o.price;
  const groupCount = (g) => g.options.reduce((s, o) => s + (chosen.get(o.id) || 0), 0);
  const modsPerPiece = () => groups.reduce((s, g) => s + g.options.reduce((t, o) => t + priceOf(o) * (chosen.get(o.id) || 0), 0), 0);
  const groupRule = (g) => (g.min > 0
    ? (g.min === g.max ? `مطلوب: اختر ${g.min}` : `مطلوب: من ${g.min} إلى ${g.max}`)
    : `اختياري — لا تزيد عن ${g.max}`);

  const m = openModal({
    title: esc(product.name),
    size: groups.length ? 'lg' : 'md',
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
            <button type="button" class="btn btn-secondary" data-step="-1" aria-label="إنقاص">${icon('minus')}</button>
            <button type="button" class="btn btn-secondary" data-step="1" aria-label="زيادة">${icon('plus')}</button>
          </div>
          ${byWeight ? `<div class="chips">${WEIGHT_PRESETS.map((p) => `
            <button type="button" class="chip" data-kg="${p.grams / 1000}">${esc(p.label)}${p.grams % 1000
              ? ` <span class="chip-num num">${p.grams / 1000}</span>` : ''}</button>`).join('')}</div>` : ''}
          <div class="item-calc" data-calc></div>
        </div>
        ${groups.map((g) => `
          <div class="mod-group" data-group="${esc(g.id)}">
            <div class="mod-head"><strong>${esc(g.name)}</strong>
              <span class="mod-rule ${g.min > 0 ? 'req' : ''}">${esc(groupRule(g))}</span>
              <span class="mod-count num" data-count></span></div>
            <div class="mod-options">${g.options.map((o) => `
              <div class="mod-opt" data-opt="${esc(o.id)}">
                <button type="button" class="mod-add" data-mod-add aria-label="إضافة ${esc(o.name)}">
                  <span class="mod-name">${esc(o.name)}</span>
                  <span class="mod-price">${priceOf(o) ? `+${formatMoney(priceOf(o))}` : 'بدون سعر إضافي'}</span>
                </button>
                <div class="mod-qty">
                  <button type="button" class="btn btn-secondary btn-icon btn-sm" data-mod-dec aria-label="إنقاص ${esc(o.name)}">${icon('minus')}</button>
                  <span class="num" data-n></span>
                </div>
              </div>`).join('')}</div>
          </div>`).join('')}
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
    if (!raw || Number.isNaN(n) || n <= 0) return { ok: false, msg: 'أدخل كمية أكبر من صفر.' };
    if (!byWeight) {
      if (!Number.isInteger(n)) return { ok: false, msg: DECIMAL_RULE };
      if (n > MAX_PIECE_QTY) return { ok: false, msg: `أقصى كمية ${MAX_PIECE_QTY}.` };
      return { ok: true, qty: n };
    }
    const grams = Math.round(n * 1000);
    if (grams < WEIGHT_MIN_GRAMS || grams > WEIGHT_MAX_GRAMS) {
      return { ok: false, msg: `يجب أن يكون الوزن بين ${formatWeight(WEIGHT_MIN_GRAMS)} و${formatWeight(WEIGHT_MAX_GRAMS)}.` };
    }
    return { ok: true, grams };
  }

  /* The first group below its minimum, as a message (null = all fine). */
  const missingGroup = () => {
    const g = groups.find((x) => groupCount(x) < x.min);
    return g ? `اختر ${g.min} على الأقل من «${g.name}».` : null;
  };

  function renderMods() {
    for (const g of groups) {
      const box = m.el.querySelector(`[data-group="${CSS.escape(g.id)}"]`);
      const n = groupCount(g);
      box.querySelector('[data-count]').textContent = `${n} من ${g.max}`;
      box.classList.toggle('full', n >= g.max);
      for (const o of g.options) {
        const row = box.querySelector(`[data-opt="${CSS.escape(o.id)}"]`);
        const c = chosen.get(o.id) || 0;
        row.classList.toggle('on', c > 0);
        row.querySelector('[data-n]').textContent = c ? String(c) : '';
        // Full group: only a one-choice group lets another option replace the current one.
        row.querySelector('[data-mod-add]').disabled = n >= g.max && !(g.max === 1 && c === 0);
      }
    }
  }

  function refresh({ showErrors = false } = {}) {
    const r = check();
    const calc = $('[data-calc]');
    const extra = modsPerPiece();
    if (r.ok) {
      showRule(showErrors ? missingGroup() || '' : '');
      const base = byWeight ? product.price * r.grams / 1000 : product.price * r.qty;
      const total = byWeight ? base + extra : (product.price + extra) * r.qty;
      const mods = extra ? ` + الإضافات ${formatMoney(byWeight ? extra : extra * r.qty)}` : '';
      calc.innerHTML = byWeight
        ? `${formatWeight(r.grams)} × ${formatMoney(product.price)}/كجم${mods} = <strong>${formatMoney(total)}</strong> <span class="est">تقريبي</span>`
        : `${r.qty} × ${formatMoney(product.price)}${mods} = <strong>${formatMoney(total)}</strong>`;
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
    if (missingGroup()) {
      m.el.querySelector(`[data-group="${CSS.escape(groups.find((g) => groupCount(g) < g.min).id)}"]`)?.scrollIntoView({ block: 'center' });
      return;
    }
    const note = $('#it-note').value.trim();
    const modifiers = groups.flatMap((g) => g.options.filter((o) => chosen.get(o.id))
      .map((o) => ({ id: o.id, groupId: g.id, group: g.name, name: o.name, price: priceOf(o), qty: chosen.get(o.id) })));
    if (line) updateLine(line.lineId, byWeight ? { grams: r.grams, note, modifiers } : { qty: r.qty, note, modifiers });
    else addProduct(product, byWeight ? { grams: r.grams, note, modifiers } : { qty: r.qty, note, modifiers });
    m.close();
  }

  m.el.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-opt]');
    if (opt && (e.target.closest('[data-mod-add]') || e.target.closest('[data-mod-dec]'))) {
      const g = groups.find((x) => x.id === opt.closest('[data-group]').dataset.group);
      const id = opt.dataset.opt;
      const c = chosen.get(id) || 0;
      if (e.target.closest('[data-mod-dec]')) {
        if (c > 1) chosen.set(id, c - 1); else chosen.delete(id);
      } else if (g.max === 1 && c === 0) {
        g.options.forEach((o) => chosen.delete(o.id));   // one choice: the new one replaces the old
        chosen.set(id, 1);
      } else if (groupCount(g) < g.max) chosen.set(id, c + 1);
      renderMods();
      refresh();
      return;
    }
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

  renderMods();
  refresh();
  if (!groups.length) {
    qtyInput.focus();
    qtyInput.select();
  }
}
