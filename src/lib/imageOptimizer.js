/**
 * Halo BK SMADA - Pengoptimal URL Media & Cloudinary CDN
 * 
 * Menghemat bandwidth dan kuota penyimpanan dengan:
 * 1. f_auto  : Format generasi baru (WebP / AVIF) otomatis sesuai dukungan browser.
 * 2. q_auto  : Kompresi visual otomatis tanpa menurunkan ketajaman foto.
 * 3. w_{size}: Membatasi dimensi gambar sesuai viewport kartu (menghindari download foto 4K).
 * 4. c_limit : Menjaga rasio aspek foto tanpa cropping berlebih.
 */

export function getOptimizedImageUrl(url, width = 400) {
  if (!url || typeof url !== 'string') return ''

  const cleanUrl = url.trim()

  // 1. Optimasi URL Cloudinary
  if (cleanUrl.includes('res.cloudinary.com') && cleanUrl.includes('/image/upload/')) {
    // Jika sudah ada parameter optimasi, jangan tambahkan duplikat
    if (
      cleanUrl.includes('/upload/f_auto') ||
      cleanUrl.includes('/upload/q_auto') ||
      cleanUrl.includes('/upload/w_')
    ) {
      return cleanUrl
    }

    const transform = `f_auto,q_auto,w_${width},c_limit`
    return cleanUrl.replace('/image/upload/', `/image/upload/${transform}/`)
  }

  // 2. Optimasi URL Unsplash (gambar berita / cover)
  if (cleanUrl.includes('images.unsplash.com')) {
    if (!cleanUrl.includes('auto=format')) {
      const sep = cleanUrl.includes('?') ? '&' : '?'
      return `${cleanUrl}${sep}auto=format&fit=crop&q=80&w=${width}`
    }
  }

  return cleanUrl
}

