// SIMAWAR Service Worker v1
const CACHE_NAME = 'simawar-v1';
const OFFLINE_URL = '/offline.html';

const ASSETS = [
  '/',
  '/index.html',
  '/user.html',
  '/admin.html',
  '/offline.html',
  '/404.html',
  '/css/style.css',
  '/js/config.js',
  '/js/user.js',
  '/js/admin.js',
  '/js/laporan.js',
  '/manifest.json'
];

// Install: cache static assets
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS).catch(err => {
        console.log('[SW] Some assets failed to cache:', err);
        // Cache satu-per-satu agar tidak gagal seluruhnya
        return Promise.all(ASSETS.map(url =>
          cache.add(url).catch(e => console.log('[SW] Failed:', url, e))
        ));
      })
    )
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first untuk API, cache-first untuk static
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip supabase/external API - selalu network
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('cloudflare') ||
      url.hostname.includes('jsdelivr') ||
      url.hostname.includes('cdn')) {
    e.respondWith(
      fetch(request).catch(() => {
        // Jika API fail dan ini navigation, tampilkan offline
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }, status: 503
        });
      })
    );
    return;
  }

  // Untuk navigasi (HTML pages): network-first, fallback ke cache/offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          // Cache halaman valid (200)
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      }).catch(() => {
        // Jika asset gagal dan ini gambar, return placeholder
        if (request.destination === 'image') {
          return new Response('', { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
