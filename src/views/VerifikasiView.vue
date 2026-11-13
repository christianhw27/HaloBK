<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import AdminOnlyGuard from '@/components/AdminOnlyGuard.vue'
import { CATEGORY_COLORS } from '@/lib/initialData'
import { getInstitutionLogo } from '@/lib/campusList'

const authStore = useAuthStore()
const alumniStore = useAlumniStore()

// Tab aktif: 'siswa' (Biodata Siswa Aktif) | 'alumni' (Lapor Diri Alumni)
const activeTab = ref('siswa')
const actionFeedback = ref('')
const actionFeedbackType = ref('')

onMounted(async () => {
  await alumniStore.fetchData()
  // Jika antrean siswa kosong tapi alumni ada, arahkan tab ke alumni otomatis
  if (alumniStore.pendingStudentUpdates.length === 0 && alumniStore.pendingList.length > 0) {
    activeTab.value = 'alumni'
  }
})

function notify(type, msg) {
  actionFeedbackType.value = type
  actionFeedback.value = msg
  setTimeout(() => {
    actionFeedback.value = ''
  }, 4500)
}

// Handler Siswa
async function handleApproveStudent(item) {
  if (confirm(`Setujui pembaruan biodata siswa "${item.nama}" (NIS: ${item.nis})?\nData profil siswa akan langsung diperbarui di database resmi.`)) {
    const res = await alumniStore.approveStudentUpdate(item)
    if (res.success) {
      notify('success', res.message)
    } else {
      notify('error', res.message)
    }
  }
}

async function handleRejectStudent(id, name) {
  if (confirm(`Tolak pengajuan perubahan biodata dari "${name}"?\nData pengajuan ini akan dihapus dari antrean tanpa mengubah profil siswa.`)) {
    const res = await alumniStore.rejectStudentUpdate(id, name)
    if (res.success) {
      notify('success', res.message)
    } else {
      notify('error', res.message)
    }
  }
}

// Handler Alumni
async function handleApprove(id, name) {
  if (confirm(`Setujui pengajuan alumni dari ${name}? Data ini akan segera dipublikasikan di direktori resmi.`)) {
    await alumniStore.approvePending(id)
    notify('success', `Laporan alumni dari ${name} berhasil disetujui (ACC)!`)
  }
}

async function handleReject(id, name) {
  if (confirm(`Tolak pengajuan dari ${name}? Data ini akan dihapus dari antrean verifikasi.`)) {
    await alumniStore.rejectPending(id)
    notify('success', `Pengajuan dari ${name} telah ditolak dan dihapus dari antrean.`)
  }
}
</script>

<template>
  <div class="space-y-6 w-full">
    <AdminOnlyGuard
      v-if="authStore.userRole !== 'admin'"
      title="Verifikasi Laporan Khusus Guru BK"
      description="Anda sedang menggunakan mode akses Siswa / Alumni. Persetujuan dan verifikasi data hanya dapat diakses oleh Administrator & Guru BK."
    />

    <template v-else>
      <!-- Header Panel Verifikasi Guru BK -->
      <section class="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#FEF3C7]/80 via-white to-[#FFE4E6]/60 dark:from-amber-950/25 dark:via-slate-900 dark:to-rose-950/20 border border-amber-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" aria-labelledby="verification-heading">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] border border-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800 text-xs font-bold mb-2">
            <i class="fa-solid fa-clipboard-check text-[11px]" aria-hidden="true"></i>
            <span>Ruang Kerja Guru BK &bull; Pusat Validasi &amp; ACC</span>
          </div>
          <h1 id="verification-heading" class="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
            Pusat Verifikasi &amp; Persetujuan Data
          </h1>
          <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
            Validasi pengajuan perubahan biodata siswa aktif dan laporan tracer study alumni sebelum masuk ke direktori resmi SMADA.
          </p>
        </div>

        <div class="px-4 py-2.5 rounded-2xl bg-white/90 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 text-[#92400E] dark:text-amber-300 text-sm font-bold flex items-center gap-2.5 self-start sm:self-auto shadow-xs shrink-0">
          <span class="w-2.5 h-2.5 rounded-full bg-[#F59E0B] animate-pulse" aria-hidden="true"></span>
          <span>{{ alumniStore.totalPendingCount }} Menunggu ACC</span>
        </div>
      </section>

      <!-- Notifikasi Pesan Feedback -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="actionFeedback"
          class="p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold shadow-xs"
          :class="actionFeedbackType === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'"
          role="alert"
        >
          <div class="flex items-center gap-2.5">
            <i :class="actionFeedbackType === 'success' ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-solid fa-circle-exclamation text-rose-600'"></i>
            <span>{{ actionFeedback }}</span>
          </div>
          <button @click="actionFeedback = ''" class="text-slate-400 hover:text-slate-600">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      </Transition>

      <!-- TAB NAVIGASI VERIFIKASI (SISWA VS ALUMNI) -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          @click="activeTab = 'siswa'"
          class="px-4 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2.5 border"
          :class="activeTab === 'siswa'
            ? 'bg-[#0369A1] text-white border-[#0369A1] shadow-xs'
            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'"
        >
          <i class="fa-solid fa-user-pen text-sm"></i>
          <span>Biodata Siswa Aktif</span>
          <span
            class="px-2 py-0.5 rounded-full text-xs font-bold"
            :class="activeTab === 'siswa'
              ? 'bg-white/20 text-white'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'"
          >
            {{ alumniStore.pendingStudentUpdates.length }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'alumni'"
          class="px-4 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2.5 border"
          :class="activeTab === 'alumni'
            ? 'bg-[#0369A1] text-white border-[#0369A1] shadow-xs'
            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'"
        >
          <i class="fa-solid fa-graduation-cap text-sm"></i>
          <span>Lapor Diri Alumni</span>
          <span
            class="px-2 py-0.5 rounded-full text-xs font-bold"
            :class="activeTab === 'alumni'
              ? 'bg-white/20 text-white'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'"
          >
            {{ alumniStore.pendingList.length }}
          </span>
        </button>
      </div>

      <!-- KONTEN TAB 1: ANTREAN PERUBAHAN BIODATA SISWA AKTIF -->
      <section v-if="activeTab === 'siswa'" class="space-y-4" aria-label="Antrean Perubahan Biodata Siswa">
        <div v-if="alumniStore.pendingStudentUpdates.length > 0" class="space-y-4">
          <div
            v-for="item in alumniStore.pendingStudentUpdates"
            :key="item.id"
            class="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-amber-900/60 shadow-[var(--shadow-card)] space-y-4"
          >
            <!-- Baris Atas: Identitas Siswa & Waktu Pengajuan -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 flex items-center justify-center font-bold text-lg border border-amber-200 dark:border-amber-800 shrink-0">
                  {{ item.nama.charAt(0) }}
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      {{ item.nama }}
                    </h2>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] dark:bg-amber-950 text-[#92400E] dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                      <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      <span>Menunggu ACC</span>
                    </span>
                  </div>
                  <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    NIS: <strong>{{ item.nis }}</strong> &bull; Kelas: <strong>{{ item.kelas }}</strong> &bull; Angkatan 61 (Lulusan {{ item.tahun_lulus }}) &bull; Diajukan: {{ item.submittedAt }}
                  </p>
                </div>
              </div>

              <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800 self-start sm:self-auto">
                <i class="fa-solid fa-id-card text-[11px]"></i>
                <span>Pengajuan Biodata Siswa</span>
              </div>
            </div>

            <!-- Detail Perubahan Data yang Diusulkan -->
            <div class="space-y-2">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Rincian Data yang Diajukan Siswa:
              </span>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs sm:text-sm">
                <!-- TTL -->
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <span class="block text-[11px] font-semibold text-slate-400">Tempat, Tanggal Lahir</span>
                  <span class="font-bold text-slate-900 dark:text-white block mt-0.5">{{ item.proposedData.ttl || '-' }}</span>
                </div>

                <!-- Kontak WA & Email -->
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <span class="block text-[11px] font-semibold text-slate-400">No. WhatsApp &amp; Email</span>
                  <span class="font-bold text-slate-900 dark:text-white block mt-0.5 font-mono">
                    {{ item.proposedData.no_wa || '-' }}
                  </span>
                  <span class="text-xs text-slate-500 dark:text-slate-400 truncate block">{{ item.proposedData.email || '-' }}</span>
                </div>

                <!-- Domisili & Transportasi -->
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <span class="block text-[11px] font-semibold text-slate-400">Jenis Tinggal &amp; Transportasi</span>
                  <span class="font-bold text-slate-900 dark:text-white block mt-0.5">
                    {{ item.proposedData.jenis_tinggal || '-' }}
                  </span>
                  <span class="text-xs text-slate-500 dark:text-slate-400 block">{{ item.proposedData.alat_transportasi || '-' }}</span>
                </div>

                <!-- Orang Tua -->
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <span class="block text-[11px] font-semibold text-slate-400">Nama &amp; Pekerjaan Orang Tua</span>
                  <span class="font-bold text-slate-900 dark:text-white block mt-0.5">{{ item.proposedData.nama_ortu || '-' }}</span>
                  <span class="text-xs text-slate-500 dark:text-slate-400 block">{{ item.proposedData.pekerjaan_ortu || '-' }}</span>
                </div>

                <!-- WA Orang Tua -->
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <span class="block text-[11px] font-semibold text-slate-400">No. WhatsApp Orang Tua</span>
                  <span class="font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5 font-mono">
                    {{ item.proposedData.no_wa_ortu || '-' }}
                  </span>
                </div>

                <!-- Asal SMP -->
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <span class="block text-[11px] font-semibold text-slate-400">Asal Sekolah (SMP)</span>
                  <span class="font-bold text-slate-900 dark:text-white block mt-0.5">{{ item.proposedData.asal_smp || '-' }}</span>
                </div>

                <!-- Alamat Lengkap -->
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 md:col-span-2 lg:col-span-3">
                  <span class="block text-[11px] font-semibold text-slate-400">Alamat Lengkap Domisili</span>
                  <span class="font-medium text-slate-900 dark:text-white block mt-0.5">{{ item.proposedData.alamat_lengkap || '-' }}</span>
                </div>
              </div>
            </div>

            <!-- Tombol Aksi Verifikasi Siswa -->
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                @click="handleRejectStudent(item.id, item.nama)"
                type="button"
                class="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[#BE123C] dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-sm font-semibold transition-colors flex items-center gap-1.5"
              >
                <i class="fa-solid fa-xmark text-sm"></i>
                <span>Tolak Pengajuan</span>
              </button>

              <button
                @click="handleApproveStudent(item)"
                type="button"
                class="px-5 py-2.5 rounded-xl bg-[#047857] hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <i class="fa-solid fa-check text-sm"></i>
                <span>Setujui &amp; Terapkan (ACC)</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Tampilan Kosong Tab Siswa -->
        <div
          v-else
          class="p-10 text-center rounded-3xl bg-gradient-to-br from-[#D1FAE5]/45 via-white to-[#E0F2FE]/45 dark:from-emerald-950/20 dark:via-slate-900 dark:to-sky-950/20 border border-emerald-200/70 dark:border-slate-800 space-y-3 shadow-[var(--shadow-sm)]"
        >
          <div class="w-14 h-14 rounded-2xl bg-[#D1FAE5] dark:bg-emerald-950/60 text-[#047857] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-2xl shadow-xs">
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          </div>
          <h2 class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
            Semua Biodata Siswa Sudah Terverifikasi
          </h2>
          <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Saat ini tidak ada pengajuan perubahan data siswa aktif yang menunggu persetujuan Guru BK.
          </p>
        </div>
      </section>

      <!-- KONTEN TAB 2: ANTREAN LAPOR DIRI ALUMNI -->
      <section v-else-if="activeTab === 'alumni'" class="space-y-4" aria-label="Antrean Lapor Diri Alumni">
        <div v-if="alumniStore.pendingList.length > 0" class="space-y-4">
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

            <!-- Tombol Aksi Verifikasi Alumni -->
            <div class="pt-2 flex items-center justify-end gap-2.5">
              <button
                @click="handleReject(item.id, item.name)"
                type="button"
                class="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[#BE123C] dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-sm font-semibold transition-colors flex items-center gap-1.5"
              >
                <i class="fa-solid fa-xmark text-sm"></i>
                <span>Tolak Laporan</span>
              </button>

              <button
                @click="handleApprove(item.id, item.name)"
                type="button"
                class="px-5 py-2.5 rounded-xl bg-[#047857] hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <i class="fa-solid fa-check text-sm"></i>
                <span>Setujui (ACC)</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Tampilan Kosong Tab Alumni -->
        <div
          v-else
          class="p-10 text-center rounded-3xl bg-gradient-to-br from-[#D1FAE5]/45 via-white to-[#E0F2FE]/45 dark:from-emerald-950/20 dark:via-slate-900 dark:to-sky-950/20 border border-emerald-200/70 dark:border-slate-800 space-y-3 shadow-[var(--shadow-sm)]"
        >
          <div class="w-14 h-14 rounded-2xl bg-[#D1FAE5] dark:bg-emerald-950/60 text-[#047857] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-2xl shadow-xs">
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          </div>
          <h2 class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
            Yeay! Semua Laporan Alumni Sudah Beres
          </h2>
          <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Saat ini belum ada antrean laporan tracer study alumni yang baru.
          </p>
        </div>
      </section>

    </template>
  </div>
</template>
