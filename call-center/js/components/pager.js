/* Long tables without endless scrolling.
     <table data-paged="20">  → 20 rows a page, «‹ السابق 1 2 3 … التالي ›» under it.
     <table data-more="10">   → the first 10 rows, then «عرض الكل (25)» / «عرض أقل».
   Call paginate(container) after the table is in the page. Only the rows shown
   change; clicks on rows (open the order, photo, …) keep working. Tables that
   fit in one page are left as they are. */
import { icon } from './icons.js';

const pageList = (page, pages) => {           // 0-based; «1 … 4 5 6 … 12»
  const out = [];
  for (let i = 0; i < pages; i += 1) {
    if (i === 0 || i === pages - 1 || Math.abs(i - page) <= 1) out.push(i);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
};

/* The buttons of one page list (also used by the lists that load a page at a time from the server). */
export function pagerNav(page, pages, count, size) {
  return `
      <button type="button" class="btn btn-secondary btn-sm" data-pg="${page - 1}" ${page === 0 ? 'disabled' : ''}>${icon('arrowRight')}السابق</button>
      <span class="pg-nums">${pageList(page, pages).map((p) => (p === '…' ? '<span class="pg-gap">…</span>'
        : `<button type="button" class="pg-num ${p === page ? 'is-on' : ''}" data-pg="${p}" ${p === page ? 'aria-current="page"' : ''}>${p + 1}</button>`)).join('')}</span>
      <button type="button" class="btn btn-secondary btn-sm" data-pg="${page + 1}" ${page >= pages - 1 ? 'disabled' : ''}>التالي${icon('chevronLeft')}</button>
      <span class="muted num pg-info">${page * size + 1}–${Math.min((page + 1) * size, count)} من ${count}</span>`;
}

function paged(table, size) {
  const rows = [...(table.tBodies[0]?.rows || [])];
  if (rows.length <= size) return;
  const pages = Math.ceil(rows.length / size);
  let page = 0;
  const wrap = table.closest('.table-wrap') || table;
  const nav = document.createElement('nav');
  nav.className = 'pager pager-nums';
  nav.setAttribute('aria-label', 'صفحات الجدول');
  wrap.after(nav);
  const show = () => {
    rows.forEach((r, i) => { r.hidden = Math.floor(i / size) !== page; });
    nav.innerHTML = pagerNav(page, pages, rows.length, size);
  };
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pg]');
    if (!b || b.disabled) return;
    page = Math.min(pages - 1, Math.max(0, Number(b.dataset.pg)));
    show();
    if (wrap.getBoundingClientRect().top < 0) wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  show();
}

function more(table, size) {
  const rows = [...(table.tBodies[0]?.rows || [])];
  if (rows.length <= size) return;
  let open = false;
  const wrap = table.closest('.table-wrap') || table;
  const bar = document.createElement('div');
  bar.className = 'more-row';
  wrap.after(bar);
  const show = () => {
    rows.forEach((r, i) => { r.hidden = !open && i >= size; });
    bar.innerHTML = `<button type="button" class="btn btn-secondary btn-sm">${open ? 'عرض أقل' : `عرض الكل (${rows.length})`}</button>`;
  };
  bar.addEventListener('click', (e) => { if (e.target.closest('button')) { open = !open; show(); } });
  show();
}

export function paginate(root) {
  root.querySelectorAll('table[data-paged], table[data-more]').forEach((t) => {
    if (t.dataset.pgDone) return;
    t.dataset.pgDone = '1';
    if (t.dataset.paged) paged(t, Number(t.dataset.paged) || 20);
    else more(t, Number(t.dataset.more) || 10);
  });
}

/* Board / prep columns: each column scrolls inside itself. The screens redraw every
   few seconds — keep each column where the employee left it. */
export function keepColumnScroll(container, selector, redraw) {
  const tops = [...container.querySelectorAll(selector)].map((el) => el.scrollTop);
  redraw();
  container.querySelectorAll(selector).forEach((el, i) => { if (tops[i]) el.scrollTop = tops[i]; });
}
