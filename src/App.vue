<script setup>
import Sidebar from '@/components/Sidebar.vue'
</script>

<template>
  <div class="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row font-sans transition-colors duration-200">
    <!-- Aksesibilitas: Tautan Langsung ke Konten Utama -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-lg"
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

      <!-- Footer Institusional Penuh -->
      <footer class="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs py-4 px-4 sm:px-6 lg:px-8 xl:px-10">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-slate-800 dark:text-slate-200">
              Halo Alumni &bull; SMA Negeri 2 Ngawi
            </span>
            <span>&bull;</span>
            <span>Bimbingan Konseling Tracer Study</span>
          </div>
          <div>
            <span>Jl. Suryo No. 47, Grudo, Kec. Ngawi, Kabupaten Ngawi, Jawa Timur</span>
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
