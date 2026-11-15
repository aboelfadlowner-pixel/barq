/* The branch corrects an order while preparing it (37_prep_adjust.sql).
   CONFIRMED: from «ابدأ التجهيز» until the driver leaves —
     «⚖️ الوزن الفعلي» on a weighed product (a warning when it differs by more than 20%),
     «🔄 تبديل» with another product from the products sheet (same names and prices),
     «❌ مش موجود» to take a product off (not the last one).
   The total follows at once; the call center is told (ring + a line on the card). No reprint. */
import * as ds from '../data/data-source.js';
import { catalog } from '../catalog.js';
import { esc } from '../utils/dom.js';
import { formatMoney, formatWeight, normalizeArabic } from '../utils/format.js';
import { icon } from './icons.js';
import { confirmDialog, openModal, showToast } from './modal.js';
import { money } from './chips.js';

const amount = (a) => (a?.grams ? formatWeight(a.grams) : a?.qty != null ? `× ${a.qty}` : '');

/* One line for the call center: «⚖️ جبنة رومي: 500 جم ← 540 جم». */
export function adjustText(c) {
  if (c.kind === 'weight') return `⚖️ ${c.name}: ${amount(c.from)} ← ${amount(c.to)}`;
  if (c.kind === 'replaced') return `🔄 ${c.name} ← ${c.toName || c.to_name || ''} ${amount(c.to)}`;
  if (c.kind === 'removed') return `❌ ${c.name}: مش موجود — اتشال`;
  return c.name || '';
}
const totalText = (r) => `الإجمالي بقى ${formatMoney(r.newTotal)} (كان ${formatMoney(r.oldTotal)})`;
const done = (r) => showToast(`تم التعديل ✓ — ${totalText(r)}`);

/* «⚖️ الوزن الفعلي» */
export async function askWeight(order, it, lineNo) {
  const m = openModal({
    title: `${icon('edit')} الوزن الفعلي — ${esc(it.name)}`,
    size: 'sm',
    body: `<div class="adj-asked">المطلوب: <strong class="num">${esc(formatWeight(it.grams))}</strong></div>
      <label class="adj-label" for="adjGrams">اكتب الوزن اللي طلع معاك (بالجرام)</label>
      <div class="adj-big-wrap"><input id="adjGrams" class="adj-big num" type="number" inputmode="numeric" min="10" max="20000" step="1" value="${esc(String(it.grams))}" data-grams>
        <span class="adj-unit">جرام</span></div>
      <p class="field-error" data-err role="alert"></p>`,
    footer: `<button type="button" class="btn btn-secondary" data-close>إلغاء</button>
      <button type="button" class="btn btn-primary" data-ok>${icon('check')}حفظ الوزن</button>`,
  });
  m.el.classList.add('modal-adj');   // stays at the top on the phone, so the keyboard never squeezes it
  const input = m.body.querySelector('[data-grams]');
  input.select?.();
  const save = async () => {
    const grams = Math.round(Number(input.value));
    const err = m.body.querySelector('[data-err]');
    err.textContent = '';
    if (!(grams >= 10 && grams <= 20000)) { err.textContent = 'اكتب الوزن بالجرام (من 10 لـ 20000)'; return; }
    if (Math.abs(grams - it.grams) / it.grams > 0.2
        && !(await confirmDialog({ title: 'الفرق كبير', message: `المطلوب ${formatWeight(it.grams)} واللي كتبته ${formatWeight(grams)} — متأكد؟`, confirmLabel: 'أيوه، متأكد' }))) return;
    try { done(await ds.prepAdjust(order.id, lineNo, it.name, 'weight', { grams })); saved = true; m.close(); }
    catch (ex) { err.textContent = ex.message; }
  };
  let saved = false;
  m.foot.querySelector('[data-ok]').addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  return new Promise((r) => m.onClose(() => r(saved)));
}

/* «🔄 تبديل»: search the products sheet, pick one, then its quantity or weight. */
export function askReplace(order, it, lineNo) {
  return new Promise((resolve) => {
    let picked = null;
    const m = openModal({
      title: `${icon('repeat')} تبديل — ${esc(it.name)}`,
      body: `<div class="field"><label for="adjSearch">الصنف البديل (من شيت المنتجات)</label>
          <input id="adjSearch" class="input" type="search" autocomplete="off" placeholder="اكتب اسم الصنف أو الكود" data-q></div>
        <div class="adj-results" data-results></div>
        <div class="adj-picked" data-picked hidden></div>
        <p class="field-error" data-err role="alert"></p>`,
      footer: `<button type="button" class="btn btn-secondary" data-close>إلغاء</button>
        <button type="button" class="btn btn-primary" data-ok disabled>${icon('check')}تبديل</button>`,
    });
    m.el.classList.add('modal-adj');
    const q = m.body.querySelector('[data-q]');
    const results = m.body.querySelector('[data-results]');
    const box = m.body.querySelector('[data-picked]');
    const ok = m.foot.querySelector('[data-ok]');
    const err = m.body.querySelector('[data-err]');
    const search = () => {
      const t = normalizeArabic(q.value.trim());
      const list = t.length < 2 ? [] : catalog.products.filter((p) => p.searchKey?.includes(t)).slice(0, 30);
      results.innerHTML = t.length < 2 ? '<p class="muted">اكتب حرفين على الأقل</p>'
        : list.length ? list.map((p) => `<button type="button" class="adj-row" data-pid="${esc(p.id)}">
            <span class="grow">${esc(p.name)}</span><span class="muted">${p.unitType === 'weight' ? 'بالكيلو' : 'بالوحدة'}</span>
            <strong class="num">${money(p.price)}</strong></button>`).join('')
          : '<p class="muted">مفيش صنف بالاسم ده</p>';
    };
    q.addEventListener('input', () => { results.hidden = false; search(); });   // typing again: search again
    search();
    q.focus();
    results.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pid]');
      if (!b) return;
      picked = catalog.productsById.get(b.dataset.pid);
      results.hidden = true;   // the list closes so the amount is right under the search (above the phone keyboard)
      const w = picked.unitType === 'weight';
      box.hidden = false;
      box.innerHTML = `<div class="adj-chosen">${icon('check')}<strong>${esc(picked.name)}</strong> · ${money(picked.price)} ${w ? 'للكيلو' : 'للوحدة'}</div>
        <label class="adj-label" for="adjAmt">${w ? 'الوزن (بالجرام)' : 'الكمية'}</label>
        <div class="adj-big-wrap"><input id="adjAmt" class="adj-big num" type="number" inputmode="numeric" min="${w ? 10 : 1}" max="${w ? 20000 : 999}" step="1"
            value="${w ? (it.unitType === 'weight' ? it.grams : 500) : (it.unitType === 'weight' ? 1 : it.qty)}" data-amt><span class="adj-unit">${w ? 'جرام' : 'قطعة'}</span></div>`;
      ok.disabled = false;
      box.querySelector('[data-amt]').focus();
    });
    ok.addEventListener('click', async () => {
      if (!picked) return;
      const v = Math.round(Number(box.querySelector('[data-amt]').value));
      err.textContent = '';
      const w = picked.unitType === 'weight';
      if (w ? !(v >= 10 && v <= 20000) : !(v >= 1 && v <= 999)) { err.textContent = w ? 'اكتب الوزن بالجرام (من 10 لـ 20000)' : 'اكتب الكمية (من 1 لـ 999)'; return; }
      ok.disabled = true;
      try {
        done(await ds.prepAdjust(order.id, lineNo, it.name, 'replace', w ? { sku: picked.id, grams: v } : { sku: picked.id, qty: v }));
        saved = true; m.close();
      } catch (ex) { err.textContent = ex.message; ok.disabled = false; }
    });
    let saved = false;
    m.onClose(() => resolve(saved));
  });
}

/* «❌ مش موجود» */
export async function askRemove(order, it, lineNo) {
  if (order.items.length <= 1) { showToast('ده آخر صنف في الطلب — لو مفيش حاجة يبقى الطلب يتلغي من الكول سنتر'); return false; }
  if (!(await confirmDialog({ title: 'الصنف مش موجود', message: `هيتشال «${it.name}» من الطلب والإجمالي هيقل — والكول سنتر هيعرف.`, confirmLabel: 'شيله من الطلب' }))) return false;
  try { done(await ds.prepAdjust(order.id, lineNo, it.name, 'remove')); return true; }
  catch (ex) { showToast(ex.message); return false; }
}
