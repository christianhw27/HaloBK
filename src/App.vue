<script setup>
import { useRoute } from 'vue-router'
import Sidebar from '@/components/Sidebar.vue'

const route = useRoute()
</script>

<template>
  <!-- Tata Letak Publik: Portal Berita (Sebelum Masuk Aplikasi Tracer Study) -->
  <div v-if="route.meta?.layout === 'public'" class="min-h-screen font-sans">
    <router-view />
  </div>

  <!-- Tata Letak Aplikasi Tracer Study (Dengan Sidebar Tetap) -->
  <div v-else class="min-h-screen bg-gradient-to-br from-[#EFF6FF]/90 via-[#F8FAFC] to-[#FFFBEB]/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-700 dark:text-slate-100 flex flex-col lg:flex-row font-sans transition-colors duration-200">
    <!-- Aksesibilitas: Tautan Langsung ke Konten Utama -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#0369A1] text-white font-semibold rounded-xl shadow-lg"
    >
      Lewati ke konten utama
    </a>

    <!-- Navigasi Samping (Sidebar Desktop & Drawer Mobile) -->
    <Sidebar />

    <!-- Konten Utama Aplikasi (Full Width Tanpa Margin Kosong Berlebih) -->
    <div class="flex-1 flex flex-col min-w-0">
      <main id="main-content" class="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- Footer Hangat Bersama Alumni -->
      <footer class="border-t border-sky-200/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/95 text-slate-600 dark:text-slate-400 text-sm py-4 px-4 sm:px-6 lg:px-8 xl:px-10">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-200">
              <span class="w-2 h-2 rounded-full bg-[#0284C7]" aria-hidden="true"></span>
              Halo Alumni &bull; SMA Negeri 2 Ngawi
            </span>
            <span class="text-slate-400" aria-hidden="true">&bull;</span>
            <span>Ruang Sahabat BK &amp; Jejaring Lulusan</span>
          </div>
          <div>
            <span>Jalan Ahmad Yani Tromol Pos 7, Klitik, Kecamatan Geneng, Kabupaten Ngawi, Jawa Timur 63217</span>
          </div>
        </div>
      </footer>
    </div>
  </div>
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
