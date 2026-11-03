<script setup>
import { onMounted } from 'vue'
import { useAlumniStore } from '@/stores/alumni'
import { CATEGORY_COLORS } from '@/lib/initialData'
import { getInstitutionLogo } from '@/lib/campusList'

const alumniStore = useAlumniStore()

onMounted(() => {
  alumniStore.fetchData()
})

function handleApprove(id, name) {
  if (confirm(`Setujui pengajuan alumni dari ${name}? Data ini akan segera dipublikasikan di direktori resmi.`)) {
    alumniStore.approvePending(id)
  }
}

function handleReject(id, name) {
  if (confirm(`Tolak pengajuan dari ${name}? Data ini akan dihapus dari antrean verifikasi.`)) {
    alumniStore.rejectPending(id)
  }
}
</script>

<template>
  <div class="space-y-6 w-full">
    
    <!-- Header Panel Verifikasi Guru BK -->
    <section class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" aria-labelledby="verification-heading">
      <div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
          <span>Panel Guru BK</span>
          <span>&bull;</span>
          <span>Validasi Tracer Study</span>
        </div>
        <h1 id="verification-heading" class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
          Persetujuan & Verifikasi Data Lapor Diri
        </h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Periksa keabsahan laporan studi lanjut atau karir alumni sebelum ditampilkan ke publik
        </p>
      </div>

      <div class="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 text-xs font-semibold flex items-center gap-2 self-start sm:self-auto">
        <span class="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true"></span>
        <span>{{ alumniStore.pendingList.length }} Laporan Menunggu</span>
      </div>
    </section>

    <!-- Daftar Antrean Pengajuan -->
    <section v-if="alumniStore.pendingList.length > 0" class="space-y-4" aria-label="Daftar Pengajuan Menunggu">
      <div
        v-for="item in alumniStore.pendingList"
        :key="item.id"
        class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
      >
        <!-- Baris Atas: Identitas & Status -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <img
              v-if="item.photo"
              :src="item.photo"
              :alt="`Foto ${item.name}`"
              class="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              loading="lazy"
            />
            <div
              v-else
              class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-sm border border-slate-200 dark:border-slate-700 shrink-0"
            >
              {{ item.name.charAt(0) }}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                  {{ item.name }}
                </h2>
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  Perlu ACC
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kelas {{ item.classRoom }} &bull; Angkatan {{ item.cohort }} &bull; Diajukan: {{ item.timestamp }}
              </p>
            </div>
          </div>

          <span
            class="px-2.5 py-1 rounded text-xs font-medium border self-start sm:self-auto"
            :class="CATEGORY_COLORS[item.category]?.badge || 'bg-slate-100 text-slate-700'"
          >
            {{ item.category }} &bull; Jalur {{ item.pathway }}
          </span>
        </div>

        <!-- Rincian Informasi Penempatan & Kontak -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div class="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Instansi / Perguruan Tinggi
            </div>
            <div class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <img
                v-if="getInstitutionLogo(item.institution)"
                :src="getInstitutionLogo(item.institution)"
                :alt="item.institution"
                class="w-5 h-5 rounded-md object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                loading="lazy"
              />
              <i v-else class="fa-solid fa-building-columns text-slate-400" aria-hidden="true"></i>
              <span>{{ item.institution }}</span>
            </div>
            <div class="text-slate-600 dark:text-slate-300">
              {{ item.major }}
            </div>
          </div>

          <div class="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Nomor WhatsApp Alumni
            </div>
            <div class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <i class="fa-brands fa-whatsapp text-emerald-600" aria-hidden="true"></i>
              <span>{{ item.phone || 'Tidak dicantumkan' }}</span>
            </div>
            <div class="text-[11px] text-slate-500">
              Tampil di direktori setelah diverifikasi.
            </div>
          </div>
        </div>

        <!-- Pesan Motivasi Alumni -->
        <div v-if="item.message" class="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs italic text-slate-700 dark:text-slate-300">
          <span class="font-semibold not-italic text-slate-900 dark:text-white">Pesan Alumni:</span> "{{ item.message }}"
        </div>

        <!-- Tombol Aksi Verifikasi -->
        <div class="pt-2 flex items-center justify-end gap-2.5">
          <button
            @click="handleReject(item.id, item.name)"
            type="button"
            class="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <i class="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
            <span>Tolak Laporan</span>
          </button>

          <button
            @click="handleApprove(item.id, item.name)"
            type="button"
            class="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
            <span>Setujui (ACC)</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Tampilan Kosong (Tidak Ada Antrean) -->
    <div
      v-else
      class="p-10 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
    >
      <div class="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto text-xl">
        <i class="fa-solid fa-check" aria-hidden="true"></i>
      </div>
      <h2 class="font-display font-semibold text-base text-slate-900 dark:text-white">
        Tidak Ada Antrean Verifikasi
      </h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
        Seluruh laporan diri alumni telah berhasil diverifikasi. Laporan baru akan langsung muncul di halaman ini saat dikirim oleh siswa.
      </p>
    </div>

  </div>
</template>
