// Sincronizzazione con Supabase (offline-first, last-write-wins)
import { state, emit, upsertMany, setSetting } from './store.js';
import * as db from './db.js';
import { CONFIG } from './config.js';
import { nowISO } from './format.js';

export const syncState = { status: 'idle', message: '', user: null, configured: false };

let client = null;
let clientKey = '';

function creds() {
  const url = (state.settings.supabase_url || CONFIG.supabaseUrl || '').trim();
  const key = (state.settings.supabase_key || CONFIG.supabaseKey || '').trim();
  return { url, key };
}

export function getClient() {
  const { url, key } = creds();
  syncState.configured = !!(url && key && window.supabase);
  if (!syncState.configured) { client = null; return null; }
  const k = url + '|' + key;
  if (client && clientKey === k) return client;
  client = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  clientKey = k;
  client.auth.onAuthStateChange((_ev, session) => { syncState.user = session?.user || null; emit('auth'); if (session) scheduleSync(500); });
  return client;
}

export async function initAuth() {
  const c = getClient(); if (!c) return null;
  const { data } = await c.auth.getSession();
  syncState.user = data.session?.user || null;
  return syncState.user;
}

export async function signIn(email, password) {
  const c = getClient(); if (!c) throw new Error('not configured');
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error; syncState.user = data.user; emit('auth'); return data.user;
}
export async function signUp(email, password) {
  const c = getClient(); if (!c) throw new Error('not configured');
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw error; syncState.user = data.user; emit('auth'); return data;
}
export async function signOut() {
  const c = getClient(); if (!c) return;
  await c.auth.signOut(); syncState.user = null; emit('auth');
}

const ts = s => (s ? Date.parse(s) : 0);
const TABLES = db.TABLES;

let syncing = false, pending = false, timer = null;
export function scheduleSync(delay = 2000) {
  if (!syncState.configured || !syncState.user) return;
  clearTimeout(timer); timer = setTimeout(() => sync().catch(() => {}), delay);
}

export async function sync() {
  const c = getClient();
  if (!c || !syncState.user) return false;
  if (!navigator.onLine) { syncState.status = 'offline'; emit('sync'); return false; }
  if (syncing) { pending = true; return false; }
  syncing = true; syncState.status = 'busy'; syncState.message = ''; emit('sync');
  try {
    await push(c);
    await pull(c);
    syncState.status = 'ok'; await setSetting('last_sync', nowISO());
  } catch (e) {
    console.error('sync', e); syncState.status = 'error'; syncState.message = e.message || String(e);
  } finally {
    syncing = false; emit('sync');
    if (pending) { pending = false; scheduleSync(1000); }
  }
  return syncState.status === 'ok';
}

async function push(c) {
  const uid = syncState.user.id;
  const outbox = await db.outboxAll();
  if (!outbox.length) return;
  for (const table of TABLES) {
    const items = outbox.filter(o => o.table === table);
    if (!items.length) continue;
    const ids = new Set(items.map(o => o.id));
    const rows = state[table].filter(r => ids.has(r.id)).map(r => ({ ...r, user_id: uid }));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await c.from(table).upsert(rows.slice(i, i + 200), { onConflict: 'id' });
      if (error) throw error;
    }
    await db.outboxRemove(items.map(o => o.key));
  }
  // impostazioni sincronizzate
  const sItems = outbox.filter(o => o.table === 'settings');
  if (sItems.length) {
    const rows = sItems.map(o => ({ user_id: uid, key: o.id, value: state.settings[o.id] ?? null, updated_at: state.settings[o.id + '_updated_at'] || nowISO() }));
    const { error } = await c.from('settings').upsert(rows, { onConflict: 'user_id,key' });
    if (error) throw error;
    await db.outboxRemove(sItems.map(o => o.key));
  }
}

async function pull(c) {
  const outbox = new Set((await db.outboxAll()).map(o => o.key));
  for (const table of TABLES) {
    const last = (await db.getSetting('pull_' + table)) || '1970-01-01T00:00:00Z';
    let from = 0, maxSeen = last; const PAGE = 1000;
    while (true) {
      const { data, error } = await c.from(table).select('*').gte('updated_at', last).order('updated_at', { ascending: true }).order('id').range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = data || [];
      const byId = new Map(state[table].map(r => [r.id, r]));
      const toApply = [];
      for (const rr of rows) {
        const r = normalize(table, rr);
        const loc = byId.get(r.id);
        if (!loc) toApply.push(r);
        else if (ts(r.updated_at) > ts(loc.updated_at)) toApply.push(r);
        else if (ts(r.updated_at) === ts(loc.updated_at) && !outbox.has(table + ':' + r.id)) toApply.push(r);
        if (ts(r.updated_at) > ts(maxSeen)) maxSeen = r.updated_at;
      }
      if (toApply.length) await upsertMany(table, toApply, { keepTimestamp: true, noOutbox: true, silent: true });
      if (rows.length < PAGE) break; from += PAGE;
    }
    if (maxSeen !== last) await db.setSetting('pull_' + table, maxSeen);
  }
  // impostazioni
  const { data: srows, error } = await c.from('settings').select('*');
  if (error) throw error;
  for (const s of srows || []) {
    const localTs = state.settings[s.key + '_updated_at'];
    if (!outbox.has('settings:' + s.key) && ts(s.updated_at) > ts(localTs)) {
      state.settings[s.key] = s.value; state.settings[s.key + '_updated_at'] = s.updated_at;
      await db.setSetting(s.key, s.value); await db.setSetting(s.key + '_updated_at', s.updated_at);
    }
  }
  emit('data');
}

function normalize(table, r) {
  const o = { ...r }; delete o.user_id;
  if ('amount' in o) o.amount = Number(o.amount);
  if ('initial_balance' in o) o.initial_balance = Number(o.initial_balance);
  if ('budget' in o) o.budget = Number(o.budget);
  if (o.date && o.date.length > 10) o.date = o.date.slice(0, 10);
  if (o.next_date && o.next_date.length > 10) o.next_date = o.next_date.slice(0, 10);
  return o;
}

// impostazione sincronizzata (es. budget_total)
export async function setSyncedSetting(key, value) {
  const now = nowISO();
  await setSetting(key, value); await setSetting(key + '_updated_at', now);
  await db.outboxAdd('settings', key);
  scheduleSync();
}

window.addEventListener('online', () => scheduleSync(300));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(300); });
