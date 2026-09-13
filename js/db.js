// IndexedDB: persistenza locale
const DB_NAME = 'moneytrack';
const DB_VERSION = 1;
export const TABLES = ['accounts', 'categories', 'transactions', 'recurring'];

let dbp = null;

export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const tname of TABLES) if (!db.objectStoreNames.contains(tname)) db.createObjectStore(tname, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(db, stores, mode) { return db.transaction(stores, mode); }
function reqp(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function done(t) { return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }

export async function getAll(store) {
  const db = await openDB();
  return reqp(tx(db, [store], 'readonly').objectStore(store).getAll());
}
export async function putMany(store, rows) {
  if (!rows.length) return;
  const db = await openDB();
  const t = tx(db, [store], 'readwrite'); const os = t.objectStore(store);
  for (const r of rows) os.put(r);
  await done(t);
}
export async function put(store, row) { return putMany(store, [row]); }
export async function del(store, id) {
  const db = await openDB();
  const t = tx(db, [store], 'readwrite'); t.objectStore(store).delete(id); await done(t);
}
export async function clearStore(store) {
  const db = await openDB();
  const t = tx(db, [store], 'readwrite'); t.objectStore(store).clear(); await done(t);
}
// cancella solo i dati (conti, categorie, transazioni, ricorrenze) e lo stato di sync, non le impostazioni
export async function clearData() {
  const db = await openDB();
  const t = tx(db, [...TABLES, 'outbox', 'settings'], 'readwrite');
  for (const n of [...TABLES, 'outbox']) t.objectStore(n).clear();
  for (const n of TABLES) t.objectStore('settings').delete('pull_' + n);
  t.objectStore('settings').delete('last_sync');
  await done(t);
}
export async function clearAll() {
  const db = await openDB();
  const names = [...TABLES, 'settings', 'outbox'];
  const t = tx(db, names, 'readwrite');
  for (const n of names) t.objectStore(n).clear();
  await done(t);
}

// settings key/value
export async function getSetting(key, def = null) {
  const db = await openDB();
  const r = await reqp(tx(db, ['settings'], 'readonly').objectStore('settings').get(key));
  return r ? r.value : def;
}
export async function setSetting(key, value) {
  const db = await openDB();
  const t = tx(db, ['settings'], 'readwrite'); t.objectStore('settings').put({ key, value }); await done(t);
}

// outbox: righe modificate localmente da inviare al cloud
export async function outboxAdd(table, id) {
  const db = await openDB();
  const t = tx(db, ['outbox'], 'readwrite'); t.objectStore('outbox').put({ key: table + ':' + id, table, id }); await done(t);
}
export async function outboxAddMany(table, ids) {
  if (!ids.length) return;
  const db = await openDB();
  const t = tx(db, ['outbox'], 'readwrite'); const os = t.objectStore('outbox');
  for (const id of ids) os.put({ key: table + ':' + id, table, id });
  await done(t);
}
export async function outboxAll() { return getAll('outbox'); }
export async function outboxRemove(keys) {
  if (!keys.length) return;
  const db = await openDB();
  const t = tx(db, ['outbox'], 'readwrite'); const os = t.objectStore('outbox');
  for (const k of keys) os.delete(k);
  await done(t);
}
