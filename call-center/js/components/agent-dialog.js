/* "مين شغال دلوقتي؟" — after the shared sign-in, the person working picks
   their name from the fixed list (CONFIRMED: list only; names are added from
   the "المناطق والموظفين" screen, not from here). Asked every time the app
   opens; the top bar has "تغيير" to switch. */
import { catalog } from '../catalog.js';
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
      <div class="agent-grid" data-list></div>`,
    footer: required ? '' : '<button type="button" class="btn btn-secondary btn-lg" data-close>إغلاق</button>',
  });
  if (required) m.el.querySelector('.modal-head [data-close]')?.remove();

  const list = m.body.querySelector('[data-list]');
  list.innerHTML = catalog.agents.length
    ? catalog.agents.map((a) => `
        <button type="button" class="agent-btn ${current?.id === a.id ? 'is-current' : ''}" data-agent="${esc(a.id)}">
          <span class="avatar">${esc(a.name.trim().charAt(0))}</span><span class="agent-name">${esc(a.name)}</span>
        </button>`).join('')
    : `<div class="agent-empty">
        <p>لسه مفيش أسماء موظفين.</p>
        <a href="#/areas" class="btn btn-primary" data-go-settings>${icon('plus')}أضف الأسماء من «المناطق والموظفين»</a>
      </div>`;

  const offs = [
    on(m.el, 'click', '[data-agent]', (e, btn) => {
      const agent = catalog.agents.find((a) => a.id === btn.dataset.agent);
      if (!agent) return;
      setAgent({ id: agent.id, name: agent.name });
      m.close();
      showToast(`أهلًا ${agent.name} — الطلبات هتتسجل باسمك`);
    }),
    // No names yet: let the screen that adds them open (the picker shows again when needed).
    on(m.el, 'click', '[data-go-settings]', () => m.close()),
  ];
  m.onClose(() => offs.forEach((f) => f()));
  (list.querySelector('.is-current') ?? list.querySelector('[data-agent]') ?? list.querySelector('[data-go-settings]'))?.focus();
  return m;
}
