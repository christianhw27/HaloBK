<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
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

const authStore = useAuthStore()
const isLightboxOpen = ref(false)

// Cek apakah pengguna saat ini adalah Guru BK / Admin
const isTeacherOrAdmin = computed(() => {
  return authStore.userRole === 'admin' || authStore.userRole === 'guru'
})

// Cek apakah data yang sedang dibuka adalah data siswa aktif
const isStudent = computed(() => {
  return Boolean(props.alumni?.isSiswa || props.alumni?.category === 'Siswa Aktif')
})

watch(() => props.isOpen, (val) => {
  if (!val) {
    isLightboxOpen.value = false
  }
})

const badgeStyle = computed(() => {
  if (!props.alumni?.category) return ''
  const cat = props.alumni.category === 'Masa Tunggu' ? 'Belum Lapor Diri' : props.alumni.category
  return CATEGORY_COLORS[cat]?.badge || 'bg-slate-100 text-slate-700'
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
  const greeting = isStudent.value
    ? `Halo ananda ${props.alumni.name}, dari Guru BK SMA Negeri 2 Ngawi...`
    : `Halo Kak ${props.alumni.name}, salam dari SMA Negeri 2 Ngawi. Ingin bertanya mengenai pengalaman kuliah/karir di ${props.alumni.institution}...`
  const text = encodeURIComponent(greeting)
  window.open(`https://wa.me/${cleanNumber}?text=${text}`, '_blank')
}

function openParentWhatsApp() {
  if (!props.alumni?.no_wa_ortu) return
  let cleanNumber = props.alumni.no_wa_ortu.replace(/[^0-9]/g, '')
  if (cleanNumber.startsWith('0')) {
    cleanNumber = '62' + cleanNumber.slice(1)
  }
  const text = encodeURIComponent(`Halo Bapak/Ibu wali dari ananda ${props.alumni.name}, kami dari pihak Bimbingan Konseling (BK) SMA Negeri 2 Ngawi...`)
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
        class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
        @click.self="emit('close')"
        role="dialog"
        aria-modal="true"
        :aria-label="'Detail Informasi ' + alumni.name"
      >
        <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
          
          <!-- Tombol Tutup Melayang di Pojok Kanan Atas -->
          <button
            @click="emit('close')"
            type="button"
            class="absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition-colors shadow-sm"
            aria-label="Tutup jendela detail"
          >
            <i class="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>

          <!-- Area Profil Utama (Header Gelap Elegan dengan Foto Berukuran Besar & Jelas) -->
          <div class="p-4 sm:p-6 bg-slate-900 text-white border-b border-slate-800">
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
              
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
                <div class="text-[11px] sm:text-xs text-center text-slate-400 mt-1.5 font-medium block">
                  Ketuk foto untuk memperbesar
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
                  <template v-if="isStudent">
                    Siswa Aktif SMADA &bull; Angkatan {{ alumni.angkatan || 61 }}
                  </template>
                  <template v-else-if="alumni.category === 'Masa Tunggu' || alumni.category === 'Belum Lapor Diri'">
                    Belum Lapor Diri / Gap Year
                  </template>
                  <template v-else>
                    {{ alumni.category }}<template v-if="alumni.pathway && alumni.pathway !== '-'"> &bull; Jalur {{ alumni.pathway }}</template>
                  </template>
                </div>
                
                <h2 class="text-xl sm:text-2xl font-bold font-display text-white leading-tight">
                  {{ alumni.name }}
                </h2>

                <p class="text-sm text-slate-300 mt-1 font-medium">
                  {{ isStudent ? 'Siswa Aktif SMA Negeri 2 Ngawi' : ('Alumni Angkatan ' + alumni.cohort) }} &bull; Kelas {{ alumni.classRoom }}
                </p>

                <div v-if="isStudent && alumni.nisn && alumni.nisn !== '-'" class="text-xs text-emerald-400 font-mono mt-0.5">
                  NISN: {{ alumni.nisn }} <template v-if="alumni.nis && alumni.nis !== '-'">| NIS: {{ alumni.nis }}</template>
                </div>

                <!-- Ringkasan Instansi Cepat di Samping Foto -->
                <div class="mt-3.5 pt-3 border-t border-slate-800/80 space-y-1.5 text-sm">
                  <div class="font-semibold text-slate-200 flex items-center justify-center sm:justify-start gap-2">
                    <img
                      v-if="getInstitutionLogo(alumni.institution)"
                      :src="getInstitutionLogo(alumni.institution)"
                      :alt="alumni.institution"
                      class="w-4 h-4 rounded object-contain bg-white p-0.5 shrink-0"
                      loading="lazy"
                      @error="(e) => e.target.style.display = 'none'"
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
            
            <!-- TAMPILAN KHUSUS: BIODATA FULL SISWA UNTUK GURU BK / ADMIN -->
            <div v-if="isTeacherOrAdmin && isStudent" class="space-y-4">
              <!-- Header Penanda Akses Terproteksi Guru -->
              <div class="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between">
                <div class="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 font-semibold text-xs sm:text-sm">
                  <div class="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <i class="fa-solid fa-user-shield text-sm"></i>
                  </div>
                  <span>Biodata Lengkap Siswa (Khusus Akses Guru BK)</span>
                </div>
                <span class="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold uppercase tracking-wider border border-emerald-300/40">
                  Data Internal
                </span>
              </div>

              <!-- 1. Identitas & Akademik -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-3">
                <div class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200/50 dark:border-slate-700/50">
                  <i class="fa-solid fa-id-card text-sky-500"></i>
                  <span>1. Identitas & Sekolah Asal</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">NISN (Nomor Induk Siswa Nasional)</span>
                    <span class="font-bold text-slate-900 dark:text-white font-mono text-sm sm:text-base">{{ alumni.nisn || '-' }}</span>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">NIS (Nomor Induk Sekolah)</span>
                    <span class="font-bold text-slate-900 dark:text-white font-mono text-sm sm:text-base">{{ alumni.nis || '-' }}</span>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Kelas & Angkatan</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">{{ alumni.classRoom || '-' }} (Angkatan {{ alumni.angkatan || 61 }} / Lulusan {{ alumni.cohort }})</span>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Tempat, Tanggal Lahir (TTL)</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">{{ alumni.ttl || '-' }}</span>
                  </div>
                  <div class="sm:col-span-2">
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Asal Sekolah (SMP / MTs)</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">{{ alumni.asal_smp || '-' }}</span>
                  </div>
                </div>
              </div>

              <!-- 2. Domisili & Transportasi -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-3">
                <div class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200/50 dark:border-slate-700/50">
                  <i class="fa-solid fa-house-chimney-user text-amber-500"></i>
                  <span>2. Tempat Tinggal & Transportasi</span>
                </div>
                <div class="space-y-2.5 text-sm">
                  <div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Alamat Tempat Tinggal Lengkap</span>
                    <span class="font-medium text-slate-800 dark:text-slate-200 leading-relaxed block">{{ alumni.alamat_lengkap || '-' }}</span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Status Jenis Tinggal</span>
                      <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200/70">
                        {{ alumni.jenis_tinggal || '-' }}
                      </span>
                    </div>
                    <div>
                      <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Alat Transportasi ke Sekolah</span>
                      <span class="font-semibold text-slate-800 dark:text-slate-200">{{ alumni.alat_transportasi || '-' }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 3. Kontak Pribadi Siswa -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-3">
                <div class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200/50 dark:border-slate-700/50">
                  <i class="fa-solid fa-address-book text-emerald-500"></i>
                  <span>3. Kontak Siswa</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Nomor WhatsApp Siswa</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200 font-mono">{{ alumni.phone && alumni.phone !== '-' ? alumni.phone : '-' }}</span>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Email Siswa</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">{{ alumni.email && alumni.email !== '-' ? alumni.email : '-' }}</span>
                  </div>
                </div>
              </div>

              <!-- 4. Data Orang Tua / Wali Siswa -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-3">
                <div class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-200/50 dark:border-slate-700/50">
                  <i class="fa-solid fa-people-roof text-purple-500"></i>
                  <span>4. Orang Tua / Wali Siswa</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Nama Orang Tua / Wali</span>
                    <span class="font-bold text-slate-900 dark:text-white">{{ alumni.nama_ortu || '-' }}</span>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Pekerjaan Orang Tua / Wali</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200">{{ alumni.pekerjaan_ortu || '-' }}</span>
                  </div>
                  <div class="sm:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      <span class="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">No. WhatsApp Orang Tua / Wali</span>
                      <span class="font-bold text-slate-900 dark:text-white font-mono text-sm sm:text-base">{{ alumni.no_wa_ortu || '-' }}</span>
                    </div>
                    <button
                      v-if="alumni.no_wa_ortu && alumni.no_wa_ortu !== '-'"
                      type="button"
                      @click="openParentWhatsApp"
                      class="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors self-start sm:self-auto"
                    >
                      <i class="fa-brands fa-whatsapp text-sm"></i>
                      <span>Chat WA Orang Tua</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAMPILAN STANDAR: ALUMNI ATAU AKSES NON-GURU -->
            <template v-else>
              <!-- Rincian Instansi / Lembaga Lengkap -->
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {{ isStudent ? 'Status Pendidikan' : 'Penempatan / Lembaga / Perguruan Tinggi' }}
                </div>
                <div class="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2.5">
                  <img
                    v-if="getInstitutionLogo(alumni.institution)"
                    :src="getInstitutionLogo(alumni.institution)"
                    :alt="alumni.institution"
                    class="w-7 h-7 rounded-lg object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                    loading="lazy"
                    @error="(e) => e.target.style.display = 'none'"
                  />
                  <i v-else class="fa-solid fa-building-columns text-slate-400" aria-hidden="true"></i>
                  <span>{{ alumni.institution }}</span>
                </div>
                <div class="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <i class="fa-solid fa-graduation-cap text-slate-400" aria-hidden="true"></i>
                  <span>
                    <template v-if="alumni.category === 'Masa Tunggu' || alumni.category === 'Belum Lapor Diri'">
                      {{ alumni.major && alumni.major !== '-' ? alumni.major : 'Belum Memilih Program Studi / Karir' }}
                    </template>
                    <template v-else>
                      {{ alumni.major }}<template v-if="!isStudent && alumni.pathway && alumni.pathway !== '-'"> &bull; Jalur Seleksi {{ alumni.pathway }}</template>
                    </template>
                  </span>
                </div>
              </div>

              <!-- Pesan Motivasi Alumni / Info Siswa -->
              <div>
                <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  {{ isStudent ? 'Catatan Siswa' : 'Pesan & Motivasi untuk Siswa SMADA' }}
                </div>
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 italic leading-relaxed text-sm sm:text-base">
                  "{{ alumni.message || 'Semangat terus meraih cita-cita untuk seluruh adik-adik kelas SMA Negeri 2 Ngawi.' }}"
                </div>
              </div>
            </template>

            <!-- Footer Metadata -->
            <div class="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
              <span>Status: {{ isStudent ? 'Siswa Aktif Terdata' : 'Terverifikasi' }} ({{ alumni.timestamp }})</span>
              <span class="font-mono text-xs text-slate-400">ID: {{ alumni.id }}</span>
            </div>
          </div>

          <!-- Tombol Aksi Bawah -->
          <div class="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2.5 mt-auto">
            <button
              v-if="alumni.phone && alumni.phone !== '-'"
              @click="openWhatsApp"
              type="button"
              class="flex-1 min-w-[170px] py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <i class="fa-brands fa-whatsapp text-base" aria-hidden="true"></i>
              <span>Hubungi WA ({{ alumni.phone }})</span>
            </button>

            <button
              v-if="isTeacherOrAdmin && isStudent && alumni.no_wa_ortu && alumni.no_wa_ortu !== '-'"
              @click="openParentWhatsApp"
              type="button"
              class="flex-1 min-w-[170px] py-2.5 px-4 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <i class="fa-brands fa-whatsapp text-base" aria-hidden="true"></i>
              <span>Hubungi WA Ortu</span>
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

    <!-- Lightbox Foto Ukuran Penuh (Teleport ke body dengan z-index tertinggi) -->
    <Teleport to="body">
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
          class="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8"
          @click.self="isLightboxOpen = false"
          role="dialog"
          aria-modal="true"
          aria-label="Tampilan foto profil penuh"
        >
          <div class="relative max-w-2xl max-h-[88vh] flex flex-col items-center">
            <button
              @click="isLightboxOpen = false"
              type="button"
              class="absolute -top-12 right-0 sm:-right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors shadow-lg cursor-pointer"
              aria-label="Tutup foto penuh"
            >
              <i class="fa-solid fa-xmark text-lg"></i>
            </button>
            
            <img
              :src="alumni.photo"
              :alt="'Foto ' + alumni.name"
              class="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/20 bg-slate-900"
            />

            <p class="text-sm text-slate-200 mt-3 font-medium text-center drop-shadow-md">
              {{ alumni.name }} &bull; Angkatan {{ alumni.cohort }} &bull; {{ alumni.institution }}
            </p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
