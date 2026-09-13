// Service worker: cache dell'app per uso offline
const VERSION = 'mt-v0.2.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css', './lib/supabase.js', './data/notion/meta.json', './data/notion/expenses-1.json', './data/notion/expenses-2.json', './data/notion/expenses-3.json', './data/notion/incomes.json',
  './js/app.js', './js/config.js', './js/db.js', './js/store.js', './js/sync.js', './js/i18n.js', './js/format.js', './js/ui.js',
  './js/periods.js', './js/charts.js', './js/recurring.js', './js/importer.js',
  './js/views/home.js', './js/views/add.js', './js/views/txlist.js', './js/views/accounts.js', './js/views/budget.js',
  './js/views/stats.js', './js/views/list.js', './js/views/settings.js', './js/views/categories.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  // scarica i file bypassando la cache HTTP del browser, altrimenti si memorizzano versioni vecchie
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => fetch(u, { cache: 'reload' }).then(r => { if (!r.ok) throw new Error(u); return c.put(u, r); })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API Supabase: sempre rete
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      const fetching = fetch(e.request, { cache: 'no-cache' }).then(res => {
        if (res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});
