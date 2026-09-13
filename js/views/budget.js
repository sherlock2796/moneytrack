// Budget: totale mensile + per categoria (mensile o annuale)
import { live, filterTx, sumBy, spentByCategory, state } from '../store.js';
import { t } from '../i18n.js';
import { esc, money, todayISO, fmtDate, addMonths } from '../format.js';
import { openModal, closeLayer, ICON } from '../ui.js';
import { monthRange, yearRange } from '../periods.js';
import { setSyncedSetting } from '../sync.js';
import { editCategory } from './categories.js';

let anchor = todayISO().slice(0, 8) + '01';

function bar(spent, budget) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const cls = spent > budget ? 'over' : pct >= 85 ? 'warn' : '';
  return `<div class="bar"><i class="${cls}" style="width:${pct}%"></i></div>`;
}
function leftText(spent, budget) {
  const d = budget - spent;
  return d >= 0 ? `<span class="income">${t('left')}: ${esc(money(d))}</span>` : `<span class="expense">${t('over')} ${esc(money(-d))}</span>`;
}

export function render(el) {
  const mr = monthRange(anchor), yr = yearRange(anchor);
  const mtx = filterTx({ from: mr.from, to: mr.to }), ytx = filterTx({ from: yr.from, to: yr.to });
  const mSpent = spentByCategory(mtx), ySpent = spentByCategory(ytx);
  const totalSpent = sumBy(mtx, 'expense');
  const totalBudget = Number(state.settings.budget_total) || 0;
  const cats = live.categories('expense').filter(c => !c.archived && Number(c.budget) > 0);
  const monthly = cats.filter(c => c.budget_period !== 'year'), yearly = cats.filter(c => c.budget_period === 'year');
  const sumMonthlyBudgets = monthly.reduce((s, c) => s + Number(c.budget), 0);
  const row = (c, spent, budget) => `<div class="budget-row" data-cat="${c.id}">
      <div class="row between"><span>${esc(c.icon)} <b>${esc(c.name)}</b></span><span class="small">${esc(money(spent))} / ${esc(money(budget))}</span></div>
      ${bar(spent, budget)}<div class="small" style="margin-top:4px">${leftText(spent, budget)}</div></div>`;

  el.innerHTML = `
    <div class="periodbar">
      <button class="iconbtn" data-shift="-1">${ICON.left}</button>
      <div class="label">${esc(fmtDate(anchor, 'month'))}</div>
      <button class="iconbtn" data-shift="1">${ICON.right}</button>
    </div>
    <div class="card" data-total>
      <h3>${t('budget_total')}</h3>
      ${totalBudget > 0 ? `<div class="row between"><span style="font-size:22px;font-weight:700">${esc(money(totalSpent))}</span><span class="muted">/ ${esc(money(totalBudget))}</span></div>${bar(totalSpent, totalBudget)}<div class="small mt">${leftText(totalSpent, totalBudget)}</div>`
        : `<div class="muted">${t('no_budget')}</div>`}
      <button class="btn sm mt" data-set-total>${t('set_budget')}</button>
      ${sumMonthlyBudgets ? `<div class="small muted mt">Σ ${t('categories').toLowerCase()} (${t('per_month')}): ${esc(money(sumMonthlyBudgets))}</div>` : ''}
    </div>
    ${monthly.length ? `<div class="card"><h3>${t('per_month')}</h3>${monthly.map(c => row(c, mSpent.get(c.id) || 0, Number(c.budget))).join('')}</div>` : ''}
    ${yearly.length ? `<div class="card"><h3>${t('per_year')} · ${anchor.slice(0, 4)}</h3>${yearly.map(c => row(c, ySpent.get(c.id) || 0, Number(c.budget))).join('')}</div>` : ''}
    ${!cats.length ? `<div class="card"><div class="muted">${t('no_budget')}</div></div>` : ''}`;
  el.querySelectorAll('[data-shift]').forEach(b => b.onclick = () => { anchor = addMonths(anchor, Number(b.dataset.shift)); render(el); });
  el.querySelectorAll('[data-cat]').forEach(x => x.onclick = () => editCategory(state.categories.find(c => c.id === x.dataset.cat)));
  el.querySelector('[data-set-total]').onclick = () => {
    const m = openModal(`<div class="title">${t('budget_total')}</div><div class="field"><input type="number" inputmode="decimal" step="1" min="0" data-v value="${totalBudget || ''}"></div>
      <div class="actions"><button class="btn" data-close>${t('cancel')}</button><button class="btn primary" data-ok>${t('save')}</button></div>`);
    m.querySelector('[data-ok]').onclick = async () => { await setSyncedSetting('budget_total', Number(m.querySelector('[data-v]').value) || 0); closeLayer(m); render(el); };
  };
}
