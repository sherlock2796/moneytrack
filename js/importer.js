// Import/Export: seed Notion, backup JSON, CSV
import { state, live, upsertMany, byId } from './store.js';
import * as db from './db.js';
import { uuid, nowISO, todayISO, round2 } from './format.js';
import { advance } from './recurring.js';

const BILLING_MAP = { monthly: 'monthly', yearly: 'yearly', annual: 'yearly', quarterly: 'quarterly', weekly: 'weekly', 'two years': 'two_years', '2annual': 'two_years' };

export async function loadNotionSeed() {
  const get = async f => { const r = await fetch("data/notion/" + f, { cache: "no-cache" }); if (!r.ok) throw new Error("seed non trovato: " + f); return r.json(); };
  const [meta, e1, e2, e3, incomes] = await Promise.all([get("meta.json"), get("expenses-1.json"), get("expenses-2.json"), get("expenses-3.json"), get("incomes.json")]);
  return { ...meta, expenses: [...e1, ...e2, ...e3, ...(meta.expensesExtra || [])], incomes };
}

export async function importNotionSeed(seed) {
  const now = nowISO();
  // conti
  const accByName = new Map(live.accounts().map(a => [a.name.toLowerCase(), a]));
  const newAccounts = [];
  seed.accounts.forEach((a, i) => {
    if (accByName.has(a.name.toLowerCase())) return;
    const row = { id: uuid(), name: a.name, icon: a.icon || '💳', color: a.color || '#1e88e5', initial_balance: 0, include_in_total: a.includeInTotal !== false, sort: i, archived: false };
    newAccounts.push(row); accByName.set(a.name.toLowerCase(), row);
  });
  if (newAccounts.length) await upsertMany('accounts', newAccounts, { silent: true });
  // categorie
  const catKey = (type, name) => type + ':' + name.toLowerCase();
  const catByKey = new Map(live.categories().map(c => [catKey(c.type, c.name), c]));
  const newCats = [];
  const mk = (type, c, i) => {
    if (catByKey.has(catKey(type, c.name))) return;
    const row = { id: uuid(), type, name: c.name, icon: c.icon || '🏷️', color: c.color || '#1e88e5', budget: Number(c.budget) || 0, budget_period: c.budgetPeriod === 'year' ? 'year' : 'month', sort: i, archived: false };
    newCats.push(row); catByKey.set(catKey(type, c.name), row);
  };
  seed.expenseCategories.forEach((c, i) => mk('expense', c, i));
  seed.incomeCategories.forEach((c, i) => mk('income', c, i));
  if (newCats.length) await upsertMany('categories', newCats, { silent: true });

  const acc = n => accByName.get(String(n).toLowerCase());
  const cat = (type, n) => catByKey.get(catKey(type, String(n)));
  // idempotente: salta le transazioni già presenti (stesso tipo, importo, data, nota, categoria, conto)
  const txKey = t => [t.type, round2(t.amount), t.date, (t.note || '').trim().toLowerCase(), t.category_id || '', t.account_id || '', t.to_account_id || ''].join('|');
  const existing = new Set(live.transactions().map(txKey));
  const pushTx = t => { if (existing.has(txKey(t))) { skipped++; return; } existing.add(txKey(t)); txs.push(t); };
  const txs = []; let maxDate = '0000-00-00'; let skipped = 0;
  for (const e of seed.expenses) {
    pushTx({ id: uuid(), type: 'expense', amount: round2(e.a), date: e.d, category_id: cat('expense', e.c)?.id || null, account_id: acc(e.p)?.id || null, to_account_id: null, note: e.n || '', is_recurring: !!e.r, recurring_id: null });
    if (e.d > maxDate) maxDate = e.d;
  }
  for (const e of seed.incomes) {
    pushTx({ id: uuid(), type: 'income', amount: round2(e.a), date: e.d, category_id: cat('income', e.c)?.id || null, account_id: acc(e.p)?.id || null, to_account_id: null, note: e.n || '', is_recurring: false, recurring_id: null });
    if (e.d > maxDate) maxDate = e.d;
  }
  for (const e of seed.transfers || []) {
    pushTx({ id: uuid(), type: 'transfer', amount: round2(e.a), date: e.d, category_id: null, account_id: acc(e.from)?.id || null, to_account_id: acc(e.to)?.id || null, note: e.n && e.n !== 'Transfer' ? e.n : '', is_recurring: false, recurring_id: null });
  }
  if (txs.length) await upsertMany('transactions', txs, { silent: true });

  // abbonamenti → ricorrenze, prossima data oltre l'ultima transazione importata (evita duplicati)
  const floor = maxDate > todayISO() ? maxDate : todayISO();
  const rules = [];
  const ruleKey = r => [(r.note || '').trim().toLowerCase(), round2(r.amount), r.frequency].join('|');
  const existingRules = new Set(live.recurring().map(ruleKey));
  for (const s of seed.subscriptions || []) {
    const freq = BILLING_MAP[String(s.billing).toLowerCase()] || 'monthly';
    if (existingRules.has(ruleKey({ note: s.name, amount: s.cost, frequency: freq }))) continue;
    let next = s.renewal; let guard = 0;
    while (next <= floor && guard++ < 200) next = advance(next, freq);
    rules.push({ id: uuid(), type: 'expense', amount: round2(s.cost), category_id: cat('expense', s.category)?.id || null, account_id: acc(s.account)?.id || null, to_account_id: null, note: s.name, frequency: freq, next_date: next, active: true });
  }
  if (rules.length) await upsertMany('recurring', rules, { silent: true });
  return { accounts: newAccounts.length, categories: newCats.length, transactions: txs.length, recurring: rules.length, skipped };
}

// ---- backup JSON ----
export function exportJSON() {
  return {
    app: 'MoneyTrack', version: 1, exportedAt: nowISO(),
    settings: { budget_total: state.settings.budget_total ?? 0 },
    accounts: state.accounts, categories: state.categories, transactions: state.transactions, recurring: state.recurring,
  };
}

export async function importJSON(obj, { replace = true } = {}) {
  if (!obj || obj.app !== 'MoneyTrack' || !Array.isArray(obj.transactions)) throw new Error('Backup non valido');
  if (replace) {
    for (const tname of db.TABLES) { await db.clearStore(tname); state[tname] = []; }
  }
  for (const tname of db.TABLES) {
    const rows = (obj[tname] || []).map(r => ({ ...r, updated_at: r.updated_at || nowISO() }));
    if (rows.length) await upsertMany(tname, rows, { keepTimestamp: !replace, silent: true });
  }
  if (obj.settings && obj.settings.budget_total != null) { state.settings.budget_total = obj.settings.budget_total; await db.setSetting('budget_total', obj.settings.budget_total); }
}

// ---- CSV ----
export function exportCSV() {
  const accs = byId('accounts'), cats = byId('categories');
  const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const lines = [['date', 'type', 'amount', 'category', 'account', 'to_account', 'note', 'recurring'].join(';')];
  const txs = live.transactions().sort((a, b) => a.date.localeCompare(b.date));
  for (const t of txs) {
    lines.push([t.date, t.type, String(t.amount).replace('.', ','), q(cats.get(t.category_id)?.name || ''), q(accs.get(t.account_id)?.name || ''), q(accs.get(t.to_account_id)?.name || ''), q(t.note), t.is_recurring ? 1 : 0].join(';'));
  }
  return '﻿' + lines.join('\r\n');
}

export function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

export function pickFile(accept = '.json') {
  return new Promise(resolve => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => { const f = inp.files[0]; if (!f) return resolve(null); const rd = new FileReader(); rd.onload = () => resolve(rd.result); rd.readAsText(f); };
    inp.click();
  });
}
