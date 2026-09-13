// Impostazioni: lingua, tema, sync, categorie, ricorrenze, backup
import { state, live, setSetting, upsert, remove, byId, emit, subscribe } from '../store.js';
import * as db from '../db.js';
import { t, setLang, LANGS } from '../i18n.js';
import { esc, money, fmtDate, todayISO } from '../format.js';
import { openSheet, openModal, closeLayer, sheetHead, toast, confirm, alert, ICON } from '../ui.js';
import { syncState, getClient, signIn, signUp, signOut, sync, scheduleSync, cloudHasData, resetLocalAndPull } from '../sync.js';
import { exportJSON, importJSON, exportCSV, download, pickFile, loadNotionSeed, importNotionSeed } from '../importer.js';
import { FREQUENCIES, upcoming, monthlyEquivalent, processDue } from '../recurring.js';
import { editCategory } from './categories.js';
import { CONFIG } from '../config.js';
import { applyTheme } from '../app.js';

export function render(el) {
  const user = syncState.user;
  const up = upcoming(45);
  const accs = byId('accounts');
  el.innerHTML = `
    <div class="card">
      <h3>${t('sync')}</h3>
      ${!syncState.configured ? `<div class="muted small mb">${t('sync_not_configured')}</div>
        <div class="field"><label>${t('supabase_url')}</label><input data-sb-url value="${esc(state.settings.supabase_url || CONFIG.supabaseUrl || '')}" placeholder="https://xxxx.supabase.co"></div>
        <div class="field"><label>${t('supabase_key')}</label><input data-sb-key value="${esc(state.settings.supabase_key || CONFIG.supabaseKey || '')}" placeholder="eyJ…"></div>
        <button class="btn primary" data-sb-save>${t('save')}</button>`
      : user ? `<div class="row between"><div><div class="small muted">${t('logged_as')}</div><div style="font-weight:600">${esc(user.email)}</div>
            <div class="small muted mt"><span class="sync-dot ${syncState.status === 'ok' ? 'ok' : syncState.status === 'error' ? 'err' : ''}"></span>${t('last_sync')}: ${state.settings.last_sync ? esc(new Date(state.settings.last_sync).toLocaleString()) : t('never')}${syncState.message ? ` · <span class="expense">${esc(syncState.message)}</span>` : ''}</div></div>
            <div><button class="btn sm primary" data-sync>${t('sync_now')}</button> <button class="btn sm" data-logout>${t('logout')}</button></div></div>`
      : `<div class="muted small mb">${t('not_logged')}</div>
        <div class="login-box"><div class="field"><label>${t('email')}</label><input type="email" data-email autocomplete="email"></div>
        <div class="field"><label>${t('password')}</label><input type="password" data-password autocomplete="current-password"></div>
        <div class="row"><button class="btn primary grow" data-login>${t('login')}</button><button class="btn grow" data-signup>${t('signup')}</button></div>
        <button class="btn ghost sm mt" data-sb-reset>⚙︎ Supabase</button></div>`}
    </div>
    <div class="card">
      <h3>${t('settings')}</h3>
      <div class="field"><label>${t('language')}</label><select data-lang>${LANGS.map(([k, n]) => `<option value="${k}" ${(state.settings.lang || 'it') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>${t('theme')}</label><select data-theme>${[['auto', 'theme_auto'], ['light', 'theme_light'], ['dark', 'theme_dark']].map(([k, n]) => `<option value="${k}" ${(state.settings.theme || 'auto') === k ? 'selected' : ''}>${t(n)}</option>`).join('')}</select></div>
    </div>
    <div class="card">
      <h3>${t('categories')}</h3>
      <div class="list-item" data-cats="expense"><div class="ico">🔴</div><div class="main"><div class="name">${t('expense_categories')}</div><div class="sub">${live.categories('expense').filter(c => !c.archived).length}</div></div>${ICON.right}</div>
      <div class="list-item" data-cats="income"><div class="ico">🟢</div><div class="main"><div class="name">${t('income_categories')}</div><div class="sub">${live.categories('income').filter(c => !c.archived).length}</div></div>${ICON.right}</div>
    </div>
    <div class="card">
      <h3>${t('recurrings')}</h3>
      ${up.length ? `<div class="small muted mb">${t('upcoming')}</div>${up.slice(0, 5).map(r => `<div class="row between small" style="padding:4px 0"><span>${esc(byId('categories').get(r.category_id)?.icon || '↻')} ${esc(r.note || '')}</span><span><span class="muted">${esc(fmtDate(r.next_date, 'short'))}</span> · <b class="${r.type}">${esc(money(r.amount))}</b></span></div>`).join('')}` : ''}
      <div class="list-item mt" data-recurring><div class="ico">↻</div><div class="main"><div class="name">${t('manage_recurring')}</div><div class="sub">${live.recurring().filter(r => r.active).length} ${t('active').toLowerCase()} · ≈ ${esc(money(live.recurring().filter(r => r.active && r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0)))} ${t('per_month')}</div></div>${ICON.right}</div>
    </div>
    <div class="card">
      <h3>${t('backup')}</h3>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <button class="btn" data-export-json>⬇️ ${t('export_json')}</button>
        <button class="btn" data-import-json>⬆️ ${t('import_json')}</button>
        <button class="btn" data-export-csv>📊 ${t('export_csv')}</button>
        <button class="btn" data-import-notion>🗒️ ${t('import_notion')}</button>
      </div>
    </div>
    <div class="card">
      <h3>${t('danger_zone')}</h3>
      <button class="btn danger sm" data-wipe>${t('wipe_local')}</button>
    </div>
    <div class="center small muted mb">${t('app')} · ${t('version')} ${CONFIG.version}</div>`;

  el.querySelector('[data-sb-save]')?.addEventListener('click', async () => {
    await setSetting('supabase_url', el.querySelector('[data-sb-url]').value.trim());
    await setSetting('supabase_key', el.querySelector('[data-sb-key]').value.trim());
    getClient(); render(el);
  });
  el.querySelector('[data-sb-reset]')?.addEventListener('click', async () => { await setSetting('supabase_url', ''); await setSetting('supabase_key', ''); getClient(); render(el); });
  el.querySelector('[data-login]')?.addEventListener('click', () => auth(el, 'in'));
  el.querySelector('[data-signup]')?.addEventListener('click', () => auth(el, 'up'));
  el.querySelector('[data-logout]')?.addEventListener('click', async () => { await signOut(); render(el); });
  el.querySelector('[data-sync]')?.addEventListener('click', async () => { const b = el.querySelector('[data-sync]'); b.disabled = true; await sync(); render(el); });
  el.querySelector('[data-lang]').onchange = async e => { await setSetting('lang', e.target.value); setLang(e.target.value); location.reload(); };
  el.querySelector('[data-theme]').onchange = async e => { await setSetting('theme', e.target.value); applyTheme(); };
  el.querySelectorAll('[data-cats]').forEach(x => x.onclick = () => categoriesSheet(x.dataset.cats));
  el.querySelector('[data-recurring]').onclick = () => recurringSheet();
  el.querySelector('[data-export-json]').onclick = () => download(`moneytrack-backup-${todayISO()}.json`, JSON.stringify(exportJSON(), null, 1));
  el.querySelector('[data-export-csv]').onclick = () => download(`moneytrack-${todayISO()}.csv`, exportCSV(), 'text/csv;charset=utf-8');
  el.querySelector('[data-import-json]').onclick = async () => {
    const txt = await pickFile('.json'); if (!txt) return;
    try { const obj = JSON.parse(txt); if (!(await confirm(t('import_replace_confirm'), { danger: true }))) return; await importJSON(obj, { replace: true }); emit('data'); scheduleSync(); toast(t('import_done')); }
    catch (e) { toast(t('error') + ': ' + e.message); }
  };
  el.querySelector('[data-import-notion]').onclick = async () => {
    try {
      const seed = await loadNotionSeed();
      const n = seed.expenses.length + seed.incomes.length + (seed.transfers || []).length;
      if (!(await confirm(t('import_confirm', { n, r: (seed.subscriptions || []).length })))) return;
      const r = await importNotionSeed(seed); emit('data'); scheduleSync(); toast(t('import_result', { n: r.transactions, s: r.skipped }), { duration: 5000 });
    } catch (e) { toast(t('error') + ': ' + e.message); }
  };
  el.querySelector('[data-wipe]').onclick = async () => {
    if (!(await confirm(t('wipe_confirm'), { danger: true, okLabel: t('delete') }))) return;
    await db.clearAll(); location.reload();
  };
}

async function auth(el, mode) {
  const email = el.querySelector('[data-email]').value.trim(), pw = el.querySelector('[data-password]').value;
  if (!email || !pw) return;
  try {
    if (mode === 'in') await signIn(email, pw); else { const r = await signUp(email, pw); if (!r.session) { await alert(t('signup_confirm_email')); render(el); return; } }
    render(el);
    // dati locali mai sincronizzati + cloud già popolato → chiedi cosa fare (evita doppioni)
    const localRows = live.transactions().length + live.accounts().length + live.categories().length;
    if (localRows > 0 && !state.settings.last_sync && (await cloudHasData())) {
      const choice = await new Promise(resolve => {
        const m = openModal(`<div class="title">${t('login_conflict_title')}</div><p class="muted small">${t('login_conflict_text')}</p>
          <div class="actions" style="flex-wrap:wrap"><button class="btn" data-merge>${t('login_merge')}</button><button class="btn primary" data-cloud>${t('login_use_cloud')}</button></div>`, { dismissable: false });
        m.querySelector('[data-merge]').onclick = () => { closeLayer(m); resolve('merge'); };
        m.querySelector('[data-cloud]').onclick = () => { closeLayer(m); resolve('cloud'); };
      });
      if (choice === 'cloud') { await resetLocalAndPull(); render(el); return; }
    }
    scheduleSync(300);
  } catch (e) { toast(t('error') + ': ' + (e.message || e)); }
}

function categoriesSheet(type) {
  const el = openSheet('', { full: true });
  const draw = () => {
    const cats = live.categories(type);
    el.innerHTML = `${sheetHead(t(type === 'expense' ? 'expense_categories' : 'income_categories'), `<button class="iconbtn" data-new>${ICON.plus}</button>`)}
      ${cats.map(c => `<div class="list-item" data-cat="${c.id}"><div class="ico" style="background:${esc(c.color)}22">${esc(c.icon)}</div>
        <div class="main"><div class="name">${esc(c.name)}${c.archived ? ` <span class="tag">${t('archived')}</span>` : ''}</div>
        ${type === 'expense' && c.budget ? `<div class="sub">${t('budget')}: ${esc(money(c.budget))} ${t(c.budget_period === 'year' ? 'per_year' : 'per_month')}</div>` : ''}</div>${ICON.right}</div>`).join('')}`;
    el.querySelector('[data-new]').onclick = () => editCategory(null, type);
    el.querySelectorAll('[data-cat]').forEach(x => x.onclick = () => editCategory(state.categories.find(c => c.id === x.dataset.cat)));
  };
  draw();
  // ridisegna quando cambiano i dati (finché il foglio è aperto)
  const unsub = subscribe(w => { if (!document.body.contains(el)) { unsub(); return; } if (w === 'data') draw(); });
}

function recurringSheet() {
  const el = openSheet('', { full: true });
  const draw = () => {
    const rules = live.recurring().sort((a, b) => (b.active - a.active) || (a.next_date || '').localeCompare(b.next_date || ''));
    const cats = byId('categories'), accs = byId('accounts');
    el.innerHTML = `${sheetHead(t('recurrings'), `<button class="iconbtn" data-new>${ICON.plus}</button>`)}
      ${rules.map(r => `<div class="list-item" data-r="${r.id}" style="${r.active ? '' : 'opacity:.5'}"><div class="ico">${esc(cats.get(r.category_id)?.icon || '↻')}</div>
        <div class="main"><div class="name">${esc(r.note || cats.get(r.category_id)?.name || '')}</div><div class="sub">${t(r.frequency)} · ${t('next_date').toLowerCase()}: ${esc(fmtDate(r.next_date, 'short'))} · ${esc(accs.get(r.account_id)?.name || '')}</div></div>
        <div class="val ${r.type}">${esc(money(r.amount))}</div></div>`).join('') || `<div class="empty">${t('no_data')}</div>`}`;
    el.querySelector('[data-new]').onclick = () => editRecurring(null, draw);
    el.querySelectorAll('[data-r]').forEach(x => x.onclick = () => editRecurring(state.recurring.find(r => r.id === x.dataset.r), draw));
  };
  draw();
}

function editRecurring(rule, onDone) {
  const accs = live.accounts().filter(a => !a.archived);
  const r = rule ? { ...rule } : { type: 'expense', amount: '', category_id: null, account_id: accs[0]?.id || null, to_account_id: null, note: '', frequency: 'monthly', next_date: todayISO(), active: true };
  const el = openSheet('');
  const draw = () => {
    const cats = live.categories(r.type === 'income' ? 'income' : 'expense').filter(c => !c.archived);
    el.innerHTML = `${sheetHead(rule ? t('edit') : t('new_recurring'), rule ? `<button class="iconbtn" data-del>${ICON.trash}</button>` : '')}
      <div class="typebar add" style="display:flex;gap:6px;background:var(--surface-2);border-radius:12px;padding:4px;margin-bottom:10px">${['expense', 'income'].map(k => `<button data-type="${k}" class="${k} ${r.type === k ? 'active' : ''}" style="flex:1;padding:8px;border-radius:9px;font-weight:600;${r.type === k ? `background:var(--${k});color:#fff` : 'color:var(--text-2)'}">${t(k)}</button>`).join('')}</div>
      <div class="field"><label>${t('note')}</label><input data-f="note" value="${esc(r.note)}" maxlength="60"></div>
      <div class="field inline"><div class="grow"><label>${t('amount')}</label><input data-f="amount" type="number" step="0.01" min="0" inputmode="decimal" value="${r.amount}"></div>
        <div class="grow"><label>${t('frequency')}</label><select data-f="frequency">${FREQUENCIES.map(f => `<option value="${f}" ${r.frequency === f ? 'selected' : ''}>${t(f)}</option>`).join('')}</select></div></div>
      <div class="field"><label>${t('category')}</label><select data-f="category_id">${cats.map(c => `<option value="${c.id}" ${r.category_id === c.id ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field inline"><div class="grow"><label>${t('account')}</label><select data-f="account_id">${accs.map(a => `<option value="${a.id}" ${r.account_id === a.id ? 'selected' : ''}>${esc(a.icon)} ${esc(a.name)}</option>`).join('')}</select></div>
        <div class="grow"><label>${t('next_date')}</label><input type="date" data-f="next_date" value="${r.next_date || ''}"></div></div>
      <label class="switch"><span>${t('active')}</span><input type="checkbox" data-f="active" ${r.active ? 'checked' : ''}></label>
      <button class="btn primary block mt" data-save>${t('save')}</button>`;
    el.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { r.type = b.dataset.type; r.category_id = null; draw(); });
    el.querySelector('[data-save]').onclick = async () => {
      const g = k => el.querySelector(`[data-f=${k}]`);
      r.note = g('note').value.trim(); r.amount = Number(g('amount').value) || 0; r.frequency = g('frequency').value;
      r.category_id = g('category_id').value || null; r.account_id = g('account_id').value || null; r.next_date = g('next_date').value; r.active = g('active').checked;
      if (!r.amount || !r.next_date) { toast(t('amount_required')); return; }
      await upsert('recurring', r); const n = await processDue(); if (n) { emit('data'); toast(t('generated_recurring', { n })); }
      closeLayer(el); scheduleSync(); onDone && onDone(); toast(t('saved'));
    };
    el.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirm(t('confirm_delete'), { okLabel: t('delete'), danger: true }))) return;
      await remove('recurring', rule.id); closeLayer(el); scheduleSync(); onDone && onDone();
    });
  };
  draw();
}
