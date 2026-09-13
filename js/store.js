// Stato in memoria + persistenza + eventi
import * as db from './db.js';
import { uuid, nowISO, round2 } from './format.js';

export const state = {
  accounts: [], categories: [], transactions: [], recurring: [],
  settings: {},          // impostazioni locali (lingua, tema, budget_total, ...)
  loaded: false,
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(what = 'data') { for (const fn of listeners) { try { fn(what); } catch (e) { console.error(e); } } }

export async function load() {
  const [a, c, t, r] = await Promise.all(db.TABLES.map(db.getAll));
  state.accounts = a; state.categories = c; state.transactions = t; state.recurring = r;
  const keys = ['lang', 'theme', 'budget_total', 'supabase_url', 'supabase_key', 'last_sync', 'onboarded', 'budget_total_updated_at'];
  for (const k of keys) state.settings[k] = await db.getSetting(k);
  state.loaded = true;
}

export async function setSetting(k, v) {
  state.settings[k] = v; await db.setSetting(k, v); emit('settings');
}

// ---- CRUD generico (soft delete + outbox) ----
function coll(table) { return state[table]; }

export async function upsert(table, row, opts = {}) {
  const now = nowISO();
  const r = { ...row };
  if (!r.id) r.id = uuid();
  if (!opts.keepTimestamp) r.updated_at = now;
  if (r.deleted === undefined) r.deleted = false;
  const arr = coll(table); const i = arr.findIndex(x => x.id === r.id);
  if (i >= 0) arr[i] = r; else arr.push(r);
  await db.put(table, r);
  if (!opts.noOutbox) await db.outboxAdd(table, r.id);
  if (!opts.silent) emit('data');
  return r;
}

export async function upsertMany(table, rows, opts = {}) {
  const now = nowISO();
  const arr = coll(table); const byId = new Map(arr.map((x, i) => [x.id, i]));
  const out = [];
  for (const row of rows) {
    const r = { ...row }; if (!r.id) r.id = uuid();
    if (!opts.keepTimestamp) r.updated_at = now;
    if (r.deleted === undefined) r.deleted = false;
    const i = byId.get(r.id);
    if (i !== undefined) arr[i] = r; else { byId.set(r.id, arr.length); arr.push(r); }
    out.push(r);
  }
  await db.putMany(table, out);
  if (!opts.noOutbox) await db.outboxAddMany(table, out.map(r => r.id));
  if (!opts.silent) emit('data');
  return out;
}

export async function remove(table, id) {
  const arr = coll(table); const r = arr.find(x => x.id === id);
  if (!r) return;
  r.deleted = true; r.updated_at = nowISO();
  await db.put(table, r); await db.outboxAdd(table, id); emit('data');
}

export async function restore(table, id) {
  const arr = coll(table); const r = arr.find(x => x.id === id);
  if (!r) return;
  r.deleted = false; r.updated_at = nowISO();
  await db.put(table, r); await db.outboxAdd(table, id); emit('data');
}

// ---- accessor "vivi" (non cancellati) ----
export const live = {
  accounts: () => state.accounts.filter(a => !a.deleted).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)),
  categories: (type) => state.categories.filter(c => !c.deleted && (!type || c.type === type)).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)),
  transactions: () => state.transactions.filter(t => !t.deleted),
  recurring: () => state.recurring.filter(r => !r.deleted),
};
export const byId = (table) => { const m = new Map(); for (const r of state[table]) m.set(r.id, r); return m; };

// ---- calcoli ----
export function accountBalance(accountId, untilDate = null) {
  const acc = state.accounts.find(a => a.id === accountId); if (!acc) return 0;
  let b = Number(acc.initial_balance) || 0;
  for (const t of state.transactions) {
    if (t.deleted) continue; if (untilDate && t.date > untilDate) continue;
    const amt = Number(t.amount) || 0;
    if (t.type === 'expense' && t.account_id === accountId) b -= amt;
    else if (t.type === 'income' && t.account_id === accountId) b += amt;
    else if (t.type === 'transfer') { if (t.account_id === accountId) b -= amt; if (t.to_account_id === accountId) b += amt; }
  }
  return round2(b);
}
export function totalBalance(onlyIncluded = true) {
  return round2(live.accounts().filter(a => !a.archived && (!onlyIncluded || a.include_in_total !== false)).reduce((s, a) => s + accountBalance(a.id), 0));
}

export function inRange(t, from, to) { return (!from || t.date >= from) && (!to || t.date <= to); }

export function sumBy(txs, type) { return round2(txs.filter(t => t.type === type).reduce((s, t) => s + (Number(t.amount) || 0), 0)); }

export function spentByCategory(txs) {
  const m = new Map();
  for (const t of txs) if (t.type === 'expense') m.set(t.category_id, round2((m.get(t.category_id) || 0) + Number(t.amount || 0)));
  return m;
}

export function filterTx({ from, to, account, type, category, query } = {}) {
  const q = query ? query.trim().toLowerCase() : '';
  // la ricerca guarda nota, nome categoria e nome conto
  const cats = q ? byId('categories') : null, accs = q ? byId('accounts') : null;
  const matches = t => {
    if ((t.note || '').toLowerCase().includes(q)) return true;
    const c = cats.get(t.category_id), a = accs.get(t.account_id), to = accs.get(t.to_account_id);
    return !!((c && c.name.toLowerCase().includes(q)) || (a && a.name.toLowerCase().includes(q)) || (to && to.name.toLowerCase().includes(q)));
  };
  return live.transactions().filter(t =>
    inRange(t, from, to) &&
    (!account || t.account_id === account || t.to_account_id === account) &&
    (!type || t.type === type) &&
    (!category || t.category_id === category) &&
    (!q || matches(t))
  ).sort((a, b) => b.date.localeCompare(a.date) || (b.updated_at || '').localeCompare(a.updated_at || ''));
}

// quante transazioni/ricorrenze usano un conto o una categoria (per impedire eliminazioni che lascerebbero righe orfane)
export function usageCount(table, id) {
  const tx = live.transactions(), rec = live.recurring();
  if (table === 'accounts') return tx.filter(t => t.account_id === id || t.to_account_id === id).length + rec.filter(r => r.account_id === id || r.to_account_id === id).length;
  return tx.filter(t => t.category_id === id).length + rec.filter(r => r.category_id === id).length;
}
