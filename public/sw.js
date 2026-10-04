// Precaches the whole app at install so it opens with no network (planning on the plane).
// The build (vite.config.js) swaps in every emitted file and a per-build cache name.
// ponytail: no Workbox, a string replace at build time is all this needs.
const ASSETS = [] /*__ASSETS__*/
const CACHE = 'japan-dev' /*__CACHE__*/
const SHELL = ['/', '/index.html', '/manifest.webmanifest', ...ASSETS]

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return

  // Shared data is kept offline by the app itself (src/lib/sync.js), not here.
  if (new URL(request.url).pathname.startsWith('/api/')) return

  // Everything else: cache first, revalidate in the background.
  e.respondWith(
    caches.match(request).then(hit => {
      const live = fetch(request)
        .then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(request, r.clone())); return r })
        .catch(() => hit)
      return hit || live
    })
  )
})
