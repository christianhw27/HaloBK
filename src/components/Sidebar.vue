<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const alumniStore = useAlumniStore()

const isDark = ref(false)
const isMobileOpen = ref(false)

function handleLogout() {
  authStore.logout()
  router.push('/')
}

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
  <header class="lg:hidden sticky top-0 z-40 bg-gradient-to-r from-white/95 via-sky-50/60 to-amber-50/50 dark:from-slate-900/95 dark:via-slate-900/95 dark:to-slate-900/95 backdrop-blur-md border-b border-sky-200/70 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button
        @click="isMobileOpen = true"
        type="button"
        class="w-10 h-10 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 flex items-center justify-center text-base border border-sky-200/80 dark:border-slate-700 focus-visible:ring-2"
        aria-label="Buka Menu Navigasi"
      >
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
      </button>

      <div class="flex items-center gap-2">
        <img
          src="/logo.png"
          alt="Logo BK SMADA"
          class="w-8 h-8 rounded-xl object-contain bg-white dark:bg-slate-800 border border-sky-200/80 dark:border-slate-700 p-0.5 shrink-0"
          onerror="this.onerror=null; this.classList.add('hidden'); if(this.nextElementSibling) this.nextElementSibling.classList.remove('hidden');"
        />
        <div class="w-8 h-8 rounded-xl bg-[#E0F2FE] dark:bg-slate-800 text-[#0369A1] dark:text-sky-400 flex items-center justify-center font-bold text-sm hidden">
          <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
        </div>
        <div>
          <span class="font-display font-bold text-base text-slate-900 dark:text-white leading-tight block">
            Halo Alumni
          </span>
          <span class="text-xs text-[#0369A1] dark:text-sky-300 font-medium block -mt-0.5">
            Sahabat BK SMADA
          </span>
        </div>
      </div>
    </div>

    <!-- Status Peran di Bar Atas Mobile (Static, Tanpa Pindah Cepat) -->
    <div class="flex items-center gap-2">
      <div
        class="px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 bg-white dark:bg-slate-800 border-sky-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs"
      >
        <span
          class="w-2 h-2 rounded-full"
          :class="authStore.userRole === 'admin' ? 'bg-emerald-500' : 'bg-[#0284C7]'"
          aria-hidden="true"
        ></span>
        <span class="max-w-[90px] truncate">{{ authStore.userRole === 'admin' ? 'Guru BK' : 'Pengunjung' }}</span>
      </div>

      <button
        @click="toggleDarkMode"
        type="button"
        class="w-9 h-9 rounded-xl bg-amber-50 dark:bg-slate-800 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm border border-amber-200/80 dark:border-slate-700"
        :aria-label="isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'"
      >
        <i v-if="isDark" class="fa-solid fa-sun text-amber-400" aria-hidden="true"></i>
        <i v-else class="fa-solid fa-moon text-[#0369A1]" aria-hidden="true"></i>
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
    class="fixed lg:sticky top-0 left-0 z-50 h-screen w-64 xl:w-72 bg-white dark:bg-slate-900 border-r border-sky-200/70 dark:border-slate-800 flex flex-col justify-between shrink-0 transition-transform duration-200 ease-out lg:translate-x-0"
    :class="isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'"
    aria-label="Navigasi Samping"
  >
    <!-- Garis Aksen Empat Pilar BK -->
    <div class="h-1.5 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981] shrink-0" aria-hidden="true"></div>

    <!-- SISI ATAS: LOGO & MENU UTAMA -->
    <div class="flex-1 flex flex-col overflow-y-auto">
      
      <!-- Brand & Identitas Sekolah -->
      <div class="p-5 border-b border-sky-100 dark:border-slate-800 bg-gradient-to-br from-sky-50/90 via-white to-amber-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30 flex items-center justify-between">
        <router-link to="/dashboard" class="flex items-center gap-3 group focus-visible:rounded-xl">
          <img
            src="/logo.png"
            alt="Logo BK SMADA"
            class="w-10 h-10 rounded-2xl object-contain bg-white dark:bg-slate-800 border border-sky-200/80 dark:border-slate-700 p-0.5 shrink-0 shadow-sm"
            onerror="this.onerror=null; this.classList.add('hidden'); if(this.nextElementSibling) this.nextElementSibling.classList.remove('hidden');"
          />
          <div class="w-10 h-10 rounded-2xl bg-[#E0F2FE] dark:bg-slate-800 border border-sky-200 dark:border-slate-700 flex items-center justify-center text-[#0369A1] dark:text-sky-400 shrink-0 hidden">
            <i class="fa-solid fa-graduation-cap text-lg" aria-hidden="true"></i>
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-display font-bold text-lg text-slate-900 dark:text-white leading-tight">
                Halo Alumni
              </span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] dark:bg-amber-950/80 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                SMADA
              </span>
            </div>
            <p class="text-xs text-[#0369A1] dark:text-sky-300 font-medium mt-0.5">
              Sahabat BK &amp; Jejak Alumni
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
              :class="authStore.userRole === 'admin' ? 'bg-emerald-500' : 'bg-[#0284C7]'"
              aria-hidden="true"
            ></span>
            <span class="truncate font-semibold">{{ authStore.userName }}</span>
          </div>
          <span
            class="text-[11px] font-medium px-2 py-0.5 rounded-full"
            :class="authStore.userRole === 'admin'
              ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50'
              : 'text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/50'"
          >
            {{ authStore.userRole === 'admin' ? 'Pengelola' : 'Tamu' }}
          </span>
        </div>
      </div>

      <!-- Menu Navigasi Utama -->
      <nav class="p-3.5 space-y-1.5 flex-1" aria-label="Menu Utama">
        <!-- Tautan Kembali ke Portal Berita Publik -->
        <router-link
          to="/"
          class="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all mb-2.5 border border-amber-200/90 dark:border-amber-800/60 bg-gradient-to-r from-[#FFFBEB] via-white to-[#E0F2FE]/60 dark:from-amber-950/35 dark:via-slate-900 dark:to-sky-950/35 text-slate-800 dark:text-slate-100 hover:border-amber-300 hover:shadow-xs"
        >
          <span class="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-2xs">
            <i class="fa-solid fa-newspaper text-sm" aria-hidden="true"></i>
          </span>
          <span>Portal Berita</span>
        </router-link>

        <div class="text-xs font-bold text-[#64748B] dark:text-slate-400 tracking-wide px-2 py-1">
          Jelajahi Menu
        </div>

        <!-- 1. Ringkasan (Dashboard - Trust Blue) -->
        <router-link
          to="/dashboard"
          class="w-full px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border"
          :class="route.path === '/dashboard'
            ? 'bg-[#E0F2FE] text-[#0369A1] border-sky-200 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-800 shadow-2xs'
            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-sky-50/70 dark:hover:bg-slate-800/80 hover:text-[#0369A1] dark:hover:text-sky-300'"
        >
          <span
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            :class="route.path === '/dashboard'
              ? 'bg-[#0369A1] text-white'
              : 'bg-sky-100/80 text-[#0369A1] dark:bg-sky-950/60 dark:text-sky-300'"
          >
            <i class="fa-solid fa-chart-pie text-sm" aria-hidden="true"></i>
          </span>
          <span>Ringkasan</span>
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

        <!-- 3. Lapor Diri (Hope Amber) -->
        <router-link
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
            v-if="alumniStore.pendingList.length > 0"
            class="px-2 py-0.5 rounded-full text-xs font-bold"
            :class="route.path === '/verifikasi'
              ? 'bg-white text-[#BE123C]'
              : 'bg-amber-500 text-slate-950'"
            aria-label="Antrean pengajuan verifikasi"
          >
            {{ alumniStore.pendingList.length }}
          </span>
        </router-link>

        <!-- 5. Kelola Data & Excel (Growth Emerald - Khusus Guru BK) -->
        <router-link
          v-if="authStore.userRole === 'admin'"
          to="/import-export"
          class="w-full px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border"
          :class="route.path === '/import-export'
            ? 'bg-[#D1FAE5] text-[#047857] border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800 shadow-2xs'
            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-emerald-50/70 dark:hover:bg-slate-800/80 hover:text-[#047857] dark:hover:text-emerald-300'"
        >
          <span
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            :class="route.path === '/import-export'
              ? 'bg-[#047857] text-white'
              : 'bg-emerald-100/80 text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300'"
          >
            <i class="fa-solid fa-database text-sm" aria-hidden="true"></i>
          </span>
          <span>Kelola Data & Excel</span>
        </router-link>

        <!-- 6. Kelola Portal Berita (Warm Magenta - Admin / Guru BK) -->
        <router-link
          v-if="authStore.userRole === 'admin'"
          to="/kelola-berita"
          class="w-full px-3 py-2 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border"
          :class="route.path === '/kelola-berita'
            ? 'bg-[#FFE4E6] text-[#BE123C] border-rose-200 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800 shadow-2xs'
            : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-rose-50/70 dark:hover:bg-slate-800/80 hover:text-[#BE123C] dark:hover:text-rose-300'"
        >
          <span
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            :class="route.path === '/kelola-berita'
              ? 'bg-[#BE123C] text-white'
              : 'bg-rose-100/80 text-[#BE123C] dark:bg-rose-950/60 dark:text-rose-300'"
          >
            <i class="fa-solid fa-pen-nib text-sm" aria-hidden="true"></i>
          </span>
          <span>Kelola Berita</span>
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

