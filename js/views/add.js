// Inserimento / modifica transazione con tastierino calcolatrice
import { live, upsert, remove, restore, byId, subscribe } from '../store.js';
import { editCategory } from './categories.js';
import { t } from '../i18n.js';
import { openSheet, openModal, closeLayer, sheetHead, toast, confirm, ICON } from '../ui.js';
import { esc, money, num, evalExpr, todayISO, fmtDate } from '../format.js';
import { scheduleSync } from '../sync.js';

const hasOp = s => /[+\-×÷]/.test(s.slice(1));

export function openAdd(opts = {}) {
  const tx = opts.tx || null;
  const accs = live.accounts().filter(a => !a.archived);
  if (!accs.length && !tx) { toast(t('account_required')); return; }
  const s = {
    type: tx?.type || opts.type || 'expense',
    expr: tx ? String(tx.amount) : '',
    categoryId: tx?.category_id || opts.categoryId || null,
    accountId: tx?.account_id || opts.accountId || accs[0]?.id || null,
    toAccountId: tx?.to_account_id || accs.find(a => a.id !== (opts.accountId || accs[0]?.id))?.id || null,
    date: tx?.date || opts.date || todayISO(),
    note: tx?.note || '',
    isRecurring: !!tx?.is_recurring,
    step: 'keypad',
  };
  const el = openSheet('', { full: true });
  const draw = () => { el.innerHTML = view(s, tx); bind(); };

  function bind() {
    el.querySelector('[data-back]')?.addEventListener('click', () => { s.step = 'keypad'; draw(); });
    el.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { s.type = b.dataset.type; if (s.type !== 'transfer') { const c = byId('categories').get(s.categoryId); if (c && c.type !== s.type) s.categoryId = null; } draw(); });
    el.querySelectorAll('[data-key]').forEach(b => b.onclick = () => key(b.dataset.key));
    el.querySelector('[data-next]')?.addEventListener('click', next);
    el.querySelector('[data-pickcat]')?.addEventListener('click', () => { s.step = 'category'; draw(); });
    el.querySelector('[data-newcat]')?.addEventListener('click', () => editCategory(null, s.type));
    el.querySelector('[data-account]')?.addEventListener('click', () => pickAccount('accountId'));
    el.querySelector('[data-toaccount]')?.addEventListener('click', () => pickAccount('toAccountId'));
    const dateInp = el.querySelector('[data-date-input]');
    el.querySelector('[data-date]')?.addEventListener('click', () => { if (dateInp.showPicker) { try { dateInp.showPicker(); return; } catch {} } dateInp.click(); });
    dateInp?.addEventListener('change', () => { if (dateInp.value) { s.date = dateInp.value; draw(); } });
    const note = el.querySelector('[data-note]'); note?.addEventListener('input', () => { s.note = note.value; });
    el.querySelector('[data-recurring]')?.addEventListener('change', e => { s.isRecurring = e.target.checked; });
    el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { s.categoryId = b.dataset.cat; save(); });
    el.querySelector('[data-delete]')?.addEventListener('click', async () => {
      if (!(await confirm(t('confirm_delete'), { okLabel: t('delete'), danger: true }))) return;
      await remove('transactions', tx.id); closeLayer(el); scheduleSync();
      toast(t('deleted'), { action: t('undo'), onAction: () => restore('transactions', tx.id) });
    });
  }

  function key(k) {
    let e = s.expr;
    if (k === 'back') e = e.slice(0, -1);
    else if (k === 'clear') e = '';
    else if (k === '=') { const v = evalExpr(e); e = isNaN(v) ? '' : String(v); }
    else if (/[+\-×÷]/.test(k)) { if (!e) { if (k === '-') e = '-'; } else if (/[+\-×÷]$/.test(e)) e = e.slice(0, -1) + k; else e += k; }
    else if (k === '.') { const last = e.split(/[+\-×÷]/).pop(); if (!last.includes('.')) e += (last === '' ? '0' : '') + '.'; }
    else { const last = e.split(/[+\-×÷]/).pop(); const dec = last.split('.')[1]; if (dec && dec.length >= 2) return; if (last === '0') e = e.slice(0, -1); e += k; }
    s.expr = e;
    const amtEl = el.querySelector('.amount'), exEl = el.querySelector('.expr'), nx = el.querySelector('[data-next]');
    if (amtEl) { amtEl.textContent = amountText(s.expr); exEl.textContent = hasOp(s.expr) ? s.expr : ''; nx.innerHTML = nextLabel(s, tx); }
  }

  function next() {
    if (hasOp(s.expr)) { key('='); return; }
    const v = evalExpr(s.expr);
    if (!v || v <= 0 || isNaN(v)) { toast(t('amount_required')); return; }
    if (s.type === 'transfer' || (tx && s.categoryId)) { save(); return; }
    s.step = 'category'; draw();
  }

  function pickAccount(field) {
    const m = openModal(`<div class="title">${t(field === 'accountId' ? (s.type === 'transfer' ? 'from_account' : 'account') : 'to_account')}</div>
      ${accs.map(a => `<div class="list-item" data-pick="${a.id}"><div class="ico">${esc(a.icon)}</div><div class="main"><div class="name">${esc(a.name)}</div></div>${a.id === s[field] ? ICON.check : ''}</div>`).join('')}`);
    m.querySelectorAll('[data-pick]').forEach(x => x.onclick = () => { s[field] = x.dataset.pick; closeLayer(m); draw(); });
  }

  async function save() {
    const v = evalExpr(s.expr);
    if (!v || v <= 0 || isNaN(v)) { toast(t('amount_required')); s.step = 'keypad'; draw(); return; }
    if (s.type !== 'transfer' && !s.categoryId) { toast(t('category_required')); return; }
    if (s.type === 'transfer' && (!s.toAccountId || s.toAccountId === s.accountId)) { toast(t('same_account')); return; }
    const row = {
      id: tx?.id, type: s.type, amount: v, date: s.date,
      category_id: s.type === 'transfer' ? null : s.categoryId,
      account_id: s.accountId, to_account_id: s.type === 'transfer' ? s.toAccountId : null,
      note: s.note.trim(), is_recurring: s.isRecurring, recurring_id: tx?.recurring_id || null,
    };
    const saved = await upsert('transactions', row);
    closeLayer(el); scheduleSync();
    if (!tx) toast(t('saved'), { action: t('undo'), onAction: () => remove('transactions', saved.id) });
  }

  draw();
  const unsub = subscribe(w => { if (!document.body.contains(el)) { unsub(); return; } if (w === 'data' && s.step === 'category') draw(); });
  return el;
}

function amountText(expr) { const v = evalExpr(expr); return isNaN(v) ? '…' : num(v || 0); }
function nextLabel(s, tx) {
  if (hasOp(s.expr)) return '=';
  if (s.type === 'transfer' || (tx && s.categoryId)) return t('save');
  return t('choose_category') + ' →';
}

function view(s, tx) {
  const accs = byId('accounts');
  const cat = s.categoryId ? byId('categories').get(s.categoryId) : null;
  const title = tx ? t('edit_transaction') : t(s.type === 'expense' ? 'new_expense' : s.type === 'income' ? 'new_income' : 'new_transfer');
  const del = tx ? `<button class="iconbtn" data-delete aria-label="${t('delete')}">${ICON.trash}</button>` : '';
  if (s.step === 'category') {
    const cats = live.categories(s.type).filter(c => !c.archived);
    return `<div class="add">
      <div class="sheet-head"><button class="iconbtn" data-back>${ICON.back}</button><div class="title">${t('choose_category')}</div><div class="${s.type}" style="font-weight:700">${money(evalExpr(s.expr) || 0)}</div></div>
      <div class="catgrid">${cats.map(c => `<button data-cat="${c.id}" class="${c.id === s.categoryId ? 'active' : ''}" style="--c:${esc(c.color)};--c-bg:${esc(c.color)}22"><div class="ico">${esc(c.icon)}</div><div class="nm">${esc(c.name)}</div></button>`).join('')}<button data-newcat style="opacity:.75"><div class="ico" style="background:var(--surface-2);border-style:dashed;border-color:var(--text-2)">＋</div><div class="nm">${t('new_category')}</div></button></div>
      ${cats.length ? '' : `<div class="empty">${t('no_data')}</div>`}
    </div>`;
  }
  const types = ['expense', 'income', 'transfer'].map(k => `<button data-type="${k}" class="${k} ${s.type === k ? 'active' : ''}">${t(k)}</button>`).join('');
  const acc = accs.get(s.accountId), toAcc = accs.get(s.toAccountId);
  const keys = [['7'], ['8'], ['9'], ['÷', 'op'], ['4'], ['5'], ['6'], ['×', 'op'], ['1'], ['2'], ['3'], ['-', 'op'], ['.'], ['0'], ['back', 'op'], ['+', 'op']];
  return `<div class="add">
    ${sheetHead(title, del)}
    <div class="typebar">${types}</div>
    <div class="expr">${hasOp(s.expr) ? esc(s.expr) : ''}</div>
    <div class="amount ${s.type}">${amountText(s.expr)}</div>
    <div class="selectors">
      <button class="chip set" data-account>${esc(acc?.icon || '')} ${esc(acc?.name || t('account'))}</button>
      ${s.type === 'transfer' ? `<span class="muted" style="align-self:center">→</span><button class="chip set" data-toaccount>${esc(toAcc?.icon || '')} ${esc(toAcc?.name || t('to_account'))}</button>` : ''}
      <button class="chip set" data-date>${ICON.calendar.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} ${esc(fmtDate(s.date, 'day'))}</button>
      <input type="date" data-date-input value="${s.date}" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px">
      ${s.type !== 'transfer' && cat ? `<button class="chip set" data-pickcat style="--c:${esc(cat.color)}">${esc(cat.icon)} ${esc(cat.name)} ▾</button>` : ''}
    </div>
    <div class="field"><input data-note placeholder="${t('note_placeholder')}" value="${esc(s.note)}" maxlength="120"></div>
    <label class="row small muted" style="margin-bottom:6px"><input type="checkbox" data-recurring ${s.isRecurring ? 'checked' : ''} style="width:auto"> ${t('recurring_label')}</label>
    <div class="keypad">
      ${keys.map(([k, cls]) => `<button data-key="${k}" class="${cls || ''}">${k === 'back' ? ICON.backspace : k}</button>`).join('')}
      <button data-next class="ok ${s.type}" style="grid-column: span 4">${nextLabel(s, tx)}</button>
    </div>
  </div>`;
}
