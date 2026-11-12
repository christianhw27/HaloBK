<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import { useNewsStore } from '@/stores/news'
import { NEWS_CATEGORIES, NEWS_CATEGORY_STYLES } from '@/lib/starterNews'
import { getNewsUrl } from '@/lib/slugify'
import PublicNavbar from '@/components/PublicNavbar.vue'

const authStore = useAuthStore()
const alumniStore = useAlumniStore()
const newsStore = useNewsStore()

// State Interaktif & Immersive
const scrollProgress = ref(0)
const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimeout = null

// Fitur Simpan / Bookmark Berita (localStorage)
const savedBookmarks = ref(new Set())
const onlySaved = ref(false)

function loadBookmarks() {
  try {
    const raw = localStorage.getItem('smada_saved_news')
    if (raw) {
      savedBookmarks.value = new Set(JSON.parse(raw))
    }
  } catch (e) {
    savedBookmarks.value = new Set()
  }
}

function toggleBookmark(newsId) {
  if (savedBookmarks.value.has(newsId)) {
    savedBookmarks.value.delete(newsId)
    showToast('Berita dihapus dari daftar tersimpan')
  } else {
    savedBookmarks.value.add(newsId)
    showToast('Berita disimpan ke daftar baca nanti ⭐')
  }
  try {
    localStorage.setItem('smada_saved_news', JSON.stringify([...savedBookmarks.value]))
  } catch (e) {
    // Abaikan jika storage penuh
  }
}

function isBookmarked(newsId) {
  return savedBookmarks.value.has(newsId)
}

// Fitur Salin Tautan (Share)
function copyNewsLink(item) {
  const url = window.location.origin + getNewsUrl(item)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Tautan berita berhasil disalin ke clipboard! 📋'))
      .catch(() => showToast('Gagal menyalin tautan'))
  } else {
    showToast('Tautan: ' + url)
  }
}

function showToast(msg) {
  toastMessage.value = msg
  toastVisible.value = true
  if (toastTimeout) clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => {
    toastVisible.value = false
  }, 2600)
}

// Indikator Scroll Progress
function handleScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  if (docHeight > 0) {
    scrollProgress.value = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100))
  }
}

// Scroll Reveal Animation (IntersectionObserver)
let scrollObserver = null

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

// Jumlah berita per kategori
function getCategoryCount(category) {
  if (category === 'ALL') {
    return newsStore.publishedNews.length
  }
  return newsStore.publishedNews.filter((n) => n.category === category).length
}

// Daftar berita yang ditampilkan (termasuk filter bookmark)
const displayedNews = computed(() => {
  let list = newsStore.filteredPublishedNews
  if (onlySaved.value) {
    list = list.filter((n) => savedBookmarks.value.has(n.id))
  }
  return list
})

function selectCategory(cat) {
  onlySaved.value = false
  newsStore.selectedCategory = cat
}

function toggleSavedFilter() {
  onlySaved.value = !onlySaved.value
}

function clearSearch() {
  newsStore.searchQuery = ''
}

function resetNewsFilters() {
  onlySaved.value = false
  newsStore.selectedCategory = 'ALL'
  newsStore.searchQuery = ''
}

function getCategoryStyle(category) {
  return NEWS_CATEGORY_STYLES[category] || NEWS_CATEGORY_STYLES['Pengumuman BK']
}

onMounted(() => {
  newsStore.fetchNews()
  alumniStore.fetchData()
  loadBookmarks()

  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()

  nextTick(() => {
    initScrollObserver()
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollObserver) scrollObserver.disconnect()
  if (toastTimeout) clearTimeout(toastTimeout)
})

watch(
  () => [newsStore.isLoading, displayedNews.value.length, newsStore.selectedCategory, onlySaved.value],
  () => {
    nextTick(() => {
      initScrollObserver()
    })
  }
)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#EFF6FF]/90 via-[#F8FAFC] to-[#FFFBEB]/85 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-700 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden relative">
    
    <!-- READING PROGRESS BAR (GLOWING GRADIENT DI ATAS LAYAR) -->
    <div
      class="fixed top-0 left-0 right-0 h-[3px] bg-transparent z-[70] pointer-events-none"
      aria-hidden="true"
    >
      <div
        class="h-full bg-gradient-to-r from-[#0284C7] via-amber-400 to-emerald-500 transition-[width] duration-100 ease-out shadow-sm shadow-sky-500/50"
        :style="{ width: `${scrollProgress}%` }"
      ></div>
    </div>

    <!-- Tautan Aksesibilitas Skip to Content -->
    <a
      href="#portal-main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#0369A1] text-white font-semibold rounded-xl shadow-lg"
    >
      Lewati ke konten berita
    </a>

    <!-- NAVBAR RESMI DENGAN 3 MENU UTAMA: BERITA, AKADEMIK & ALUMNI -->
    <PublicNavbar />

    <!-- STRIP INFORMASI CEPAT: RUNNING TEXT (TICKER) MARQUEE -->
    <section aria-label="Informasi Terkini Berjalan" class="bg-gradient-to-r from-[#FEF3C7]/90 via-[#FFFBEB] to-[#E0F2FE]/90 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/70 border-b border-amber-200/80 dark:border-slate-800 text-[#334155] dark:text-slate-200 overflow-hidden shadow-xs">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
        
        <!-- BADGE INFO TERKINI (Tanpa tombol edit di dashboard) -->
        <div class="flex items-center gap-2 shrink-0 z-20">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-[#F59E0B] text-slate-950 border border-amber-400 dark:bg-amber-500 dark:text-slate-950 font-bold text-[11px] sm:text-xs uppercase tracking-wider shadow-xs">
            <span class="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            <span>Info Terkini</span>
          </span>
        </div>

        <!-- CONTAINER TEKS BERJALAN (MARQUEE) -->
        <div
          class="relative flex-1 overflow-hidden min-w-0 flex items-center select-none py-0.5"
          title="Arahkan kursor atau sentuh untuk menjeda teks"
        >
          <!-- Fade Gradien Samping -->
          <div class="pointer-events-none absolute left-0 top-0 bottom-0 w-3 sm:w-6 bg-gradient-to-r from-[#FFFBEB] dark:from-slate-900 to-transparent z-10"></div>
          <div class="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-l from-[#FFFBEB] dark:from-slate-900 to-transparent z-10"></div>

          <!-- Seamless Looping Marquee Track Otomatis Berjalan -->
          <div class="running-ticker-track text-xs sm:text-sm font-medium text-[#0F172A] dark:text-slate-100">
            <div class="flex items-center shrink-0 pr-12">
              <span>{{ newsStore.tickerText }}</span>
            </div>
            <div class="flex items-center shrink-0 pr-12" aria-hidden="true">
              <span>{{ newsStore.tickerText }}</span>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- AMBIENT GLOW LATAR BELAKANG HERO (DEPTH & LIGHTING) -->
    <div class="absolute top-28 left-1/4 w-[420px] h-[420px] bg-sky-400/10 dark:bg-sky-500/5 rounded-full blur-3xl pointer-events-none -z-10" aria-hidden="true"></div>
    <div class="absolute top-52 right-12 w-[360px] h-[360px] bg-amber-300/10 dark:bg-amber-500/5 rounded-full blur-3xl pointer-events-none -z-10" aria-hidden="true"></div>

    <!-- KONTEN UTAMA PORTAL BERITA -->
    <main id="portal-main" class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-12">
      
      <!-- SEKSI 1: LEAD STORY + AKSES TRACER STUDY (SPLIT EDITORIAL) -->
      <section id="berita-utama" class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start" aria-label="Sorotan Berita Utama">
        
        <!-- KOLOM KIRI (8/12): BERITA UTAMA -->
        <div class="lg:col-span-8 min-w-0">
          <!-- Loading State -->
          <div
            v-if="newsStore.isLoading"
            class="rounded-3xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 p-8 sm:p-12 text-center space-y-3 shadow-md"
          >
            <i class="fa-solid fa-spinner fa-spin text-2xl text-[#0284C7]" aria-hidden="true"></i>
            <p class="text-sm font-semibold text-[#334155] dark:text-slate-300">
              Memuat kabar terbaru dari ruang Bimbingan Konseling...
            </p>
          </div>

          <!-- Artikel Utama (Headline) dengan Scroll Reveal & Hover Depth -->
          <article
            v-else-if="newsStore.featuredNews"
            class="reveal-on-scroll rounded-3xl bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
            :class="getCategoryStyle(newsStore.featuredNews.category).cardTop"
          >
            <!-- Visual Sampul Artikel Utama -->
            <router-link
              v-if="newsStore.featuredNews.imageUrl"
              :to="getNewsUrl(newsStore.featuredNews)"
              class="relative block w-full aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-[#E2E8F0] dark:border-slate-800 group"
            >
              <img
                :src="newsStore.featuredNews.imageUrl"
                :alt="newsStore.featuredNews.title"
                width="960"
                height="540"
                fetchpriority="high"
                class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
              
              <!-- Badge Sorotan Utama di atas Gambar -->
              <span class="absolute top-4 left-4 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md">
                <i class="fa-solid fa-star text-[11px]" aria-hidden="true"></i>
                <span>Sorotan Utama</span>
              </span>
            </router-link>

            <!-- Sampul Cerah Harmonis Jika Tanpa Gambar -->
            <router-link
              v-else
              :to="getNewsUrl(newsStore.featuredNews)"
              class="block w-full aspect-[16/8] bg-gradient-to-br p-6 sm:p-9 flex flex-col justify-between border-b border-[#E2E8F0] dark:border-slate-800 relative overflow-hidden"
              :class="getCategoryStyle(newsStore.featuredNews.category).surface"
            >
              <div class="flex items-center justify-between gap-2 relative z-10">
                <span
                  class="px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-xs"
                  :class="getCategoryStyle(newsStore.featuredNews.category).badge"
                >
                  {{ newsStore.featuredNews.category }}
                </span>
                <span class="px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] border border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                  <i class="fa-solid fa-star text-xs" aria-hidden="true"></i>
                  <span>Sorotan Utama</span>
                </span>
              </div>

              <div class="flex items-end justify-between gap-4 pt-6 relative z-10">
                <div class="space-y-1">
                  <span class="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-300">
                    Buletin Bimbingan Konseling
                  </span>
                  <p class="font-display font-bold text-lg sm:text-2xl text-[#0F172A] dark:text-white">
                    SMA Negeri 2 Ngawi
                  </p>
                </div>
                <div
                  class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-sm"
                  :class="[getCategoryStyle(newsStore.featuredNews.category).iconBg, getCategoryStyle(newsStore.featuredNews.category).accentText]"
                >
                  <i :class="getCategoryStyle(newsStore.featuredNews.category).icon" aria-hidden="true"></i>
                </div>
              </div>
            </router-link>

            <!-- Konten Berita Utama -->
            <div class="p-6 sm:p-8 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm">
                  <span
                    class="px-2.5 py-0.5 rounded-md font-semibold border"
                    :class="getCategoryStyle(newsStore.featuredNews.category).badge"
                  >
                    {{ newsStore.featuredNews.category }}
                  </span>
                  <span class="text-[#64748B] dark:text-slate-400">
                    {{ newsStore.formatNewsDate(newsStore.featuredNews.createdAt) }}
                  </span>
                  <span class="text-slate-400" aria-hidden="true">&bull;</span>
                  <span class="text-[#64748B] dark:text-slate-400">
                    {{ newsStore.estimateReadTime(newsStore.featuredNews.content) }}
                  </span>
                </div>

                <!-- Tombol Aksi Cepat: Simpan & Salin Tautan -->
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    @click.stop="toggleBookmark(newsStore.featuredNews.id)"
                    class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-amber-500 hover:border-amber-300 dark:hover:text-amber-300 flex items-center justify-center transition-colors"
                    :title="isBookmarked(newsStore.featuredNews.id) ? 'Hapus dari tersimpan' : 'Simpan berita'"
                  >
                    <i :class="isBookmarked(newsStore.featuredNews.id) ? 'fa-solid fa-bookmark text-amber-500' : 'fa-regular fa-bookmark'" class="text-sm"></i>
                  </button>
                  <button
                    type="button"
                    @click.stop="copyNewsLink(newsStore.featuredNews)"
                    class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-[#0284C7] hover:border-sky-300 dark:hover:text-sky-300 flex items-center justify-center transition-colors"
                    title="Salin tautan berita"
                  >
                    <i class="fa-regular fa-share-from-square text-sm"></i>
                  </button>
                </div>
              </div>

              <h1 class="font-display font-bold text-2xl sm:text-[1.75rem] lg:text-[2.1rem] text-[#0F172A] dark:text-white leading-[1.25] tracking-tight">
                <router-link
                  :to="getNewsUrl(newsStore.featuredNews)"
                  class="hover:text-[#0369A1] dark:hover:text-sky-400 transition-colors"
                >
                  {{ newsStore.featuredNews.title }}
                </router-link>
              </h1>

              <p class="text-base sm:text-lg text-[#334155] dark:text-slate-300 leading-[1.6]">
                {{ newsStore.featuredNews.summary }}
              </p>

              <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="text-sm text-[#64748B] dark:text-slate-400 flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950 text-[#0284C7] dark:text-sky-300 flex items-center justify-center text-xs font-bold">
                    BK
                  </div>
                  <span>Ditulis oleh <strong class="text-[#0F172A] dark:text-slate-200">{{ newsStore.featuredNews.author }}</strong></span>
                </div>

                <router-link
                  :to="getNewsUrl(newsStore.featuredNews)"
                  class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0369A1] to-[#0284C7] hover:from-[#075985] hover:to-[#0369A1] text-white text-sm sm:text-base font-semibold transition-all duration-150 inline-flex items-center justify-center gap-2 min-h-[44px] shadow-sm group/btn"
                >
                  <span>Baca Berita Selengkapnya</span>
                  <i class="fa-solid fa-arrow-right text-xs group-hover/btn:translate-x-1 transition-transform" aria-hidden="true"></i>
                </router-link>
              </div>
            </div>
          </article>

          <!-- Empty State Jika Belum Ada Berita Sama Sekali -->
          <div
            v-else
            class="rounded-3xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 p-8 sm:p-12 text-center space-y-4 shadow-sm"
          >
            <div class="w-14 h-14 rounded-2xl bg-[#E0F2FE] dark:bg-slate-800 text-[#0369A1] dark:text-sky-400 flex items-center justify-center mx-auto text-2xl">
              <i class="fa-regular fa-newspaper" aria-hidden="true"></i>
            </div>
            <div class="space-y-1.5 max-w-md mx-auto">
              <h1 class="font-display font-bold text-2xl sm:text-3xl text-[#0F172A] dark:text-white leading-[1.3]">
                Portal Informasi BK SMA Negeri 2 Ngawi
              </h1>
              <p class="text-sm sm:text-base text-[#334155] dark:text-slate-400 leading-[1.6]">
                Belum ada artikel berita yang diterbitkan saat ini. Kunjungi kembali secara berkala untuk update informasi terbaru.
              </p>
            </div>
          </div>
        </div>

        <!-- KOLOM KANAN (4/12): WIDGET TRACER STUDY & KABAR PILIHAN -->
        <aside class="lg:col-span-4 space-y-6 min-w-0">
          
          <!-- Kartu Pintu Masuk Tracer Study Interaktif -->
          <div class="reveal-on-scroll rounded-3xl bg-gradient-to-br from-[#E0F2FE]/80 via-white to-[#FEF3C7]/70 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/40 border border-sky-200/80 dark:border-slate-800 overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
            <div class="h-1.5 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981]" aria-hidden="true"></div>

            <div class="p-6 space-y-5">
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#FEF3C7] to-[#FFE4E6] text-[#92400E] border border-amber-200/80 dark:from-amber-950/60 dark:to-rose-950/60 dark:text-amber-300 dark:border-amber-800">
                    <i class="fa-solid fa-star text-[11px]" aria-hidden="true"></i>
                    <span>Ruang Alumni SMADA</span>
                  </span>
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Data
                  </span>
                </div>
                <h2 class="font-display font-bold text-xl sm:text-2xl text-[#0F172A] dark:text-white leading-[1.35]">
                  Jejak &amp; Cerita Alumni SMADA
                </h2>
                <p class="text-sm sm:text-base text-[#334155] dark:text-slate-300 leading-[1.6]">
                  Intip serunya perjalanan kuliah dan karir kakak kelas SMA Negeri 2 Ngawi di sini.
                </p>
              </div>

              <!-- Statistik Riil dari Store Alumni -->
              <div class="grid grid-cols-2 gap-3 pt-1">
                <div class="p-3.5 rounded-2xl bg-white/95 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 shadow-xs hover:border-sky-400 transition-colors">
                  <div class="text-xs sm:text-sm font-semibold text-[#0369A1] dark:text-sky-300">Alumni Terdata</div>
                  <div class="font-display font-bold text-2xl text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                    {{ alumniStore.statistics.total }}
                  </div>
                </div>
                <div class="p-3.5 rounded-2xl bg-white/95 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs hover:border-emerald-400 transition-colors">
                  <div class="text-xs sm:text-sm font-semibold text-[#047857] dark:text-emerald-300">Kuliah PTN &amp; PTS</div>
                  <div class="font-display font-bold text-2xl text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                    {{ alumniStore.statistics.ptnCount + alumniStore.statistics.ptsCount }}
                  </div>
                </div>
              </div>

              <!-- CTA Button Langsung ke Dashboard Tracer Study -->
              <router-link
                to="/dashboard"
                class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#075985] hover:from-[#0369A1] hover:to-[#0c4a6e] text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all group"
              >
                <span>Buka Dashboard Tracer Study</span>
                <i class="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
              </router-link>

              <p class="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                Dihimpun resmi oleh tim Bimbingan Konseling SMA Negeri 2 Ngawi.
              </p>
            </div>
          </div>

          <!-- Daftar Sorotan Sekunder Bernomor (Editorial Index) -->
          <div
            v-if="newsStore.secondaryHighlights.length > 0"
            class="reveal-on-scroll rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-800 p-5 sm:p-6 space-y-4 shadow-md"
          >
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 class="font-display font-bold text-lg text-[#0F172A] dark:text-white flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" aria-hidden="true"></span>
                <span>Kabar Pilihan Lainnya</span>
              </h2>
              <a href="#arsip-berita" class="text-xs sm:text-sm font-semibold text-[#0369A1] dark:text-sky-400 hover:underline">
                Lihat Semua
              </a>
            </div>

            <div class="divide-y divide-slate-100 dark:divide-slate-800">
              <router-link
                v-for="(item, idx) in newsStore.secondaryHighlights"
                :key="item.id"
                :to="getNewsUrl(item)"
                class="w-full text-left py-3.5 first:pt-1 last:pb-1 flex items-start gap-3.5 group block transition-all"
              >
                <span
                  class="w-8 h-8 rounded-xl font-display font-extrabold text-sm flex items-center justify-center tabular-nums shrink-0 mt-0.5 transition-transform duration-150 group-hover:scale-110 shadow-2xs"
                  :class="[
                    'bg-[#E0F2FE] text-[#0369A1] dark:bg-sky-900/60 dark:text-sky-300',
                    'bg-[#D1FAE5] text-[#047857] dark:bg-emerald-900/60 dark:text-emerald-300',
                    'bg-[#FEF3C7] text-[#92400E] dark:bg-amber-900/60 dark:text-amber-300',
                    'bg-[#FFE4E6] text-[#BE123C] dark:bg-rose-900/60 dark:text-rose-300'
                  ][idx % 4]"
                >
                  0{{ idx + 1 }}
                </span>
                <div class="min-w-0 space-y-1">
                  <div class="text-xs font-semibold" :class="getCategoryStyle(item.category).accentText">
                    {{ item.category }}
                  </div>
                  <h3 class="font-display font-semibold text-sm sm:text-base text-[#0F172A] dark:text-slate-100 group-hover:text-[#0369A1] dark:group-hover:text-sky-400 transition-colors line-clamp-2 leading-snug">
                    {{ item.title }}
                  </h3>
                  <div class="text-xs text-[#64748B] dark:text-slate-400">
                    {{ newsStore.formatNewsDate(item.createdAt) }}
                  </div>
                </div>
              </router-link>
            </div>
          </div>

        </aside>
      </section>

      <!-- SEKSI 2: FILTER KATEGORI & ARSIP GRID BERITA -->
      <section id="arsip-berita" class="space-y-6 pt-5 border-t border-sky-200/70 dark:border-slate-800" aria-labelledby="archive-heading">
        
        <div class="reveal-on-scroll flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 id="archive-heading" class="font-display font-bold text-xl sm:text-2xl text-[#0F172A] dark:text-white leading-[1.35] tracking-tight">
              Cerita &amp; Kabar Hangat SMADA
            </h2>
            <p class="text-sm sm:text-base text-[#64748B] dark:text-slate-400 mt-1 leading-[1.5]">
              Kumpulan pengumuman sekolah, tips masuk kampus impian, beasiswa, dan kabar alumni.
            </p>
          </div>

          <!-- Pencarian Berita Interaktif -->
          <div class="w-full md:w-80 relative">
            <label for="public-news-search" class="sr-only">Cari berita atau pengumuman</label>
            <i class="fa-solid fa-magnifying-glass text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true"></i>
            <input
              id="public-news-search"
              v-model="newsStore.searchQuery"
              type="search"
              placeholder="Cari judul, kata kunci, topik..."
              class="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 text-sm sm:text-base text-[#0F172A] dark:text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all shadow-2xs"
            />
            <!-- Tombol Hapus Query Pencarian -->
            <button
              v-if="newsStore.searchQuery"
              type="button"
              @click="clearSearch"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Bersihkan pencarian"
              aria-label="Bersihkan pencarian"
            >
              <i class="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
        </div>

        <!-- Tabs Filter Kategori (Dengan Indikator Jumlah & Tab Tersimpan) -->
        <div class="reveal-on-scroll flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter kategori berita">
          <!-- Tab Semua Berita -->
          <button
            type="button"
            role="tab"
            :aria-selected="!onlySaved && newsStore.selectedCategory === 'ALL'"
            @click="selectCategory('ALL')"
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 min-h-[40px] inline-flex items-center gap-2"
            :class="!onlySaved && newsStore.selectedCategory === 'ALL'
              ? 'bg-[#0369A1] text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-[#334155] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-800 hover:bg-sky-50/70 dark:hover:bg-slate-800'"
          >
            <span>Semua Berita</span>
            <span
              class="text-[11px] px-2 py-0.2 rounded-full font-bold tabular-nums"
              :class="!onlySaved && newsStore.selectedCategory === 'ALL'
                ? 'bg-sky-800 text-sky-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'"
            >
              {{ getCategoryCount('ALL') }}
            </span>
          </button>

          <!-- Tab Per Kategori -->
          <button
            v-for="cat in NEWS_CATEGORIES"
            :key="cat"
            type="button"
            role="tab"
            :aria-selected="!onlySaved && newsStore.selectedCategory === cat"
            @click="selectCategory(cat)"
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 min-h-[40px] inline-flex items-center gap-2"
            :class="!onlySaved && newsStore.selectedCategory === cat
              ? getCategoryStyle(cat).activeTab + ' shadow-md'
              : 'bg-white dark:bg-slate-900 text-[#334155] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-800 hover:bg-[#F1F5F9] dark:hover:bg-slate-800'"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="!onlySaved && newsStore.selectedCategory === cat ? 'bg-current opacity-85' : getCategoryStyle(cat).dot"
              aria-hidden="true"
            ></span>
            <span>{{ cat }}</span>
            <span
              class="text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums"
              :class="!onlySaved && newsStore.selectedCategory === cat
                ? 'bg-black/15 text-current'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'"
            >
              {{ getCategoryCount(cat) }}
            </span>
          </button>

          <!-- Tab Khusus Berita Tersimpan (Bookmark) jika ada -->
          <button
            v-if="savedBookmarks.size > 0"
            type="button"
            role="tab"
            :aria-selected="onlySaved"
            @click="toggleSavedFilter"
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 min-h-[40px] inline-flex items-center gap-2 ml-auto"
            :class="onlySaved
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'"
          >
            <i class="fa-solid fa-bookmark text-xs"></i>
            <span>Disimpan</span>
            <span class="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-amber-400/80 text-amber-950 tabular-nums">
              {{ savedBookmarks.size }}
            </span>
          </button>
        </div>

        <!-- Info Hasil Filter / Pencarian Aktif -->
        <div
          v-if="newsStore.searchQuery || onlySaved || newsStore.selectedCategory !== 'ALL'"
          class="flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 px-1"
        >
          <span>
            Menampilkan <strong class="text-slate-900 dark:text-white">{{ displayedNews.length }}</strong> berita
            <span v-if="newsStore.searchQuery">untuk kata kunci "<em>{{ newsStore.searchQuery }}</em>"</span>
            <span v-if="onlySaved">yang Anda simpan</span>
          </span>
          <button
            type="button"
            @click="resetNewsFilters"
            class="text-[#0284C7] dark:text-sky-400 font-semibold hover:underline flex items-center gap-1"
          >
            <i class="fa-solid fa-rotate-left text-xs"></i>
            <span>Reset filter</span>
          </button>
        </div>

        <!-- Error State -->
        <div
          v-if="newsStore.errorMessage"
          role="alert"
          class="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-[#BE123C] dark:text-rose-200 text-sm sm:text-base flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2.5">
            <i class="fa-solid fa-circle-exclamation text-[#E11D48]" aria-hidden="true"></i>
            <span>{{ newsStore.errorMessage }}</span>
          </div>
          <button
            type="button"
            @click="newsStore.fetchNews()"
            class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold self-start sm:self-auto"
          >
            Muat Ulang
          </button>
        </div>

        <!-- Grid Kartu Berita dengan Scroll Reveal & Stagger Animation -->
        <div
          v-if="displayedNews.length > 0"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <article
            v-for="(item, idx) in displayedNews"
            :key="item.id"
            class="reveal-on-scroll rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group"
            :class="getCategoryStyle(item.category).cardTop"
            :style="{ '--stagger': (idx % 6) + 1 }"
          >
            <div>
              <!-- Gambar Cover atau Placeholder Kategori Cerah -->
              <router-link
                v-if="item.imageUrl"
                :to="getNewsUrl(item)"
                class="relative block w-full aspect-[16/10] bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-slate-100 dark:border-slate-800 group"
              >
                <img
                  :src="item.imageUrl"
                  :alt="item.title"
                  width="640"
                  height="400"
                  loading="lazy"
                  class="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </router-link>

              <router-link
                v-else
                :to="getNewsUrl(item)"
                class="block w-full aspect-[16/9] bg-gradient-to-br p-5 flex flex-col justify-between border-b border-[#E2E8F0] dark:border-slate-800 relative overflow-hidden"
                :class="getCategoryStyle(item.category).surface"
              >
                <div class="flex items-center justify-between gap-2 relative z-10">
                  <span
                    class="text-xs font-semibold px-2.5 py-0.5 rounded-full border backdrop-blur-xs"
                    :class="getCategoryStyle(item.category).badge"
                  >
                    {{ item.category }}
                  </span>
                  <div
                    class="w-8 h-8 rounded-lg border flex items-center justify-center shadow-xs"
                    :class="[getCategoryStyle(item.category).iconBg, getCategoryStyle(item.category).accentText]"
                  >
                    <i :class="getCategoryStyle(item.category).icon" class="text-sm" aria-hidden="true"></i>
                  </div>
                </div>
                <span class="text-xs font-medium text-[#64748B] dark:text-slate-300 relative z-10">
                  Buletin BK SMA Negeri 2 Ngawi
                </span>
              </router-link>

              <div class="p-5 space-y-3">
                <div class="flex items-center justify-between gap-2 text-xs sm:text-sm text-[#64748B] dark:text-slate-400">
                  <div class="flex items-center gap-2">
                    <span>{{ newsStore.formatNewsDate(item.createdAt) }}</span>
                    <span>&bull;</span>
                    <span>{{ newsStore.estimateReadTime(item.content) }}</span>
                  </div>

                  <!-- Aksi Cepat Kartu: Bookmark & Share -->
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      @click.prevent.stop="toggleBookmark(item.id)"
                      class="w-7 h-7 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                      :title="isBookmarked(item.id) ? 'Hapus bookmark' : 'Simpan artikel'"
                    >
                      <i :class="isBookmarked(item.id) ? 'fa-solid fa-bookmark text-amber-500' : 'fa-regular fa-bookmark'" class="text-xs"></i>
                    </button>
                    <button
                      type="button"
                      @click.prevent.stop="copyNewsLink(item)"
                      class="w-7 h-7 rounded-lg text-slate-400 hover:text-[#0284C7] hover:bg-sky-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                      title="Salin tautan artikel"
                    >
                      <i class="fa-regular fa-share-from-square text-xs"></i>
                    </button>
                  </div>
                </div>

                <h3 class="font-display font-semibold text-lg sm:text-xl text-[#0F172A] dark:text-white leading-[1.4] line-clamp-2">
                  <router-link
                    :to="getNewsUrl(item)"
                    class="hover:text-[#0369A1] dark:hover:text-sky-400 transition-colors"
                  >
                    {{ item.title }}
                  </router-link>
                </h3>

                <p class="text-sm sm:text-base text-[#334155] dark:text-slate-300 leading-[1.6] line-clamp-3">
                  {{ item.summary }}
                </p>
              </div>
            </div>

            <div class="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <span class="text-xs sm:text-sm font-medium text-[#64748B] dark:text-slate-400 truncate">
                {{ item.author }}
              </span>

              <router-link
                :to="getNewsUrl(item)"
                class="px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200/80 dark:border-sky-800 hover:bg-[#0369A1] hover:text-white dark:hover:bg-[#0369A1] text-[#0369A1] dark:text-sky-200 text-sm font-semibold transition-all duration-150 shrink-0 min-h-[40px] inline-flex items-center gap-1.5 group/btn"
              >
                <span>Baca Artikel</span>
                <i class="fa-solid fa-arrow-right text-xs group-hover/btn:translate-x-1 transition-transform" aria-hidden="true"></i>
              </router-link>
            </div>
          </article>
        </div>

        <!-- Empty State Arsip Berita (Tanpa tombol Kelola Berita) -->
        <div
          v-else-if="!newsStore.isLoading"
          class="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 text-center space-y-4 shadow-sm"
        >
          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
            <i class="fa-solid fa-magnifying-glass"></i>
          </div>
          <div class="space-y-1">
            <p class="font-bold text-base text-[#0F172A] dark:text-slate-200">
              {{ onlySaved ? 'Belum ada berita yang Anda simpan.' : ((newsStore.selectedCategory !== 'ALL' || newsStore.searchQuery) ? 'Tidak ada berita yang sesuai dengan filter atau kata kunci Anda.' : 'Belum ada berita tambahan di luar sorotan utama.') }}
            </p>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {{ onlySaved ? 'Klik ikon bookmark pada artikel mana saja untuk menyimpannya ke daftar ini.' : 'Coba gunakan kata kunci lain atau tampilkan seluruh kategori berita.' }}
            </p>
          </div>
          <div class="flex items-center justify-center gap-3 pt-2">
            <button
              v-if="newsStore.selectedCategory !== 'ALL' || newsStore.searchQuery || onlySaved"
              type="button"
              @click="resetNewsFilters"
              class="px-4 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold min-h-[40px] transition-colors shadow-sm"
            >
              Tampilkan Semua Berita
            </button>
          </div>
        </div>

      </section>

    </main>

    <!-- FLOATING TOAST NOTIFICATION (SALIN TAUTAN & BOOKMARK) -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-3 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-3 scale-95"
    >
      <div
        v-if="toastVisible"
        class="fixed bottom-6 right-6 z-[80] flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 shadow-2xl backdrop-blur-md border border-slate-700/50 dark:border-slate-200 text-xs sm:text-sm font-semibold pointer-events-none"
        role="status"
        aria-live="polite"
      >
        <div class="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 text-xs">
          <i class="fa-solid fa-check"></i>
        </div>
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- FOOTER INSTITUSIONAL -->
    <footer class="border-t border-sky-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900 text-[#64748B] dark:text-slate-400 text-sm py-6 px-4 sm:px-6 lg:px-8">
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
/* Continuous Marquee Ticker */
@keyframes continuous-marquee-scroll {
  0% {
    transform: translate3d(0, 0, 0);
  }
  100% {
    transform: translate3d(-50%, 0, 0);
  }
}

.running-ticker-track {
  display: inline-flex !important;
  width: max-content !important;
  white-space: nowrap !important;
  will-change: transform;
  animation: continuous-marquee-scroll 28s linear infinite !important;
}

.running-ticker-track:hover {
  animation-play-state: paused !important;
}

/* SCROLL REVEAL ANIMATION */
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(32px) scale(0.985);
  transition: opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
  transition-delay: calc(var(--stagger, 0) * 80ms);
}

.reveal-on-scroll.is-revealed {
  opacity: 1 !important;
  transform: translateY(0) scale(1) !important;
}
</style>
