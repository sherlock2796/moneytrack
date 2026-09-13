// Conti: saldi, gestione, trasferimenti
import { live, upsert, remove, accountBalance, totalBalance, state } from '../store.js';
import { t } from '../i18n.js';
import { esc, money } from '../format.js';
import { openSheet, closeLayer, sheetHead, toast, confirm, PALETTE, ICON } from '../ui.js';
import { scheduleSync } from '../sync.js';
import { openAdd } from './add.js';

let showArchived = false;

export function render(el) {
  const accs = live.accounts().filter(a => showArchived || !a.archived);
  el.innerHTML = `
    <div class="card">
      <div class="row between"><div><div class="small muted">${t('available')}</div><div style="font-size:26px;font-weight:700">${esc(money(totalBalance(true)))}</div></div>
      <div class="right"><div class="small muted">${t('total')}</div><div style="font-weight:600">${esc(money(totalBalance(false)))}</div></div></div>
    </div>
    <div class="card">
      ${accs.map(a => `<div class="list-item" data-acc="${a.id}"><div class="ico" style="background:${esc(a.color)}22">${esc(a.icon)}</div>
        <div class="main"><div class="name">${esc(a.name)}${a.archived ? ` <span class="tag">${t('archived')}</span>` : ''}${a.include_in_total === false ? ` <span class="tag">${t('total')} ✕</span>` : ''}</div></div>
        <div class="val">${esc(money(accountBalance(a.id)))}</div></div>`).join('')}
      ${accs.length ? '' : `<div class="empty">${t('no_data')}</div>`}
    </div>
    <div class="row" style="gap:8px">
      <button class="btn primary grow" data-new>${ICON.plus.replace('<svg', '<svg style="width:18px;height:18px"')} ${t('new_account')}</button>
      <button class="btn grow" data-transfer>↔️ ${t('transfer')}</button>
    </div>
    <label class="row small muted mt"><input type="checkbox" data-archived ${showArchived ? 'checked' : ''} style="width:auto"> ${t('show_archived')}</label>`;
  el.querySelectorAll('[data-acc]').forEach(x => x.onclick = () => editAccount(state.accounts.find(a => a.id === x.dataset.acc)));
  el.querySelector('[data-new]').onclick = () => editAccount(null);
  el.querySelector('[data-transfer]').onclick = () => openAdd({ type: 'transfer' });
  el.querySelector('[data-archived]').onchange = e => { showArchived = e.target.checked; render(el); };
}

export function editAccount(acc) {
  const a = acc ? { ...acc } : { name: '', icon: '💳', color: PALETTE[5], initial_balance: 0, include_in_total: true, archived: false, sort: live.accounts().length };
  const el = openSheet(`${sheetHead(acc ? t('edit') : t('new_account'), acc ? `<button class="iconbtn" data-del>${ICON.trash}</button>` : '')}
    <div class="field"><label>${t('account_name')}</label><input data-f="name" value="${esc(a.name)}" maxlength="40"></div>
    <div class="field inline">
      <div class="grow"><label>${t('icon')}</label><input data-f="icon" value="${esc(a.icon)}" maxlength="4" style="font-size:22px;text-align:center"></div>
      <div class="grow" style="flex:3"><label>${t('initial_balance')}</label><input data-f="initial_balance" type="number" step="0.01" inputmode="decimal" value="${a.initial_balance}"></div>
    </div>
    <div class="field"><label>${t('color')}</label><div class="colors">${PALETTE.map(c => `<div class="color-dot ${c === a.color ? 'active' : ''}" data-color="${c}" style="background:${c}"></div>`).join('')}</div></div>
    <label class="switch"><span>${t('include_in_total')}</span><input type="checkbox" data-f="include_in_total" ${a.include_in_total !== false ? 'checked' : ''}></label>
    <label class="switch"><span>${t('archived')}</span><input type="checkbox" data-f="archived" ${a.archived ? 'checked' : ''}></label>
    <button class="btn primary block mt" data-save>${t('save')}</button>`);
  el.querySelectorAll('[data-color]').forEach(d => d.onclick = () => { a.color = d.dataset.color; el.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('active', x === d)); });
  el.querySelector('[data-save]').onclick = async () => {
    a.name = el.querySelector('[data-f=name]').value.trim(); if (!a.name) return;
    a.icon = el.querySelector('[data-f=icon]').value.trim() || '💳';
    a.initial_balance = Number(el.querySelector('[data-f=initial_balance]').value) || 0;
    a.include_in_total = el.querySelector('[data-f=include_in_total]').checked;
    a.archived = el.querySelector('[data-f=archived]').checked;
    await upsert('accounts', a); closeLayer(el); scheduleSync(); toast(t('saved'));
  };
  el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirm(t('confirm_delete'), { okLabel: t('delete'), danger: true }))) return;
    await remove('accounts', acc.id); closeLayer(el); scheduleSync(); toast(t('deleted'));
  });
}
