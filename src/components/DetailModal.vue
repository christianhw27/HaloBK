<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { CATEGORY_COLORS } from '@/lib/initialData'

const props = defineProps({
  alumni: {
    type: Object,
    default: null
  },
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const badgeStyle = computed(() => {
  if (!props.alumni?.category) return ''
  return CATEGORY_COLORS[props.alumni.category]?.badge || 'bg-slate-100 text-slate-700'
})

function handleKeydown(e) {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function openWhatsApp() {
  if (!props.alumni?.phone) return
  let cleanNumber = props.alumni.phone.replace(/[^0-9]/g, '')
  if (cleanNumber.startsWith('0')) {
    cleanNumber = '62' + cleanNumber.slice(1)
  }
  const text = encodeURIComponent(`Halo Kak ${props.alumni.name}, salam dari siswa SMA Negeri 2 Ngawi. Ingin bertanya mengenai pengalaman kuliah/karir di ${props.alumni.institution}...`)
  window.open(`https://wa.me/${cleanNumber}?text=${text}`, '_blank')
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen && alumni"
      class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      @click.self="emit('close')"
      role="dialog"
      aria-modal="true"
      :aria-label="'Detail Informasi ' + alumni.name"
    >
      <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-auto">
        
        <!-- Header Modal Institusional -->
        <div class="p-5 sm:p-6 bg-slate-900 text-white relative border-b border-slate-800">
          <button
            @click="emit('close')"
            type="button"
            class="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Tutup jendela detail"
          >
            <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
          </button>

          <div class="flex items-center gap-3.5 pr-8">
            <div class="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 font-display font-bold text-lg shrink-0">
              {{ alumni.name ? alumni.name.charAt(0) : 'A' }}
            </div>
            <div>
              <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium mb-1 border" :class="badgeStyle">
                {{ alumni.category }} &bull; Jalur {{ alumni.pathway }}
              </div>
              <h2 class="text-base sm:text-lg font-bold font-display text-white leading-tight">
                {{ alumni.name }}
              </h2>
              <p class="text-xs text-slate-400 mt-0.5">
                Alumni Angkatan {{ alumni.cohort }} &bull; Kelas {{ alumni.classRoom }}
              </p>
            </div>
          </div>
        </div>

        <!-- Badan Konten Modal -->
        <div class="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
          
          <!-- Tujuan Kampus / Instansi -->
          <div class="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Perguruan Tinggi / Lembaga / Perusahaan
            </div>
            <div class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <i class="fa-solid fa-building-columns text-slate-400 text-xs" aria-hidden="true"></i>
              <span>{{ alumni.institution }}</span>
            </div>
            <div class="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <i class="fa-solid fa-graduation-cap text-slate-400 text-xs" aria-hidden="true"></i>
              <span>{{ alumni.major }}</span>
            </div>
          </div>

          <!-- Pesan & Tips untuk Siswa SMADA -->
          <div>
            <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Pesan & Motivasi untuk Siswa SMADA
            </div>
            <div class="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 italic leading-relaxed text-xs">
              "{{ alumni.message || 'Semangat terus meraih cita-cita untuk seluruh adik-adik kelas SMA Negeri 2 Ngawi.' }}"
            </div>
          </div>

          <!-- Waktu Terdata -->
          <div class="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            <span>Terverifikasi: {{ alumni.timestamp }}</span>
            <span class="font-mono text-[10px] text-slate-400">ID: {{ alumni.id }}</span>
          </div>
        </div>

        <!-- Tombol Aksi Bawah -->
        <div class="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex gap-2.5">
          <button
            v-if="alumni.phone && alumni.phone !== '-'"
            @click="openWhatsApp"
            type="button"
            class="flex-1 py-2 px-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <i class="fa-brands fa-whatsapp text-sm" aria-hidden="true"></i>
            <span>Konsultasi via WhatsApp</span>
          </button>
          
          <button
            @click="emit('close')"
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>
