const CACHE_NAME = 'bastion-pwa-v3';
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/art/icon-192.png',
  '/art/icon-512.png',
  '/art/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws') ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  // Network-first for HTML navigation & manifest so Render deploys arrive immediately
  if (
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((cached) => cached || caches.match('/'))
            .then((fallback) => fallback || Response.error())
        )
    );
    return;
  }

  // Cache-first for Vite content-hashed JS/CSS bundles
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req)
            .then((res) => {
              if (res && res.status === 200) {
                const copy = res.clone();
                caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
              }
              return res;
            })
            .catch(() => Response.error())
      )
    );
    return;
  }

  // Stale-while-revalidate for game art & static icons
  event.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || net;
    })
  );
});
