/**
 * Utility untuk membuat slug URL yang ramah SEO dan mudah dibaca manusia.
 * Contoh: "Pendataan Tracer Study Alumni SMADA" -> "pendataan-tracer-study-alumni-smada"
 */
export function slugify(text) {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Hapus karakter aksen jika ada
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '') // Hapus simbol aneh, pertahankan huruf, angka, spasi, strip
    .replace(/[\s_-]+/g, '-')   // Ganti spasi & underscore berulang dengan satu strip
    .replace(/^-+|-+$/g, '')    // Hapus strip di awal atau akhir
}

/**
 * Menghasilkan URL lengkap berita dengan slug judul ramah SEO.
 * @param {Object} item Objek berita
 * @returns {string} URL rute Vue
 */
export function getNewsUrl(item) {
  if (!item) return '/'
  const slug = item.slug || slugify(item.title)
  return `/berita/${slug || item.id}`
}

