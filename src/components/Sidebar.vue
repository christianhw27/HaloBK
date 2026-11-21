<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import { useEligibleStore } from '@/stores/eligible'
import { useChatStore } from '@/stores/chat'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const alumniStore = useAlumniStore()
const eligibleStore = useEligibleStore()
const chatStore = useChatStore()

const isDark = ref(false)
const isMobileOpen = ref(false)

function handleLogout() {
  authStore.logout()
  router.push('/')
}

onMounted(() => {
  if (localStorage.getItem('theme') === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  } else {
    isDark.value = false
    document.documentElement.classList.remove('dark')
  }
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Tutup drawer mobile secara otomatis saat rute berpindah
watch(() => route.path, () => {
  isMobileOpen.value = false
})

function handleKeydown(e) {
  if (e.key === 'Escape' && isMobileOpen.value) {
    isMobileOpen.value = false
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
</script>

<template>
  <!-- SUB-BAR NAVIGASI KHUSUS MOBILE (< lg) DI BAWAH NAVBAR UTAMA -->
  <div class="lg:hidden sticky top-16 sm:top-[72px] z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-sky-200/70 dark:border-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 shadow-2xs w-full max-w-full min-w-0">
    <button
      @click="isMobileOpen = true"
      type="button"
      class="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/80 text-[#0284C7] dark:text-sky-300 border border-sky-200/80 dark:border-sky-800 text-xs font-bold transition-all shadow-2xs shrink-0"
      aria-label="Buka Menu Tracer Study"
    >
      <i class="fa-solid fa-bars-staggered text-xs" aria-hidden="true"></i>
      <span>Menu Tracer Study</span>
    </button>

    <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 min-w-0 truncate">
      <span class="w-2 h-2 rounded-full bg-[#0284C7] shrink-0" aria-hidden="true"></span>
      <span class="truncate">Tracer Study &amp; Karir</span>
    </div>
  </div>

  <!-- BACKDROP OVERLAY UNTUK MOBILE DRAWER -->
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isMobileOpen"
      @click="isMobileOpen = false"
      class="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm"
      aria-hidden="true"
    ></div>
  </Transition>

  <!-- SIDEBAR CONTAINER (DESKTOP: FIXED ASIDE DOCKING DI BAWAH NAVBAR, MOBILE: OFF-CANVAS DRAWER) -->
  <aside
    class="fixed top-0 lg:top-16 sm:lg:top-[72px] left-0 z-[60] lg:z-30 h-screen lg:h-[calc(100vh-4rem)] sm:lg:h-[calc(100vh-4.5rem)] w-64 xl:w-72 bg-white dark:bg-slate-900 border-r border-sky-200/70 dark:border-slate-800 flex flex-col justify-between shrink-0 transition-transform duration-200 ease-out"
    :class="isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'"
    aria-label="Navigasi Samping"
  >
    <!-- Garis Aksen Empat Pilar BK -->
    <div class="h-1.5 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981] shrink-0" aria-hidden="true"></div>

    <!-- SISI ATAS: LOGO & MENU UTAMA -->
    <div class="flex-1 flex flex-col overflow-y-auto">
      
      <!-- Brand & Identitas Modul Tracer Study -->
      <div class="p-4 border-b border-sky-100 dark:border-slate-800 bg-gradient-to-br from-sky-50/90 via-white to-amber-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30 flex items-center justify-between">
        <router-link to="/tracer-study" class="flex items-center gap-2.5 group focus-visible:rounded-xl">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#075985] text-white flex items-center justify-center text-sm font-bold shadow-xs group-hover:scale-105 transition-transform">
            <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
          </div>
          <div>
            <span class="font-display font-bold text-sm text-slate-900 dark:text-white leading-tight block">
              Tracer Study
            </span>
            <p class="text-[11px] text-[#0284C7] dark:text-sky-300 font-medium mt-0.5">
              Alumni &amp; Jejak Karir
            </p>
          </div>
        </router-link>

        <!-- Tombol Tutup Khusus Mobile Drawer -->
        <button
          @click="isMobileOpen = false"
          type="button"
          class="lg:hidden w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center"
          aria-label="Tutup menu navigasi"
        >
          <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Kartu Status Akun Pengguna (Static, Terpisah Tegas Tanpa Pindah Cepat) -->
      <div class="p-4 border-b border-sky-100/80 dark:border-slate-800/80 bg-gradient-to-br from-sky-50/75 via-white to-emerald-50/55 dark:from-slate-800/50 dark:via-slate-900 dark:to-slate-900">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wide">
            Masuk Sebagai
          </span>
          <span
            v-if="authStore.userRole !== 'siswa'"
            class="text-xs font-bold px-2.5 py-0.5 rounded-full border"
            :class="authStore.userRole === 'admin'
              ? 'bg-[#D1FAE5] text-[#047857] border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-[#E0F2FE] text-[#0369A1] border-sky-200 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800'"
          >
            {{ authStore.userRole === 'admin' ? 'Guru BK' : 'Pengunjung' }}
          </span>
        </div>

        <div class="w-full py-2.5 px-3.5 rounded-2xl text-sm font-semibold flex items-center justify-between border bg-white dark:bg-slate-900 border-sky-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs">
          <div class="flex items-center gap-2 truncate">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :class="authStore.userRole === 'admin' ? 'bg-emerald-500' : (authStore.userRole === 'siswa' ? 'bg-amber-500' : 'bg-[#0284C7]')"
              aria-hidden="true"
            ></span>
            <span class="truncate font-semibold">{{ authStore.userName }}</span>
          </div>
          <span
            v-if="authStore.userRole !== 'siswa'"
            class="text-[11px] font-medium px-2 py-0.5 rounded-full"
            :class="authStore.userRole === 'admin'
              ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50'
              : 'text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/50'"
          >
            {{ authStore.userRole === 'admin' ? 'Pengelola' : 'Tamu' }}
          </span>
        </div>
      </div>

      <!-- Menu Navigasi Utama Tracer Study -->
      <nav class="p-3.5 space-y-1.5 flex-1" aria-label="Menu Tracer Study">
        <div class="text-xs font-bold text-[#64748B] dark:text-slate-400 tracking-wide px-2 py-1">
          Menu Tracer Study
        </div>

        <!-- 1. Dashboard Tracer Study (Trust Blue) -->
        <router-link
          to="/tracer-study"
          class="w-full px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border"
          :class="route.path === '/tracer-study' || route.path === '/dashboard'
            ? 'bg-[#E0F2FE] text-[#0369A1] border-sky-200 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-800 shadow-2xs'
            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-sky-50/70 dark:hover:bg-slate-800/80 hover:text-[#0369A1] dark:hover:text-sky-300'"
        >
          <span
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            :class="route.path === '/tracer-study' || route.path === '/dashboard'
              ? 'bg-[#0369A1] text-white'
              : 'bg-sky-100/80 text-[#0369A1] dark:bg-sky-950/60 dark:text-sky-300'"
          >
            <i class="fa-solid fa-chart-pie text-sm" aria-hidden="true"></i>
          </span>
          <span>Dashboard Tracer Study</span>
        </router-link>

        <!-- 2. Direktori Data Alumni (Growth Emerald) -->
        <router-link
          to="/data"
          class="w-full px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border"
          :class="route.path === '/data'
            ? 'bg-[#D1FAE5] text-[#047857] border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800 shadow-2xs'
            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-emerald-50/70 dark:hover:bg-slate-800/80 hover:text-[#047857] dark:hover:text-emerald-300'"
        >
          <span
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            :class="route.path === '/data'
              ? 'bg-[#047857] text-white'
              : 'bg-emerald-100/80 text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300'"
          >
            <i class="fa-solid fa-users text-sm" aria-hidden="true"></i>
          </span>
          <span>Direktori Alumni</span>
        </router-link>

        <!-- 3. Lapor Diri (Hope Amber - Khusus Alumni / Bukan Siswa Aktif) -->
        <router-link
          v-if="authStore.userRole !== 'siswa'"
          to="/lapor"
          class="w-full px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border"
          :class="route.path === '/lapor'
            ? 'bg-[#FEF3C7] text-[#92400E] border-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800 shadow-2xs'
            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-amber-50/70 dark:hover:bg-slate-800/80 hover:text-[#92400E] dark:hover:text-amber-300'"
        >
          <span
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            :class="route.path === '/lapor'
              ? 'bg-[#F59E0B] text-slate-950'
              : 'bg-amber-100/80 text-[#92400E] dark:bg-amber-950/60 dark:text-amber-300'"
          >
            <i class="fa-solid fa-user-plus text-sm" aria-hidden="true"></i>
          </span>
          <span>Formulir Lapor Diri</span>
        </router-link>

        <!-- 4. Verifikasi Laporan ACC (Warm Magenta - Khusus Guru BK) -->
        <router-link
          v-if="authStore.userRole === 'admin'"
          to="/verifikasi"
          class="w-full px-3 py-2 rounded-2xl text-sm font-semibold flex items-center justify-between transition-all border"
          :class="route.path === '/verifikasi'
            ? 'bg-[#FFE4E6] text-[#BE123C] border-rose-200 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800 shadow-2xs'
            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-rose-50/70 dark:hover:bg-slate-800/80 hover:text-[#BE123C] dark:hover:text-rose-300'"
        >
          <div class="flex items-center gap-3">
            <span
              class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              :class="route.path === '/verifikasi'
                ? 'bg-[#BE123C] text-white'
                : 'bg-rose-100/80 text-[#BE123C] dark:bg-rose-950/60 dark:text-rose-300'"
            >
              <i class="fa-solid fa-shield-halved text-sm" aria-hidden="true"></i>
            </span>
            <span>Verifikasi Laporan</span>
          </div>
          <span
            v-if="alumniStore.totalPendingCount > 0"
            class="px-2 py-0.5 rounded-full text-xs font-bold"
            :class="route.path === '/verifikasi'
              ? 'bg-white text-[#BE123C]'
              : 'bg-amber-500 text-slate-950'"
            aria-label="Antrean pengajuan verifikasi"
          >
            {{ alumniStore.totalPendingCount }}
          </span>
        </router-link>

        <!-- 5. Kelola Data & Excel (Growth Emerald - Khusus Guru BK) -->
        <router-link
          v-if="authStore.userRole === 'admin'"
          to="/import-export"
          class="w-full px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border"
          :class="route.path === '/import-export' && route.query.tab !== 'users'
            ? 'bg-[#D1FAE5] text-[#047857] border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800 shadow-2xs'
            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-emerald-50/70 dark:hover:bg-slate-800/80 hover:text-[#047857] dark:hover:text-emerald-300'"
        >
          <span
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            :class="route.path === '/import-export' && route.query.tab !== 'users'
              ? 'bg-[#047857] text-white'
              : 'bg-emerald-100/80 text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300'"
          >
            <i class="fa-solid fa-database text-sm" aria-hidden="true"></i>
          </span>
          <span>Kelola Data & Excel</span>
        </router-link>

        <!-- 6. Kelola Akun Pengguna (Trust Violet / Indigo - Khusus Guru BK) -->
        <router-link
          v-if="authStore.userRole === 'admin'"
          :to="{ path: '/import-export', query: { tab: 'users' } }"
          class="w-full px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border"
          :class="route.path === '/import-export' && route.query.tab === 'users'
            ? 'bg-[#EEF2FF] text-[#4F46E5] border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-800 shadow-2xs'
            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 hover:text-[#4F46E5] dark:hover:text-indigo-300'"
        >
          <span
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            :class="route.path === '/import-export' && route.query.tab === 'users'
              ? 'bg-[#4F46E5] text-white'
              : 'bg-indigo-100/80 text-[#4F46E5] dark:bg-indigo-950/60 dark:text-indigo-300'"
          >
            <i class="fa-solid fa-users-gear text-sm" aria-hidden="true"></i>
          </span>
          <span>Kelola Akun</span>
        </router-link>
      </nav>
    </div>

    <!-- SISI BAWAH: TEMA & INFO SISTEM -->
    <div class="p-4 border-t border-sky-100 dark:border-slate-800 space-y-2.5 bg-gradient-to-br from-sky-50/50 via-white to-amber-50/40 dark:from-slate-900 dark:to-slate-900">
      <!-- Tombol Keluar dari Akun -->
      <button
        @click="handleLogout"
        type="button"
        class="w-full py-2 px-3.5 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100/80 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between transition-colors shadow-2xs"
      >
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
          <span>Keluar dari Akun</span>
        </div>
        <i class="fa-solid fa-chevron-right text-[10px] text-rose-400" aria-hidden="true"></i>
      </button>

      <!-- Tombol Pengubah Tema -->
      <button
        @click="toggleDarkMode"
        type="button"
        class="w-full py-2 px-3.5 rounded-2xl border border-sky-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50/60 dark:hover:bg-slate-700/60 text-xs font-semibold flex items-center justify-between transition-colors shadow-2xs"
      >
        <div class="flex items-center gap-2.5">
          <i v-if="isDark" class="fa-solid fa-sun text-amber-400 text-sm" aria-hidden="true"></i>
          <i v-else class="fa-solid fa-moon text-[#0369A1] text-sm" aria-hidden="true"></i>
          <span>{{ isDark ? 'Mode Terang' : 'Mode Gelap' }}</span>
        </div>
        <span class="text-xs font-medium text-[#64748B] dark:text-slate-400">
          {{ isDark ? 'Gelap' : 'Terang' }}
        </span>
      </button>

      <!-- Informasi Footer Sekolah Ringkas -->
      <div class="text-xs text-slate-500 dark:text-slate-400 pt-1 leading-snug">
        <div class="flex items-center justify-between gap-2">
          <p class="font-semibold text-slate-800 dark:text-slate-300">SMA Negeri 2 Ngawi</p>
          <span class="inline-flex items-center gap-1" aria-hidden="true">
            <span class="w-2 h-2 rounded-full bg-[#0284C7]"></span>
            <span class="w-2 h-2 rounded-full bg-[#E11D48]"></span>
            <span class="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
            <span class="w-2 h-2 rounded-full bg-[#10B981]"></span>
          </span>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-500 mt-0.5">Ruang Cerita &amp; Tracer Study BK</p>
      </div>
    </div>
  </aside>
</template>

