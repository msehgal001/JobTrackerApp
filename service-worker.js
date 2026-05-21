// ============================================================
// JOB COMMAND — Service Worker
// Caches the app shell so it works offline; data still requires
// network (or queued for next online sync, which Supabase handles).
// ============================================================

const CACHE_VERSION = 'job-command-v2.5.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS).catch(e => console.warn('SW: precache partial fail', e)))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   - Supabase API calls: network-only (data must be fresh)
//   - Fonts CDN: cache-first
//   - Same-origin: cache-first, fall back to network, fall back to cached index
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache Supabase requests
  if (url.hostname.endsWith('.supabase.co')) {
    return; // default network behavior
  }

  // Google Fonts: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => { cache.put(req, res.clone()); return res; }).catch(() => hit))
      )
    );
    return;
  }

  // Supabase CDN (the JS SDK): cache-first
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => { cache.put(req, res.clone()); return res; }))
      )
    );
    return;
  }

  // Same-origin: cache-first with network fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) {
          // Refresh in background
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(req, res));
          }).catch(() => {});
          return hit;
        }
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
  }
});
