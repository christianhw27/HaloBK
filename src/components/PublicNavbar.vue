<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isDark = ref(false)
const isMobileMenuOpen = ref(false)
const activeDropdown = ref(null) // 'akademik' | 'alumni' | null
const isEligibleModalOpen = ref(false)

// Mobile Accordion
const mobileOpenSection = ref('alumni')

function syncTheme() {
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

function toggleDropdown(name) {
  if (activeDropdown.value === name) {
    activeDropdown.value = null
  } else {
    activeDropdown.value = name
  }
}

function closeDropdown() {
  activeDropdown.value = null
}

function handleClickOutside(e) {
  const nav = document.getElementById('public-desktop-nav')
  if (nav && !nav.contains(e.target)) {
    closeDropdown()
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    closeDropdown()
    isMobileMenuOpen.value = false
    isEligibleModalOpen.value = false
  }
}

watch(() => route.fullPath, () => {
  closeDropdown()
  isMobileMenuOpen.value = false
})

onMounted(() => {
  syncTheme()
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleKeydown)
})

function navigateToNews(hash = '#arsip-berita') {
  closeDropdown()
  isMobileMenuOpen.value = false
  if (route.path === '/') {
    const el = document.querySelector(hash)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  } else {
    router.push(`/${hash}`)
  }
}

function openEligibleModal() {
  closeDropdown()
  isMobileMenuOpen.value = false
  isEligibleModalOpen.value = true
}

function toggleMobileAccordion(section) {
  mobileOpenSection.value = mobileOpenSection.value === section ? null : section
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-sky-200/70 dark:border-slate-800">
    <!-- Garis Aksen Empat Pilar BK -->
    <div class="h-1.5 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981]" aria-hidden="true"></div>

    <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center justify-between gap-2 sm:gap-4">
      
      <!-- LOGO & IDENTITAS SEKOLAH -->
      <router-link to="/" class="flex items-center gap-2 sm:gap-3 min-w-0 min-h-[44px] group" @click="closeDropdown">
        <img
          src="/logo.png"
          alt="Logo SMA Negeri 2 Ngawi"
          width="40"
          height="40"
          class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 p-0.5 shadow-xs shrink-0 group-hover:scale-105 transition-transform"
        />
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

      <!-- 3 TOMBOL UTAMA NAVIGASI DESKTOP (BERITA, AKADEMIK, ALUMNI) -->
      <nav id="public-desktop-nav" class="hidden md:flex items-center gap-1.5 lg:gap-2.5 relative" aria-label="Navigasi Utama">
        
        <!-- 1. TOMBOL BERITA (LANGSUNG KE BAGIAN BERITA) -->
        <button
          type="button"
          @click="navigateToNews('#arsip-berita')"
          class="px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          :class="route.path === '/' && !activeDropdown
            ? 'text-[#0284C7] dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60'
            : 'text-slate-700 dark:text-slate-200 hover:text-[#0284C7] dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'"
        >
          <i class="fa-regular fa-newspaper text-sm" aria-hidden="true"></i>
          <span>Berita</span>
        </button>

        <!-- 2. TOMBOL AKADEMIK (DROPDOWN KE BAWAH: ELIGIBLE LOCKED) -->
        <div class="relative">
          <button
            type="button"
            @click.stop="toggleDropdown('akademik')"
            class="px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border"
            :class="activeDropdown === 'akademik'
              ? 'bg-[#0284C7] text-white border-sky-600 shadow-sm'
              : 'border-transparent text-slate-700 dark:text-slate-200 hover:text-[#0284C7] dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'"
            aria-haspopup="true"
            :aria-expanded="activeDropdown === 'akademik'"
          >
            <i class="fa-solid fa-graduation-cap text-sm" aria-hidden="true"></i>
            <span>Akademik</span>
            <i
              class="fa-solid fa-chevron-down text-xs transition-transform duration-200"
              :class="{ 'rotate-180': activeDropdown === 'akademik' }"
              aria-hidden="true"
            ></i>
          </button>

          <!-- DROPDOWN PANEL AKADEMIK -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 translate-y-2 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 translate-y-2 scale-95"
          >
            <div
              v-if="activeDropdown === 'akademik'"
              class="absolute left-0 mt-2 w-[380px] sm:w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 z-50 focus:outline-none"
              role="menu"
            >
              <div class="px-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Layanan Akademik BK
                </span>
                <span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Seleksi Masuk PTN
                </span>
              </div>

              <!-- Item: Eligible (Locked) -->
              <button
                type="button"
                @click="openEligibleModal"
                class="w-full text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 hover:bg-amber-50/70 dark:bg-slate-850 dark:hover:bg-slate-800/80 transition-all cursor-pointer group block"
                role="menuitem"
              >
                <div class="flex items-start gap-3.5">
                  <!-- Squircle Icon dengan Gembok -->
                  <div class="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                    <i class="fa-solid fa-award text-xl" aria-hidden="true"></i>
                    <!-- Gembok Overlay Badge -->
                    <span class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-sm border-2 border-white dark:border-slate-900">
                      <i class="fa-solid fa-lock text-[9px]" aria-hidden="true"></i>
                    </span>
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                        Eligible Siswa
                      </span>
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-900 shrink-0">
                        <i class="fa-solid fa-lock text-[9px]"></i>
                        <span>Terkunci</span>
                      </span>
                    </div>
                    <p class="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Pemeringkatan kuota siswa eligible untuk pendaftaran jalur SNBP.
                    </p>
                  </div>
                </div>

                <div class="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  <span class="flex items-center gap-1.5">
                    <i class="fa-solid fa-circle-info text-[10px]"></i>
                    Status &amp; info pembukaan
                  </span>
                  <span class="text-slate-400 dark:text-slate-500 font-normal text-[10px]">Klik untuk melihat</span>
                </div>
              </button>
            </div>
          </Transition>
        </div>

        <!-- 3. TOMBOL ALUMNI (DROPDOWN KE BAWAH: TRACER STUDY) -->
        <div class="relative">
          <button
            type="button"
            @click.stop="toggleDropdown('alumni')"
            class="px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border"
            :class="activeDropdown === 'alumni'
              ? 'bg-[#0284C7] text-white border-sky-600 shadow-sm'
              : 'border-transparent text-slate-700 dark:text-slate-200 hover:text-[#0284C7] dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'"
            aria-haspopup="true"
            :aria-expanded="activeDropdown === 'alumni'"
          >
            <i class="fa-solid fa-user-group text-sm" aria-hidden="true"></i>
            <span>Alumni</span>
            <i
              class="fa-solid fa-chevron-down text-xs transition-transform duration-200"
              :class="{ 'rotate-180': activeDropdown === 'alumni' }"
              aria-hidden="true"
            ></i>
          </button>

          <!-- DROPDOWN PANEL ALUMNI -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 translate-y-2 scale-95"
            enter-to-class="opacity-100 translate-y-0 scale-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 translate-y-0 scale-100"
            leave-to-class="opacity-0 translate-y-2 scale-95"
          >
            <div
              v-if="activeDropdown === 'alumni'"
              class="absolute left-0 mt-2 w-[380px] sm:w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 z-50 focus:outline-none"
              role="menu"
            >
              <div class="px-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Layanan Alumni SMADA
                </span>
                <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300">
                  Resmi
                </span>
              </div>

              <!-- Item: Tracer Study -->
              <router-link
                to="/dashboard"
                @click="closeDropdown"
                class="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-gradient-to-r from-sky-50/80 via-white to-sky-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30 hover:border-sky-400 dark:hover:border-sky-700 hover:shadow-md transition-all group block"
                role="menuitem"
              >
                <div class="flex items-start gap-3.5">
                  <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#075985] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <i class="fa-solid fa-chart-pie text-xl" aria-hidden="true"></i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-display font-bold text-sm sm:text-base text-[#0284C7] dark:text-sky-300 group-hover:underline">
                        Tracer Study
                      </span>
                      <span class="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Aktif
                      </span>
                    </div>
                    <p class="text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      Statistik sebaran PTN, PTS, Kedinasan &amp; karir alumni SMADA.
                    </p>
                  </div>
                </div>

                <div class="mt-2.5 pt-2 border-t border-sky-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-[#0284C7] dark:text-sky-300">
                  <span class="flex items-center gap-1.5">
                    Buka Dashboard Statistik
                  </span>
                  <i class="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
                </div>
              </router-link>
            </div>
          </Transition>
        </div>

      </nav>

      <!-- AKSI KANAN NAVBAR -->
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

        <!-- Tombol Masuk / Login (Jika Belum Login) -->
        <router-link
          v-if="!authStore.isLoggedIn"
          to="/login"
          class="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold shadow-xs transition-colors duration-150 min-h-[44px]"
          title="Masuk sebagai Guru BK atau Pengunjung"
        >
          <i class="fa-solid fa-arrow-right-to-bracket text-sm" aria-hidden="true"></i>
          <span>Masuk / Login</span>
        </router-link>

        <!-- Jika Sudah Login: Tombol Akun / Dashboard & Keluar -->
        <div v-else class="hidden sm:flex items-center gap-2">
          <router-link
            to="/dashboard"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold shadow-xs transition-colors duration-150 min-h-[44px]"
          >
            <i class="fa-solid fa-gauge" aria-hidden="true"></i>
            <span>Dashboard</span>
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

        <!-- Tombol Menu Mobile Hamburger (Ponsel & Tablet) -->
        <button
          type="button"
          @click="isMobileMenuOpen = true"
          class="md:hidden w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-[#334155] dark:text-slate-200 border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-center transition-colors shrink-0"
          aria-label="Buka Menu Navigasi"
        >
          <i class="fa-solid fa-bars text-base" aria-hidden="true"></i>
        </button>
      </div>

    </div>
  </header>

  <!-- MOBILE NAVIGATION DRAWER -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileMenuOpen"
        class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end"
        @click.self="isMobileMenuOpen = false"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu Navigasi Seluler"
          class="w-80 max-w-[88vw] bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-2xl overflow-y-auto"
        >
          <div class="space-y-5">
            <!-- Header Drawer -->
            <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-2.5">
                <img src="/logo.png" alt="Logo BK SMADA" class="w-8 h-8 rounded-lg object-contain" />
                <span class="font-display font-bold text-base text-slate-900 dark:text-white">
                  Menu Utama
                </span>
              </div>
              <button
                type="button"
                @click="isMobileMenuOpen = false"
                class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center"
                aria-label="Tutup menu"
              >
                <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Accordion Links: Berita, Akademik, Alumni -->
            <nav class="space-y-3" aria-label="Tautan Menu Seluler">
              
              <!-- 1. Menu Berita -->
              <button
                type="button"
                @click="navigateToNews('#arsip-berita')"
                class="w-full text-left px-3.5 py-3 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 flex items-center justify-between border border-transparent hover:border-sky-200 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-sky-100 text-[#0284C7] dark:bg-sky-950/70 dark:text-sky-300 flex items-center justify-center text-sm">
                    <i class="fa-regular fa-newspaper" aria-hidden="true"></i>
                  </div>
                  <span>Berita &amp; Informasi</span>
                </div>
                <i class="fa-solid fa-arrow-right text-xs text-slate-400" aria-hidden="true"></i>
              </button>

              <!-- 2. Menu Akademik (Eligible) -->
              <div class="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                  type="button"
                  @click="toggleMobileAccordion('akademik')"
                  class="w-full text-left px-3.5 py-3 bg-slate-50/70 dark:bg-slate-850 text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center text-sm">
                      <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
                    </div>
                    <span>Akademik</span>
                  </div>
                  <i
                    class="fa-solid fa-chevron-down text-xs transition-transform duration-200 text-slate-500"
                    :class="{ 'rotate-180': mobileOpenSection === 'akademik' }"
                  ></i>
                </button>

                <div v-if="mobileOpenSection === 'akademik'" class="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <button
                    type="button"
                    @click="openEligibleModal"
                    class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-left flex items-center gap-2.5"
                  >
                    <div class="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 text-xs">
                      <i class="fa-solid fa-lock"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-xs text-slate-900 dark:text-white">Eligible</span>
                        <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Terkunci</span>
                      </div>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Pemeringkatan kuota siswa SNBP
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <!-- 3. Menu Alumni (Tracer Study) -->
              <div class="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                  type="button"
                  @click="toggleMobileAccordion('alumni')"
                  class="w-full text-left px-3.5 py-3 bg-slate-50/70 dark:bg-slate-850 text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-sky-100 text-[#0284C7] dark:bg-sky-950/70 dark:text-sky-300 flex items-center justify-center text-sm">
                      <i class="fa-solid fa-user-group" aria-hidden="true"></i>
                    </div>
                    <span>Alumni</span>
                  </div>
                  <i
                    class="fa-solid fa-chevron-down text-xs transition-transform duration-200 text-slate-500"
                    :class="{ 'rotate-180': mobileOpenSection === 'alumni' }"
                  ></i>
                </button>

                <div v-if="mobileOpenSection === 'alumni'" class="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <router-link
                    to="/dashboard"
                    @click="isMobileMenuOpen = false"
                    class="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-left flex items-center gap-2.5 block border border-sky-200 dark:border-sky-900/60"
                  >
                    <div class="w-8 h-8 rounded-lg bg-[#0284C7] text-white flex items-center justify-center shrink-0 text-xs">
                      <i class="fa-solid fa-chart-pie"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-xs text-[#0284C7] dark:text-sky-300">Tracer Study</span>
                        <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Aktif</span>
                      </div>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Statistik sebaran kuliah &amp; karir
                      </p>
                    </div>
                  </router-link>
                </div>
              </div>
            </nav>
          </div>

          <!-- Drawer Footer: Auth Actions -->
          <div class="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <router-link
              v-if="!authStore.isLoggedIn"
              to="/login"
              @click="isMobileMenuOpen = false"
              class="w-full py-3 px-4 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold flex items-center justify-center gap-2 min-h-[44px] transition-colors shadow-xs"
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
                <i class="fa-solid fa-gauge" aria-hidden="true"></i>
                <span>Buka Dashboard</span>
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
  </Teleport>

  <!-- MODAL INFORMASI: ELIGIBLE TERKUNCI -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isEligibleModalOpen"
        class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
        @click.self="isEligibleModalOpen = false"
      >
        <div
          role="dialog"
          aria-modal="true"
          class="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 text-center space-y-4"
        >
          <!-- Icon Bulat Gembok -->
          <div class="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400 mx-auto flex items-center justify-center text-2xl shadow-inner border border-amber-200 dark:border-amber-800">
            <i class="fa-solid fa-lock" aria-hidden="true"></i>
          </div>

          <div class="space-y-2">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 text-xs font-bold uppercase tracking-wider">
              <span>Status: Terkunci (Locked)</span>
            </div>
            <h3 class="font-display font-bold text-xl text-slate-900 dark:text-white">
              Layanan Siswa Eligible (SNBP)
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Fitur pemeringkatan dan kuota siswa <strong>Eligible SNBP</strong> saat ini masih dikunci oleh sistem. Layanan ini akan dibuka secara resmi oleh Guru BK SMA Negeri 2 Ngawi saat periode seleksi SNBP telah tiba.
            </p>
          </div>

          <div class="pt-2">
            <button
              type="button"
              @click="isEligibleModalOpen = false"
              class="w-full py-3 px-5 rounded-2xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-sm transition-colors shadow-sm"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
