/* Generic dialog built on the native <dialog> element (focus trap + Esc). */
import { icon } from './icons.js';
import { esc } from '../utils/dom.js';

/* title is trusted HTML (built by our code); escape user text before passing it. */
export function openModal({ title, size = 'md', body = '', footer = '', dismissible = true } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = `modal modal-${size}`;
  dlg.innerHTML = `
    <header class="modal-head">
      <h2>${title}</h2>
      <button type="button" class="btn btn-ghost btn-icon" data-close aria-label="إغلاق">${icon('x')}</button>
    </header>
    <div class="modal-body">${body}</div>
    <footer class="modal-foot">${footer}</footer>`;
  document.body.appendChild(dlg);

  const closeHandlers = [];
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dlg.close();
    dlg.remove();
    closeHandlers.forEach((fn) => fn());
  };

  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    if (dismissible) close();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg && dismissible) close();          // backdrop
    else if (e.target.closest('[data-close]')) close();
  });

  dlg.showModal();
  return {
    el: dlg,
    body: dlg.querySelector('.modal-body'),
    foot: dlg.querySelector('.modal-foot'),
    close,
    onClose: (fn) => closeHandlers.push(fn),
  };
}

export function confirmDialog({ title, message, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const m = openModal({
      title: esc(title),
      size: 'sm',
      body: `<p class="confirm-msg">${esc(message)}</p>`,
      footer: `
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmLabel)}</button>
        <button type="button" class="btn btn-secondary" data-close>${esc(cancelLabel)}</button>`,
    });
    m.foot.querySelector('[data-ok]').addEventListener('click', () => { result = true; m.close(); });
    m.onClose(() => resolve(result));
    m.foot.querySelector('[data-ok]').focus();
  });
}

let toastTimer;
export function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
