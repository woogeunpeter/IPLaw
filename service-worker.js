/* Auto-refresh Service Worker */
const CACHE_STATIC = 'iplaw-static-v1';
const CORE = [
  './','./index.html','./styles.css','./app.js','./manifest.json',
  './icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_STATIC).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_STATIC) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('/data/')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE_STATIC);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const fetchPromise = fetch(event.request).then((networkResponse) => {
      caches.open(CACHE_STATIC).then((cache) => cache.put(event.request, networkResponse.clone()));
      return networkResponse;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
