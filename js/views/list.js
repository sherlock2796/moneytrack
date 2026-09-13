// Lista transazioni con ricerca e filtri
import { live, filterTx, sumBy } from '../store.js';
import { t } from '../i18n.js';
import { esc, money } from '../format.js';
import { txListHTML, bindTxList } from './txlist.js';

const f = { query: '', type: '', account: '', category: '', from: '', to: '' };

export function render(el) {
  const txs = filterTx({ query: f.query, type: f.type, account: f.account, category: f.category, from: f.from, to: f.to });
  const accs = live.accounts(), cats = live.categories(f.type === 'income' ? 'income' : f.type === 'expense' ? 'expense' : null);
  el.innerHTML = `
    <div class="field"><input type="search" data-q placeholder="${t('search')}" value="${esc(f.query)}"></div>
    <div class="row mb" style="gap:6px;flex-wrap:wrap">
      <select data-f="type" style="width:auto;flex:1"><option value="">${t('all_types')}</option>${['expense', 'income', 'transfer'].map(x => `<option value="${x}" ${f.type === x ? 'selected' : ''}>${t(x)}</option>`).join('')}</select>
      <select data-f="account" style="width:auto;flex:1"><option value="">${t('all_accounts')}</option>${accs.map(a => `<option value="${a.id}" ${f.account === a.id ? 'selected' : ''}>${esc(a.icon)} ${esc(a.name)}</option>`).join('')}</select>
      <select data-f="category" style="width:auto;flex:1"><option value="">${t('all_categories')}</option>${cats.map(c => `<option value="${c.id}" ${f.category === c.id ? 'selected' : ''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}</select>
    </div>
    <div class="row mb" style="gap:6px"><input type="date" data-f="from" value="${f.from}"><span class="muted">–</span><input type="date" data-f="to" value="${f.to}"></div>
    <div class="small muted mb">${t('transactions_count', { n: txs.length })} · <span class="expense">−${esc(money(sumBy(txs, 'expense')))}</span> · <span class="income">+${esc(money(sumBy(txs, 'income')))}</span></div>
    <div data-list>${txListHTML(txs.slice(0, 500))}</div>`;
  const q = el.querySelector('[data-q]');
  let timer; q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { f.query = q.value; render(el); const nq = el.querySelector('[data-q]'); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }, 250); };
  el.querySelectorAll('[data-f]').forEach(s => s.onchange = () => { f[s.dataset.f] = s.value; if (s.dataset.f === 'type') f.category = ''; render(el); });
  bindTxList(el, txs);
}
