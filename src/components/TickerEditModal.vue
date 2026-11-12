<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useNewsStore } from '@/stores/news'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'saved'])

const newsStore = useNewsStore()
const authStore = useAuthStore()

const textDraft = ref('')
const successNotice = ref('')
const errorNotice = ref('')

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      textDraft.value = newsStore.tickerText || ''
      successNotice.value = ''
      errorNotice.value = ''
    }
  }
)

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

function applyPreset(type) {
  if (type === 'default') {
    textDraft.value = '📢 Selamat datang di Portal Ruang BK SMA Negeri 2 Ngawi • Pendataan Tracer Study Alumni Angkatan 60 Resmi Dibuka • Kunjungi ruang Bimbingan Konseling untuk layanan konsultasi karir & perguruan tinggi • Maju Bersama, Hebat Semua!'
  } else if (type === 'headline' && newsStore.featuredNews) {
    textDraft.value = `📰 INFO UTAMA: ${newsStore.featuredNews.title} • Dapatkan informasi selengkapnya di Ruang BK Smada • SMADA Ngawi Berprestasi!`
  } else if (type === 'tracer') {
    textDraft.value = '🎓 TRACER STUDY ALUMNI: Mari sukseskan pendataan studi lanjut & karir alumni SMA Negeri 2 Ngawi • Isi formulir lapor diri melalui menu Tracer Study!'
  } else if (type === 'konseling') {
    textDraft.value = '💬 LAYANAN KONSELING SMADA: Bimbingan Karir, SNBP, SNBT, Kedinasan & Konseling Pribadi buka setiap hari sekolah di Ruang BK • Konsultasikan masa depanmu!'
  }
}

async function handleSave() {
  const clean = textDraft.value.trim()
  if (!clean) {
    errorNotice.value = 'Teks berjalan tidak boleh kosong.'
    return
  }

  errorNotice.value = ''
  const res = await newsStore.updateTickerText(clean)
  if (res && res.success) {
    successNotice.value = 'Teks berjalan Info Terkini berhasil disimpan!'
    emit('saved', clean)
    setTimeout(() => {
      successNotice.value = ''
      emit('close')
    }, 900)
  } else {
    errorNotice.value = 'Gagal menyimpan perubahan. Silakan coba kembali.'
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        @click.self="emit('close')"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticker-modal-title"
          class="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto transition-all"
        >
          <!-- MODAL HEADER -->
          <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-amber-50/80 via-white to-sky-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 flex items-center justify-center shadow-xs">
                <i class="fa-solid fa-bullhorn text-lg" aria-hidden="true"></i>
              </div>
              <div>
                <span class="inline-block text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Pengaturan Header Beranda
                </span>
                <h2 id="ticker-modal-title" class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
                  Edit Running Text Global (Info Terkini)
                </h2>
              </div>
            </div>

            <button
              type="button"
              @click="emit('close')"
              class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Tutup dialog"
            >
              <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
            </button>
          </div>

          <!-- MODAL BODY -->
          <div class="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            <!-- STATUS PERMISSION INFO -->
            <div
              class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5"
            >
              <i class="fa-solid fa-cloud-arrow-up text-emerald-600 dark:text-emerald-400 text-sm mt-0.5 shrink-0" aria-hidden="true"></i>
              <div>
                <span class="font-bold">Tersimpan Secara Global di Cloud Database:</span>
                <p class="mt-0.5 text-emerald-800 dark:text-emerald-300">
                  Perubahan teks ini akan langsung disimpan ke database Supabase dan secara otomatis tampil untuk seluruh pengunjung portal Ruang BK Smada di semua perangkat.
                </p>
              </div>
            </div>

            <!-- PRESET QUICK CLICKS -->
            <div class="space-y-2">
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Pilihan Cepat (Preset Template):
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  @click="applyPreset('default')"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center gap-1.5"
                >
                  <i class="fa-solid fa-rotate-left text-[11px] text-amber-600"></i>
                  <span>Default SMADA</span>
                </button>

                <button
                  v-if="newsStore.featuredNews"
                  type="button"
                  @click="applyPreset('headline')"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition-colors inline-flex items-center gap-1.5"
                >
                  <i class="fa-solid fa-newspaper text-[11px]"></i>
                  <span>Gunakan Berita Utama</span>
                </button>

                <button
                  type="button"
                  @click="applyPreset('tracer')"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors inline-flex items-center gap-1.5"
                >
                  <i class="fa-solid fa-graduation-cap text-[11px]"></i>
                  <span>Info Tracer Study</span>
                </button>

                <button
                  type="button"
                  @click="applyPreset('konseling')"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-colors inline-flex items-center gap-1.5"
                >
                  <i class="fa-solid fa-comments text-[11px]"></i>
                  <span>Layanan Konseling</span>
                </button>
              </div>
            </div>

            <!-- TEXTAREA INPUT -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <label for="ticker-text-input" class="font-bold text-slate-700 dark:text-slate-200">
                  Isi Teks Berjalan:
                </label>
                <span class="text-slate-500 dark:text-slate-400">
                  {{ textDraft.length }} karakter
                </span>
              </div>
              <textarea
                id="ticker-text-input"
                v-model="textDraft"
                rows="4"
                maxlength="600"
                placeholder="Tuliskan pengumuman atau info penting yang ingin ditampilkan secara berjalan..."
                class="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 leading-relaxed transition-all"
              ></textarea>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                Tip: Gunakan pemisah tanda titik bulat (•) atau emoji untuk memisahkan beberapa kalimat informasi.
              </p>
            </div>

            <!-- LIVE PREVIEW BOX -->
            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Pratinjau Animasi Berjalan:
              </label>
              <div class="p-2.5 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-100/50 to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/40 border border-amber-200 dark:border-slate-800 flex items-center gap-2 overflow-hidden shadow-inner">
                <span class="px-2 py-0.5 rounded-full bg-[#F59E0B] text-slate-950 font-bold text-[10px] uppercase tracking-wider shrink-0 shadow-xs">
                  Live Ticker
                </span>
                <div class="relative flex-1 overflow-hidden min-w-0 flex items-center">
                  <div class="animate-ticker text-xs font-medium text-slate-900 dark:text-slate-100">
                    <div class="flex items-center shrink-0 pr-10">
                      <span>{{ textDraft || 'Teks berjalan akan tampil di sini...' }}</span>
                    </div>
                    <div class="flex items-center shrink-0 pr-10" aria-hidden="true">
                      <span>{{ textDraft || 'Teks berjalan akan tampil di sini...' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- FEEDBACK ALERTS -->
            <div
              v-if="successNotice"
              class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2"
            >
              <i class="fa-solid fa-circle-check text-sm text-emerald-600"></i>
              <span>{{ successNotice }}</span>
            </div>

            <div
              v-if="errorNotice"
              class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2"
            >
              <i class="fa-solid fa-circle-exclamation text-sm text-rose-600"></i>
              <span>{{ errorNotice }}</span>
            </div>
          </div>

          <!-- MODAL FOOTER -->
          <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-end gap-3">
            <button
              type="button"
              @click="emit('close')"
              :disabled="newsStore.isSavingTicker"
              class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              @click="handleSave"
              :disabled="newsStore.isSavingTicker || !textDraft.trim()"
              class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-sm inline-flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i v-if="newsStore.isSavingTicker" class="fa-solid fa-spinner fa-spin text-sm" aria-hidden="true"></i>
              <i v-else class="fa-solid fa-floppy-disk text-sm" aria-hidden="true"></i>
              <span>{{ newsStore.isSavingTicker ? 'Menyimpan...' : 'Simpan Teks Berjalan' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

