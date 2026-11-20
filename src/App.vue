<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '@/components/Sidebar.vue'
import EligibleCongratsModal from '@/components/EligibleCongratsModal.vue'
import HaloBKChatWidget from '@/components/HaloBKChatWidget.vue'
import { useAuthStore } from '@/stores/auth'
import { useEligibleStore } from '@/stores/eligible'

const route = useRoute()
const authStore = useAuthStore()
const eligibleStore = useEligibleStore()

// Penentuan tata letak eksplisit: Hanya rute modul Tracer Study yang memuat Sidebar Tracer Study
const isTracerLayout = computed(() => {
  const p = route.path || ''
  return (
    p === '/tracer-study' ||
    p === '/dashboard' ||
    p === '/data' ||
    p === '/lapor' ||
    p === '/verifikasi' ||
    p === '/import-export' ||
    p.startsWith('/tracer-study/') ||
    p.startsWith('/data/') ||
    p.startsWith('/lapor/')
  )
})

// Cek status Siswa Eligible secara reaktif setiap kali sesi login terverifikasi atau akun berganti
watch(
  () => [authStore.isLoggedIn, authStore.userRole, authStore.currentUser?.id],
  async ([loggedIn, role, uid]) => {
    if (loggedIn && role !== 'admin' && uid) {
      await eligibleStore.checkMyEligibleStatus()
    } else if (!loggedIn) {
      eligibleStore.resetMyEligibleState()
    }
  },
  { immediate: true }
)
</script>

<template>
  <!-- Tata Letak Aplikasi Tracer Study (Eksklusif Rute Tracer Study) -->
  <div v-if="isTracerLayout" class="min-h-screen bg-gradient-to-br from-[#EFF6FF]/90 via-[#F8FAFC] to-[#FFFBEB]/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-700 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
    <!-- Aksesibilitas: Tautan Langsung ke Konten Utama -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#0369A1] text-white font-semibold rounded-xl shadow-lg"
    >
      Lewati ke konten utama
    </a>

    <!-- Navigasi Samping Tracer Study -->
    <Sidebar />

    <!-- Konten Utama Aplikasi (Full Width dengan offset sidebar desktop) -->
    <div class="flex-1 flex flex-col min-w-0 lg:pl-64 xl:pl-72">
      <main id="main-content" class="flex-1 w-full px-3.5 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-8">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- Footer Institusional Ruang BK Smada -->
      <footer class="border-t border-sky-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/95 text-slate-600 dark:text-slate-400 text-xs sm:text-sm py-4 px-3.5 sm:px-6 lg:px-8 xl:px-10">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left">
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span class="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-200">
              <span class="w-2.5 h-2.5 rounded-full bg-[#0284C7]" aria-hidden="true"></span>
              Ruang BK SMADA &bull; SMA Negeri 2 Ngawi
            </span>
            <span class="text-slate-400 hidden sm:inline" aria-hidden="true">&bull;</span>
            <span class="text-slate-500 dark:text-slate-400">Portal Bimbingan Konseling &amp; Tracer Study</span>
          </div>
          <div class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            <span>Jl. Ahmad Yani Tromol Pos 7, Geneng, Ngawi 63217</span>
          </div>
        </div>
      </footer>
    </div>
  </div>

  <!-- Tata Letak Publik & Modul Stand-Alone (Portal Berita, Modul Siswa Eligible, Profil) -->
  <div v-else class="min-h-screen font-sans">
    <router-view />
    <!-- Pop-up Ucapan Selamat Siswa Eligible Pertama Kali Login -->
    <EligibleCongratsModal />
  </div>

  <!-- Widget Konsultasi Chat HaloBK (Hanya Tampil Jika Sudah Login dan Bukan Admin) -->
  <HaloBKChatWidget v-if="authStore.isLoggedIn && authStore.userRole !== 'admin'" />
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
