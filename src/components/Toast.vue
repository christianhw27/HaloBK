<script setup>
import { ref } from 'vue'

const isVisible = ref(false)
const message = ref('')
const type = ref('info') // 'success' | 'error' | 'info'
let timer = null

function show(msg, toastType = 'info', duration = 3500) {
  message.value = msg
  type.value = toastType
  isVisible.value = true

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    isVisible.value = false
  }, duration)
}

defineExpose({ show })
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="isVisible"
      class="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 max-w-sm w-full p-3.5 rounded-lg shadow-lg border flex items-start gap-3"
      :class="{
        'bg-slate-900 border-emerald-500/50 text-white': type === 'success',
        'bg-slate-900 border-rose-500/50 text-white': type === 'error',
        'bg-slate-900 border-slate-700 text-white': type === 'info'
      }"
      :role="type === 'error' ? 'alert' : 'status'"
    >
      <div class="mt-0.5 shrink-0 text-base">
        <i v-if="type === 'success'" class="fa-solid fa-circle-check text-emerald-400" aria-hidden="true"></i>
        <i v-else-if="type === 'error'" class="fa-solid fa-circle-exclamation text-rose-400" aria-hidden="true"></i>
        <i v-else class="fa-solid fa-circle-info text-sky-400" aria-hidden="true"></i>
      </div>
      <div class="flex-1 text-sm sm:text-base font-medium leading-snug">
        {{ message }}
      </div>
      <button
        @click="isVisible = false"
        type="button"
        class="text-slate-400 hover:text-white shrink-0 text-sm"
        aria-label="Tutup notifikasi"
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
  </Transition>
</template>
