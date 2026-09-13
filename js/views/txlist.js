// Lista transazioni raggruppata per giorno (condivisa da Home e Lista)
import { byId, sumBy } from '../store.js';
import { t } from '../i18n.js';
import { esc, money, fmtDate } from '../format.js';
import { openAdd } from './add.js';

export function txListHTML(txs) {
  if (!txs.length) return `<div class="empty">${t('no_transactions')}</div>`;
  const accs = byId('accounts'), cats = byId('categories');
  const groups = new Map();
  for (const tx of txs) { if (!groups.has(tx.date)) groups.set(tx.date, []); groups.get(tx.date).push(tx); }
  let html = '';
  for (const [date, items] of groups) {
    const exp = sumBy(items, 'expense'), inc = sumBy(items, 'income');
    html += `<div class="tx-day"><span>${esc(fmtDate(date, 'day'))}</span><span>${inc ? `<span class="income">+${esc(money(inc))}</span> ` : ''}${exp ? `<span class="expense">−${esc(money(exp))}</span>` : ''}</span></div>`;
    for (const tx of items) {
      const c = cats.get(tx.category_id), a = accs.get(tx.account_id), to = accs.get(tx.to_account_id);
      const icon = tx.type === 'transfer' ? '↔️' : (c?.icon || '❓');
      const name = tx.type === 'transfer' ? `${esc(a?.name || '?')} → ${esc(to?.name || '?')}` : esc(c?.name || t('category'));
      const meta = [tx.note, tx.type !== 'transfer' ? a?.name : null].filter(Boolean).map(esc).join(' · ');
      const sign = tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : '';
      html += `<div class="tx" data-tx="${tx.id}">
        <div class="ico" style="${c ? `background:${esc(c.color)}22` : ''}">${icon}</div>
        <div class="main"><div class="name">${name}${tx.is_recurring ? `<span class="tag">↻</span>` : ''}</div><div class="meta">${meta}</div></div>
        <div class="amt ${tx.type}">${sign}${esc(money(tx.amount))}</div>
      </div>`;
    }
  }
  return html;
}

export function bindTxList(container, txs) {
  container.querySelectorAll('[data-tx]').forEach(el => el.onclick = () => { const tx = txs.find(x => x.id === el.dataset.tx); if (tx) openAdd({ tx }); });
}
