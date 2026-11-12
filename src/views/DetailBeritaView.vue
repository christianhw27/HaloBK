<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNewsStore } from '@/stores/news'
import { NEWS_CATEGORY_STYLES } from '@/lib/starterNews'
import { slugify, getNewsUrl } from '@/lib/slugify'
import PublicNavbar from '@/components/PublicNavbar.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const newsStore = useNewsStore()

const copiedNotice = ref(false)

// Pencarian artikel berdasarkan ID, slug, atau judul slugified
const article = computed(() => {
  const param = String(route.params.slug || route.params.id || '').trim().toLowerCase()
  if (!param) return null

  // 1. Cocokkan ID persis
  let found = newsStore.newsList.find(n => String(n.id).toLowerCase() === param)
  if (found) return found

  // 2. Cocokkan slug khusus bila tersimpan di database
  found = newsStore.newsList.find(n => n.slug && String(n.slug).toLowerCase() === param)
  if (found) return found

  // 3. Cocokkan slug dari judul berita
  found = newsStore.newsList.find(n => slugify(n.title) === param)
  if (found) return found

  // 4. Pencocokan awalan slug (toleransi URL terpotong)
  found = newsStore.newsList.find(n => {
    const s = slugify(n.title)
    return s.startsWith(param) || param.startsWith(s)
  })
  return found || null
})

const categoryStyle = computed(() => {
  if (!article.value?.category) return NEWS_CATEGORY_STYLES['Pengumuman BK']
  return NEWS_CATEGORY_STYLES[article.value.category] || NEWS_CATEGORY_STYLES['Pengumuman BK']
})

const paragraphs = computed(() => {
  if (!article.value?.content) return []
  return article.value.content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
})

const otherNews = computed(() => {
  if (!article.value) return newsStore.publishedNews.slice(0, 3)
  return newsStore.publishedNews
    .filter(n => String(n.id) !== String(article.value.id))
    .slice(0, 3)
})

function getShareableUrl() {
  if (!article.value) return window.location.href
  const base = window.location.origin
  return base + getNewsUrl(article.value)
}

async function copyArticleLink() {
  const url = getShareableUrl()
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    copiedNotice.value = true
    setTimeout(() => {
      copiedNotice.value = false
    }, 3000)
  } catch (err) {
    console.warn('Gagal menyalin tautan:', err)
  }
}

function shareToWhatsApp() {
  if (!article.value) return
  const url = getShareableUrl()
  const text = encodeURIComponent(`*${article.value.title}*\n\n${article.value.summary || ''}\n\nBaca selengkapnya di Ruang BK Smada:\n${url}`)
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
}

function setMetaTag(attr, key, content) {
  if (typeof document === 'undefined') return
  let element = document.querySelector(`meta[${attr}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content || '')
}

function updatePageMetadata() {
  if (article.value) {
    const title = `${article.value.title} - Ruang BK Smada`
    const description = article.value.summary || 'Kabar terbaru dari Bimbingan Konseling SMA Negeri 2 Ngawi.'
    const url = getShareableUrl()
    const image = article.value.imageUrl || `${window.location.origin}/logo.png`

    document.title = title

    // Perbarui Open Graph meta tags agar thumbnail preview terbaca saat dibagikan
    setMetaTag('property', 'og:title', title)
    setMetaTag('property', 'og:description', description)
    setMetaTag('property', 'og:image', image)
    setMetaTag('property', 'og:url', url)
    setMetaTag('property', 'og:type', 'article')
    setMetaTag('name', 'twitter:card', 'summary_large_image')
    setMetaTag('name', 'twitter:title', title)
    setMetaTag('name', 'twitter:description', description)
    setMetaTag('name', 'twitter:image', image)

    newsStore.incrementViews(article.value.id)
  } else {
    document.title = 'Detail Berita - Ruang BK Smada'
  }
}

// Reading progress & scroll reveal
const scrollProgress = ref(0)
let scrollObserver = null

function handleScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  if (docHeight > 0) {
    scrollProgress.value = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100))
  }
}

function initScrollObserver() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return

  if (scrollObserver) {
    scrollObserver.disconnect()
  }

  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed')
          scrollObserver.unobserve(entry.target)
        }
      })
    },
    {
      threshold: 0.05,
      rootMargin: '0px 0px -20px 0px',
    }
  )

  const elements = document.querySelectorAll('.reveal-on-scroll:not(.is-revealed)')
  elements.forEach((el) => scrollObserver.observe(el))
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()

  if (newsStore.newsList.length === 0) {
    await newsStore.fetchNews()
  }
  updatePageMetadata()

  nextTick(() => {
    initScrollObserver()
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollObserver) scrollObserver.disconnect()
})

watch(() => [route.params.slug, route.params.id], async () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  if (newsStore.newsList.length === 0) {
    await newsStore.fetchNews()
  }
  updatePageMetadata()
  nextTick(() => {
    initScrollObserver()
  })
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#EFF6FF]/90 via-[#F8FAFC] to-[#FFFBEB]/85 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-700 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden relative">
    
    <!-- READING PROGRESS BAR DI ATAS LAYAR -->
    <div
      class="fixed top-0 left-0 right-0 h-[3px] bg-transparent z-[70] pointer-events-none"
      aria-hidden="true"
    >
      <div
        class="h-full bg-gradient-to-r from-[#0284C7] via-amber-400 to-emerald-500 transition-[width] duration-100 ease-out shadow-sm shadow-sky-500/50"
        :style="{ width: `${scrollProgress}%` }"
      ></div>
    </div>

    <!-- NAVBAR RESMI DENGAN 3 MENU: BERITA, AKADEMIK & ALUMNI -->
    <PublicNavbar />

    <!-- NOTIFIKASI TOAST FLOATING SAAT TAUTAN DISALIN -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0"
    >
      <div
        v-if="copiedNotice"
        class="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-sky-600 text-sm font-semibold shadow-2xl flex items-center gap-2.5 border border-slate-700 dark:border-sky-500"
      >
        <i class="fa-solid fa-circle-check text-emerald-400 text-base" aria-hidden="true"></i>
        <span>Tautan berita berhasil disalin ke clipboard!</span>
      </div>
    </Transition>

    <!-- KONTEN UTAMA HALAMAN BERITA -->
    <main class="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      
      <!-- NAVIGASI ATAS: KEMBALI & TOMBOL BAGIKAN -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-sky-100/80 dark:border-slate-800 text-sm">
        <router-link
          to="/"
          class="inline-flex items-center gap-2 font-semibold text-[#0369A1] dark:text-sky-400 hover:underline"
        >
          <i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>
          <span>Kembali ke Semua Berita</span>
        </router-link>

        <div class="flex items-center gap-2">
          <!-- Tombol Salin Tautan (Copy Link) -->
          <button
            type="button"
            @click="copyArticleLink"
            class="px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 shadow-2xs"
            :class="copiedNotice
              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-sky-200/90 dark:border-slate-700 text-[#0369A1] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800'"
            title="Salin link berita ini untuk dibagikan"
          >
            <i :class="copiedNotice ? 'fa-solid fa-check' : 'fa-regular fa-copy'" aria-hidden="true"></i>
            <span>{{ copiedNotice ? 'Tautan Disalin!' : 'Salin Link' }}</span>
          </button>

          <!-- Tombol Bagikan WhatsApp -->
          <button
            type="button"
            @click="shareToWhatsApp"
            class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Bagikan ke WhatsApp"
          >
            <i class="fa-brands fa-whatsapp text-sm" aria-hidden="true"></i>
            <span class="hidden sm:inline">WhatsApp</span>
          </button>
        </div>
      </div>

      <!-- KONDISI LOADING -->
      <div
        v-if="newsStore.isLoading"
        class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3"
      >
        <i class="fa-solid fa-spinner fa-spin text-3xl text-[#0284C7]" aria-hidden="true"></i>
        <p class="text-base font-semibold text-slate-700 dark:text-slate-300">
          Memuat artikel berita...
        </p>
      </div>

      <!-- KONDISI ARTIKEL TIDAK DITEMUKAN -->
      <div
        v-else-if="!article"
        class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center space-y-4 shadow-sm"
      >
        <div class="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-slate-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-2xl">
          <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
        </div>
        <div class="space-y-1">
          <h1 class="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            Artikel Berita Tidak Ditemukan
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Berita yang Anda cari mungkin telah diarsipkan, dihapus, atau tautan yang Anda masukkan kurang tepat.
          </p>
        </div>
        <router-link
          to="/"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-sm shadow-sm transition-colors"
        >
          <i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>
          <span>Kembali ke Halaman Berita</span>
        </router-link>
      </div>

      <!-- KONTEN ARTIKEL LENGKAP -->
      <article v-else class="reveal-on-scroll space-y-6 sm:space-y-8">
        
        <!-- HEADER ARTIKEL: KATEGORI, TANGGAL & METADATA -->
        <header class="space-y-3.5">
          <div class="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <span
              class="px-3 py-1 rounded-full font-semibold border shadow-2xs"
              :class="categoryStyle.badge"
            >
              {{ article.category }}
            </span>
            <span class="text-slate-400" aria-hidden="true">&bull;</span>
            <span class="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <i class="fa-regular fa-calendar text-xs" aria-hidden="true"></i>
              <span>{{ newsStore.formatNewsDate(article.createdAt) }}</span>
            </span>
            <span class="text-slate-400" aria-hidden="true">&bull;</span>
            <span class="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <i class="fa-regular fa-clock text-xs" aria-hidden="true"></i>
              <span>{{ newsStore.estimateReadTime(article.content) }}</span>
            </span>
            <span class="text-slate-400 hidden sm:inline" aria-hidden="true">&bull;</span>
            <span class="text-slate-600 dark:text-slate-400 hidden sm:inline-flex items-center gap-1.5">
              <i class="fa-regular fa-eye text-xs" aria-hidden="true"></i>
              <span>{{ article.views }} kali dibaca</span>
            </span>
          </div>

          <!-- JUDUL UTAMA (H1) -->
          <h1 class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white leading-[1.25] tracking-tight">
            {{ article.title }}
          </h1>

          <!-- INFORMASI PENULIS -->
          <div class="flex items-center gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 pt-1">
            <div class="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950/70 text-[#0369A1] dark:text-sky-300 flex items-center justify-center font-bold text-xs shrink-0">
              <i class="fa-regular fa-user" aria-hidden="true"></i>
            </div>
            <div>
              <span>Ditulis oleh <strong class="text-slate-900 dark:text-slate-100 font-semibold">{{ article.author }}</strong></span>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">Tim Bimbingan Konseling SMA Negeri 2 Ngawi</p>
            </div>
          </div>
        </header>

        <!-- GAMBAR SAMPUL ARTIKEL -->
        <div v-if="article.imageUrl" class="rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md bg-slate-100 dark:bg-slate-800">
          <img
            :src="article.imageUrl"
            :alt="article.title"
            class="w-full max-h-[480px] object-cover"
          />
        </div>

        <!-- CALLOUT RINGKASAN ARTIKEL -->
        <div
          v-if="article.summary"
          class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-sky-50 via-white to-amber-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30 border-l-4 border-[#0284C7] dark:border-sky-400 shadow-2xs"
        >
          <div class="text-xs font-bold uppercase tracking-wider text-[#0369A1] dark:text-sky-300 mb-1 flex items-center gap-1.5">
            <i class="fa-solid fa-quote-left" aria-hidden="true"></i>
            <span>Ringkasan Berita</span>
          </div>
          <p class="text-sm sm:text-base font-medium text-slate-800 dark:text-slate-200 leading-relaxed italic">
            {{ article.summary }}
          </p>
        </div>

        <!-- ISI LENGKAP ARTIKEL BERITA -->
        <div class="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 text-base sm:text-lg leading-relaxed space-y-5">
          <p
            v-for="(para, idx) in paragraphs"
            :key="idx"
            class="text-justify sm:text-left leading-[1.8]"
          >
            {{ para }}
          </p>
        </div>

        <!-- KOTAK BAGIKAN DI AKHIR ARTIKEL -->
        <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="space-y-1 text-center sm:text-left">
            <p class="font-bold text-slate-900 dark:text-white text-base">
              Bagikan Kabar Ini
            </p>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Salin tautan atau bagikan berita ini ke WhatsApp alumni, teman, dan adik kelas.
            </p>
          </div>

          <div class="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              @click="copyArticleLink"
              class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-[#0369A1] hover:text-white dark:hover:bg-[#0369A1] text-[#0369A1] dark:text-sky-200 border border-sky-200/80 dark:border-sky-800 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <i :class="copiedNotice ? 'fa-solid fa-check text-emerald-500' : 'fa-regular fa-copy'" aria-hidden="true"></i>
              <span>{{ copiedNotice ? 'Tautan Disalin!' : 'Salin Tautan' }}</span>
            </button>

            <button
              type="button"
              @click="shareToWhatsApp"
              class="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <i class="fa-brands fa-whatsapp text-base" aria-hidden="true"></i>
              <span>Kirim WA</span>
            </button>
          </div>
        </div>


        <!-- SEKSI KABAR LAINNYA -->
        <section v-if="otherNews.length > 0" class="reveal-on-scroll pt-6 border-t border-sky-100 dark:border-slate-800 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-[#0284C7]" aria-hidden="true"></span>
              <span>Kabar Pilihan Lainnya</span>
            </h2>
            <router-link
              to="/"
              class="text-xs sm:text-sm font-semibold text-[#0369A1] dark:text-sky-400 hover:underline"
            >
              Lihat Semua Berita
            </router-link>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <router-link
              v-for="item in otherNews"
              :key="item.id"
              :to="getNewsUrl(item)"
              class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between group"
            >
              <div class="space-y-2">
                <span
                  class="px-2 py-0.5 rounded text-[11px] font-semibold border"
                  :class="NEWS_CATEGORY_STYLES[item.category]?.badge || 'bg-slate-100 text-slate-700 border-slate-200'"
                >
                  {{ item.category }}
                </span>
                <h3 class="font-display font-semibold text-sm text-slate-900 dark:text-white group-hover:text-[#0369A1] dark:group-hover:text-sky-400 transition-colors line-clamp-2 leading-snug">
                  {{ item.title }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {{ item.summary }}
                </p>
              </div>

              <div class="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>{{ newsStore.formatNewsDate(item.createdAt) }}</span>
                <span class="font-semibold text-[#0369A1] dark:text-sky-400 flex items-center gap-1">
                  <span>Baca</span>
                  <i class="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
                </span>
              </div>
            </router-link>
          </div>
        </section>

      </article>

    </main>

    <!-- FOOTER INSTITUSIONAL (TANPA LOGIN) -->
    <footer class="border-t border-sky-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900 text-[#64748B] dark:text-slate-400 text-sm py-6 px-4 sm:px-6 lg:px-8 mt-12">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div class="space-y-1">
          <p class="font-semibold text-[#0F172A] dark:text-white flex items-center justify-center sm:justify-start gap-2">
            <span>Ruang BK Smada &bull; SMA Negeri 2 Ngawi</span>
          </p>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Jalan Ahmad Yani Tromol Pos 7, Klitik, Kecamatan Geneng, Kabupaten Ngawi, Jawa Timur 63217
          </p>
        </div>

        <div class="text-xs text-slate-500 dark:text-slate-400">
          <span>&copy; 2026 Bimbingan Konseling SMA Negeri 2 Ngawi. Hak cipta dilindungi.</span>
        </div>
      </div>
    </footer>

  </div>
</template>

<style scoped>
/* SCROLL REVEAL ANIMATION */
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
}

.reveal-on-scroll.is-revealed {
  opacity: 1 !important;
  transform: translateY(0) !important;
}
</style>

