<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import PublicNavbar from '@/components/PublicNavbar.vue'
import { processAndUploadPhoto, isCloudinaryConfigured } from '@/lib/cloudinary'

const authStore = useAuthStore()
const alumniStore = useAlumniStore()

// Cek peran pengguna
const isSiswa = computed(() => authStore.userRole === 'siswa')
const isAdmin = computed(() => authStore.userRole === 'admin' || authStore.userRole === 'guru')

// State status pengajuan verifikasi perubahan biodata untuk siswa
const pendingUpdate = ref(null)

// State Formulir Biodata
const form = ref({
  nama: '',
  kelas: '',
  nisn: '',
  nis: '',
  foto_url: '',
  ttl: '',
  alamat_lengkap: '',
  jenis_tinggal: 'Bersama Orang Tua',
  alat_transportasi: 'Sepeda Motor',
  no_wa: '',
  email: '',
  nama_ortu: '',
  pekerjaan_ortu: '',
  no_wa_ortu: '',
  asal_smp: ''
})

// State Unggah Foto
const fileInput = ref(null)
const isUploadingPhoto = ref(false)
const photoUploadError = ref('')

// State Ganti Kata Sandi
const passForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const showOldPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

// Feedback Status
const isSavingBiodata = ref(false)
const isSavingPassword = ref(false)
const feedbackMessage = ref('')
const feedbackType = ref('') // 'success' atau 'error'

// Pilihan Jenis Tinggal
const JENIS_TINGGAL_OPTIONS = [
  'Bersama Orang Tua',
  'Anggota Keluarga Lainnya',
  'Sendiri'
]

// Pilihan Alat Transportasi
const TRANSPORT_OPTIONS = [
  'Sepeda Motor',
  'Sepeda',
  'Jalan Kaki',
  'Angkutan Umum',
  'Antar Jemput',
  'Mobil Pribadi',
  'Lainnya'
]

// Sinkronkan data pengguna saat halaman dibuka
function loadUserData() {
  const u = authStore.currentUser || {}
  
  // Jika ada pengajuan pending, tampilkan perubahan terakhir yang diusulkan siswa
  const pending = isSiswa.value ? alumniStore.checkStudentPendingStatus(u.nis || authStore.userNis) : null
  pendingUpdate.value = pending
  const source = (isSiswa.value && pending?.proposedData) ? pending.proposedData : u

  form.value = {
    nama: u.nama || authStore.userName || '',
    kelas: u.kelas || 'XI 1',
    nisn: u.nisn || authStore.userNisn || '',
    nis: u.nis || authStore.userNis || '',
    foto_url: source.foto_url !== undefined ? source.foto_url : (u.foto_url || ''),
    ttl: source.ttl || '',
    alamat_lengkap: source.alamat_lengkap || '',
    jenis_tinggal: source.jenis_tinggal || 'Bersama Orang Tua',
    alat_transportasi: source.alat_transportasi || 'Sepeda Motor',
    no_wa: source.no_wa || '',
    email: source.email || authStore.userEmail || '',
    nama_ortu: source.nama_ortu || '',
    pekerjaan_ortu: source.pekerjaan_ortu || '',
    no_wa_ortu: source.no_wa_ortu || '',
    asal_smp: source.asal_smp || ''
  }
}

// Buka file chooser foto
function triggerPhotoSelect() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

// Proses unggah foto ke Cloudinary
async function handlePhotoUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return

  photoUploadError.value = ''
  isUploadingPhoto.value = true

  try {
    if (isCloudinaryConfigured()) {
      const url = await processAndUploadPhoto(file)
      form.value.foto_url = url
    } else {
      // Fallback jika Cloudinary belum aktif
      const reader = new FileReader()
      reader.onload = (evt) => {
        form.value.foto_url = evt.target.result
      }
      reader.readAsDataURL(file)
    }
  } catch (err) {
    photoUploadError.value = err.message || 'Gagal mengunggah foto profil.'
  } finally {
    isUploadingPhoto.value = false
    if (e.target) e.target.value = ''
  }
}

function handleRemovePhoto() {
  form.value.foto_url = ''
  photoUploadError.value = ''
}

// Hitung persentase kelengkapan profil
const completenessPercentage = computed(() => {
  const fields = [
    form.value.foto_url,
    form.value.ttl,
    form.value.alamat_lengkap,
    form.value.jenis_tinggal,
    form.value.alat_transportasi,
    form.value.no_wa,
    form.value.email,
    form.value.nama_ortu,
    form.value.pekerjaan_ortu,
    form.value.no_wa_ortu,
    form.value.asal_smp
  ]
  const filled = fields.filter((f) => f && String(f).trim().length > 0).length
  return Math.round((filled / fields.length) * 100)
})

// Inisial avatar
const userInitials = computed(() => {
  const name = form.value.nama || authStore.userName || 'Siswa'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
})

// Simpan Biodata
async function handleSaveBiodata() {
  clearFeedback()
  isSavingBiodata.value = true

  if (isSiswa.value) {
    // Siswa: Tidak langsung disimpan ke users, melainkan dikirim ke antrean verifikasi Guru BK
    const res = await alumniStore.submitStudentUpdate(form.value)
    isSavingBiodata.value = false

    if (res.success) {
      pendingUpdate.value = res.data || alumniStore.checkStudentPendingStatus(form.value.nis)
      showFeedback('success', 'Pengajuan perubahan biodata berhasil disimpan dan sedang menunggu verifikasi (ACC) dari Guru BK.')
    } else {
      showFeedback('error', res.message || 'Gagal mengirim pengajuan perubahan biodata.')
    }
  } else {
    // Admin / Guru BK: Simpan langsung ke database users
    const res = await authStore.updateProfile(form.value)
    isSavingBiodata.value = false

    if (res.success) {
      showFeedback('success', res.message || 'Biodata profil berhasil disimpan!')
    } else {
      showFeedback('error', res.message || 'Gagal menyimpan biodata profil.')
    }
  }
}

// Ubah Kata Sandi
async function handleChangePassword() {
  clearFeedback()

  if (!passForm.value.oldPassword) {
    showFeedback('error', 'Masukkan kata sandi lama Anda.')
    return
  }
  if (!passForm.value.newPassword) {
    showFeedback('error', 'Masukkan kata sandi baru.')
    return
  }
  if (passForm.value.newPassword.length < 6) {
    showFeedback('error', 'Kata sandi baru minimal 6 karakter.')
    return
  }
  if (passForm.value.newPassword !== passForm.value.confirmPassword) {
    showFeedback('error', 'Konfirmasi kata sandi baru tidak cocok.')
    return
  }

  isSavingPassword.value = true
  const res = await authStore.changePassword(passForm.value.oldPassword, passForm.value.newPassword)
  isSavingPassword.value = false

  if (res.success) {
    showFeedback('success', 'Kata sandi berhasil diperbarui! Gunakan sandi baru untuk login berikutnya.')
    passForm.value = {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  } else {
    showFeedback('error', res.message || 'Gagal memperbarui kata sandi.')
  }
}

function showFeedback(type, msg) {
  feedbackType.value = type
  feedbackMessage.value = msg
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function clearFeedback() {
  feedbackMessage.value = ''
  feedbackType.value = ''
}

onMounted(async () => {
  await authStore.refreshUserProfile()
  await alumniStore.fetchData()
  loadUserData()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#EFF6FF]/90 via-[#F8FAFC] to-[#FFFBEB]/85 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-700 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200">
    
    <!-- NAVBAR RESMI HALAMAN DEPAN -->
    <PublicNavbar />

    <!-- KONTEN UTAMA PROFIL -->
    <main class="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      
      <!-- NAVIGASI KEMBALI KE PORTAL BERITA -->
      <div class="flex items-center justify-between pb-1">
        <router-link
          to="/"
          class="inline-flex items-center gap-2 text-sm font-semibold text-[#0369A1] dark:text-sky-400 hover:underline py-1 group"
        >
          <i class="fa-solid fa-arrow-left text-xs group-hover:-translate-x-1 transition-transform"></i>
          <span>Kembali ke Halaman Berita</span>
        </router-link>

        <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Konfigurasi Akun &bull; {{ isAdmin ? 'Guru BK' : (isSiswa ? 'Siswa' : 'Pengguna') }}
        </span>
      </div>

      <!-- HEADER PROFIL: IDENTITY HERO CARD -->
      <div class="rounded-3xl bg-gradient-to-br from-[#0284C7] via-[#0369A1] to-[#075985] text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <!-- Ornamen Dekoratif Latar Belakang -->
        <div class="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div class="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-400/15 rounded-full blur-2xl pointer-events-none"></div>

        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="flex items-center gap-4 sm:gap-5">
            <!-- Avatar Squircle dengan Foto atau Inisial -->
            <div class="relative group shrink-0">
              <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-white/15 backdrop-blur-md border border-white/30 text-white flex items-center justify-center font-display font-extrabold text-2xl sm:text-3xl shadow-md">
                <img
                  v-if="form.foto_url"
                  :src="form.foto_url"
                  :alt="'Foto ' + form.nama"
                  class="w-full h-full object-cover"
                />
                <span v-else>{{ userInitials }}</span>
              </div>
              <!-- Tombol Kamera Cepat di Sudut Avatar (Hanya untuk Admin / Guru BK) -->
              <button
                v-if="isAdmin"
                type="button"
                @click="triggerPhotoSelect"
                class="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center text-xs shadow-md transition-transform group-hover:scale-110"
                title="Unggah atau ganti foto profil"
                aria-label="Unggah atau ganti foto profil"
              >
                <i class="fa-solid fa-camera"></i>
              </button>
            </div>

            <div class="space-y-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide shadow-2xs">
                  {{ isAdmin ? 'Guru BK / Pengelola' : (isSiswa ? ('Angkatan ' + (form.angkatan || 61) + ' (Lulusan 2027)') : 'Alumni / Pengguna') }}
                </span>
                <span class="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-white font-semibold text-xs border border-white/25">
                  {{ isSiswa ? (form.kelas || 'Siswa') : (isAdmin ? 'Hak Akses Penuh' : 'Pengguna Terdaftar') }}
                </span>
              </div>

              <h1 class="font-display font-bold text-xl sm:text-2xl lg:text-3xl text-white truncate leading-tight">
                {{ form.nama || authStore.userName || 'Profil Pengguna' }}
              </h1>

              <p class="text-xs sm:text-sm text-sky-100 flex flex-wrap items-center gap-x-3 gap-y-1">
                <template v-if="isSiswa">
                  <span>NISN: <strong class="text-white">{{ form.nisn || '-' }}</strong></span>
                  <span aria-hidden="true">&bull;</span>
                  <span>NIS: <strong class="text-white">{{ form.nis || '-' }}</strong></span>
                </template>
                <template v-else>
                  <span>Email: <strong class="text-white">{{ form.email || authStore.userEmail || '-' }}</strong></span>
                  <span aria-hidden="true">&bull;</span>
                  <span>Peran: <strong class="text-white">{{ authStore.userRole === 'admin' ? 'Guru BK / Admin' : 'Pengguna' }}</strong></span>
                </template>
              </p>
            </div>
          </div>

          <!-- Meter Kelengkapan Profil (Khusus Siswa) atau Info Status (Khusus Admin/User) -->
          <div v-if="isSiswa" class="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 w-full md:w-64 space-y-2 shrink-0">
            <div class="flex items-center justify-between text-xs font-semibold">
              <span class="text-sky-100 flex items-center gap-1.5">
                <i class="fa-solid fa-list-check text-amber-300"></i>
                Kelengkapan Biodata
              </span>
              <span class="font-display font-bold text-sm text-amber-300">{{ completenessPercentage }}%</span>
            </div>
            <div class="w-full bg-white/20 rounded-full h-2 overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500 rounded-full"
                :style="{ width: `${completenessPercentage}%` }"
              ></div>
            </div>
            <p class="text-[11px] text-sky-100/90 leading-tight">
              {{ completenessPercentage === 100 ? '🎉 Biodata Anda sudah lengkap!' : 'Lengkapi seluruh data untuk keperluan administrasi BK.' }}
            </p>
          </div>
          <div v-else class="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 w-full md:w-64 space-y-2 shrink-0">
            <div class="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <i class="fa-solid fa-shield-halved"></i>
              <span>Status Akun Aktif</span>
            </div>
            <p class="text-xs text-sky-100 leading-relaxed">
              {{ isAdmin ? 'Akun Administrator Guru BK: Memiliki akses mengelola berita, database alumni, serta verifikasi laporan tracer study.' : 'Akun Pengguna Terverifikasi.' }}
            </p>
          </div>
        </div>
      </div>

    <!-- FEEDBACK ALERT (SUKSES / ERROR) -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="feedbackMessage"
        class="p-4 rounded-2xl border flex items-start justify-between gap-3 text-sm font-semibold shadow-xs"
        :class="feedbackType === 'success'
          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
          : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'"
        role="alert"
      >
        <div class="flex items-center gap-2.5">
          <i
            class="text-base shrink-0"
            :class="feedbackType === 'success' ? 'fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400' : 'fa-solid fa-circle-exclamation text-rose-600 dark:text-rose-400'"
            aria-hidden="true"
          ></i>
          <span>{{ feedbackMessage }}</span>
        </div>
        <button
          type="button"
          @click="clearFeedback"
          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Tutup pesan"
        >
          <i class="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>
    </Transition>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
      
      <!-- KOLOM KIRI (2/3): FORMULIR FOTO, BIODATA SISWA & ORANG TUA -->
      <div class="lg:col-span-2 space-y-6">

        <!-- BANNER PERINGATAN KUNING: MENUNGGU VERIFIKASI DATA (KHUSUS SISWA DENGAN PENGAJUAN PENDING) -->
        <div
          v-if="isSiswa && pendingUpdate"
          class="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-50 via-white to-amber-50/70 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-950/20 border-2 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
        >
          <div class="flex items-start gap-3.5">
            <div class="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 text-xl shadow-xs">
              <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-display font-bold text-base text-amber-950 dark:text-amber-100">
                  Menunggu Verifikasi Data
                </span>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] dark:bg-amber-900 text-[#92400E] dark:text-amber-200 border border-amber-300 dark:border-amber-700 inline-flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>Perlu ACC Guru BK</span>
                </span>
              </div>
              <p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                Perubahan biodata Anda terakhir diajukan pada <strong class="text-amber-900 dark:text-amber-300">{{ pendingUpdate.submittedAt }}</strong> dan saat ini sedang menunggu persetujuan Guru BK. Anda tetap dapat mengedit dan menyimpan formulir di bawah ini; sistem akan otomatis memperbarui pengajuan terakhir tanpa membuat data ganda.
              </p>
            </div>
          </div>
        </div>
        
        <!-- SEKSI 0: FORM FOTO PROFIL SISWA -->
        <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-[#0284C7] dark:text-sky-300 flex items-center justify-center text-sm">
                <i class="fa-solid fa-image"></i>
              </span>
              <span>Foto Profil Siswa</span>
            </h2>
            <span class="text-xs text-slate-400">Formal / Almamater</span>
          </div>

          <!-- Hidden Input File -->
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            @change="handlePhotoUpload"
            class="hidden"
          />

          <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <!-- Box Preview Foto -->
            <div class="relative w-24 h-28 sm:w-28 sm:h-36 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <img
                v-if="form.foto_url"
                :src="form.foto_url"
                :alt="'Foto ' + form.nama"
                class="w-full h-full object-cover"
              />
              <div v-else class="text-center p-3 text-slate-400 dark:text-slate-500">
                <i class="fa-regular fa-user text-2xl mb-1 block"></i>
                <span class="text-[10px] leading-tight block">Belum ada foto</span>
              </div>

              <!-- Overlay Loading Saat Upload -->
              <div
                v-if="isUploadingPhoto"
                class="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-1.5"
              >
                <i class="fa-solid fa-spinner fa-spin text-lg text-sky-400"></i>
                <span class="text-[10px] font-semibold">Mengunggah...</span>
              </div>
            </div>

            <!-- Tombol Aksi & Keterangan Foto -->
            <div class="space-y-3 flex-1 text-center sm:text-left">
              <!-- Jika Admin: Memiliki Hak Kelola / Unggah Foto -->
              <template v-if="isAdmin">
                <div class="space-y-1">
                  <p class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Kelola Foto Profil
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Gunakan foto setengah badan formal untuk identitas akun Anda.
                  </p>
                </div>

                <!-- Pesan Error Upload Foto -->
                <p v-if="photoUploadError" class="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  {{ photoUploadError }}
                </p>

                <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                  <button
                    type="button"
                    @click="triggerPhotoSelect"
                    :disabled="isUploadingPhoto"
                    class="px-4 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs inline-flex items-center gap-2 disabled:opacity-50 min-h-[38px]"
                  >
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    <span>{{ form.foto_url ? 'Ganti Foto' : 'Pilih Berkas Foto' }}</span>
                  </button>

                  <button
                    v-if="form.foto_url"
                    type="button"
                    @click="handleRemovePhoto"
                    class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-300 text-xs sm:text-sm font-semibold transition-colors border border-slate-200 dark:border-slate-700 min-h-[38px] inline-flex items-center gap-1.5"
                  >
                    <i class="fa-regular fa-trash-can text-xs"></i>
                    <span>Hapus</span>
                  </button>
                </div>

                <div class="flex items-center justify-center sm:justify-start gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                  <i class="fa-solid fa-circle-check text-emerald-500"></i>
                  <span>Tersimpan di Cloudinary CDN (Format JPG, PNG, WEBP)</span>
                </div>
              </template>

              <!-- Jika Siswa: Hanya Tampilan Info (Siswa tidak bisa ganti foto, hanya admin) -->
              <template v-else>
                <div class="space-y-1.5">
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                    <i class="fa-solid fa-lock text-[10px]"></i>
                    <span>Hak Akses Guru BK</span>
                  </div>
                  <p class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Foto Resmi Siswa
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Pengunggahan dan penggantian foto resmi siswa hanya dapat dilakukan oleh <strong>Administrator / Guru BK</strong> melalui Studio Manajemen Data.
                  </p>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- SEKSI 1: BIODATA UTAMA SISWA -->
        <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-5">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-[#0284C7] dark:text-sky-300 flex items-center justify-center text-sm">
                <i class="fa-solid fa-user"></i>
              </span>
              <span>{{ isSiswa ? 'Biodata Siswa' : 'Informasi Akun Pengelola' }}</span>
            </h2>
            <span class="text-xs text-slate-400">{{ isSiswa ? 'Data Pokok' : 'Profil Pengguna' }}</span>
          </div>

          <div v-if="isSiswa" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- NAMA LENGKAP (Readonly Terverifikasi) -->
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                NAMA SISWA
                <span class="text-xs font-normal text-slate-400 ml-1">(Resmi dari Sekolah)</span>
              </label>
              <div class="relative">
                <input
                  v-model="form.nama"
                  type="text"
                  readonly
                  class="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-not-allowed"
                />
                <i class="fa-solid fa-lock absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" title="Terkunci resmi"></i>
              </div>
            </div>

            <!-- KELAS -->
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kelas Baru
              </label>
              <input
                v-model="form.kelas"
                type="text"
                readonly
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-not-allowed"
              />
            </div>

            <!-- NISN & NIS -->
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                NISN &amp; NIS
              </label>
              <div class="grid grid-cols-2 gap-2">
                <input
                  v-model="form.nisn"
                  type="text"
                  readonly
                  title="NISN Siswa (ID Login)"
                  placeholder="NISN"
                  class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-not-allowed text-center"
                />
                <input
                  v-model="form.nis"
                  type="text"
                  readonly
                  title="NIS Siswa"
                  placeholder="NIS"
                  class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-not-allowed text-center"
                />
              </div>
            </div>

            <!-- TEMPAT, TANGGAL LAHIR (TTL) -->
            <div class="sm:col-span-2">
              <label for="ttl" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tempat, Tanggal Lahir (TTL) <span class="text-rose-500">*</span>
              </label>
              <input
                id="ttl"
                v-model="form.ttl"
                type="text"
                placeholder="contoh: Ngawi, 15 Mei 2008"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>

            <!-- ALAMAT LENGKAP -->
            <div class="sm:col-span-2">
              <label for="alamat" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alamat Lengkap <span class="text-rose-500">*</span>
              </label>
              <textarea
                id="alamat"
                v-model="form.alamat_lengkap"
                rows="2"
                placeholder="Jalan, RT/RW, Dusun, Desa/Kelurahan, Kecamatan, Kabupaten"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all resize-none"
              ></textarea>
            </div>

            <!-- JENIS TINGGAL -->
            <div>
              <label for="jenis_tinggal" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Jenis Tinggal <span class="text-rose-500">*</span>
              </label>
              <select
                id="jenis_tinggal"
                v-model="form.jenis_tinggal"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              >
                <option v-for="opt in JENIS_TINGGAL_OPTIONS" :key="opt" :value="opt">
                  {{ opt }}
                </option>
              </select>
            </div>

            <!-- ALAT TRANSPORTASI -->
            <div>
              <label for="transportasi" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alat Transportasi ke Sekolah <span class="text-rose-500">*</span>
              </label>
              <select
                id="transportasi"
                v-model="form.alat_transportasi"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              >
                <option v-for="opt in TRANSPORT_OPTIONS" :key="opt" :value="opt">
                  {{ opt }}
                </option>
              </select>
            </div>

            <!-- NOMOR WA SISWA -->
            <div>
              <label for="no_wa" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                No. WhatsApp Siswa <span class="text-rose-500">*</span>
              </label>
              <input
                id="no_wa"
                v-model="form.no_wa"
                type="tel"
                placeholder="contoh: 081234567890"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>

            <!-- EMAIL SISWA -->
            <div>
              <label for="email" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Siswa
              </label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                placeholder="nama@gmail.com"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>

            <!-- ASAL SMP -->
            <div class="sm:col-span-2">
              <label for="asal_smp" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Asal SMP / MTs <span class="text-rose-500">*</span>
              </label>
              <input
                id="asal_smp"
                v-model="form.asal_smp"
                type="text"
                placeholder="contoh: SMP Negeri 2 Ngawi"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>
          </div>

          <!-- TAMPILAN FORMULIR KHUSUS GURU BK / PENGELOLA / PENGGUNA -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label for="admin_nama" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Lengkap
              </label>
              <input
                id="admin_nama"
                v-model="form.nama"
                type="text"
                placeholder="Nama Pengguna"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>

            <div>
              <label for="admin_email" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alamat Email
              </label>
              <input
                id="admin_email"
                v-model="form.email"
                type="email"
                placeholder="email@sekolah.sch.id"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>

            <div>
              <label for="admin_no_wa" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nomor WhatsApp
              </label>
              <input
                id="admin_no_wa"
                v-model="form.no_wa"
                type="tel"
                placeholder="081234567890"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Peran Hak Akses
              </label>
              <input
                :value="isAdmin ? 'Guru Bimbingan Konseling / Administrator' : 'Pengguna / Alumni SMADA'"
                type="text"
                readonly
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <!-- SEKSI 2: DATA ORANG TUA / WALI (KHUSUS SISWA) -->
        <div v-if="isSiswa" class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-5">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 flex items-center justify-center text-sm">
                <i class="fa-solid fa-people-roof"></i>
              </span>
              <span>Data Orang Tua / Wali</span>
            </h2>
            <span class="text-xs text-slate-400">Kontak Keluarga</span>
          </div>

          <div v-if="isSiswa" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- NAMA ORTU / WALI -->
            <div class="sm:col-span-2">
              <label for="nama_ortu" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Orang Tua / Wali <span class="text-rose-500">*</span>
              </label>
              <input
                id="nama_ortu"
                v-model="form.nama_ortu"
                type="text"
                placeholder="Nama lengkap ayah / ibu / wali murid"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>

            <!-- PEKERJAAN ORTU / WALI -->
            <div>
              <label for="pekerjaan_ortu" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pekerjaan Orang Tua / Wali <span class="text-rose-500">*</span>
              </label>
              <input
                id="pekerjaan_ortu"
                v-model="form.pekerjaan_ortu"
                type="text"
                placeholder="contoh: PNS, Wiraswasta, Petani, Guru"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>

            <!-- NO WA ORTU (SALAH SATU) -->
            <div>
              <label for="no_wa_ortu" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                No. WhatsApp Ortu (Salah Satu) <span class="text-rose-500">*</span>
              </label>
              <input
                id="no_wa_ortu"
                v-model="form.no_wa_ortu"
                type="tel"
                placeholder="contoh: 081234567890"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
              />
            </div>
          </div>

          <!-- Tombol Simpan Biodata & Indikator Status ACC -->
          <div class="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div v-if="isSiswa && pendingUpdate" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold">
              <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Menunggu Verifikasi Data</span>
            </div>
            <div v-else></div>

            <button
              type="button"
              @click="handleSaveBiodata"
              :disabled="isSavingBiodata"
              class="px-6 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-sm transition-colors shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
            >
              <i v-if="isSavingBiodata" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-floppy-disk"></i>
              <span>{{ isSavingBiodata ? 'Menyimpan...' : (isSiswa && pendingUpdate ? 'Perbarui Pengajuan Data' : 'Simpan Perubahan Biodata') }}</span>
            </button>
          </div>
        </div>

      </div>

      <!-- KOLOM KANAN (1/3): KONFIGURASI KATA SANDI & PANDUAN -->
      <div class="space-y-6">
        
        <!-- KARTU GANTI PASSWORD -->
        <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="font-display font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs">
                <i class="fa-solid fa-key"></i>
              </span>
              <span>Konfigurasi Kata Sandi</span>
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Amankan akun Anda dengan mengganti kata sandi bawaan sekolah.
            </p>
          </div>

          <form @submit.prevent="handleChangePassword" class="space-y-4">
            <!-- Kata Sandi Lama -->
            <div>
              <label for="old_pass" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kata Sandi Lama <span class="text-rose-500">*</span>
              </label>
              <div class="relative">
                <input
                  id="old_pass"
                  v-model="passForm.oldPassword"
                  :type="showOldPassword ? 'text' : 'password'"
                  placeholder="Masukkan kata sandi saat ini"
                  class="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
                />
                <button
                  type="button"
                  @click="showOldPassword = !showOldPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                  :aria-label="showOldPassword ? 'Sembunyikan sandi' : 'Lihat sandi'"
                >
                  <i :class="showOldPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
                </button>
              </div>
            </div>

            <!-- Kata Sandi Baru -->
            <div>
              <label for="new_pass" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kata Sandi Baru <span class="text-rose-500">*</span>
              </label>
              <div class="relative">
                <input
                  id="new_pass"
                  v-model="passForm.newPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  placeholder="Minimal 6 karakter"
                  class="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
                />
                <button
                  type="button"
                  @click="showNewPassword = !showNewPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                  :aria-label="showNewPassword ? 'Sembunyikan sandi' : 'Lihat sandi'"
                >
                  <i :class="showNewPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
                </button>
              </div>
            </div>

            <!-- Konfirmasi Kata Sandi Baru -->
            <div>
              <label for="confirm_pass" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ulangi Kata Sandi Baru <span class="text-rose-500">*</span>
              </label>
              <div class="relative">
                <input
                  id="confirm_pass"
                  v-model="passForm.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  placeholder="Ketik ulang kata sandi baru"
                  class="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
                />
                <button
                  type="button"
                  @click="showConfirmPassword = !showConfirmPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                  :aria-label="showConfirmPassword ? 'Sembunyikan sandi' : 'Lihat sandi'"
                >
                  <i :class="showConfirmPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              :disabled="isSavingPassword"
              class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
            >
              <i v-if="isSavingPassword" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-shield-halved"></i>
              <span>{{ isSavingPassword ? 'Memproses...' : 'Perbarui Kata Sandi' }}</span>
            </button>
          </form>
        </div>

        <!-- PANDUAN PENGISIAN BIODATA -->
        <div class="rounded-3xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 p-5 space-y-3">
          <div class="flex items-center gap-2 text-sky-800 dark:text-sky-300 font-bold text-xs">
            <i class="fa-solid fa-circle-info text-sm"></i>
            <span>Petunjuk Penting</span>
          </div>
          <ul class="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
            <li>Pastikan <strong>nomor WhatsApp</strong> aktif untuk memudahkan komunikasi bimbingan karir oleh Guru BK.</li>
            <li>Nama lengkap dan NISN telah diverifikasi sesuai data Dapodik sekolah.</li>
            <li>Foto profil otomatis disesuaikan agar tampil rapi pada direktori sekolah.</li>
            <li>Catat kata sandi baru Anda dengan baik agar tidak terlupa saat login berikutnya.</li>
          </ul>
        </div>

      </div>

    </div>

  </main>

  <!-- FOOTER RESMI -->
  <footer class="mt-auto border-t border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 py-4 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
    &copy; 2026 Bimbingan Konseling SMA Negeri 2 Ngawi. Hak cipta dilindungi.
  </footer>
</div>
</template>
