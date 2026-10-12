/* Optional weight for a cart line. The product price is treated as the price per kg,
   so the line total becomes price × weight. Without a weight the line stays by piece. */
import { setLineWeight, setLineByPiece } from '../store.js';
import { WEIGHT_PRESETS, WEIGHT_STEP_GRAMS, WEIGHT_MIN_GRAMS, WEIGHT_MAX_GRAMS } from '../constants.js';
import { esc } from '../utils/dom.js';
import { formatMoney, formatWeight, toWesternDigits } from '../utils/format.js';
import { icon } from './icons.js';
import { openModal } from './modal.js';

const priceFor = (product, grams) => (product.price * grams) / 1000;
const isValid = (g) => g >= WEIGHT_MIN_GRAMS && g <= WEIGHT_MAX_GRAMS;

export function openWeightDialog(product, { line }) {
  const isWeight = line.unitType === 'weight';
  let grams = isWeight ? line.grams : 0;

  const m = openModal({
    title: `${icon('scale')} بيع بالوزن: ${esc(product.name)}`,
    size: 'sm',
    body: `
      <div class="wd">
        <div class="wd-rate"><span>سعر الكيلو (سعر الصنف في الشيت)</span><strong class="num">${formatMoney(product.price)}</strong></div>

        <div class="seg seg-full" role="tablist" aria-label="طريقة الإدخال">
          <button type="button" class="active" data-mode="weight">بالوزن</button>
          <button type="button" data-mode="amount">بالمبلغ <span class="tag">مقترح</span></button>
        </div>

        <div data-pane="weight" class="wd">
          <div class="preset-grid">
            ${WEIGHT_PRESETS.map((p) => `
              <button type="button" class="preset" data-g="${p.grams}">
                ${esc(p.label)}<small class="num">${formatMoney(priceFor(product, p.grams))}</small>
              </button>`).join('')}
          </div>
          <div class="field">
            <label for="wdGrams">وزن مخصص</label>
            <div class="qty-input">
              <button type="button" class="btn btn-secondary" data-step="1" aria-label="زيادة ${WEIGHT_STEP_GRAMS} جرام">${icon('plus')}</button>
              <div class="input-wrap">
                <input id="wdGrams" class="input ltr-center" inputmode="numeric" autocomplete="off" placeholder="0">
                <span class="suffix">جرام</span>
              </div>
              <button type="button" class="btn btn-secondary" data-step="-1" aria-label="نقص ${WEIGHT_STEP_GRAMS} جرام">${icon('minus')}</button>
            </div>
          </div>
        </div>

        <div data-pane="amount" class="wd" hidden>
          <div class="field">
            <label for="wdAmount">المبلغ الذي يطلبه العميل</label>
            <div class="input-wrap">
              <input id="wdAmount" class="input" inputmode="decimal" autocomplete="off" placeholder="مثال: 100">
              <span class="suffix">ج.م</span>
            </div>
          </div>
          <div class="alert alert-info">${icon('info')}<span>يُحسب الوزن التقريبي من المبلغ. هذه طريقة مقترحة في انتظار الاعتماد.</span></div>
        </div>

        <div class="wd-summary" aria-live="polite">
          <div><div class="k">الوزن</div><div class="v num" data-out="weight">—</div></div>
          <div><div class="k">السعر التقديري</div><div class="v price num" data-out="price">—</div></div>
        </div>
        <div class="est-note">${icon('scale')} السعر النهائي يتحدد حسب الوزن الفعلي عند التجهيز</div>
      </div>`,
    footer: `
      <button type="button" class="btn btn-primary btn-lg" data-ok disabled>${icon('check')}${isWeight ? 'حفظ الوزن' : 'احسب بالوزن'}</button>
      <button type="button" class="btn btn-secondary btn-lg" data-close>إلغاء</button>
      ${isWeight ? `<button type="button" class="btn btn-ghost push" data-piece>${icon('package')}رجوع للبيع بالقطعة</button>` : ''}`,
  });

  const $ = (sel) => m.el.querySelector(sel);
  const gramsInput = $('#wdGrams');
  const amountInput = $('#wdAmount');
  const okBtn = $('[data-ok]');

  function sync({ fromInput = false } = {}) {
    m.el.querySelectorAll('.preset').forEach((b) => b.classList.toggle('active', Number(b.dataset.g) === grams));
    if (!fromInput) gramsInput.value = grams ? String(grams) : '';
    $('[data-out="weight"]').textContent = grams ? formatWeight(grams) : '—';
    $('[data-out="price"]').textContent = grams ? formatMoney(priceFor(product, grams)) : '—';
    okBtn.disabled = !isValid(grams);
  }

  function commit() {
    if (!isValid(grams)) return;
    setLineWeight(line.lineId, grams);
    m.close();
  }

  m.el.addEventListener('click', (e) => {
    const preset = e.target.closest('[data-g]');
    if (preset) { grams = Number(preset.dataset.g); sync(); return; }
    const step = e.target.closest('[data-step]');
    if (step) {
      const dir = Number(step.dataset.step);
      const snapped = Math.round(grams / WEIGHT_STEP_GRAMS) * WEIGHT_STEP_GRAMS;
      grams = Math.min(WEIGHT_MAX_GRAMS, Math.max(0, snapped + dir * WEIGHT_STEP_GRAMS));
      sync();
      return;
    }
    const mode = e.target.closest('[data-mode]');
    if (mode) {
      m.el.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b === mode));
      const isAmount = mode.dataset.mode === 'amount';
      $('[data-pane="weight"]').hidden = isAmount;
      $('[data-pane="amount"]').hidden = !isAmount;
      (isAmount ? amountInput : gramsInput).focus();
    }
  });

  gramsInput.addEventListener('input', () => {
    const v = parseInt(toWesternDigits(gramsInput.value).replace(/\D/g, ''), 10);
    grams = Number.isFinite(v) ? Math.min(v, WEIGHT_MAX_GRAMS) : 0;
    sync({ fromInput: true });
  });

  amountInput.addEventListener('input', () => {
    const v = parseFloat(toWesternDigits(amountInput.value).replace(/[^\d.]/g, ''));
    // Round to the nearest 5 g so the weight is practical to cut.
    grams = Number.isFinite(v) && v > 0 ? Math.min(WEIGHT_MAX_GRAMS, Math.round(((v / product.price) * 1000) / 5) * 5) : 0;
    sync();
  });

  [gramsInput, amountInput].forEach((inp) => inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
  }));
  okBtn.addEventListener('click', commit);
  m.foot.querySelector('[data-piece]')?.addEventListener('click', () => { setLineByPiece(line.lineId); m.close(); });

  sync();
  gramsInput.focus();
  if (isWeight) gramsInput.select();
}
