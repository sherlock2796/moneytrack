// Bootstrap + shell + router
import { state, load, subscribe, emit, live, setSetting } from './store.js';
import { t, setLang } from './i18n.js';
import { ICON, toast, openModal, closeLayer } from './ui.js';
import { esc } from './format.js';
import { initAuth, scheduleSync, syncState, sync } from './sync.js';
import { processDue } from './recurring.js';
import { loadNotionSeed, importNotionSeed } from './importer.js';
import { CONFIG } from './config.js';
import * as home from './views/home.js';
import * as accounts from './views/accounts.js';
import * as budget from './views/budget.js';
import * as stats from './views/stats.js';
import * as list from './views/list.js';
import * as settings from './views/settings.js';
import { openAdd } from './views/add.js';

const VIEWS = { home, accounts, budget, stats, list, settings };
const NAV = [['home', 'home', ICON.home], ['accounts', 'accounts', ICON.wallet], ['budget', 'budget', ICON.target], ['stats', 'stats', ICON.bars], ['list', 'list', ICON.list], ['settings', 'more', ICON.more]];
let current = 'home';

export function applyTheme() {
  const th = state.settings.theme || 'auto';
  if (th === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', th);
}

function shell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="header row between">
      <div class="title">${t('app')}</div>
      <div class="row">
        <span id="syncdot" class="sync-dot" title=""></span>
        <button class="iconbtn" id="btn-sync" title="${t('sync_now')}">${ICON.sync}</button>
      </div>
    </header>
    <main id="content" class="content"></main>
    <div class="fabs" id="fabs">
      <button class="fab minus" id="fab-expense" aria-label="${t('new_expense')}">−</button>
      <button class="fab plus" id="fab-income" aria-label="${t('new_income')}">+</button>
    </div>
    <nav class="nav" id="nav">${NAV.map(([id, key, ico]) => `<button data-nav="${id}">${ico}<span>${t(key)}</span></button>`).join('')}</nav>`;
  app.querySelector('#nav').addEventListener('click', e => { const b = e.target.closest('[data-nav]'); if (b) navigate(b.dataset.nav); });
  app.querySelector('#fab-expense').onclick = () => openAdd({ type: 'expense' });
  app.querySelector('#fab-income').onclick = () => openAdd({ type: 'income' });
  app.querySelector('#btn-sync').onclick = async () => {
    if (!syncState.configured || !syncState.user) { navigate('settings'); return; }
    const ok = await sync(); toast(ok ? t('saved') : (syncState.message || t('error')));
  };
}

export function navigate(view) {
  current = VIEWS[view] ? view : 'home';
  render();
}

let raf = null;
export function render() {
  if (raf) return; raf = requestAnimationFrame(() => { raf = null; doRender(); });
}
function doRender() {
  const app = document.getElementById('app');
  if (!app.querySelector('#content')) shell();
  document.querySelectorAll('#nav [data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === current));
  const content = document.getElementById('content');
  content.classList.toggle('no-fab', current !== 'home' && current !== 'list');
  document.getElementById('fabs').style.display = (current === 'home' || current === 'list') ? '' : 'none';
  VIEWS[current].render(content);
  renderSyncDot();
}
function renderSyncDot() {
  const d = document.getElementById('syncdot'); if (!d) return;
  d.className = 'sync-dot ' + (syncState.status === 'ok' ? 'ok' : syncState.status === 'error' ? 'err' : syncState.status === 'busy' ? 'busy' : '');
  d.title = syncState.user ? (syncState.status === 'error' ? syncState.message : syncState.status) : t('not_logged');
}

async function onboarding() {
  return new Promise(resolve => {
    const el = openModal(`<div class="title">${t('welcome_title')}</div><p class="muted">${t('welcome_text')}</p>
      <div class="actions" style="flex-wrap:wrap"><button class="btn" data-login>${t('start_login')}</button><button class="btn" data-empty>${t('start_empty')}</button><button class="btn primary" data-notion>${t('start_notion')}</button></div>`, { dismissable: false });
    el.querySelector('[data-empty]').onclick = () => { closeLayer(el); resolve(false); };
    el.querySelector('[data-login]').onclick = () => { closeLayer(el); navigate('settings'); resolve(false); };
    el.querySelector('[data-notion]').onclick = async () => {
      const b = el.querySelector('[data-notion]'); b.disabled = true; b.textContent = '…';
      try { const seed = await loadNotionSeed(); const r = await importNotionSeed(seed); closeLayer(el); toast(t('import_result', { n: r.transactions, s: r.skipped }), { duration: 5000 }); resolve(true); }
      catch (e) { console.error(e); b.disabled = false; b.textContent = t('start_notion'); toast(t('error') + ': ' + e.message); }
    };
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) toast(t('update_available'), { action: t('reload'), onAction: () => location.reload(), duration: 10000 });
      });
    });
  }).catch(e => console.warn('SW', e));
}

async function main() {
  await load();
  setLang(state.settings.lang || ((navigator.language || 'it').startsWith('en') ? 'en' : 'it'));
  applyTheme();
  shell(); doRender();
  registerSW();
  subscribe(what => {
    if (what === 'data' || what === 'settings') render();
    else if (what === 'auth' || what === 'sync') { renderSyncDot(); if (current === 'settings') render(); }
  });
  try { await initAuth(); } catch (e) { console.warn(e); }
  emit('auth');
  // se già connesso, prima scarica i dati dal cloud: così un dispositivo nuovo non propone
  // l'import e le ricorrenze non vengono generate due volte
  if (syncState.user) { try { await sync(); } catch (e) { console.warn(e); } }
  if (!state.settings.onboarded && live.transactions().length === 0 && live.accounts().length === 0) {
    await onboarding();
    await setSetting('onboarded', true);
  }
  const n = await processDue();
  if (n) { emit('data'); toast(t('generated_recurring', { n })); }
  scheduleSync(800);
  // scorciatoie dal manifest: ?add=expense | ?add=income
  const add = new URLSearchParams(location.search).get('add');
  if (add === 'expense' || add === 'income') { history.replaceState(null, '', location.pathname); openAdd({ type: add }); }
}

window.MT = { state, live, CONFIG };
main().catch(e => { console.error(e); document.getElementById('app').innerHTML = `<div class="boot">Errore: ${esc(e.message)}</div>`; });
