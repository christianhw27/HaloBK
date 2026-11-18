<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isOpen = ref(false)
const options = ref({
  title: 'Konfirmasi Aksi',
  message: 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText: 'Ya, Lanjutkan',
  cancelText: 'Batal',
  type: 'primary' // 'primary' | 'danger' | 'warning' | 'info' | 'success'
})

let resolvePromise = null

function open(customOptions = {}) {
  options.value = {
    title: customOptions.title || 'Konfirmasi Tindakan',
    message: customOptions.message || 'Apakah Anda yakin ingin melanjutkan?',
    confirmText: customOptions.confirmText || 'Ya, Lanjutkan',
    cancelText: customOptions.cancelText || 'Batal',
    type: customOptions.type || 'primary'
  }
  isOpen.value = true

  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

function handleConfirm() {
  isOpen.value = false
  if (resolvePromise) resolvePromise(true)
}

function handleCancel() {
  isOpen.value = false
  if (resolvePromise) resolvePromise(false)
}

function handleKeydown(e) {
  if (e.key === 'Escape' && isOpen.value) {
    handleCancel()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

defineExpose({ open })
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
        v-if="isOpen"
        class="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
        @click.self="handleCancel"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div class="flex items-start gap-4">
            <!-- Squircle Icon Sesuai Type -->
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-xs"
              :class="{
                'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800': options.type === 'primary',
                'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800': options.type === 'danger',
                'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800': options.type === 'warning',
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800': options.type === 'success',
                'bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800': options.type === 'info'
              }"
            >
              <i v-if="options.type === 'danger'" class="fa-solid fa-triangle-exclamation"></i>
              <i v-else-if="options.type === 'warning'" class="fa-solid fa-circle-exclamation"></i>
              <i v-else-if="options.type === 'success'" class="fa-solid fa-circle-check"></i>
              <i v-else-if="options.type === 'info'" class="fa-solid fa-circle-info"></i>
              <i v-else class="fa-solid fa-award"></i>
            </div>

            <div class="space-y-1.5 flex-1 min-w-0">
              <h3 class="font-display font-bold text-lg text-slate-900 dark:text-white leading-tight">
                {{ options.title }}
              </h3>
              <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                {{ options.message }}
              </p>
            </div>
          </div>

          <!-- Tombol Aksi -->
          <div class="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              @click="handleCancel"
              class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              {{ options.cancelText }}
            </button>

            <button
              type="button"
              @click="handleConfirm"
              class="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xs transition-colors cursor-pointer"
              :class="{
                'bg-purple-600 hover:bg-purple-700': options.type === 'primary',
                'bg-rose-600 hover:bg-rose-700': options.type === 'danger',
                'bg-amber-600 hover:bg-amber-700': options.type === 'warning',
                'bg-emerald-600 hover:bg-emerald-700': options.type === 'success',
                'bg-[#0369A1] hover:bg-[#075985]': options.type === 'info'
              }"
            >
              {{ options.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
