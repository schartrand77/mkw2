// Basic offline-first service worker
const CACHE_NAME = 'mwv2-cache-v2';
const CORE_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.webmanifest'
];
const STATIC_DESTINATIONS = new Set(['style', 'script', 'image', 'font', 'worker']);
const STATIC_PATH_PREFIXES = ['/_next/static/', '/_next/image', '/files/', '/fonts/', '/icons/', '/public/'];

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
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Let normal navigation flows hit the network so server redirects/auth work.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  if (!shouldCache(req, url)) return;

  event.respondWith(cacheFirst(req));
});

function shouldCache(req, url) {
  if (CORE_ASSETS.includes(url.pathname)) return true;
  if (STATIC_DESTINATIONS.has(req.destination)) return true;
  if (STATIC_PATH_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) return true;
  return false;
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type !== 'opaqueredirect' && res.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const fallback = await caches.match('/');
    if (fallback) return fallback;
    throw err;
  }
}
