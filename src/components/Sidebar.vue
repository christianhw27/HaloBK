<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'

const route = useRoute()
const authStore = useAuthStore()
const alumniStore = useAlumniStore()

const isDark = ref(false)
const isMobileOpen = ref(false)

onMounted(() => {
  if (localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
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
  <!-- TOP BAR KHUSUS LAYAR MOBILE & TABLET (< lg) -->
  <header class="lg:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button
        @click="isMobileOpen = true"
        type="button"
        class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-base border border-slate-200 dark:border-slate-700 focus-visible:ring-2"
        aria-label="Buka Menu Navigasi"
      >
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
      </button>

      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-800 text-amber-400 flex items-center justify-center font-bold text-sm">
          <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
        </div>
        <div>
          <span class="font-display font-bold text-sm text-slate-900 dark:text-white leading-tight block">
            Halo Alumni
          </span>
          <span class="text-[10px] text-slate-500 dark:text-slate-400 block -mt-0.5">
            BK SMADA Ngawi
          </span>
        </div>
      </div>
    </div>

    <!-- Tombol Cepat Tema di Bar Atas Mobile -->
    <div class="flex items-center gap-2">
      <button
        @click="authStore.toggleRole()"
        type="button"
        class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
        :title="'Mode: ' + (authStore.userRole === 'admin' ? 'Guru BK' : 'Alumni')"
      >
        <span
          class="w-2 h-2 rounded-full"
          :class="authStore.userRole === 'admin' ? 'bg-emerald-500' : 'bg-blue-500'"
          aria-hidden="true"
        ></span>
        <span class="max-w-[90px] truncate">{{ authStore.userRole === 'admin' ? 'Guru BK' : 'Alumni' }}</span>
      </button>

      <button
        @click="toggleDarkMode"
        type="button"
        class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm border border-slate-200 dark:border-slate-700"
        :aria-label="isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'"
      >
        <i v-if="isDark" class="fa-solid fa-sun text-amber-400" aria-hidden="true"></i>
        <i v-else class="fa-solid fa-moon text-slate-600" aria-hidden="true"></i>
      </button>
    </div>
  </header>

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

  <!-- SIDEBAR CONTAINER (DESKTOP: STICKY ASIDE, MOBILE: OFF-CANVAS DRAWER) -->
  <aside
    class="fixed lg:sticky top-0 left-0 z-50 h-screen w-64 xl:w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 transition-transform duration-200 ease-out lg:translate-x-0"
    :class="isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'"
    aria-label="Navigasi Samping"
  >
    <!-- SISI ATAS: LOGO & MENU UTAMA -->
    <div class="flex-1 flex flex-col overflow-y-auto">
      
      <!-- Brand & Identitas Sekolah -->
      <div class="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <router-link to="/dashboard" class="flex items-center gap-3 group focus-visible:rounded-lg">
          <div class="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
            <i class="fa-solid fa-graduation-cap text-lg" aria-hidden="true"></i>
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-display font-bold text-base text-slate-900 dark:text-white leading-tight">
                Halo Alumni
              </span>
              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                SMADA
              </span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Tracer Study BK Ngawi
            </p>
          </div>
        </router-link>

        <!-- Tombol Tutup Khusus Mobile Drawer -->
        <button
          @click="isMobileOpen = false"
          type="button"
          class="lg:hidden w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center"
          aria-label="Tutup menu navigasi"
        >
          <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Kartu Peran Akun Pengguna -->
      <div class="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Mode Akses
          </span>
          <span
            class="text-[10px] font-bold px-2 py-0.5 rounded-full"
            :class="authStore.userRole === 'admin'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'"
          >
            {{ authStore.userRole === 'admin' ? 'Guru BK' : 'Alumni' }}
          </span>
        </div>

        <button
          @click="authStore.toggleRole()"
          type="button"
          class="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-colors bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm"
          title="Klik untuk beralih antara akun Guru BK dan Alumni"
        >
          <div class="flex items-center gap-2 truncate">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :class="authStore.userRole === 'admin' ? 'bg-emerald-500' : 'bg-blue-500'"
              aria-hidden="true"
            ></span>
            <span class="truncate font-medium">{{ authStore.userName }}</span>
          </div>
          <i class="fa-solid fa-repeat text-[10px] text-slate-400 ml-1.5 shrink-0" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Menu Navigasi Utama -->
      <nav class="p-3 space-y-1 flex-1" aria-label="Menu Utama">
        <div class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-1.5">
          Menu Aplikasi
        </div>

        <!-- 1. Ringkasan (Dashboard) -->
        <router-link
          to="/dashboard"
          class="w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-3 transition-colors"
          :class="route.path === '/dashboard'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'"
        >
          <i class="fa-solid fa-chart-pie text-sm w-4 text-center" aria-hidden="true"></i>
          <span>Ringkasan</span>
        </router-link>

        <!-- 2. Direktori Data Alumni -->
        <router-link
          to="/data"
          class="w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-3 transition-colors"
          :class="route.path === '/data'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'"
        >
          <i class="fa-solid fa-users text-sm w-4 text-center" aria-hidden="true"></i>
          <span>Direktori Alumni</span>
        </router-link>

        <!-- 3. Lapor Diri -->
        <router-link
          to="/lapor"
          class="w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-3 transition-colors"
          :class="route.path === '/lapor'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'"
        >
          <i class="fa-solid fa-user-plus text-sm w-4 text-center" aria-hidden="true"></i>
          <span>Formulir Lapor Diri</span>
        </router-link>

        <!-- 4. Verifikasi Laporan ACC (Khusus Guru BK & Menampilkan Notifikasi Antrean) -->
        <router-link
          to="/verifikasi"
          class="w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors"
          :class="route.path === '/verifikasi'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'"
        >
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-shield-halved text-sm w-4 text-center" aria-hidden="true"></i>
            <span>Verifikasi Laporan</span>
          </div>
          <span
            v-if="alumniStore.pendingList.length > 0"
            class="px-2 py-0.5 rounded-full text-[10px] font-bold"
            :class="route.path === '/verifikasi'
              ? 'bg-white text-blue-700'
              : 'bg-amber-500 text-slate-950'"
            aria-label="Antrean pengajuan verifikasi"
          >
            {{ alumniStore.pendingList.length }}
          </span>
        </router-link>

        <!-- 5. Kelola Data & Excel (CRUD, Import, Export) -->
        <router-link
          to="/import-export"
          class="w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-3 transition-colors"
          :class="route.path === '/import-export'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'"
        >
          <i class="fa-solid fa-database text-sm w-4 text-center" aria-hidden="true"></i>
          <span>Kelola Data & Excel</span>
        </router-link>
      </nav>
    </div>

    <!-- SISI BAWAH: TEMA & INFO SISTEM -->
    <div class="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900">
      <!-- Tombol Pengubah Tema -->
      <button
        @click="toggleDarkMode"
        type="button"
        class="w-full py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold flex items-center justify-between transition-colors shadow-sm"
      >
        <div class="flex items-center gap-2.5">
          <i v-if="isDark" class="fa-solid fa-sun text-amber-400 text-sm" aria-hidden="true"></i>
          <i v-else class="fa-solid fa-moon text-slate-600 text-sm" aria-hidden="true"></i>
          <span>{{ isDark ? 'Mode Terang' : 'Mode Gelap' }}</span>
        </div>
        <span class="text-[11px] text-slate-400">
          {{ isDark ? 'Gelap' : 'Terang' }}
        </span>
      </button>

      <!-- Informasi Footer Sekolah Ringkas -->
      <div class="text-[11px] text-slate-500 dark:text-slate-500 pt-1 leading-tight">
        <p class="font-semibold text-slate-700 dark:text-slate-400">SMA Negeri 2 Ngawi</p>
        <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Sistem Tracer Study Alumni BK</p>
      </div>
    </div>
  </aside>
</template>

