<script setup>
import { useAuthStore } from '@/stores/auth'

defineProps({
  title: {
    type: String,
    default: 'Halaman Khusus Admin & Guru BK'
  },
  description: {
    type: String,
    default: 'Anda sedang menggunakan mode akses Pengunjung (Tamu). Fitur ini khusus untuk Guru BK SMADA.'
  },
  backTo: {
    type: String,
    default: '/dashboard'
  },
  backLabel: {
    type: String,
    default: 'Kembali ke Ringkasan'
  },
  backIcon: {
    type: String,
    default: 'fa-solid fa-chart-pie'
  }
})

const authStore = useAuthStore()
</script>

<template>
  <section
    class="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-6 sm:p-10 text-center max-w-2xl mx-auto shadow-[var(--shadow-card)]"
    aria-labelledby="admin-guard-heading"
  >
    <div class="w-14 h-14 mx-auto rounded-2xl bg-[#FEF3C7] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 flex items-center justify-center mb-4">
      <i class="fa-solid fa-lock text-2xl" aria-hidden="true"></i>
    </div>
    <h1 id="admin-guard-heading" class="font-display font-bold text-xl sm:text-2xl text-[#0F172A] dark:text-white mb-2.5">
      {{ title }}
    </h1>
    <p class="text-sm sm:text-base text-[#334155] dark:text-slate-300 leading-relaxed mb-6">
      {{ description }}
    </p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
      <button
        type="button"
        @click="authStore.setRole('admin')"
        class="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm sm:text-base font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
      >
        <i class="fa-solid fa-user-shield" aria-hidden="true"></i>
        <span>Beralih ke Mode Guru BK</span>
      </button>
      <router-link
        :to="backTo"
        class="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-sm sm:text-base font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        <i :class="backIcon" aria-hidden="true"></i>
        <span>{{ backLabel }}</span>
      </router-link>
    </div>
  </section>
</template>

