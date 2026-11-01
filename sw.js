/**
 * Offline-First Service Worker for Encrypted Trip Countdown Board.
 * Caches core app shell assets on install and serves network-first with cache fallback for vault.json & live-state.json.
 */

const CACHE_NAME = 'trip-countdown-board-v4';

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',
  './js/config.js',
  './js/storage-vault.js',
  './js/crypto-vault.js',
  './js/countdown-engine.js',
  './js/photo-stack.js',
  './js/timeline-renderer.js',
  './js/github-sync.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept GitHub REST API calls; let github-sync.js handle network/offline fallback
  if (url.hostname === 'api.github.com') return;

  // Network-first with cache fallback for live-state.json and vault.json so updates appear immediately when online
  if (url.pathname.endsWith('/live-state.json') || url.pathname.endsWith('/vault.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, clone));
          }
          return response;
        })
        .catch(() => caches.match(url.pathname) || caches.match(request))
    );
    return;
  }

  // Cache-first with background refresh for static app shell assets
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
