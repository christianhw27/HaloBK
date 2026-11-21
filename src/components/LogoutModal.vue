<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const remainingSeconds = ref(4)
let countdownTimer = null

function handleClose() {
  authStore.closeLogoutNotice()
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

watch(
  () => authStore.showLogoutNotice,
  (isOpen) => {
    if (isOpen) {
      remainingSeconds.value = 4
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = setInterval(() => {
        remainingSeconds.value--
        if (remainingSeconds.value <= 0) {
          handleClose()
        }
      }, 1000)
    } else {
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }
  }
)

function handleKeydown(e) {
  if (authStore.showLogoutNotice && (e.key === 'Escape' || e.key === 'Enter')) {
    handleClose()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<template>
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
        v-if="authStore.showLogoutNotice"
        class="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
        @click.self="handleClose"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-notice-title"
      >
        <div
          class="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <!-- Top Gradient Accent Bar -->
          <div class="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500"></div>

          <div class="p-6 sm:p-7 space-y-5">
            <div class="flex items-start gap-4">
              <!-- Squircle Icon -->
              <div
                class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-xs bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80"
              >
                <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
              </div>

              <!-- Text Content -->
              <div class="space-y-1.5 flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 id="logout-notice-title" class="font-display font-bold text-lg text-slate-900 dark:text-white leading-tight">
                    Berhasil Keluar
                  </h3>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Sesi Diakhiri
                  </span>
                </div>
                <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {{ authStore.logoutNoticeMessage || 'Anda telah berhasil keluar dari akun. Sesi telah diakhiri dan Anda telah dialihkan kembali ke Portal Berita SMADA.' }}
                </p>
              </div>
            </div>

            <!-- Footer Action -->
            <div class="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <span class="text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1.5">
                <i class="fa-regular fa-clock text-[11px]" aria-hidden="true"></i>
                Menutup otomatis ({{ remainingSeconds }}s)
              </span>

              <button
                type="button"
                @click="handleClose"
                class="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer flex items-center gap-2"
              >
                <span>Oke, Paham</span>
                <i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
