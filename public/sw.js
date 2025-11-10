// Basic offline-first service worker
const CACHE_NAME = 'mwv2-cache-v1';
const CORE_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Bypass for non-GET
  if (req.method !== 'GET') return;
  // Cache-first for same-origin navigations and static files
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
        return res;
      } catch (err) {
        // Optional: return a simple fallback for navigations
        if (req.mode === 'navigate') {
          return caches.match('/') || Response.error();
        }
        throw err;
      }
    })());
  }
});

