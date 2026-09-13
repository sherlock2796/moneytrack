// Home: anello per categoria + periodo + lista
import { live, byId, filterTx, sumBy, spentByCategory, totalBalance, accountBalance } from '../store.js';
import { t } from '../i18n.js';
import { esc, money, todayISO } from '../format.js';
import { openModal, closeLayer, ICON } from '../ui.js';
import { defaultPeriod, range, shift, label, PERIOD_TYPES } from '../periods.js';
import { donutSVG, ringPositions } from '../charts.js';
import { txListHTML, bindTxList } from './txlist.js';
import { openAdd } from './add.js';

const ui = { period: defaultPeriod(), account: null, category: null, mode: 'expense' };

export function render(el) {
  const r = range(ui.period);
  const all = filterTx({ from: r.from, to: r.to, account: ui.account });
  const exp = sumBy(all, 'expense'), inc = sumBy(all, 'income');
  const cats = live.categories(ui.mode).filter(c => !c.archived);
  const spent = ui.mode === 'expense' ? spentByCategory(all) : (() => { const m = new Map(); for (const x of all) if (x.type === 'income') m.set(x.category_id, (m.get(x.category_id) || 0) + Number(x.amount)); return m; })();
  // categorie con importo per l'anello (ordinate per importo), tutte per le bolle
  const slices = cats.filter(c => (spent.get(c.id) || 0) > 0).map(c => ({ id: c.id, value: spent.get(c.id), color: c.color, title: `${c.name}: ${money(spent.get(c.id))}` }));
  const shown = cats; // tutte le categorie attorno all'anello
  const pos = ringPositions(shown.length, 45);
  const accs = live.accounts().filter(a => !a.archived);
  const accLabel = ui.account ? (accs.find(a => a.id === ui.account)?.name || '') : t('all_accounts');
  const balance = ui.account ? accountBalance(ui.account) : totalBalance(true);
  const listTx = ui.category ? all.filter(x => x.category_id === ui.category) : all;
  const catSel = ui.category ? byId('categories').get(ui.category) : null;

  el.innerHTML = `
    <div class="row between mb">
      <button class="chip set" data-account-pick style="background:var(--surface);box-shadow:var(--shadow);color:var(--text)">💳 ${esc(accLabel)} ▾</button>
      <div class="right"><div class="small muted">${t('balance')}</div><div style="font-weight:700">${esc(money(balance))}</div></div>
    </div>
    <div class="chips mb">${PERIOD_TYPES.map(p => `<button class="chip ${ui.period.type === p ? 'active' : ''}" data-ptype="${p}">${t(p)}</button>`).join('')}</div>
    <div class="periodbar">
      <button class="iconbtn" data-shift="-1" ${ui.period.type === 'all' ? 'disabled' : ''}>${ICON.left}</button>
      <div class="label" data-period-label>${esc(label(ui.period))}</div>
      <button class="iconbtn" data-shift="1" ${ui.period.type === 'all' ? 'disabled' : ''}>${ICON.right}</button>
    </div>
    <div class="card">
      <div class="donut-wrap" data-donut>
        ${donutSVG(slices, { size: 300, thickness: 30 })}
        <div class="donut-center">
          <div class="big expense">${esc(money(exp))}</div>
          <div class="sub">${t('expenses')}</div>
          <div class="big income" style="font-size:16px;margin-top:6px">+${esc(money(inc))}</div>
          <div class="sub">${t('incomes')}</div>
        </div>
        ${shown.map((c, i) => { const v = spent.get(c.id) || 0; return `<div class="cat-bubble" style="left:${pos[i].x}%;top:${pos[i].y}%;--c:${esc(c.color)}" data-bubble="${c.id}" title="${esc(c.name)}">
          <div class="ico ${v ? 'has' : ''}" style="${v ? `background:${esc(c.color)}22` : ''}">${esc(c.icon)}</div>
          <div class="amt" style="${v ? '' : 'color:var(--text-2);font-weight:400'}">${v ? esc(money(v)) : ''}</div>
          <div class="nm">${esc(c.name)}</div></div>`; }).join('')}
      </div>
      <div class="row" style="justify-content:center;margin-top:10px;gap:6px">
        <button class="chip ${ui.mode === 'expense' ? 'active' : ''}" data-mode="expense">${t('expenses')}</button>
        <button class="chip ${ui.mode === 'income' ? 'active' : ''}" data-mode="income">${t('incomes')}</button>
      </div>
    </div>
    ${catSel ? `<div class="row between mb"><span>${esc(catSel.icon)} <b>${esc(catSel.name)}</b> <span class="muted small">(${t('transactions_count', { n: listTx.length })})</span></span><button class="btn sm" data-clear-cat>${ICON.close.replace('<svg', '<svg style="width:16px;height:16px"')}</button></div>` : ''}
    <div data-list>${txListHTML(listTx)}</div>`;

  el.querySelectorAll('[data-ptype]').forEach(b => b.onclick = () => {
    const p = b.dataset.ptype;
    if (p === 'custom') { pickRange(el); return; }
    ui.period = { type: p, anchor: todayISO() }; render(el);
  });
  el.querySelectorAll('[data-shift]').forEach(b => b.onclick = () => { ui.period = shift(ui.period, Number(b.dataset.shift)); render(el); });
  el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { ui.mode = b.dataset.mode; ui.category = null; render(el); });
  el.querySelector('[data-clear-cat]')?.addEventListener('click', () => { ui.category = null; render(el); });
  el.querySelectorAll('[data-bubble]').forEach(b => b.onclick = () => openAdd({ type: ui.mode, categoryId: b.dataset.bubble, accountId: ui.account || undefined }));
  el.querySelectorAll('.donut-slice').forEach(sl => sl.addEventListener('click', () => { ui.category = ui.category === sl.dataset.cat ? null : sl.dataset.cat; render(el); }));
  el.querySelector('[data-account-pick]').onclick = () => {
    const m = openModal(`<div class="title">${t('account')}</div>
      <div class="list-item" data-pick=""><div class="ico">💳</div><div class="main"><div class="name">${t('all_accounts')}</div></div><div class="val">${esc(money(totalBalance(true)))}</div></div>
      ${accs.map(a => `<div class="list-item" data-pick="${a.id}"><div class="ico">${esc(a.icon)}</div><div class="main"><div class="name">${esc(a.name)}</div></div><div class="val">${esc(money(accountBalance(a.id)))}</div></div>`).join('')}`);
    m.querySelectorAll('[data-pick]').forEach(x => x.onclick = () => { ui.account = x.dataset.pick || null; closeLayer(m); render(el); });
  };
  bindTxList(el, listTx);
}

function pickRange(el) {
  const r = range(ui.period.type === 'all' ? { type: 'month', anchor: todayISO() } : ui.period);
  const m = openModal(`<div class="title">${t('custom')}</div>
    <div class="field"><label>${t('from')}</label><input type="date" data-from value="${r.from}"></div>
    <div class="field"><label>${t('to')}</label><input type="date" data-to value="${r.to}"></div>
    <div class="actions"><button class="btn" data-close>${t('cancel')}</button><button class="btn primary" data-apply>${t('apply')}</button></div>`);
  m.querySelector('[data-apply]').onclick = () => {
    const from = m.querySelector('[data-from]').value, to = m.querySelector('[data-to]').value;
    if (!from || !to || from > to) return;
    ui.period = { type: 'custom', anchor: from, from, to }; closeLayer(m); render(el);
  };
}
