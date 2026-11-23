/* «خصم» و«بدون رسوم توصيل» (48_order_adjust.sql) — from the order's side panel.
   CONFIRMED:
     • «بدون رسوم توصيل»: the fee is taken off the order; the branch sees «رسوم التوصيل متشالة»;
     • «خصم»: ready buttons 10% / 15%, or «مبلغ تاني» typed as جنيه or %; a percent is taken from the
       ITEMS only (not the delivery fee); the total follows at once;
     • no reason is asked; a discount over 30% shows a warning;
     • call center and admin; the order keeps who did it and when. */
import { getState, setAdjust, areaFee, draftTotals } from '../store.js';
import { computeTotals, discountAmount } from '../utils/pricing.js';
import { esc } from '../utils/dom.js';
import { formatMoney } from '../utils/format.js';
import { icon } from './icons.js';
import { money } from './chips.js';
import { openModal, showToast } from './modal.js';

export const WARN_PERCENT = 30;

export function openAdjustDialog() {
  const s0 = getState();
  const fee = areaFee(s0);
  const cur = s0.adjust || {};
  const st = {
    noFee: !!cur.noFee,
    kind: cur.discount?.kind ?? 'percent',            // 'percent' | 'amount'
    value: cur.discount?.value ?? 0,
    preset: cur.discount?.kind === 'percent' && [10, 15].includes(cur.discount.value) ? cur.discount.value : (cur.discount?.value > 0 ? 'custom' : 0),
  };
  const m = openModal({ title: `${icon('edit')} خصم / رسوم التوصيل`, size: 'sm' });
  const subtotal = draftTotals(s0).subtotal;

  const discount = () => (st.value > 0 ? { kind: st.kind, value: st.value } : null);
  const preview = () => {
    const removed = st.noFee ? (fee || 0) : 0;
    return computeTotals(s0.cart, st.noFee ? 0 : fee, discount(), removed);
  };
  const problems = () => {
    const p = [];
    if (st.value > 0 && st.kind === 'percent' && st.value > 100) p.push('النسبة لازم تكون من 1 لـ 100');
    if (st.value > 0 && st.kind === 'amount' && st.value > subtotal) p.push('الخصم أكبر من أصناف الطلب');
    return p;
  };

  const render = () => {
    const t = preview();
    const pct = st.kind === 'percent' ? st.value : (subtotal ? (t.discount / subtotal) * 100 : 0);
    const probs = problems();
    m.body.innerHTML = `
      <div class="adj">
        ${fee == null ? '<p class="muted">اختار عنوان التوصيل الأول علشان رسوم التوصيل تظهر.</p>' : fee === 0 ? '' : `
        <label class="adj-check ${st.noFee ? 'is-on' : ''}">
          <input type="checkbox" data-nofee ${st.noFee ? 'checked' : ''}>
          <span><strong>بدون رسوم توصيل</strong><small class="muted"> — الرسوم ${money(fee)} هتتشال من الطلب، والتجهيز هيشوف إنها متشالة</small></span>
        </label>`}

        <div class="adj-sec">
          <h4>خصم</h4>
          <div class="adj-presets" role="group" aria-label="خصم جاهز">
            ${[10, 15].map((p) => `<button type="button" class="chip ${st.preset === p ? 'is-on' : ''}" data-preset="${p}">${p}%</button>`).join('')}
            <button type="button" class="chip ${st.preset === 'custom' ? 'is-on' : ''}" data-preset="custom">مبلغ تاني</button>
            ${st.value > 0 ? '<button type="button" class="btn btn-ghost btn-sm" data-clear-disc>بدون خصم</button>' : ''}
          </div>
          ${st.preset === 'custom' ? `
          <div class="adj-custom">
            <input id="adj-val" class="input input-lg ltr num" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="${st.value > 0 ? esc(String(st.value)) : ''}" aria-label="قيمة الخصم">
            <div class="seg" role="group" aria-label="نوع الخصم">
              <button type="button" class="${st.kind === 'amount' ? 'active' : ''}" data-kind="amount">ج.م</button>
              <button type="button" class="${st.kind === 'percent' ? 'active' : ''}" data-kind="percent">%</button>
            </div>
          </div>` : ''}
          <p class="muted adj-note">الخصم بيتحسب من أصناف الطلب (${money(subtotal)}) من غير رسوم التوصيل.</p>
          ${pct > WARN_PERCENT ? `<div class="alert alert-warn">${icon('alert')}<span>الخصم ${Math.round(pct)}% — أكتر من ${WARN_PERCENT}%. اتأكد إنه مقصود.</span></div>` : ''}
        </div>

        <div class="adj-sum">
          <div class="trow"><span>الأصناف</span>${money(t.subtotal)}</div>
          <div class="trow"><span>رسوم التوصيل</span>${st.noFee && fee ? `<span><s class="muted">${money(fee)}</s> <strong>متشالة</strong></span>` : (fee == null ? '<span class="muted">—</span>' : money(fee))}</div>
          ${t.discount > 0 ? `<div class="trow disc"><span>${st.kind === 'percent' ? `خصم ${st.value}%` : 'خصم'}</span><span>− ${money(t.discount)}</span></div>` : ''}
          <div class="trow total"><span>${t.estimated ? 'الإجمالي التقريبي' : 'الإجمالي'}</span>${money(t.total)}</div>
        </div>
        ${probs.length ? `<div class="field-error" role="alert">${probs.map(esc).join(' · ')}</div>` : ''}
      </div>`;
    m.foot.innerHTML = `
      <button type="button" class="btn btn-secondary" data-close>إلغاء</button>
      <button type="button" class="btn btn-primary" data-save ${probs.length ? 'disabled' : ''}>${icon('check')}تطبيق</button>`;
  };

  const parseVal = (txt) => {
    const n = Number(String(txt).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  };

  m.el.addEventListener('click', (e) => {
    const preset = e.target.closest('[data-preset]');
    if (preset) {
      const v = preset.dataset.preset;
      if (v === 'custom') {
        if (st.preset !== 'custom' && [10, 15].includes(st.value) && st.kind === 'percent') Object.assign(st, { value: 0, kind: 'amount' });   // leave the ready button's number
        st.preset = 'custom';
      }
      else { st.preset = Number(v); st.kind = 'percent'; st.value = Number(v); }
      render();
      if (st.preset === 'custom') m.el.querySelector('#adj-val')?.focus();
      return;
    }
    if (e.target.closest('[data-clear-disc]')) { Object.assign(st, { preset: 0, value: 0 }); render(); return; }
    const kind = e.target.closest('[data-kind]');
    if (kind) { st.kind = kind.dataset.kind; render(); m.el.querySelector('#adj-val')?.focus(); return; }
    if (e.target.closest('[data-save]')) {
      if (problems().length) return;
      setAdjust({ noFee: st.noFee && !!fee, discount: discount() });
      m.close();
      showToast(st.noFee || st.value > 0 ? 'اتطبّق على الطلب ✓' : 'اتشال الخصم');
    }
  });
  m.el.addEventListener('change', (e) => {
    if (e.target.matches('[data-nofee]')) { st.noFee = e.target.checked; render(); }
  });
  m.el.addEventListener('input', (e) => {
    if (e.target.id === 'adj-val') {
      st.value = parseVal(e.target.value);
      // live: update the summary and the button without re-rendering the field (the cursor stays)
      const keep = e.target.value; const pos = e.target.selectionStart;
      render();
      const f = m.el.querySelector('#adj-val'); if (f) { f.value = keep; f.focus(); try { f.setSelectionRange(pos, pos); } catch { /* ignore */ } }
    }
  });
  render();
}
