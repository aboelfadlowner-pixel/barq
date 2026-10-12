/* Category list (right column on desktop, chip bar on tablet). */
import { bind, setState } from '../store.js';
import { catalog } from '../catalog.js';
import { esc, on } from '../utils/dom.js';

export function mountCategoryNav(el) {
  const counts = new Map();
  catalog.products.forEach((p) => counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1));
  const items = [{ id: 'all', name: 'الكل', count: catalog.products.length },
    ...catalog.categories.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))];

  const off = on(el, 'click', '[data-cat]', (e, btn) => {
    setState({ activeCategory: btn.dataset.cat, search: '' });
  });

  const unbind = bind((s) => ({ active: s.activeCategory, searching: s.search.trim() !== '' }), ({ active, searching }) => {
    el.innerHTML = `
      <div class="cats-title">الأقسام</div>
      <div class="cat-list ${searching ? 'dimmed' : ''}" role="tablist" aria-label="أقسام المنتجات">
        ${items.map((c) => `
          <button type="button" role="tab" class="cat-btn ${c.id === active ? 'active' : ''}" data-cat="${c.id}" aria-selected="${c.id === active}">
            <span>${esc(c.name)}</span><span class="count num">${c.count}</span>
          </button>`).join('')}
      </div>`;
    el.querySelector('.cat-btn.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  return () => { off(); unbind(); };
}
