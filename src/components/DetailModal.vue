<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { CATEGORY_COLORS } from '@/lib/initialData'
import { getInstitutionLogo } from '@/lib/campusList'

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

const isLightboxOpen = ref(false)

const badgeStyle = computed(() => {
  if (!props.alumni?.category) return ''
  return CATEGORY_COLORS[props.alumni.category]?.badge || 'bg-slate-100 text-slate-700'
})

function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (isLightboxOpen.value) {
      isLightboxOpen.value = false
      return
    }
    if (props.isOpen) {
      emit('close')
    }
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
  <div>
    <!-- Modal Utama Detail Alumni -->
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
        class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        @click.self="emit('close')"
        role="dialog"
        aria-modal="true"
        :aria-label="'Detail Informasi ' + alumni.name"
      >
        <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
          
          <!-- Tombol Tutup Melayang di Pojok Kanan Atas -->
          <button
            @click="emit('close')"
            type="button"
            class="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center transition-colors shadow-sm"
            aria-label="Tutup jendela detail"
          >
            <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
          </button>

          <!-- Area Profil Utama (Header Gelap Elegan dengan Foto Berukuran Besar & Jelas) -->
          <div class="p-5 sm:p-6 bg-slate-900 text-white border-b border-slate-800">
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              
              <!-- Container Foto Profil Berukuran Jelas (Proporsi Potret 3:4) -->
              <div v-if="alumni.photo" class="relative group shrink-0">
                <div
                  @click="isLightboxOpen = true"
                  class="w-32 h-40 sm:w-40 sm:h-52 rounded-xl overflow-hidden border-2 border-slate-700/80 bg-slate-800 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] flex items-center justify-center"
                  title="Klik untuk melihat foto ukuran penuh"
                  role="button"
                  tabindex="0"
                  @keydown.enter="isLightboxOpen = true"
                  @keydown.space.prevent="isLightboxOpen = true"
                >
                  <img
                    :src="alumni.photo"
                    :alt="'Foto Profil ' + alumni.name"
                    class="w-full h-full object-cover"
                  />
                  <!-- Hover Overlay Zoom Hint -->
                  <div class="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-sm gap-1.5 rounded-xl">
                    <i class="fa-solid fa-magnifying-glass-plus text-lg"></i>
                    <span class="text-xs font-medium">Perbesar Foto</span>
                  </div>
                </div>
                <div class="text-xs text-center text-slate-400 mt-1.5 font-medium sm:block hidden">
                  Klik foto untuk memperbesar
                </div>
              </div>

              <!-- Fallback Inisial jika alumni belum memiliki foto -->
              <div
                v-else
                class="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-300 font-display font-bold text-3xl sm:text-4xl shrink-0 shadow-md"
              >
                {{ alumni.name ? alumni.name.charAt(0) : 'A' }}
              </div>

              <!-- Identitas Alumni di Samping Foto -->
              <div class="flex-1 text-center sm:text-left min-w-0">
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs sm:text-sm font-semibold mb-2 border" :class="badgeStyle">
                  {{ alumni.category }} &bull; Jalur {{ alumni.pathway }}
                </div>
                
                <h2 class="text-xl sm:text-2xl font-bold font-display text-white leading-tight">
                  {{ alumni.name }}
                </h2>

                <p class="text-sm text-slate-300 mt-1 font-medium">
                  Alumni Angkatan {{ alumni.cohort }} &bull; Kelas {{ alumni.classRoom }}<template v-if="alumni.nis && alumni.nis !== '-'"> &bull; NIS: {{ alumni.nis }}</template>
                </p>

                <!-- Ringkasan Instansi Cepat di Samping Foto -->
                <div class="mt-3.5 pt-3 border-t border-slate-800/80 space-y-1.5 text-sm">
                  <div class="font-semibold text-slate-200 flex items-center justify-center sm:justify-start gap-2">
                    <img
                      v-if="getInstitutionLogo(alumni.institution)"
                      :src="getInstitutionLogo(alumni.institution)"
                      :alt="alumni.institution"
                      class="w-4 h-4 rounded object-contain bg-white p-0.5 shrink-0"
                      loading="lazy"
                    />
                    <i v-else class="fa-solid fa-building-columns text-sky-400 text-sm" aria-hidden="true"></i>
                    <span class="truncate">{{ alumni.institution }}</span>
                  </div>
                  <div class="text-slate-400 flex items-center justify-center sm:justify-start gap-2">
                    <i class="fa-solid fa-graduation-cap text-slate-500 text-sm" aria-hidden="true"></i>
                    <span class="truncate">{{ alumni.major }}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Badan Konten Modal (Scrollable) -->
          <div class="p-5 sm:p-6 space-y-4 text-sm sm:text-base overflow-y-auto">
            
            <!-- Rincian Instansi / Lembaga Lengkap -->
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Penempatan / Lembaga / Perguruan Tinggi
              </div>
              <div class="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2.5">
                <img
                  v-if="getInstitutionLogo(alumni.institution)"
                  :src="getInstitutionLogo(alumni.institution)"
                  :alt="alumni.institution"
                  class="w-7 h-7 rounded-lg object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                  loading="lazy"
                />
                <i v-else class="fa-solid fa-building-columns text-slate-400" aria-hidden="true"></i>
                <span>{{ alumni.institution }}</span>
              </div>
              <div class="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <i class="fa-solid fa-graduation-cap text-slate-400" aria-hidden="true"></i>
                <span>{{ alumni.major }} &bull; Jalur Seleksi {{ alumni.pathway }}</span>
              </div>
            </div>

            <!-- Pesan Motivasi Alumni -->
            <div>
              <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                Pesan & Motivasi untuk Siswa SMADA
              </div>
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 italic leading-relaxed text-sm sm:text-base">
                "{{ alumni.message || 'Semangat terus meraih cita-cita untuk seluruh adik-adik kelas SMA Negeri 2 Ngawi.' }}"
              </div>
            </div>

            <!-- Footer Metadata -->
            <div class="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
              <span>Status: Terverifikasi ({{ alumni.timestamp }})</span>
              <span class="font-mono text-xs text-slate-400">ID: {{ alumni.id }}</span>
            </div>
          </div>

          <!-- Tombol Aksi Bawah -->
          <div class="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex gap-2.5 mt-auto">
            <button
              v-if="alumni.phone && alumni.phone !== '-'"
              @click="openWhatsApp"
              type="button"
              class="flex-1 py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <i class="fa-brands fa-whatsapp text-base" aria-hidden="true"></i>
              <span>Hubungi via WhatsApp ({{ alumni.phone }})</span>
            </button>
            
            <button
              @click="emit('close')"
              type="button"
              class="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm sm:text-base font-semibold transition-colors"
            >
              Tutup
            </button>
          </div>

        </div>
      </div>
    </Transition>

    <!-- Lightbox Foto Ukuran Penuh (Full Resolution Preview) -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isLightboxOpen && alumni?.photo"
        class="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8"
        @click.self="isLightboxOpen = false"
      >
        <div class="relative max-w-2xl max-h-[85vh] flex flex-col items-center">
          <button
            @click="isLightboxOpen = false"
            type="button"
            class="absolute -top-12 right-0 sm:-right-4 w-10 h-10 rounded-full bg-slate-800/90 text-white hover:bg-slate-700 flex items-center justify-center transition-colors shadow-lg cursor-pointer"
            aria-label="Tutup foto penuh"
          >
            <i class="fa-solid fa-xmark text-base"></i>
          </button>
          
          <img
            :src="alumni.photo"
            :alt="'Foto ' + alumni.name"
            class="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl border border-slate-700 bg-slate-900"
          />

          <p class="text-xs text-slate-300 mt-3 font-medium text-center">
            {{ alumni.name }} &bull; Angkatan {{ alumni.cohort }} &bull; {{ alumni.institution }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>
