const CACHE = 'bauapp-v3'
const GRUND = ['/', '/index.html', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(GRUND)))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const r = e.request
  if (r.method !== 'GET') return
  const url = new URL(r.url)
  const schrift = url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')
  if (url.origin !== self.location.origin && !schrift) return // Supabase nie zwischenspeichern

  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then(res => {
          const kopie = res.clone()
          caches.open(CACHE).then(c => c.put('/index.html', kopie))
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  e.respondWith(
    caches.match(r).then(
      treffer =>
        treffer ||
        fetch(r).then(res => {
          if (res.ok || res.type === 'opaque') {
            const kopie = res.clone()
            caches.open(CACHE).then(c => c.put(r, kopie))
          }
          return res
        })
    )
  )
})
