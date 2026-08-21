// sw.js
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('snowboard-cache').then((cache) => {
      return cache.addAll(['./', './index.html', './manifest.json', './apple-touch-icon.png']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
