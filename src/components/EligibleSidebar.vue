<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEligibleStore } from '@/stores/eligible'

const props = defineProps({
  activeTab: {
    type: String,
    default: 'siswa'
  }
})

const emit = defineEmits(['update:activeTab', 'tab-change'])

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const eligibleStore = useEligibleStore()

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

function selectTab(tabKey) {
  emit('update:activeTab', tabKey)
  emit('tab-change', tabKey)
  isMobileOpen.value = false
}
</script>

<template>
  <!-- SUB-BAR NAVIGASI KHUSUS MOBILE (< lg) DI BAWAH NAVBAR UTAMA -->
  <div class="lg:hidden sticky top-16 sm:top-[72px] z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-purple-200/70 dark:border-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 shadow-2xs w-full max-w-full min-w-0">
    <button
      @click="isMobileOpen = true"
      type="button"
      class="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800 text-xs font-bold transition-all shadow-2xs shrink-0"
      aria-label="Buka Menu Eligible"
    >
      <i class="fa-solid fa-bars-staggered text-xs" aria-hidden="true"></i>
      <span>Menu Eligible</span>
    </button>

    <div class="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 min-w-0 truncate">
      <span class="w-2 h-2 rounded-full bg-purple-600 shrink-0" aria-hidden="true"></span>
      <span class="truncate">{{ authStore.userRole === 'admin' ? 'Kelola SNBP' : 'Portal SNBP' }}</span>
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

  <!-- SIDEBAR CONTAINER MODUL ELIGIBLE (DESKTOP: FIXED ASIDE DOCKING DI BAWAH NAVBAR, MOBILE: OFF-CANVAS DRAWER) -->
  <aside
    class="fixed top-0 lg:top-16 sm:lg:top-[72px] left-0 z-[60] lg:z-30 h-screen lg:h-[calc(100vh-4rem)] sm:lg:h-[calc(100vh-4.5rem)] w-64 xl:w-72 bg-white dark:bg-slate-900 border-r border-purple-200/70 dark:border-slate-800 flex flex-col justify-between shrink-0 transition-transform duration-200 ease-out"
    :class="isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'"
    aria-label="Navigasi Samping Modul Eligible"
  >
    <!-- Garis Aksen Khas Seleksi SNBP -->
    <div class="h-1.5 w-full bg-gradient-to-r from-purple-600 via-indigo-600 via-amber-500 to-emerald-500 shrink-0" aria-hidden="true"></div>

    <!-- SISI ATAS: LOGO & MENU UTAMA -->
    <div class="flex-1 flex flex-col overflow-y-auto">
      
      <!-- Brand & Identitas Modul -->
      <div class="p-4 border-b border-purple-100 dark:border-slate-800 bg-gradient-to-br from-purple-50/90 via-white to-amber-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/30 flex items-center justify-between">
        <router-link :to="authStore.userRole === 'admin' ? '/admin/eligible' : '/eligible'" class="flex items-center gap-2.5 group focus-visible:rounded-xl">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-xs group-hover:scale-105 transition-transform">
            <i class="fa-solid fa-award" aria-hidden="true"></i>
          </div>
          <div>
            <span class="font-display font-bold text-sm text-slate-900 dark:text-white leading-tight block">
              Siswa Eligible
            </span>
            <p class="text-[11px] text-purple-700 dark:text-purple-300 font-semibold mt-0.5">
              Seleksi SNBP
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

      <!-- Kartu Status Akun Pengguna -->
      <div class="p-4 border-b border-purple-100/80 dark:border-slate-800/80 bg-gradient-to-br from-purple-50/75 via-white to-amber-50/55 dark:from-slate-800/50 dark:via-slate-900 dark:to-slate-900">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wide">
            Masuk Sebagai
          </span>
          <span
            class="text-xs font-bold px-2.5 py-0.5 rounded-full border"
            :class="authStore.userRole === 'admin'
              ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800'
              : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800'"
          >
            {{ authStore.userRole === 'admin' ? 'Guru BK' : 'Siswa Eligible' }}
          </span>
        </div>

        <div class="w-full py-2.5 px-3.5 rounded-2xl text-sm font-semibold flex items-center justify-between border bg-white dark:bg-slate-900 border-purple-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs">
          <div class="flex items-center gap-2 truncate">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :class="authStore.userRole === 'admin' ? 'bg-purple-600' : 'bg-amber-500'"
              aria-hidden="true"
            ></span>
            <span class="truncate font-semibold">{{ authStore.userName }}</span>
          </div>
          <span class="text-[11px] font-medium px-2 py-0.5 rounded-full text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/50">
            {{ eligibleStore.currentAcademicYear }}
          </span>
        </div>
      </div>

      <!-- Menu Navigasi Utama Modul Eligible -->
      <nav class="p-3.5 space-y-1.5 flex-1" aria-label="Menu Modul Eligible">
        <div class="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase px-2 py-1">
          Menu Seleksi SNBP
        </div>

        <!-- JIKA USER ADALAH ADMIN / GURU BK -->
        <template v-if="authStore.userRole === 'admin'">
          <!-- 1. Daftar Siswa -->
          <button
            type="button"
            @click="selectTab('siswa')"
            class="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-between transition-all border text-left"
            :class="props.activeTab === 'siswa'
              ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-800 shadow-2xs font-bold'
              : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-purple-50/70 dark:hover:bg-slate-800/80 hover:text-purple-700 dark:hover:text-purple-300'"
          >
            <div class="flex items-center gap-3">
              <span
                class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                :class="props.activeTab === 'siswa'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-100/80 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'"
              >
                <i class="fa-solid fa-users-gear text-sm" aria-hidden="true"></i>
              </span>
              <span>Daftar Siswa &amp; Kuota</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-white dark:bg-slate-800 border border-purple-200 dark:border-slate-700 text-purple-700 dark:text-purple-300">
              {{ eligibleStore.allEligibleStudents.length }}
            </span>
          </button>

          <!-- 2. Validasi / ACC Ganda -->
          <button
            type="button"
            @click="selectTab('validasi')"
            class="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-between transition-all border text-left"
            :class="props.activeTab === 'validasi'
              ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800 shadow-2xs font-bold'
              : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-amber-50/70 dark:hover:bg-slate-800/80 hover:text-amber-800 dark:hover:text-amber-300'"
          >
            <div class="flex items-center gap-3">
              <span
                class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                :class="props.activeTab === 'validasi'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100/80 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'"
              >
                <i class="fa-solid fa-check-double text-sm" aria-hidden="true"></i>
              </span>
              <span>Validasi / ACC Ganda</span>
            </div>
            <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          </button>

          <!-- 3. Matriks Nilai & Ranking -->
          <button
            type="button"
            @click="selectTab('ranking')"
            class="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border text-left"
            :class="props.activeTab === 'ranking'
              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800 shadow-2xs font-bold'
              : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-emerald-50/70 dark:hover:bg-slate-800/80 hover:text-emerald-700 dark:hover:text-emerald-300'"
          >
            <span
              class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              :class="props.activeTab === 'ranking'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'"
            >
              <i class="fa-solid fa-table-list text-sm" aria-hidden="true"></i>
            </span>
            <span>Matriks &amp; Auto-Ranking</span>
          </button>

          <!-- 4. Master Mata Pelajaran -->
          <button
            type="button"
            @click="selectTab('mapel')"
            class="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border text-left"
            :class="props.activeTab === 'mapel'
              ? 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-800 shadow-2xs font-bold'
              : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 hover:text-indigo-700 dark:hover:text-indigo-300'"
          >
            <span
              class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              :class="props.activeTab === 'mapel'
                ? 'bg-indigo-700 text-white'
                : 'bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'"
            >
              <i class="fa-solid fa-book-open text-sm" aria-hidden="true"></i>
            </span>
            <span>Master Mata Pelajaran</span>
          </button>

          <!-- 5. Sinkronisasi Data SNPMB -->
          <button
            type="button"
            @click="selectTab('sync')"
            class="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border text-left"
            :class="props.activeTab === 'sync'
              ? 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-800 shadow-2xs font-bold'
              : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-sky-50/70 dark:hover:bg-slate-800/80 hover:text-sky-700 dark:hover:text-sky-300'"
          >
            <span
              class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              :class="props.activeTab === 'sync'
                ? 'bg-sky-700 text-white'
                : 'bg-sky-100/80 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'"
            >
              <i class="fa-solid fa-cloud-arrow-down text-sm" aria-hidden="true"></i>
            </span>
            <span>Sinkronisasi SNPMB</span>
          </button>
        </template>

        <!-- JIKA USER ADALAH SISWA ELIGIBLE -->
        <template v-else>
          <!-- 1. Pilihan PTN -->
          <button
            type="button"
            @click="selectTab('pilihan')"
            class="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border text-left"
            :class="props.activeTab === 'pilihan'
              ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-800 shadow-2xs font-bold'
              : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-purple-50/70 dark:hover:bg-slate-800/80 hover:text-purple-700 dark:hover:text-purple-300'"
          >
            <span
              class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              :class="props.activeTab === 'pilihan'
                ? 'bg-purple-700 text-white'
                : 'bg-purple-100/80 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'"
            >
              <i class="fa-solid fa-building-columns text-sm" aria-hidden="true"></i>
            </span>
            <span>1. Pilihan PTN &amp; Prodi</span>
          </button>

          <!-- 2. Nilai Rapor S1-S5 -->
          <button
            type="button"
            @click="selectTab('nilai')"
            class="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border text-left"
            :class="props.activeTab === 'nilai'
              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800 shadow-2xs font-bold'
              : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-emerald-50/70 dark:hover:bg-slate-800/80 hover:text-emerald-700 dark:hover:text-emerald-300'"
          >
            <span
              class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              :class="props.activeTab === 'nilai'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'"
            >
              <i class="fa-solid fa-graduation-cap text-sm" aria-hidden="true"></i>
            </span>
            <span>2. Nilai Rapor S1–S5</span>
          </button>

          <!-- 3. Portofolio Sertifikat -->
          <button
            type="button"
            @click="selectTab('sertifikat')"
            class="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-all border text-left"
            :class="props.activeTab === 'sertifikat'
              ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800 shadow-2xs font-bold'
              : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-amber-50/70 dark:hover:bg-slate-800/80 hover:text-amber-700 dark:hover:text-amber-300'"
          >
            <span
              class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              :class="props.activeTab === 'sertifikat'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-100/80 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'"
            >
              <i class="fa-solid fa-certificate text-sm" aria-hidden="true"></i>
            </span>
            <span>3. Portofolio Sertifikat</span>
          </button>
        </template>
      </nav>
    </div>

    <!-- SISI BAWAH: TEMA & INFO SISTEM -->
    <div class="p-4 border-t border-purple-100 dark:border-slate-800 space-y-2.5 bg-gradient-to-br from-purple-50/50 via-white to-amber-50/40 dark:from-slate-900 dark:to-slate-900">
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
        class="w-full py-2 px-3.5 rounded-2xl border border-purple-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50/60 dark:hover:bg-slate-700/60 text-xs font-semibold flex items-center justify-between transition-colors shadow-2xs"
      >
        <div class="flex items-center gap-2.5">
          <i v-if="isDark" class="fa-solid fa-sun text-amber-400 text-sm" aria-hidden="true"></i>
          <i v-else class="fa-solid fa-moon text-purple-700 text-sm" aria-hidden="true"></i>
          <span>{{ isDark ? 'Mode Terang' : 'Mode Gelap' }}</span>
        </div>
        <span class="text-xs font-medium text-slate-400">
          {{ isDark ? 'Gelap' : 'Terang' }}
        </span>
      </button>

      <!-- Informasi Footer Sekolah -->
      <div class="text-xs text-slate-500 dark:text-slate-400 pt-1 leading-snug">
        <div class="flex items-center justify-between gap-2">
          <p class="font-semibold text-slate-800 dark:text-slate-300">SMA Negeri 2 Ngawi</p>
          <span class="inline-flex items-center gap-1" aria-hidden="true">
            <span class="w-2 h-2 rounded-full bg-purple-600"></span>
            <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          </span>
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5">Modul Seleksi Siswa Eligible SNBP</p>
      </div>
    </div>
  </aside>
</template>
