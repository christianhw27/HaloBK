<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useEligibleStore } from '@/stores/eligible'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const eligibleStore = useEligibleStore()
const authStore = useAuthStore()

const isOpen = computed(() => {
  return (
    authStore.isLoggedIn &&
    authStore.userRole === 'siswa' &&
    eligibleStore.isEligible &&
    !eligibleStore.myEligibleData?.has_seen_popup
  )
})

async function handleGoToEligible() {
  await eligibleStore.markPopupSeen()
  router.push('/eligible')
}

async function handleClose() {
  await eligibleStore.markPopupSeen()
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-amber-300 dark:border-amber-700/60 shadow-2xl overflow-hidden p-6 sm:p-8 text-center space-y-5 animate-in">
        
        <!-- Ornamen Banner Selamat -->
        <div class="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-200 text-amber-950 flex items-center justify-center shadow-lg shadow-amber-500/30 text-3xl">
          <i class="fa-solid fa-award"></i>
        </div>

        <div class="space-y-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800">
            <i class="fa-solid fa-sparkles text-amber-500"></i>
            <span>SELAMAT! SISWA ELIGIBLE SNBP</span>
          </span>

          <h2 class="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Halo, {{ authStore.userName }}!
          </h2>

          <p class="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
            Anda telah resmi ditetapkan oleh pihak Bimbingan Konseling sebagai <strong>Siswa Eligible SNBP SMA Negeri 2 Ngawi Tahun Ajaran {{ eligibleStore.currentAcademicYear }}</strong>.
          </p>
        </div>

        <div class="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-left text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1.5">
          <div class="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-check text-amber-600"></i>
            <span>Langkah Wajib Selanjutnya:</span>
          </div>
          <ul class="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 pl-1">
            <li>Tentukan <strong>Pilihan 1 &amp; Pilihan 2</strong> Program Studi PTN.</li>
            <li>Lengkapi <strong>Tabel Nilai Rapor Semester 1 s.d. 5</strong>.</li>
            <li>Unggah sertifikat prestasi pendukung (jika ada).</li>
          </ul>
        </div>

        <div class="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            type="button"
            @click="handleGoToEligible"
            class="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-bold text-sm sm:text-base shadow-md shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
          >
            <span>Isi Data Eligible Sekarang</span>
            <i class="fa-solid fa-arrow-right text-xs"></i>
          </button>
          
          <button
            type="button"
            @click="handleClose"
            class="w-full sm:w-auto py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
          >
            Nanti Saja
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>
