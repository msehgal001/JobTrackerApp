// ============================================================
// JOB COMMAND — Service Worker
// Caches the app shell so it works offline; data still requires
// network (or queued for next online sync, which Supabase handles).
// ============================================================

const CACHE_VERSION = 'job-command-v2.6.1';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './resume-builder.css',
  './app.js',
  './resume-builder.js',
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
//   - Same-origin (our HTML/JS/CSS): NETWORK-FIRST so deploys take effect
//     immediately when online; falls back to cache offline.
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

  // Same-origin: network-first so updated code is served as soon as it deploys;
  // cache is updated on every successful fetch and used only when offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
  }
});
