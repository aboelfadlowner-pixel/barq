/* "مين شغال دلوقتي؟" — the person picks their name from the fixed list
   (CONFIRMED: list, not free typing, so the same person always has the same
   name). Asked every time the app opens; the top bar has "تغيير" to switch.
   A first-time employee can add their name here once. */
import * as ds from '../data/data-source.js';
import { catalog, reloadAgents } from '../catalog.js';
import { getState, setAgent } from '../store.js';
import { esc, on } from '../utils/dom.js';
import { icon } from './icons.js';
import { openModal, showToast } from './modal.js';

export function openAgentPicker({ required = false } = {}) {
  const current = getState().agent;
  const m = openModal({
    title: `${icon('headset')} مين شغال دلوقتي؟`,
    size: 'md',
    dismissible: !required,
    body: `
      <p class="muted agent-hint">اختار اسمك — الطلبات اللي هتعملها هتتسجل باسمك.</p>
      <div class="agent-grid" data-list></div>
      <form class="agent-add" data-add novalidate>
        <button type="button" class="link-btn" data-show-add>${icon('plus')}اسمي مش في القايمة</button>
        <div class="agent-add-row" data-add-row hidden>
          <input class="input" name="name" maxlength="40" autocomplete="off" placeholder="اكتب اسمك زي ما هيظهر على الطلبات" aria-label="اسم الموظف">
          <button type="submit" class="btn btn-primary">${icon('check')}إضافة</button>
        </div>
        <div class="field-error" data-err="add"></div>
      </form>`,
    footer: required ? '' : '<button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>',
  });
  if (required) m.el.querySelector('.modal-head [data-close]')?.remove();

  const list = m.body.querySelector('[data-list]');
  const render = () => {
    list.innerHTML = catalog.agents.length
      ? catalog.agents.map((a) => `
          <button type="button" class="agent-btn ${current?.id === a.id ? 'is-current' : ''}" data-agent="${esc(a.id)}">
            <span class="avatar">${esc(a.name.trim().charAt(0))}</span><span class="agent-name">${esc(a.name)}</span>
          </button>`).join('')
      : '<p class="muted">لسه مفيش أسماء — أضف اسمك تحت.</p>';
  };
  render();

  const choose = (agent) => {
    setAgent({ id: agent.id, name: agent.name });
    m.close();
    showToast(`أهلًا ${agent.name} — الطلبات هتتسجل باسمك`);
  };

  const addRow = m.body.querySelector('[data-add-row]');
  const input = addRow.querySelector('input');
  const err = m.body.querySelector('[data-err="add"]');
  const offs = [
    on(m.el, 'click', '[data-agent]', (e, btn) => {
      const agent = catalog.agents.find((a) => a.id === btn.dataset.agent);
      if (agent) choose(agent);
    }),
    on(m.el, 'click', '[data-show-add]', (e, btn) => { addRow.hidden = false; btn.hidden = true; input.focus(); }),
    on(m.el, 'submit', '[data-add]', async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) { err.textContent = 'اكتب اسمك'; input.focus(); return; }
      err.textContent = '';
      try {
        const created = await ds.saveAgent({ name, active: true });
        await reloadAgents();
        choose(created);
      } catch (ex) {
        err.textContent = ex.message;
      }
    }),
  ];
  m.onClose(() => offs.forEach((f) => f()));
  if (!catalog.agents.length) { addRow.hidden = false; m.body.querySelector('[data-show-add]').hidden = true; input.focus(); }
  else (list.querySelector('.is-current') ?? list.querySelector('[data-agent]'))?.focus();
  return m;
}
