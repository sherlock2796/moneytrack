// Statistiche: barre mensili entrate/uscite, storico per categoria, ripartizione
import { live, filterTx, sumBy, spentByCategory, byId } from '../store.js';
import { t } from '../i18n.js';
import { esc, money, fmtDate, todayISO, round2 } from '../format.js';
import { barsSVG } from '../charts.js';
import { lastMonths, yearRange } from '../periods.js';

const ui = { category: null, months: 12 };

export function render(el) {
  const months = lastMonths(ui.months);
  const groups = months.map(m => {
    const txs = filterTx({ from: m.from, to: m.to });
    return { label: fmtDate(m.from, 'monthShort'), inc: sumBy(txs, 'income'), exp: sumBy(txs, 'expense'), txs };
  });
  const active = groups.filter(g => g.txs.length) ; const nActive = Math.max(1, active.length);
  const avgExp = round2(active.reduce((s, g) => s + g.exp, 0) / nActive);
  const avgInc = round2(active.reduce((s, g) => s + g.inc, 0) / nActive);
  const cats = live.categories('expense');
  const catSel = ui.category ? byId('categories').get(ui.category) : null;
  const catGroups = catSel ? groups.map(g => ({ label: g.label, values: [{ v: spentByCategory(g.txs).get(catSel.id) || 0, color: catSel.color }] })) : null;
  // ripartizione anno corrente
  const yr = yearRange(todayISO());
  const ySpent = spentByCategory(filterTx({ from: yr.from, to: yr.to }));
  const yTotal = [...ySpent.values()].reduce((s, v) => s + v, 0);
  const ranking = cats.map(c => ({ c, v: ySpent.get(c.id) || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);

  el.innerHTML = `
    <div class="card">
      <h3>${t('monthly_chart')}</h3>
      ${barsSVG(groups.map(g => ({ label: g.label, values: [{ v: g.inc, color: 'var(--income)' }, { v: g.exp, color: 'var(--expense)' }] })))}
      <div class="legend"><span><i style="background:var(--income)"></i>${t('incomes')}</span><span><i style="background:var(--expense)"></i>${t('expenses')}</span></div>
      <div class="stat-tiles mt">
        <div class="tile"><div class="v income">${esc(money(avgInc))}</div><div class="k">${t('avg_month')} · ${t('incomes')}</div></div>
        <div class="tile"><div class="v expense">${esc(money(avgExp))}</div><div class="k">${t('avg_month')} · ${t('expenses')}</div></div>
        <div class="tile"><div class="v ${avgInc - avgExp >= 0 ? 'income' : 'expense'}">${esc(money(round2(avgInc - avgExp)))}</div><div class="k">${t('avg_month')} · ${t('net')}</div></div>
      </div>
    </div>
    <div class="card">
      <h3>${t('category_history')}</h3>
      <div class="chips mb">${cats.map(c => `<button class="chip ${ui.category === c.id ? 'active' : ''}" data-cat="${c.id}">${esc(c.icon)} ${esc(c.name)}</button>`).join('')}</div>
      ${catGroups ? barsSVG(catGroups) + `<div class="small muted mt">${t("avg_month")}: ${esc(money(round2(catGroups.reduce((s, g) => s + g.values[0].v, 0) / nActive)))}</div>` : `<div class="muted small">${t('no_data')}</div>`}
    </div>
    <div class="card">
      <h3>${t('stats_expense_by_cat')} · ${yr.from.slice(0, 4)}</h3>
      ${ranking.map(({ c, v }) => `<div class="budget-row"><div class="row between"><span>${esc(c.icon)} ${esc(c.name)}</span><span class="small"><b>${esc(money(v))}</b> · ${Math.round((v / yTotal) * 100)}%</span></div><div class="bar"><i style="width:${(v / (ranking[0]?.v || 1)) * 100}%;background:${esc(c.color)}"></i></div></div>`).join('') || `<div class="muted">${t('no_data')}</div>`}
      <div class="small muted mt">${t('total')}: ${esc(money(yTotal))}</div>
    </div>`;
  el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { ui.category = ui.category === b.dataset.cat ? null : b.dataset.cat; render(el); });
}
