// ============================================================
// Service Worker: Halo BK SMADA Media & Image Cache Engine
// Menghemat kuota penyimpanan & bandwidth Cloudinary/CDN
// ============================================================

const CACHE_NAME = 'halobk-media-cache-v1'

// Aset statis inti yang langsung dicache saat instalasi
const PRECACHE_ASSETS = [
  '/logo.png',
  '/logo.svg'
]

// 1. Install Event: Cache aset statis inti
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

// 2. Activate Event: Hapus versi cache lama
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

// 3. Fetch Event: Strategi Cache-First untuk Semua Gambar & Foto
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Hanya proses HTTP GET request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Identifikasi apakah request merupakan berkas gambar
  const isImageDestination = request.destination === 'image'
  const isImageExtension = /\.(png|jpe?g|webp|svg|gif|avif|ico)(\?.*)?$/i.test(url.pathname)
  const isCdnMedia = url.hostname.includes('cloudinary.com') ||
                     url.hostname.includes('unsplash.com') ||
                     url.pathname.startsWith('/logos/') ||
                     url.pathname === '/logo.png'

  if (isImageDestination || isImageExtension || isCdnMedia) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Cek apakah gambar sudah tersimpan di cache lokal
        const cachedResponse = await cache.match(request)
        if (cachedResponse) {
          // Sajikan langsung dari penyimpanan peramban lokal (0 KB transfer jaringan)
          return cachedResponse
        }

        // Jika belum ada di cache, unduh dari jaringan sekali saja
        try {
          const networkResponse = await fetch(request)
          // Simpan respons valid (HTTP 200 atau Opaque cross-origin CDN) ke dalam cache
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone())
          }
          return networkResponse
        } catch (fetchErr) {
          // Jika offline atau jaringan terputus, kembalikan cache jika ada
          return cachedResponse || new Response('', { status: 408, statusText: 'Request Timeout' })
        }
      })
    )
  }
})

