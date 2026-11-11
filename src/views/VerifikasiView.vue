<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import AdminOnlyGuard from '@/components/AdminOnlyGuard.vue'
import { CATEGORY_COLORS } from '@/lib/initialData'
import { getInstitutionLogo } from '@/lib/campusList'

const authStore = useAuthStore()
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
    <AdminOnlyGuard
      v-if="authStore.userRole !== 'admin'"
      title="Verifikasi Laporan Khusus Guru BK"
      description="Anda sedang menggunakan mode akses Alumni. Persetujuan dan verifikasi data lapor diri hanya dapat diakses oleh Guru BK."
    />

    <template v-else>
      <!-- Header Panel Verifikasi Guru BK -->
      <section class="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#FEF3C7]/75 via-white to-[#FFE4E6]/55 dark:from-amber-950/25 dark:via-slate-900 dark:to-rose-950/20 border border-amber-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" aria-labelledby="verification-heading">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] border border-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800 text-xs font-bold mb-2">
            <i class="fa-solid fa-clipboard-check text-[11px]" aria-hidden="true"></i>
            <span>Ruang Kerja Guru BK &bull; Validasi</span>
          </div>
          <h1 id="verification-heading" class="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
            Verifikasi Cerita &amp; Laporan Alumni
          </h1>
          <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
            Cek dulu data studi lanjut atau karir yang masuk sebelum tampil di direktori resmi SMADA
          </p>
        </div>

        <div class="px-4 py-2.5 rounded-2xl bg-white/90 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 text-[#92400E] dark:text-amber-300 text-sm font-bold flex items-center gap-2.5 self-start sm:self-auto shadow-xs">
          <span class="w-2.5 h-2.5 rounded-full bg-[#F59E0B] animate-pulse" aria-hidden="true"></span>
          <span>{{ alumniStore.pendingList.length }} Menunggu ACC</span>
        </div>
      </section>

    <!-- Daftar Antrean Pengajuan -->
    <section v-if="alumniStore.pendingList.length > 0" class="space-y-4" aria-label="Daftar Pengajuan Menunggu">
      <div
        v-for="item in alumniStore.pendingList"
        :key="item.id"
        class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 shadow-[var(--shadow-sm)] space-y-4"
        :class="CATEGORY_COLORS[item.category]?.cardAccent"
      >
        <!-- Baris Atas: Identitas & Status -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <img
              v-if="item.photo"
              :src="item.photo"
              :alt="`Foto ${item.name}`"
              class="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              loading="lazy"
            />
            <div
              v-else
              class="w-11 h-11 rounded-xl font-bold flex items-center justify-center text-base border shrink-0 shadow-2xs"
              :class="CATEGORY_COLORS[item.category]?.avatar || 'bg-amber-100 text-[#92400E] border-amber-200'"
            >
              {{ item.name.charAt(0) }}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                  {{ item.name }}
                </h2>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3C7] dark:bg-amber-950 text-[#92400E] dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Perlu ACC
                </span>
              </div>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Kelas {{ item.classRoom }} &bull; Angkatan {{ item.cohort }}<template v-if="item.nis && item.nis !== '-'"> &bull; NIS: {{ item.nis }}</template> &bull; Diajukan: {{ item.timestamp }}
              </p>
            </div>
          </div>

          <span
            class="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold border self-start sm:self-auto"
            :class="CATEGORY_COLORS[item.category]?.badge || 'bg-slate-100 text-slate-700'"
          >
            {{ item.category }} &bull; Jalur {{ item.pathway }}
          </span>
        </div>

        <!-- Rincian Informasi Penempatan & Kontak -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div class="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/60 space-y-1">
            <div class="text-xs font-semibold text-[#0369A1] dark:text-sky-300">
              Instansi / Perguruan Tinggi
            </div>
            <div class="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <img
                v-if="getInstitutionLogo(item.institution)"
                :src="getInstitutionLogo(item.institution)"
                :alt="item.institution"
                class="w-5 h-5 rounded-md object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                loading="lazy"
                @error="(e) => e.target.style.display = 'none'"
              />
              <i v-else class="fa-solid fa-building-columns text-[#0284C7]" aria-hidden="true"></i>
              <span>{{ item.institution }}</span>
            </div>
            <div class="text-slate-600 dark:text-slate-300">
              {{ item.major }}
            </div>
          </div>

          <div class="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60 space-y-1">
            <div class="text-xs font-semibold text-[#047857] dark:text-emerald-300">
              Nomor WhatsApp Alumni
            </div>
            <div class="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <i class="fa-brands fa-whatsapp text-emerald-600" aria-hidden="true"></i>
              <span>{{ item.phone || 'Tidak dicantumkan' }}</span>
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              Tampil di direktori setelah diverifikasi.
            </div>
          </div>
        </div>

        <!-- Pesan Motivasi Alumni -->
        <div v-if="item.message" class="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/60 text-sm italic text-slate-700 dark:text-slate-300">
          <span class="font-semibold not-italic text-[#92400E] dark:text-amber-300">Pesan Alumni:</span> "{{ item.message }}"
        </div>

        <!-- Tombol Aksi Verifikasi -->
        <div class="pt-2 flex items-center justify-end gap-2.5">
          <button
            @click="handleReject(item.id, item.name)"
            type="button"
            class="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[#BE123C] dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-sm font-semibold transition-colors flex items-center gap-1.5"
          >
            <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
            <span>Tolak Laporan</span>
          </button>

          <button
            @click="handleApprove(item.id, item.name)"
            type="button"
            class="px-5 py-2.5 rounded-xl bg-[#047857] hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <i class="fa-solid fa-check text-sm" aria-hidden="true"></i>
            <span>Setujui (ACC)</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Tampilan Kosong (Tidak Ada Antrean) -->
    <div
      v-else
      class="p-10 text-center rounded-3xl bg-gradient-to-br from-[#D1FAE5]/45 via-white to-[#E0F2FE]/45 dark:from-emerald-950/20 dark:via-slate-900 dark:to-sky-950/20 border border-emerald-200/70 dark:border-slate-800 space-y-3 shadow-[var(--shadow-sm)]"
    >
      <div class="w-14 h-14 rounded-2xl bg-[#D1FAE5] dark:bg-emerald-950/60 text-[#047857] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-2xl shadow-xs">
        <i class="fa-solid fa-check" aria-hidden="true"></i>
      </div>
      <h2 class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
        Yeay! Semua Laporan Sudah Beres
      </h2>
      <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-md mx-auto">
        Saat ini belum ada antrean verifikasi baru. Jika ada alumni yang mengisi formulir lapor diri, datanya bakal langsung muncul di sini.
      </p>
    </div>
    </template>

  </div>
</template>
