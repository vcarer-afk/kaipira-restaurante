const CACHE_NAME = 'kaipira-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through simples para garantir funcionamento online constante
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
