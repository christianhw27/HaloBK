<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNewsStore } from '@/stores/news'
import { NEWS_CATEGORY_STYLES } from '@/lib/starterNews'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const newsStore = useNewsStore()

const isDark = ref(false)
const isMobileMenuOpen = ref(false)
const copiedNotice = ref(false)

function syncThemeOnMount() {
  if (
    localStorage.getItem('theme') === 'dark' ||
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  } else {
    isDark.value = false
    document.documentElement.classList.remove('dark')
  }
}

function toggleDarkMode() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape' && isMobileMenuOpen.value) {
    isMobileMenuOpen.value = false
  }
}

const article = computed(() => {
  const paramId = String(route.params.id || '')
  return newsStore.newsList.find(n => String(n.id) === paramId) || null
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

async function copyArticleLink() {
  const url = window.location.href
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
  const url = window.location.href
  const text = encodeURIComponent(`*${article.value.title}*\n\n${article.value.summary || ''}\n\nBaca selengkapnya di Ruang BK Smada:\n${url}`)
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
}

function updatePageMetadata() {
  if (article.value) {
    document.title = `${article.value.title} - Ruang BK Smada`
    newsStore.incrementViews(article.value.id)
  } else {
    document.title = 'Detail Berita - Ruang BK Smada'
  }
}

onMounted(async () => {
  syncThemeOnMount()
  window.addEventListener('keydown', handleKeydown)

  if (newsStore.newsList.length === 0) {
    await newsStore.fetchNews()
  }
  updatePageMetadata()
})

watch(() => route.params.id, async () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  if (newsStore.newsList.length === 0) {
    await newsStore.fetchNews()
  }
  updatePageMetadata()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#EFF6FF]/90 via-[#F8FAFC] to-[#FFFBEB]/85 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-700 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden">
    
    <!-- STICKY NAVBAR -->
    <header class="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-sky-200/70 dark:border-slate-800">
      <div class="h-1.5 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981]" aria-hidden="true"></div>

      <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-2 sm:gap-4">
        
        <!-- Logo & Identitas Portal -->
        <router-link to="/" class="flex items-center gap-2 sm:gap-3 min-w-0 min-h-[44px]">
          <img
            src="/logo.png"
            alt="Logo SMA Negeri 2 Ngawi"
            width="40"
            height="40"
            class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 p-0.5 shadow-sm shrink-0"
            onerror="this.onerror=null; this.classList.add('hidden'); if(this.nextElementSibling) this.nextElementSibling.classList.remove('hidden');"
          />
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#E0F2FE] dark:bg-slate-800 border border-sky-200 dark:border-slate-700 flex items-center justify-center text-[#0369A1] dark:text-sky-400 shrink-0 hidden">
            <i class="fa-solid fa-graduation-cap text-base sm:text-lg" aria-hidden="true"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-display font-bold text-base sm:text-xl text-[#0F172A] dark:text-white tracking-tight truncate">
                Ruang BK Smada
              </span>
              <span class="hidden sm:inline-flex text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] dark:bg-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800 shrink-0">
                SMADA Ngawi
              </span>
            </div>
            <p class="text-[11px] sm:text-xs text-[#64748B] dark:text-slate-400 truncate -mt-0.5">
              SMA Negeri 2 Ngawi
            </p>
          </div>
        </router-link>

        <!-- Aksi Kanan Navbar -->
        <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <router-link
            to="/"
            class="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-[#0369A1] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
          >
            <i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>
            <span>Portal Berita</span>
          </router-link>

          <!-- Toggle Tema Gelap / Terang -->
          <button
            type="button"
            @click="toggleDarkMode"
            class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-[#334155] dark:text-slate-200 border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-center transition-colors shrink-0"
            :aria-label="isDark ? 'Ubah ke tampilan terang' : 'Ubah ke tampilan gelap'"
          >
            <i v-if="isDark" class="fa-solid fa-sun text-amber-400 text-sm" aria-hidden="true"></i>
            <i v-else class="fa-solid fa-moon text-[#334155] text-sm" aria-hidden="true"></i>
          </button>

          <!-- Menu Akses Tracer Study (Jika Sudah Login) -->
          <div v-if="authStore.isLoggedIn" class="hidden sm:flex items-center gap-2">
            <router-link
              to="/dashboard"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold shadow-sm transition-colors duration-150 min-h-[44px]"
            >
              <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
              <span>Tracer Study</span>
            </router-link>
          </div>

          <!-- Tombol Menu Mobile -->
          <button
            type="button"
            @click="isMobileMenuOpen = true"
            class="lg:hidden w-10 h-10 sm:w-auto sm:px-3.5 sm:py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-200 text-sm font-semibold flex items-center justify-center gap-1.5 shrink-0"
            aria-label="Buka menu navigasi"
          >
            <i class="fa-solid fa-bars text-sm" aria-hidden="true"></i>
            <span class="hidden sm:inline">Menu</span>
          </button>
        </div>
      </div>
    </header>

    <!-- MOBILE NAVIGATION DRAWER -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileMenuOpen"
        class="lg:hidden fixed inset-0 z-50 bg-slate-950/60 flex justify-end"
        @click.self="isMobileMenuOpen = false"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu Navigasi Seluler"
          class="w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-2xl"
        >
          <div class="space-y-5">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <span class="font-display font-bold text-base text-slate-900 dark:text-white">Menu Ruang BK</span>
              <button
                type="button"
                @click="isMobileMenuOpen = false"
                class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center"
                aria-label="Tutup menu"
              >
                <i class="fa-solid fa-xmark text-base" aria-hidden="true"></i>
              </button>
            </div>

            <nav class="space-y-1.5" aria-label="Tautan Seluler">
              <router-link
                to="/"
                @click="isMobileMenuOpen = false"
                class="block px-3.5 py-3 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <i class="fa-solid fa-newspaper mr-2 text-sky-600" aria-hidden="true"></i>
                Halaman Depan Berita
              </router-link>
              <router-link
                to="/dashboard"
                @click="isMobileMenuOpen = false"
                class="block px-3.5 py-3 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <i class="fa-solid fa-chart-pie mr-2 text-emerald-600" aria-hidden="true"></i>
                Portal Tracer Study
              </router-link>
              <router-link
                v-if="authStore.userRole === 'admin'"
                to="/kelola-berita"
                @click="isMobileMenuOpen = false"
                class="block px-3.5 py-3 rounded-lg text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <i class="fa-solid fa-pen-to-square mr-2 text-emerald-600" aria-hidden="true"></i>
                Kelola Berita (Admin)
              </router-link>
            </nav>
          </div>

          <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              @click="copyArticleLink"
              class="w-full py-3 px-4 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-[#0369A1] dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <i class="fa-regular fa-copy" aria-hidden="true"></i>
              <span>{{ copiedNotice ? 'Tautan Disalin!' : 'Salin Link Berita Ini' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

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
      <article v-else class="space-y-6 sm:space-y-8">
        
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
        <section v-if="otherNews.length > 0" class="pt-6 border-t border-sky-100 dark:border-slate-800 space-y-4">
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
              :to="'/berita/' + item.id"
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

