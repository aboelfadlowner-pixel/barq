/* "اسمك" — single choice at the top of the call-center screen (CONFIRMED:
   no pop-up; the person working picks their own name here when they start).
   The orders they send and cancel are saved with this name. The choice is
   kept until this browser tab is closed. */
import { catalog } from '../catalog.js';
import { getState, setAgent } from '../store.js';
import { esc } from '../utils/dom.js';
import { normalizeArabic } from '../utils/format.js';
import { icon } from './icons.js';
import { showToast } from './modal.js';

const KEY = 'cc-agent';

/* Restore the name picked earlier in this tab (only if still on the list). */
export function restoreAgent() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    const live = saved && catalog.agents.find((a) => a.id === saved.id);
    if (live) setAgent({ id: live.id, name: live.name });
  } catch { /* storage blocked: the person just picks again */ }
}

export function chooseAgent(agent) {
  setAgent(agent ? { id: agent.id, name: agent.name } : null);
  try {
    if (agent) sessionStorage.setItem(KEY, JSON.stringify({ id: agent.id }));
    else sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function agentSelectHtml() {
  return `
    <div class="combo agent-select" data-agent-select>
      <button type="button" class="select combo-btn" aria-haspopup="listbox" aria-expanded="false" data-as-btn>
        ${icon('headset')}<span data-as-label></span></button>
      <div class="combo-pop" hidden data-as-pop>
        <input type="search" class="input combo-search" placeholder="ابدأ الكتابة للبحث" aria-label="بحث عن اسمك" autocomplete="off">
        <ul class="combo-list" role="listbox" data-as-list></ul>
      </div>
    </div>`;
}

export function initAgentSelect(root) {
  const box = root.querySelector('[data-agent-select]');
  const btn = box.querySelector('[data-as-btn]');
  const pop = box.querySelector('[data-as-pop]');
  const search = pop.querySelector('.combo-search');
  const list = pop.querySelector('[data-as-list]');

  const label = () => {
    const cur = getState().agent;
    box.querySelector('[data-as-label]').textContent = cur ? cur.name : 'اختر اسمك';
    btn.classList.toggle('has-value', !!cur);
    btn.classList.toggle('needs-value', !cur);
  };
  const renderList = () => {
    const q = normalizeArabic(search.value.trim());
    const cur = getState().agent;
    const shown = catalog.agents.filter((a) => !q || normalizeArabic(a.name).includes(q));
    list.innerHTML = shown.map((a) => `
      <li role="option" data-agent="${esc(a.id)}" aria-selected="${cur?.id === a.id}">${esc(a.name)}</li>`).join('')
      || `<li class="combo-empty">${catalog.agents.length ? 'لا يوجد اسم مطابق' : 'لا توجد أسماء بعد — أضفها من «المناطق والموظفين»'}</li>`;
  };
  const open = () => { pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); search.value = ''; renderList(); search.focus(); };
  const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };

  btn.addEventListener('click', () => (pop.hidden ? open() : close()));
  search.addEventListener('input', renderList);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); }
    if (e.key === 'Enter') { e.preventDefault(); list.querySelector('[data-agent]')?.click(); }
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('[data-agent]');
    if (!li) return;
    const agent = catalog.agents.find((a) => a.id === li.dataset.agent);
    chooseAgent(agent);
    close();
    label();
    showToast(`أهلًا ${agent.name} — سيتم تسجيل الطلبات باسمك`);
  });
  const outside = (e) => { if (!pop.hidden && !box.contains(e.target)) close(); };
  document.addEventListener('pointerdown', outside);
  label();
  return { open, refresh: label, destroy: () => document.removeEventListener('pointerdown', outside) };
}

/* Used before sending or cancelling: true when a name is picked, otherwise explains. */
export function requireAgent() {
  if (getState().agent) return true;
  showToast('اختر اسمك أولًا من قائمة «اختر اسمك» في شاشة مركز الاتصال');
  return false;
}
