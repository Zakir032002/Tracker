/* Ascend service worker: works offline. Network-first so updates show up, cache as fallback. */
const CACHE = 'ascend-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'assets/icon.svg',
  'css/theme.css', 'css/components.css', 'css/views.css',
  'js/util.js', 'js/store.js', 'js/audio.js', 'js/game.js', 'js/fx.js', 'js/ui.js',
  'js/views/today.js', 'js/views/quests.js', 'js/views/insights.js', 'js/views/notes.js',
  'js/views/alarms.js', 'js/views/focus.js', 'js/views/vault.js', 'js/views/settings.js',
  'js/alarm-engine.js', 'js/main.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (new URL(req.url).origin === location.origin || /fonts\.(googleapis|gstatic)\.com/.test(req.url))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
