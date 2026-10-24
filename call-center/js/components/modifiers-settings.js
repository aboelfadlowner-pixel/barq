/* Settings (admin): which add-on groups each product shows, like Foodics, with the minimum and the
   maximum of each group («لا تزيد عن 5»). The groups and their prices come from the Foodics export;
   here the admin only links them to products. Saved for all devices; prices stay in the database. */
import * as ds from '../data/data-source.js';
import { catalog, productModifiers, reloadModifiers } from '../catalog.js';
import { filterProducts } from './product-grid.js';
import { esc, on } from '../utils/dom.js';
import { formatMoney, toWesternDigits } from '../utils/format.js';
import { icon } from './icons.js';
import { showToast } from './modal.js';

const toInt = (v) => {
  const n = parseInt(toWesternDigits(String(v)).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : NaN;
};
const optionsText = (g) => g.options.map((o) => `${o.name}${o.price ? ` ${formatMoney(o.price)}` : ''}`).join(' · ');

export function mountModifiersSettings(box) {
  let product = null;   // the product being set
  let links = [];       // [{ groupId, min, max, defaultId }] for that product, in order

  box.innerHTML = `
    <h2 class="section-title">${icon('package')}إضافات الأصناف</h2>
    <p class="muted section-sub">مثل فودكس: عند اختيار الصنف تظهر مجموعات الإضافات التي تحددها هنا، بأسعارها من شيت الإضافات.
      <strong>اختيار جاهز</strong> = يظهر مختارًا من البداية ويمكن تغييره (مثل Full Cream Milk) ·
      <strong>الحد الأدنى</strong> 0 = اختياري، 1 أو أكثر = يجب الاختيار (مثل طعم الآيس كريم) · <strong>الحد الأقصى</strong> = لا تزيد عن.</p>
    <div class="card card-pad mods-settings">
      <div class="field">
        <label for="modsSearch">الصنف</label>
        <input id="modsSearch" class="input" autocomplete="off" placeholder="ابحث باسم الصنف أو الكود">
        <div class="mods-results" data-results></div>
        <div class="mods-linked" data-linked></div>
      </div>
      <div data-editor></div>
    </div>`;

  const $ = (sel) => box.querySelector(sel);

  const renderLinked = () => {
    const skus = [...catalog.modifiersBySku.keys()].filter((id) => catalog.productsById.has(id));
    $('[data-linked]').innerHTML = skus.length
      ? `<div class="hint">أصناف لها إضافات (${skus.length}):</div><div class="chips">${skus.map((id) => `
          <button type="button" class="chip ${product?.id === id ? 'active' : ''}" data-pick="${esc(id)}">${esc(catalog.productsById.get(id).name)}</button>`).join('')}</div>`
      : `<div class="hint">${catalog.modifierGroups?.length ? 'لا توجد أصناف مرتبطة بإضافات بعد.' : 'لا توجد مجموعات إضافات على قاعدة البيانات بعد.'}</div>`;
  };

  const renderEditor = () => {
    const ed = $('[data-editor]');
    if (!product) { ed.innerHTML = ''; return; }
    const groups = catalog.modifierGroups || [];
    const byId = new Map(groups.map((g) => [g.id, g]));
    const free = groups.filter((g) => !links.some((l) => l.groupId === g.id));
    ed.innerHTML = `
      <div class="mods-product"><strong>${esc(product.name)}</strong> <span class="muted num">${esc(product.code ?? product.id)}</span></div>
      <div class="table-wrap">
        <table class="table mods-table">
          <thead><tr><th>مجموعة الإضافات</th><th>اختيار جاهز</th><th>الحد الأدنى</th><th>الحد الأقصى</th><th></th></tr></thead>
          <tbody>${links.length ? links.map((l, i) => {
            const g = byId.get(l.groupId);
            return `
            <tr data-i="${i}">
              <td><strong>${esc(g?.name ?? '—')}</strong><div class="hint">${esc(g ? optionsText(g) : '')}</div></td>
              <td><select class="input" name="def" aria-label="اختيار جاهز">
                <option value="">—</option>
                ${(g?.options || []).map((o) => `<option value="${esc(o.id)}" ${o.id === l.defaultId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
              </select></td>
              <td class="fee-cell"><input class="input ltr-center" name="min" inputmode="numeric" value="${l.min}" aria-label="الحد الأدنى"></td>
              <td class="fee-cell"><input class="input ltr-center" name="max" inputmode="numeric" value="${l.max}" aria-label="الحد الأقصى"></td>
              <td><button type="button" class="btn btn-danger-ghost btn-icon btn-sm" data-remove aria-label="إزالة">${icon('trash')}</button></td>
            </tr>`;
          }).join('') : '<tr><td colspan="5" class="table-empty">لا توجد إضافات لهذا الصنف</td></tr>'}</tbody>
        </table>
      </div>
      <div class="mods-add">
        <select class="input" data-new-group aria-label="مجموعة إضافات">
          <option value="">— اختر مجموعة لإضافتها —</option>
          ${free.map((g) => `<option value="${esc(g.id)}">${esc(g.name)} (${g.options.length})</option>`).join('')}
        </select>
        <button type="button" class="btn btn-secondary" data-add-group>${icon('plus')}إضافة المجموعة</button>
        <button type="button" class="btn btn-primary" data-save-mods>${icon('check')}حفظ إضافات الصنف</button>
      </div>
      <div class="field-error" data-err="mods"></div>`;
  };

  const pick = (id) => {
    product = catalog.productsById.get(id) || null;
    links = productModifiers(id).map((g) => ({ groupId: g.id, min: g.min, max: g.max, defaultId: g.defaultId }));
    $('[data-results]').innerHTML = '';
    $('#modsSearch').value = product?.name ?? '';
    renderLinked();
    renderEditor();
  };

  // Keep typed min/max when the table is redrawn.
  const readInputs = () => {
    box.querySelectorAll('[data-editor] tr[data-i]').forEach((tr) => {
      const l = links[Number(tr.dataset.i)];
      l.min = toInt(tr.querySelector('[name="min"]').value);
      l.max = toInt(tr.querySelector('[name="max"]').value);
      l.defaultId = tr.querySelector('[name="def"]').value || null;
    });
  };

  const offs = [
    on(box, 'input', '#modsSearch', (e, input) => {
      const found = filterProducts(input.value).slice(0, 8);
      $('[data-results]').innerHTML = found.map((p) => `
        <button type="button" class="mods-result" data-pick="${esc(p.id)}"><span>${esc(p.name)}</span>
          <span class="muted num">${esc(p.code ?? p.id)} · ${formatMoney(p.price)}</span></button>`).join('');
    }),
    on(box, 'click', '[data-pick]', (e, btn) => pick(btn.dataset.pick)),
    on(box, 'click', '[data-remove]', (e, btn) => {
      readInputs();
      links.splice(Number(btn.closest('tr').dataset.i), 1);
      renderEditor();
    }),
    on(box, 'click', '[data-add-group]', () => {
      const id = $('[data-new-group]').value;
      if (!id) return;
      readInputs();
      links.push({ groupId: id, min: 0, max: 5 });
      renderEditor();
    }),
    on(box, 'click', '[data-save-mods]', async (e, btn) => {
      readInputs();
      const err = $('[data-err="mods"]');
      const bad = links.find((l) => !(l.max >= 1 && l.max <= 20) || !(l.min >= 0) || l.min > l.max);
      if (bad) { err.textContent = 'الحد الأقصى من 1 إلى 20، والحد الأدنى صفر أو أكثر ولا يزيد عن الحد الأقصى.'; return; }
      err.textContent = '';
      btn.disabled = true;
      try {
        await ds.saveProductModifiers(product.id, links);
        await reloadModifiers();
        showToast(`تم حفظ إضافات «${product.name}»`);
        pick(product.id);
      } catch (ex) {
        err.textContent = ex.message;
      } finally { btn.disabled = false; }
    }),
  ];

  renderLinked();
  return () => offs.forEach((f) => f());
}
