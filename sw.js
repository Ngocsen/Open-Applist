// sw.js
const CACHE_NAME = 'snowboard-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './apple-touch-icon.png',
  './db.json',
  './system-app.json',
  './social.json',
  './Language/vi-VN.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});