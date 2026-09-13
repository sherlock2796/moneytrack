// Piccoli helper UI: sheet, modal, toast, conferme
import { t } from './i18n.js';
import { esc } from './format.js';

const overlay = () => document.getElementById('overlay');
const stack = [];

function renderOverlay() {
  const ov = overlay();
  ov.innerHTML = '';
  if (!stack.length) { ov.classList.remove('open'); document.body.style.overflow = ''; return; }
  ov.classList.add('open'); document.body.style.overflow = 'hidden';
  for (const layer of stack) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.addEventListener('click', () => { if (layer.dismissable !== false) closeTop(); });
    ov.appendChild(bd);
    ov.appendChild(layer.el);
  }
}

export function openSheet(html, { full = false, dismissable = true, onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'sheet' + (full ? ' full' : '');
  el.innerHTML = html;
  const layer = { el, dismissable, onClose };
  stack.push(layer); renderOverlay();
  return el;
}
export function openModal(html, { dismissable = true, onClose } = {}) {
  const el = document.createElement('div'); el.className = 'modal'; el.innerHTML = html;
  const layer = { el, dismissable, onClose };
  stack.push(layer); renderOverlay();
  return el;
}
export function closeTop() {
  const layer = stack.pop();
  if (layer && layer.onClose) layer.onClose();
  renderOverlay();
}
export function closeAll() { while (stack.length) closeTop(); }
export function closeLayer(el) { const i = stack.findIndex(l => l.el === el); if (i >= 0) { const [l] = stack.splice(i, 1); if (l.onClose) l.onClose(); renderOverlay(); } }

export function sheetHead(title, extra = '') {
  return `<div class="sheet-head"><button class="iconbtn" data-close aria-label="${t('close')}">${ICON.close}</button><div class="title">${esc(title)}</div>${extra}</div>`;
}

export function confirm(msg, { okLabel, danger = false } = {}) {
  return new Promise(resolve => {
    const el = openModal(`<div class="title">${esc(msg)}</div>
      <div class="actions"><button class="btn" data-no>${t('cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel || t('ok'))}</button></div>`,
      { onClose: () => resolve(false) });
    el.querySelector('[data-no]').onclick = () => closeLayer(el);
    el.querySelector('[data-yes]').onclick = () => { const i = stack.findIndex(l => l.el === el); if (i >= 0) { stack.splice(i, 1); renderOverlay(); } resolve(true); };
  });
}

export function alert(msg) {
  return new Promise(resolve => {
    const el = openModal(`<div class="title">${esc(msg)}</div><div class="actions"><button class="btn primary" data-ok>${t('ok')}</button></div>`, { onClose: () => resolve() });
    el.querySelector('[data-ok]').onclick = () => closeLayer(el);
  });
}

let toastTimer = null;
export function toast(msg, { action, onAction, duration = 3000 } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = esc(msg) + (action ? `<button>${esc(action)}</button>` : '');
  if (action) el.querySelector('button').onclick = () => { el.classList.remove('show'); onAction && onAction(); };
  el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// delega click: data-close chiude il layer che lo contiene
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]');
  if (c) { const layer = c.closest('.sheet, .modal'); if (layer) closeLayer(layer); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) closeTop(); });

export const ICON = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/><circle cx="16" cy="14" r="1.5"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  bars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  backspace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="M18 9l-6 6M12 9l6 6"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>',
};

export const PALETTE = ['#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5', '#039be5', '#00acc1', '#00897b', '#43a047', '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00', '#f4511e', '#6d4c41', '#757575', '#546e7a', '#26a69a'];
