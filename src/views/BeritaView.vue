<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import { useNewsStore } from '@/stores/news'
import { NEWS_CATEGORIES, NEWS_CATEGORY_STYLES } from '@/lib/starterNews'

const authStore = useAuthStore()
const alumniStore = useAlumniStore()
const newsStore = useNewsStore()

const isDark = ref(false)
const isMobileMenuOpen = ref(false)

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

onMounted(() => {
  syncThemeOnMount()
  newsStore.fetchNews()
  alumniStore.fetchData()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function getCategoryStyle(category) {
  return NEWS_CATEGORY_STYLES[category] || NEWS_CATEGORY_STYLES['Pengumuman BK']
}

function resetNewsFilters() {
  newsStore.selectedCategory = 'ALL'
  newsStore.searchQuery = ''
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#EFF6FF]/90 via-[#F8FAFC] to-[#FFFBEB]/85 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-700 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200 overflow-x-hidden">
    
    <!-- Tautan Aksesibilitas Skip to Content -->
    <a
      href="#portal-main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#0369A1] text-white font-semibold rounded-xl shadow-lg"
    >
      Lewati ke konten berita
    </a>

    <!-- STICKY PUBLIC NAVBAR -->
    <header class="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-sky-200/70 dark:border-slate-800">
      <!-- Garis Aksen Empat Pilar BK -->
      <div class="h-1.5 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981]" aria-hidden="true"></div>

      <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-2 sm:gap-4">
        
        <!-- Logo & Identitas Portal Berita -->
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

        <!-- Navigasi Seksi Desktop -->
        <nav class="hidden lg:flex items-center gap-6 text-sm font-semibold text-[#334155] dark:text-slate-300" aria-label="Navigasi Portal Berita">
          <a href="#berita-utama" class="hover:text-[#0369A1] dark:hover:text-sky-400 transition-colors py-2">
            Sorotan Utama
          </a>
          <a href="#arsip-berita" class="hover:text-[#0369A1] dark:hover:text-sky-400 transition-colors py-2">
            Daftar Berita
          </a>
        </nav>

        <!-- Aksi Kanan Navbar -->
        <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
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

          <!-- Tombol Kelola Berita (Khusus Admin) -->
          <router-link
            v-if="authStore.userRole === 'admin'"
            to="/kelola-berita"
            class="hidden md:inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-[#334155] dark:text-slate-200 text-sm font-semibold transition-colors min-h-[44px]"
          >
            <i class="fa-solid fa-pen-to-square text-[#0369A1] dark:text-sky-400" aria-hidden="true"></i>
            <span>Kelola Berita</span>
          </router-link>

          <!-- Tombol Masuk / Login (Jika Belum Login) -->
          <router-link
            v-if="!authStore.isLoggedIn"
            to="/login"
            class="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold shadow-sm transition-colors duration-150 min-h-[44px]"
            title="Masuk sebagai Guru BK atau Pengunjung"
          >
            <i class="fa-solid fa-arrow-right-to-bracket text-sm" aria-hidden="true"></i>
            <span>Masuk / Login</span>
          </router-link>

          <!-- Menu Akses Tracer Study (Jika Sudah Login) -->
          <div v-else class="hidden sm:flex items-center gap-2">
            <router-link
              to="/dashboard"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold shadow-sm transition-colors duration-150 min-h-[44px]"
            >
              <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
              <span>Tracer Study</span>
            </router-link>

            <button
              @click="authStore.logout()"
              type="button"
              class="w-11 h-11 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-center transition-colors shrink-0"
              title="Keluar dari akun"
              aria-label="Keluar dari akun"
            >
              <i class="fa-solid fa-arrow-right-from-bracket text-sm" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Tombol Menu Mobile (Responsif, Pas di Ponsel Tanpa Memotong Layar) -->
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
              <span class="font-display font-bold text-base text-slate-900 dark:text-white">Menu Portal</span>
              <button
                type="button"
                @click="isMobileMenuOpen = false"
                class="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center"
                aria-label="Tutup menu"
              >
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>

            <nav class="space-y-1.5" aria-label="Tautan Seluler">
              <a
                href="#berita-utama"
                @click="isMobileMenuOpen = false"
                class="block px-3.5 py-3 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Sorotan Utama
              </a>
              <a
                href="#arsip-berita"
                @click="isMobileMenuOpen = false"
                class="block px-3.5 py-3 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Daftar Berita
              </a>
              <router-link
                v-if="authStore.userRole === 'admin'"
                to="/kelola-berita"
                @click="isMobileMenuOpen = false"
                class="block px-3.5 py-3 rounded-lg text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                Kelola Berita (Admin)
              </router-link>
            </nav>
          </div>

          <div class="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <router-link
              v-if="!authStore.isLoggedIn"
              to="/login"
              @click="isMobileMenuOpen = false"
              class="w-full py-3 px-4 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold flex items-center justify-center gap-2 min-h-[44px] transition-colors shadow-sm"
            >
              <i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
              <span>Masuk / Login</span>
            </router-link>

            <div v-else class="space-y-2">
              <router-link
                to="/dashboard"
                @click="isMobileMenuOpen = false"
                class="w-full py-3 px-4 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold flex items-center justify-center gap-2 min-h-[44px]"
              >
                <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
                <span>Tracer Study</span>
              </router-link>
              <button
                @click="authStore.logout(); isMobileMenuOpen = false"
                type="button"
                class="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- STRIP INFORMASI CEPAT -->
    <div class="bg-gradient-to-r from-[#FEF3C7]/70 via-[#FFFBEB]/85 to-[#E0F2FE]/70 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/60 border-b border-amber-200/70 dark:border-slate-800 text-[#334155] dark:text-slate-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="px-2.5 py-0.5 rounded-full bg-[#F59E0B] text-slate-950 border border-amber-400 dark:bg-amber-900/80 dark:text-amber-200 dark:border-amber-700 font-bold text-xs uppercase tracking-wider shrink-0">
            Info Terkini
          </span>
          <span class="truncate text-[#0F172A] dark:text-slate-100 font-medium">
            {{ newsStore.featuredNews ? newsStore.featuredNews.title : 'Portal Bimbingan Konseling & Kabar Prestasi Siswa SMA Negeri 2 Ngawi' }}
          </span>
        </div>
      </div>
    </div>

    <!-- KONTEN UTAMA PORTAL BERITA -->
    <main id="portal-main" class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-12">
      
      <!-- SEKSI 1: LEAD STORY + AKSES TRACER STUDY (SPLIT EDITORIAL) -->
      <section id="berita-utama" class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start" aria-label="Sorotan Berita Utama">
        
        <!-- KOLOM KIRI (8/12): BERITA UTAMA -->
        <div class="lg:col-span-8 min-w-0">
          <!-- Loading State -->
          <div
            v-if="newsStore.isLoading"
            class="rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 p-8 sm:p-12 text-center space-y-3 shadow-[var(--shadow-card)]"
          >
            <i class="fa-solid fa-spinner fa-spin text-2xl text-[#0284C7]" aria-hidden="true"></i>
            <p class="text-sm font-semibold text-[#334155] dark:text-slate-300">
              Memuat kabar terbaru dari ruang Bimbingan Konseling...
            </p>
          </div>

          <!-- Artikel Utama (Headline) -->
          <article
            v-else-if="newsStore.featuredNews"
            class="rounded-3xl bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 overflow-hidden shadow-[var(--shadow-card)]"
            :class="getCategoryStyle(newsStore.featuredNews.category).cardTop"
          >
            <!-- Visual Sampul Artikel Utama -->
            <router-link
              v-if="newsStore.featuredNews.imageUrl"
              :to="'/berita/' + newsStore.featuredNews.id"
              class="block w-full aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-[#E2E8F0] dark:border-slate-800 group"
            >
              <img
                :src="newsStore.featuredNews.imageUrl"
                :alt="newsStore.featuredNews.title"
                width="960"
                height="540"
                fetchpriority="high"
                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </router-link>

            <!-- Sampul Cerah Harmonis Jika Tanpa Gambar -->
            <router-link
              v-else
              :to="'/berita/' + newsStore.featuredNews.id"
              class="block w-full aspect-[16/8] bg-gradient-to-br p-6 sm:p-9 flex flex-col justify-between border-b border-[#E2E8F0] dark:border-slate-800"
              :class="getCategoryStyle(newsStore.featuredNews.category).surface"
            >
              <div class="flex items-center justify-between gap-2">
                <span
                  class="px-3 py-1 rounded-full text-xs font-semibold border"
                  :class="getCategoryStyle(newsStore.featuredNews.category).badge"
                >
                  {{ newsStore.featuredNews.category }}
                </span>
                <span class="px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] border border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 text-xs font-semibold flex items-center gap-1.5">
                  <i class="fa-solid fa-star text-xs" aria-hidden="true"></i>
                  <span>Sorotan Utama</span>
                </span>
              </div>

              <div class="flex items-end justify-between gap-4 pt-6">
                <div class="space-y-1">
                  <span class="text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-300">
                    Buletin Bimbingan Konseling
                  </span>
                  <p class="font-display font-bold text-lg sm:text-xl text-[#0F172A] dark:text-white">
                    SMA Negeri 2 Ngawi
                  </p>
                </div>
                <div
                  class="w-12 h-12 rounded-xl border flex items-center justify-center text-xl shrink-0 shadow-sm"
                  :class="[getCategoryStyle(newsStore.featuredNews.category).iconBg, getCategoryStyle(newsStore.featuredNews.category).accentText]"
                >
                  <i :class="getCategoryStyle(newsStore.featuredNews.category).icon" aria-hidden="true"></i>
                </div>
              </div>
            </router-link>

            <!-- Konten Berita Utama -->
            <div class="p-6 sm:p-8 space-y-4">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:text-sm">
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

              <h1 class="font-display font-bold text-2xl sm:text-[1.75rem] lg:text-[2rem] text-[#0F172A] dark:text-white leading-[1.25] tracking-tight">
                <router-link
                  :to="'/berita/' + newsStore.featuredNews.id"
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
                  <i class="fa-regular fa-user text-[#0284C7] dark:text-sky-400" aria-hidden="true"></i>
                  <span>Ditulis oleh <strong class="text-[#0F172A] dark:text-slate-200">{{ newsStore.featuredNews.author }}</strong></span>
                </div>

                <router-link
                  :to="'/berita/' + newsStore.featuredNews.id"
                  class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm sm:text-base font-semibold transition-colors duration-150 inline-flex items-center justify-center gap-2 min-h-[44px] shadow-sm"
                >
                  <span>Baca Berita Selengkapnya</span>
                  <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
                </router-link>
              </div>
            </div>
          </article>

          <!-- Empty State Jika Belum Ada Berita Sama Sekali -->
          <div
            v-else
            class="rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 p-8 sm:p-12 text-center space-y-4 shadow-[var(--shadow-card)]"
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
            <div v-if="authStore.userRole === 'admin'" class="flex flex-wrap items-center justify-center gap-3 pt-2">
              <router-link
                to="/kelola-berita"
                class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm sm:text-base font-semibold min-h-[44px] inline-flex items-center gap-2 transition-colors shadow-sm"
              >
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
                <span>Tulis Berita Pertama</span>
              </router-link>
            </div>
          </div>
        </div>

        <!-- KOLOM KANAN (4/12): AKSES TRACER STUDY & KABAR PILIHAN -->
        <aside class="lg:col-span-4 space-y-6 min-w-0">
          
          <!-- Kartu Pintu Masuk Tracer Study (Hangat, Cerah, & Suportif) -->
          <div class="rounded-3xl bg-gradient-to-br from-[#E0F2FE]/80 via-white to-[#FEF3C7]/70 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/40 border border-sky-200/80 dark:border-slate-800 overflow-hidden shadow-[var(--shadow-card)]">
            <div class="h-1.5 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981]" aria-hidden="true"></div>

            <div class="p-6 space-y-5">
              <div class="space-y-2">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#FEF3C7] to-[#FFE4E6] text-[#92400E] border border-amber-200/80 dark:from-amber-950/60 dark:to-rose-950/60 dark:text-amber-300 dark:border-amber-800">
                  <i class="fa-solid fa-star text-[11px]" aria-hidden="true"></i>
                  <span>Ruang Alumni SMADA</span>
                </span>
                <h2 class="font-display font-bold text-xl sm:text-2xl text-[#0F172A] dark:text-white leading-[1.35]">
                  Jejak &amp; Cerita Alumni SMADA
                </h2>
                <p class="text-sm sm:text-base text-[#334155] dark:text-slate-300 leading-[1.6]">
                  Intip serunya perjalanan kuliah dan karir kakak kelas SMA Negeri 2 Ngawi di sini.
                </p>
              </div>

              <!-- Statistik Riil dari Store Alumni (Tanpa angka karangan) -->
              <div class="grid grid-cols-2 gap-3 pt-1">
                <div class="p-3.5 rounded-2xl bg-white/90 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 shadow-xs">
                  <div class="text-xs sm:text-sm font-semibold text-[#0369A1] dark:text-sky-300">Alumni Terdata</div>
                  <div class="font-display font-bold text-xl text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                    {{ alumniStore.statistics.total }}
                  </div>
                </div>
                <div class="p-3.5 rounded-2xl bg-white/90 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
                  <div class="text-xs sm:text-sm font-semibold text-[#047857] dark:text-emerald-300">Kuliah PTN &amp; PTS</div>
                  <div class="font-display font-bold text-xl text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                    {{ alumniStore.statistics.ptnCount + alumniStore.statistics.ptsCount }}
                  </div>
                </div>
              </div>

              <p class="text-xs text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
                Data statistik penelusuran lulusan dan studi lanjut dihimpun oleh tim Bimbingan Konseling SMA Negeri 2 Ngawi.
              </p>
            </div>
          </div>

          <!-- Daftar Sorotan Sekunder Bernomor (Editorial Index) -->
          <div
            v-if="newsStore.secondaryHighlights.length > 0"
            class="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-800 p-5 sm:p-6 space-y-4 shadow-[var(--shadow-card)]"
          >
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 class="font-display font-bold text-lg text-[#0F172A] dark:text-white flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" aria-hidden="true"></span>
                <span>Kabar Pilihan Lainnya</span>
              </h2>
              <a href="#arsip-berita" class="text-sm font-semibold text-[#0369A1] dark:text-sky-400 hover:underline">
                Lihat Semua
              </a>
            </div>

            <div class="divide-y divide-slate-100 dark:divide-slate-800">
              <router-link
                v-for="(item, idx) in newsStore.secondaryHighlights"
                :key="item.id"
                :to="'/berita/' + item.id"
                class="w-full text-left py-3.5 first:pt-1 last:pb-1 flex items-start gap-3.5 group block"
              >
                <span
                  class="w-8 h-8 rounded-xl font-display font-extrabold text-sm flex items-center justify-center tabular-nums shrink-0 mt-0.5 transition-transform duration-150 group-hover:scale-105"
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
        
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 id="archive-heading" class="font-display font-bold text-xl sm:text-2xl text-[#0F172A] dark:text-white leading-[1.35] tracking-tight">
              Cerita &amp; Kabar Hangat SMADA
            </h2>
            <p class="text-sm sm:text-base text-[#64748B] dark:text-slate-400 mt-1 leading-[1.5]">
              Kumpulan pengumuman sekolah, tips masuk kampus impian, beasiswa, dan kabar alumni.
            </p>
          </div>

          <!-- Pencarian Berita -->
          <div class="w-full md:w-72 relative">
            <label for="public-news-search" class="sr-only">Cari berita atau pengumuman</label>
            <i class="fa-solid fa-magnifying-glass text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true"></i>
            <input
              id="public-news-search"
              v-model="newsStore.searchQuery"
              type="search"
              placeholder="Cari judul atau topik..."
              class="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 text-sm sm:text-base text-[#0F172A] dark:text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
            />
          </div>
        </div>

        <!-- Tab Kategori Berita -->
        <!-- Tabs Filter Kategori (Empat Pilar Berwarna) -->
        <div class="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter kategori berita">
          <button
            type="button"
            role="tab"
            :aria-selected="newsStore.selectedCategory === 'ALL'"
            @click="newsStore.selectedCategory = 'ALL'"
            class="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 min-h-[40px] inline-flex items-center gap-2"
            :class="newsStore.selectedCategory === 'ALL'
              ? 'bg-[#0369A1] text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-[#334155] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-800 hover:bg-sky-50/70 dark:hover:bg-slate-800'"
          >
            <span>Semua Berita</span>
          </button>

          <button
            v-for="cat in NEWS_CATEGORIES"
            :key="cat"
            type="button"
            role="tab"
            :aria-selected="newsStore.selectedCategory === cat"
            @click="newsStore.selectedCategory = cat"
            class="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 min-h-[40px] inline-flex items-center gap-2"
            :class="newsStore.selectedCategory === cat
              ? getCategoryStyle(cat).activeTab
              : 'bg-white dark:bg-slate-900 text-[#334155] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-800 hover:bg-[#F1F5F9] dark:hover:bg-slate-800'"
          >
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :class="newsStore.selectedCategory === cat ? 'bg-current opacity-85' : getCategoryStyle(cat).dot"
              aria-hidden="true"
            ></span>
            <span>{{ cat }}</span>
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

        <!-- Grid Kartu Berita -->
        <div
          v-if="newsStore.filteredPublishedNews.length > 0"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <article
            v-for="item in newsStore.filteredPublishedNews"
            :key="item.id"
            class="rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-[var(--shadow-sm)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
            :class="getCategoryStyle(item.category).cardTop"
          >
            <div>
              <!-- Gambar Cover atau Placeholder Kategori Cerah -->
              <router-link
                v-if="item.imageUrl"
                :to="'/berita/' + item.id"
                class="block w-full aspect-[16/10] bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-slate-100 dark:border-slate-800 group"
              >
                <img
                  :src="item.imageUrl"
                  :alt="item.title"
                  width="640"
                  height="400"
                  loading="lazy"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </router-link>

              <router-link
                v-else
                :to="'/berita/' + item.id"
                class="block w-full aspect-[16/9] bg-gradient-to-br p-5 flex flex-col justify-between border-b border-[#E2E8F0] dark:border-slate-800"
                :class="getCategoryStyle(item.category).surface"
              >
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
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
                <span class="text-xs font-medium text-[#64748B] dark:text-slate-300">
                  Buletin BK SMA Negeri 2 Ngawi
                </span>
              </router-link>

              <div class="p-5 space-y-3">
                <div class="flex items-center justify-between gap-2 text-xs sm:text-sm text-[#64748B] dark:text-slate-400">
                  <span>{{ newsStore.formatNewsDate(item.createdAt) }}</span>
                  <span>{{ newsStore.estimateReadTime(item.content) }}</span>
                </div>

                <h3 class="font-display font-semibold text-lg sm:text-xl text-[#0F172A] dark:text-white leading-[1.4] line-clamp-2">
                  <router-link
                    :to="'/berita/' + item.id"
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
                :to="'/berita/' + item.id"
                class="px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200/80 dark:border-sky-800 hover:bg-[#0369A1] hover:text-white dark:hover:bg-[#0369A1] text-[#0369A1] dark:text-sky-200 text-sm font-semibold transition-colors duration-150 shrink-0 min-h-[40px] inline-flex items-center gap-1.5"
              >
                <span>Baca Artikel</span>
                <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
              </router-link>
            </div>
          </article>
        </div>

        <!-- Empty State Arsip Berita -->
        <div
          v-else-if="!newsStore.isLoading"
          class="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 text-center space-y-3 shadow-[var(--shadow-sm)]"
        >
          <p class="font-semibold text-base text-[#0F172A] dark:text-slate-200">
            {{ (newsStore.selectedCategory !== 'ALL' || newsStore.searchQuery) ? 'Tidak ada berita yang sesuai dengan filter atau kata kunci Anda.' : 'Belum ada berita tambahan di luar sorotan utama.' }}
          </p>
          <div class="flex items-center justify-center gap-3">
            <button
              v-if="newsStore.selectedCategory !== 'ALL' || newsStore.searchQuery"
              type="button"
              @click="resetNewsFilters"
              class="px-4 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold min-h-[40px] transition-colors"
            >
              Tampilkan Semua Berita
            </button>
            <router-link
              v-if="authStore.userRole === 'admin'"
              to="/kelola-berita"
              class="px-4 py-2 rounded-xl bg-[#F1F5F9] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-200 text-sm font-semibold min-h-[40px] inline-flex items-center gap-1.5"
            >
              <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
              <span>Kelola Berita</span>
            </router-link>
          </div>
        </div>

      </section>

    </main>

    <!-- FOOTER INSTITUSIONAL (TANPA TAUTAN LOGIN) -->
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

