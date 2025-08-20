/* Offline cache for statutes UI */
const CACHE = 'law-ui-v1';
const CORE = [
  './','./index.html','./styles.css','./app.js','./manifest.json',
  './icons/icon-192.png','./icons/icon-512.png','./data/patent.json'
];
self.addEventListener('install', e=> e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));
self.addEventListener('activate', e=> e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE&&caches.delete(k))))));
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.pathname.includes('/data/')){
    e.respondWith(fetch(e.request).then(r=>{const x=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,x)); return r;}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
