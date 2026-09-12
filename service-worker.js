// Al Mukhtar Petroleum - Dip Calculator - Service Worker
// Enables offline use and "Install app" support on Android/iOS/desktop.

const CACHE_NAME = 'amp-dip-calculator-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './tank25.js',
  './tank50.js',
  './manifest.json',
  './bismillah.jpg',
  './dev-logo.png',
  './icon-192.png',
  './icon-512.png'
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app files, network-first fallback for everything else (e.g. CDN libs)
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((response) => {
          // Cache a copy of successful same-origin and CDN responses for future offline use
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
          }
          return response;
        })
        .catch(() => {
          // If offline and it's a navigation request, fall back to the cached shell
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
