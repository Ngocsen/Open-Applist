// sw.js (Thêm chiến lược cache tốt hơn và fallback cho offline)
const CACHE_NAME = 'snowboard-cache-v2'; // Nâng cấp version
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './apple-touch-icon.png',
  './db.json',
  './system-app.json',
  './social.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Chiến lược cache-first
  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then((response) => {
            // Chỉ cache các phản hồi hợp lệ và cùng origin
            if (response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Fallback về trang chủ khi offline
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});
