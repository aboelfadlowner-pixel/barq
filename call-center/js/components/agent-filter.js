/* "كل الموظفين" filter (Foodics style): a button that opens a list with a
   search box and a checkbox per name. Nothing ticked = everyone.
   Names come from the employee list plus any name found on the orders
   (e.g. a name that was later switched off). */
import { catalog } from '../catalog.js';
import { esc } from '../utils/dom.js';
import { normalizeArabic } from '../utils/format.js';

export function agentFilterHtml() {
  return `
    <div class="combo agent-filter" data-agent-filter>
      <button type="button" class="select combo-btn" aria-haspopup="listbox" aria-expanded="false" data-af-btn>
        <span data-af-label>كل الموظفين</span></button>
      <div class="combo-pop" hidden data-af-pop>
        <input type="search" class="input combo-search" placeholder="ابدأ الكتابة للبحث" aria-label="بحث عن موظف" autocomplete="off">
        <ul class="combo-list" role="listbox" aria-multiselectable="true" data-af-list></ul>
      </div>
    </div>`;
}

/* selected: a Set of names (kept by the caller so it survives re-renders).
   getOrders: returns the orders currently loaded. onChange: called after a change. */
export function initAgentFilter(root, { selected, getOrders, onChange }) {
  const box = root.querySelector('[data-agent-filter]');
  const btn = box.querySelector('[data-af-btn]');
  const pop = box.querySelector('[data-af-pop]');
  const search = pop.querySelector('.combo-search');
  const list = pop.querySelector('[data-af-list]');

  const names = () => {
    const all = new Set(catalog.allAgents.map((a) => a.name));
    getOrders().forEach((o) => o.employee && all.add(o.employee));
    return [...all].sort((a, b) => a.localeCompare(b, 'ar'));
  };
  const label = () => {
    box.querySelector('[data-af-label]').textContent = !selected.size ? 'كل الموظفين'
      : selected.size === 1 ? [...selected][0] : `${selected.size} موظفين`;
    btn.classList.toggle('has-value', selected.size > 0);
  };
  const renderList = () => {
    const q = normalizeArabic(search.value.trim());
    const shown = names().filter((n) => !q || normalizeArabic(n).includes(q));
    list.innerHTML = `
      ${q ? '' : `<li><label class="af-row"><input type="checkbox" data-af-all ${selected.size ? '' : 'checked'}><span>كل الموظفين</span></label></li>`}
      ${shown.map((n) => `
        <li><label class="af-row"><input type="checkbox" data-af-name="${esc(n)}" ${selected.has(n) ? 'checked' : ''}><span>${esc(n)}</span></label></li>`).join('')}
      ${shown.length ? '' : '<li class="combo-empty">مفيش اسم كده</li>'}`;
  };
  const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };

  btn.addEventListener('click', () => {
    if (!pop.hidden) { close(); return; }
    pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
    search.value = ''; renderList(); search.focus();
  });
  search.addEventListener('input', renderList);
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); } });
  list.addEventListener('change', (e) => {
    if (e.target.matches('[data-af-all]')) selected.clear();
    else if (e.target.matches('[data-af-name]')) {
      const n = e.target.dataset.afName;
      if (e.target.checked) selected.add(n); else selected.delete(n);
    }
    renderList(); label(); onChange();
  });
  const outside = (e) => { if (!pop.hidden && !box.contains(e.target)) close(); };
  document.addEventListener('pointerdown', outside);
  label();
  return () => document.removeEventListener('pointerdown', outside);
}

/* Shared rule: nothing selected = all orders. */
export const matchesAgent = (o, selected) => !selected.size || selected.has(o.employee);
