/* Cache the game locally; it needs no external APIs or CDNs. */
const CACHE_NAME = 'sudoku-offline-v5';
const OFFLINE_FILES = [
  './', './index.html', './style.css', './engine.js', './puzzles.js', './translations.js', './app.js',
  './manifest.webmanifest', './assets/favicon.svg',
  './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const found = await cache.match(request, {ignoreSearch: true});
    if (found) return found;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    return fetch(request);
  })());
});
