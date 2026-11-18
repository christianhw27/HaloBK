// ============================================================
// Service Worker: Halo BK SMADA Media & Image Cache Engine v2
// Hanya meng-cache aset gambar same-origin agar tidak memicu
// konflik CSP connect-src / CORS pada CDN eksternal (Cloudinary,
// Supabase Storage, Logo Kampus, Unsplash).
// ============================================================

const CACHE_NAME = 'halobk-media-cache-v2'

// Aset statis inti yang langsung dicache saat instalasi
const PRECACHE_ASSETS = [
  '/logo.png',
  '/logo.svg'
]

// 1. Install Event: Cache aset statis inti & langsung aktifkan v2
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW Cache] Pre-caching asset info:', err)
      })
    })
  )
})

// 2. Activate Event: Hapus versi cache lama (termasuk v1 yang mungkin menyimpan 408)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('halobk-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW Cache] Menghapus cache usang:', name)
            return caches.delete(name)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// 3. Fetch Event: Hanya tangani gambar same-origin (/logo.png, /logos/*)
// Biarkan gambar eksternal (Cloudinary, Supabase, gstatic, Unsplash) dimuat native oleh browser!
self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // PENTING: Jangan intercept gambar cross-origin agar tidak terblokir CSP connect-src atau CORS
  if (url.origin !== self.location.origin) {
    return
  }

  const isLocalImage =
    url.pathname === '/logo.png' ||
    url.pathname === '/logo.svg' ||
    url.pathname.startsWith('/logos/')

  if (isLocalImage) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request)
        if (cachedResponse) {
          return cachedResponse
        }

        try {
          const networkResponse = await fetch(request)
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone())
          }
          return networkResponse
        } catch (fetchErr) {
          return cachedResponse || fetch(request)
        }
      })
    )
  }
})
