self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('snowboard').then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './manifest.json',
        './apple-touch-icon.png',
        './db.json',
        './social.json',
        './system-app.json',
        './Language/en_US.json',
        './Language/vi_VN.json'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== 'snowboard-v2').map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('.json')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open('snowboard').then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return (
        response ||
        fetch(e.request).then((response) => {
          const clone = response.clone();
          caches.open('snowboard').then((cache) => cache.put(e.request, clone));
          return response;
        })
      );
    })
  );
});