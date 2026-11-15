/* The branch corrects an order while preparing it (37_prep_adjust.sql).
   CONFIRMED: only while «قيد التجهيز» (at the cashier: back to «قيد التجهيز» first) —
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
      <label class="adj-label" for="adjGrams">الوزن الجديد (بالجرام)</label>
      <div class="adj-big-wrap"><input id="adjGrams" class="adj-big num" type="number" inputmode="numeric" min="10" max="20000" step="1" placeholder="${esc(String(it.grams))}" data-grams>
        <span class="adj-unit">جرام</span></div>
      <p class="field-error" data-err role="alert"></p>`,
    footer: `<button type="button" class="btn btn-secondary" data-close>إلغاء</button>
      <button type="button" class="btn btn-primary" data-ok>${icon('check')}حفظ الوزن</button>`,
  });
  m.el.classList.add('modal-adj');   // stays at the top on the phone, so the keyboard never squeezes it
  const input = m.body.querySelector('[data-grams]');
  input.focus();
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
      body: `<label class="adj-label" for="adjSearch">آخر 3 لـ 5 أرقام من باركود الصنف البديل</label>
          <div class="adj-big-wrap"><input id="adjSearch" class="adj-big num" type="text" inputmode="numeric" autocomplete="off" maxlength="13" placeholder="مثال: 104" data-q>
            <span class="adj-unit">باركود</span></div>
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
    /* CONFIRMED: the barcode's last 3 to 5 digits. One product → picked at once; several → a short list.
       The prep account cannot read the whole products list: it asks the database for the matches
       (40_prep_find_product.sql). Accounts that have the list (admin, call center) search it here. */
    const found = new Map();   // id → product, of the last search (to pick from the list)
    let seq = 0;
    let timer = null;
    const show = (list, d, digitsOnly) => {
      list.forEach((p) => found.set(p.id, p));
      results.innerHTML = list.length ? `<p class="muted adj-count">${list.length >= 30 ? 'أول 30 صنف — كمّل رقم كمان' : `${list.length} صنف`}</p>` + list.map((p) => `<button type="button" class="adj-row" data-pid="${esc(p.id)}">
            <span class="grow">${esc(p.name)}${p.barcode ? `<span class="adj-bc ltr-inline num">…${esc(String(p.barcode).slice(-5))}</span>` : ''}</span>
            <span class="muted">${p.unitType === 'weight' ? 'بالكيلو' : 'بالوحدة'}</span>
            <strong class="num">${money(p.price)}</strong></button>`).join('')
        : `<p class="muted">${digitsOnly ? `مفيش صنف باركوده بينتهي بـ ${esc(d)}` : 'مفيش صنف بالاسم ده'}</p>`;
    };
    const search = () => {
      const raw = q.value.trim();
      const digitsOnly = /^[0-9٠-٩]+$/.test(raw);
      const d = raw.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
      clearTimeout(timer);
      const mine = ++seq;
      if (!raw || (digitsOnly && d.length < 3)) {
        results.innerHTML = '<p class="muted">اكتب آخر 3 لـ 5 أرقام من الباركود — لو أكتر من صنف، كمّل رقم كمان</p>';
        return;
      }
      if (!catalog.products.length) {             // the prep account: ask the database
        if (!digitsOnly) { results.innerHTML = '<p class="muted">اكتب أرقام الباركود بس</p>'; return; }
        results.innerHTML = '<p class="muted">جارٍ البحث…</p>';
        timer = setTimeout(async () => {
          let list;
          try { list = await ds.prepFindProduct(d); } catch { if (mine === seq) results.innerHTML = '<p class="field-error">تعذر البحث — اتأكد من النت وجرّب تاني</p>'; return; }
          if (mine !== seq) return;                // a newer search is on its way
          if (list.length === 1) { found.set(list[0].id, list[0]); pick(list[0]); return; }
          show(list, d, true);
        }, 250);
        return;
      }
      let list;
      if (digitsOnly) {
        const ends = catalog.products.filter((p) => p.barcode && String(p.barcode).endsWith(d));
        if (ends.length === 1) { pick(ends[0]); return; }   // one product with that ending: chosen at once
        list = ends.slice(0, 30);
      } else {
        const words = normalizeArabic(raw).split(/\s+/).filter(Boolean);
        list = catalog.products.filter((p) => words.every((w) => p.searchKey?.includes(w))).slice(0, 30);
      }
      show(list, d, digitsOnly);
    };
    q.addEventListener('input', () => { results.hidden = false; search(); });   // typing again: search again
    search();
    q.focus();
    results.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pid]');
      if (b) pick(found.get(b.dataset.pid) || catalog.productsById.get(b.dataset.pid));
    });
    function pick(product) {
      picked = product;
      results.hidden = true;   // the list closes so the amount is right under the search (above the phone keyboard)
      const w = picked.unitType === 'weight';
      box.hidden = false;
      box.innerHTML = `<div class="adj-chosen">${icon('check')}<strong>${esc(picked.name)}</strong> · ${money(picked.price)} ${w ? 'للكيلو' : 'للوحدة'}</div>
        <label class="adj-label" for="adjAmt">${w ? 'الوزن (بالجرام)' : 'الكمية'}</label>
        <div class="adj-big-wrap"><input id="adjAmt" class="adj-big num" type="number" inputmode="numeric" min="${w ? 10 : 1}" max="${w ? 20000 : 999}" step="1"
            value="${w ? (it.unitType === 'weight' ? it.grams : 500) : (it.unitType === 'weight' ? 1 : it.qty)}" data-amt><span class="adj-unit">${w ? 'جرام' : 'قطعة'}</span></div>`;
      ok.disabled = false;
      box.querySelector('[data-amt]').select?.();
      box.querySelector('[data-amt]').focus();
    }
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
