const CACHE_NAME = 'snowboard-cache-v10'; // Tăng số lên để ép xóa cache cũ
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './script.js',
  './manifest.json',
  './apple-touch-icon.png',
  './db.json',
  './system-app.json',
  './social.json',
  './Language/vi_VN.json',
  './Language/en-US.json',
  './icons/icon_setting.png',
  './icons/icon_info.png',
  './icons/icon_reset.png',
  './icons/icon_plugin.png',
  './icons/icon_delete.png'
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

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});