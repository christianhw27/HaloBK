<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAlumniStore } from '@/stores/alumni'
import { useAuthStore } from '@/stores/auth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { processAndUploadPhoto, isCloudinaryConfigured } from '@/lib/cloudinary'
import { compressImage } from '@/lib/imageHelper'
import PublicNavbar from '@/components/PublicNavbar.vue'
import CampusCombobox from '@/components/CampusCombobox.vue'
import ProdiCombobox from '@/components/ProdiCombobox.vue'

const route = useRoute()
const router = useRouter()
const alumniStore = useAlumniStore()
const authStore = useAuthStore()

const studentId = computed(() => route.params.id)

// State Formulir Lengkap Siswa / Alumni
const form = ref({
  id: '',
  name: '',
  nis: '',
  nisn: '',
  classRoom: 'XII-1',
  cohort: '2027',
  angkatan: 61,
  ttl: '',
  alamat_lengkap: '',
  jenis_tinggal: 'Bersama Orang Tua',
  alat_transportasi: 'Sepeda Motor',
  phone: '',
  email: '',
  nama_ortu: '',
  pekerjaan_ortu: '',
  no_wa_ortu: '',
  asal_smp: '',
  category: 'Siswa Aktif',
  pathway: 'Siswa',
  institution: '',
  major: '',
  message: '',
  photo: '',
  newPassword: ''
})

const isLoading = ref(true)
const isSaving = ref(false)
const isUploadingPhoto = ref(false)
const photoUploadError = ref('')
const feedbackMessage = ref('')
const feedbackType = ref('') // 'success' | 'error'
const showPassword = ref(false)
const fileInput = ref(null)

// Pilihan Jalur Masuk Berdasarkan Kategori
const pathwaysByCategory = {
  'Siswa Aktif': ['Siswa', 'Siswa Reguler'],
  'PTN': ['SNBP', 'SNBT', 'Mandiri PTN', 'Beasiswa KIP-Kuliah', 'Jalur Prestasi'],
  'PTS': ['Jalur Prestasi Rapor', 'Beasiswa Yayasan', 'Mandiri PTS', 'Tes Masuk PTS'],
  'Kedinasan': ['Ikatan Dinas', 'Politeknik Kedinasan', 'Beasiswa Ikatan Kerja'],
  'TNI/Polri': ['Seleksi Akmil / Akpol', 'Bintara Polri', 'Bintara TNI AD/AL/AU', 'Tamtama'],
  'Bekerja': ['Rekrutmen Kerja Perusahaan', 'BUMN / BUMD', 'Freelance / Remote Work'],
  'Wirausaha': ['Wirausaha Mandiri', 'Bisnis Kuliner / UMKM', 'Digital Creator / Agensi'],
  'Pelatihan / LPK': ['Program Pelatihan / LPK', 'Magang Luar Negeri / Jepang', 'Balai Latihan Kerja (BLK)'],
  'Belum Lapor Diri': ['Belum Menentukan Pilihan', 'Persiapan UTBK / Kedinasan (Gap Year)', 'Kursus / Les Intensif'],
  'Masa Tunggu': ['Belum Menentukan Pilihan', 'Persiapan UTBK / Kedinasan (Gap Year)', 'Kursus / Les Intensif']
}

const currentPathwayOptions = computed(() => {
  return pathwaysByCategory[form.value.category] || ['Reguler', 'Lainnya']
})

function onCategoryChange() {
  const opts = currentPathwayOptions.value
  if (opts && opts.length > 0 && !opts.includes(form.value.pathway)) {
    form.value.pathway = opts[0]
  }
}

// Inisial untuk avatar fallback
const initials = computed(() => {
  const name = form.value.name || 'Siswa'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
})

// Angkatan 2026 kebawah tidak memiliki akun login, jadi reset sandi hanya untuk 2027 keatas
const hasUserAccount = computed(() => {
  const cohortYear = parseInt(form.value.cohort) || 0
  return cohortYear >= 2027
})

// Muat data siswa dari Store atau Supabase langsung
async function loadStudentData() {
  if (authStore.userRole !== 'admin') {
    router.replace('/dashboard')
    return
  }

  isLoading.value = true
  const targetId = studentId.value

  if (!targetId) {
    showFeedback('error', 'ID Siswa tidak valid.')
    isLoading.value = false
    return
  }

  // 1. Pastikan store sudah memiliki data
  if (alumniStore.alumniList.length === 0) {
    await alumniStore.fetchData()
  }

  // 2. Cari di alumniList
  let item = alumniStore.alumniList.find((a) => String(a.id) === String(targetId))

  // 3. Jika tidak ada di alumniList (misal direct link refresh), query langsung ke Supabase
  if (!item && isSupabaseConfigured && supabase) {
    try {
      // Coba tabel users
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', targetId)
        .maybeSingle()

      if (userData) {
        item = {
          id: userData.id,
          name: userData.nama,
          nis: userData.nis,
          nisn: userData.nisn,
          classRoom: userData.kelas,
          cohort: String(userData.tahun_lulus || 2027),
          angkatan: userData.angkatan || 61,
          phone: userData.no_wa,
          email: userData.email,
          ttl: userData.ttl,
          alamat_lengkap: userData.alamat_lengkap,
          jenis_tinggal: userData.jenis_tinggal,
          alat_transportasi: userData.alat_transportasi,
          nama_ortu: userData.nama_ortu,
          pekerjaan_ortu: userData.pekerjaan_ortu,
          no_wa_ortu: userData.no_wa_ortu,
          asal_smp: userData.asal_smp,
          photo: userData.foto_url,
          category: 'Siswa Aktif',
          pathway: 'Siswa',
          institution: 'SMA Negeri 2 Ngawi',
          major: `Siswa Aktif Kelas ${userData.kelas || '-'}`,
          message: ''
        }
      } else {
        // Coba tabel alumni
        const { data: alumniData } = await supabase
          .from('alumni')
          .select('*')
          .eq('id', targetId)
          .maybeSingle()

        if (alumniData) {
          item = {
            id: alumniData.id,
            name: alumniData.nama_lengkap,
            nis: alumniData.nis,
            nisn: '',
            classRoom: alumniData.kelas_terakhir,
            cohort: String(alumniData.tahun_lulus || 2026),
            angkatan: 60,
            phone: alumniData.no_wa,
            email: '',
            ttl: '',
            alamat_lengkap: '',
            jenis_tinggal: 'Bersama Orang Tua',
            alat_transportasi: 'Sepeda Motor',
            nama_ortu: '',
            pekerjaan_ortu: '',
            no_wa_ortu: '',
            asal_smp: '',
            photo: alumniData.foto_url,
            category: alumniData.kategori || 'PTN',
            pathway: alumniData.jalur_masuk || 'SNBP',
            institution: alumniData.instansi || '',
            major: alumniData.jurusan_posisi || '',
            message: alumniData.pesan || ''
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching student directly:', e)
    }
  }

  if (item) {
    form.value = {
      id: item.id,
      name: item.name || '',
      nis: item.nis === '-' ? '' : (item.nis || ''),
      nisn: item.nisn === '-' ? '' : (item.nisn || ''),
      classRoom: item.classRoom === '-' ? 'XII-1' : (item.classRoom || 'XII-1'),
      cohort: String(item.cohort || '2027'),
      angkatan: item.angkatan || 61,
      ttl: item.ttl === '-' ? '' : (item.ttl || ''),
      alamat_lengkap: item.alamat_lengkap === '-' ? '' : (item.alamat_lengkap || ''),
      jenis_tinggal: item.jenis_tinggal === '-' ? 'Bersama Orang Tua' : (item.jenis_tinggal || 'Bersama Orang Tua'),
      alat_transportasi: item.alat_transportasi === '-' ? 'Sepeda Motor' : (item.alat_transportasi || 'Sepeda Motor'),
      phone: item.phone === '-' ? '' : (item.phone || ''),
      email: item.email === '-' ? '' : (item.email || ''),
      nama_ortu: item.nama_ortu === '-' ? '' : (item.nama_ortu || ''),
      pekerjaan_ortu: item.pekerjaan_ortu === '-' ? '' : (item.pekerjaan_ortu || ''),
      no_wa_ortu: item.no_wa_ortu === '-' ? '' : (item.no_wa_ortu || ''),
      asal_smp: item.asal_smp === '-' ? '' : (item.asal_smp || ''),
      category: item.category || 'Siswa Aktif',
      pathway: item.pathway || 'Siswa',
      institution: item.institution || '',
      major: item.major === '-' ? '' : (item.major || ''),
      message: item.message || '',
      photo: item.photo || '',
      newPassword: ''
    }
  } else {
    showFeedback('error', 'Data siswa atau alumni dengan ID tersebut tidak ditemukan.')
  }

  isLoading.value = false
}

// Upload & Penggantian Foto
function triggerFileInput() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

async function handlePhotoFile(e) {
  const file = e.target.files?.[0]
  if (!file) return

  photoUploadError.value = ''
  isUploadingPhoto.value = true

  try {
    if (isCloudinaryConfigured()) {
      const url = await processAndUploadPhoto(file)
      form.value.photo = url
      showFeedback('success', 'Foto profil berhasil diunggah ke Cloudinary!')
    } else {
      const compressed = await compressImage(file, 400, 0.75)
      form.value.photo = compressed
      showFeedback('info', 'Foto profil berhasil disimpan (format lokal).')
    }
  } catch (err) {
    photoUploadError.value = err.message || 'Gagal memproses foto.'
    showFeedback('error', err.message || 'Gagal memproses foto.')
  } finally {
    isUploadingPhoto.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function removePhoto() {
  if (confirm('Hapus foto profil siswa ini?')) {
    form.value.photo = ''
    showFeedback('info', 'Foto profil telah dihapus dari formulir. Klik Simpan untuk memperbarui database.')
  }
}

// Simpan Seluruh Perubahan Data Siswa
async function handleSave() {
  if (!form.value.name.trim()) {
    showFeedback('error', 'Nama lengkap siswa tidak boleh kosong!')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  isSaving.value = true
  feedbackMessage.value = ''

  const res = await alumniStore.adminUpdateStudentOrAlumni(form.value.id, form.value)
  isSaving.value = false

  if (res.success) {
    showFeedback('success', res.message || 'Biodata siswa berhasil diperbarui!')
    // Kosongkan newPassword setelah sukses
    form.value.newPassword = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    showFeedback('error', res.message || 'Gagal memperbarui data siswa.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function showFeedback(type, message) {
  feedbackType.value = type
  feedbackMessage.value = message
}

function closeCurrentTab() {
  if (window.opener) {
    window.close()
  } else {
    router.push('/data')
  }
}

onMounted(() => {
  loadStudentData()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#EFF6FF]/70 via-[#F8FAFC] to-[#FFFBEB]/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-700 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200">
    <!-- Navbar Resmi Portal -->
    <PublicNavbar />

    <!-- Kontainer Konten Utama -->
    <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      
      <!-- NAVIGASI ATAS & TOMBOL AKSI CEPAT -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="closeCurrentTab"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs group"
          >
            <i class="fa-solid fa-arrow-left text-xs group-hover:-translate-x-1 transition-transform"></i>
            <span>Kembali / Tutup Tab</span>
          </button>

          <span class="hidden sm:inline text-xs text-slate-400">&bull;</span>
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <i class="fa-solid fa-shield-halved mr-1"></i>
            Akses Guru BK / Admin
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="handleSave"
            :disabled="isSaving || isLoading"
            class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-sm transition-all duration-150 shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            <i v-if="isSaving" class="fa-solid fa-spinner fa-spin text-sm" aria-hidden="true"></i>
            <i v-else class="fa-solid fa-floppy-disk text-sm" aria-hidden="true"></i>
            <span>{{ isSaving ? 'Menyimpan Perubahan...' : 'Simpan Semua Perubahan' }}</span>
          </button>
        </div>
      </div>

      <!-- FEEDBACK BANNER (SUCCESS / ERROR) -->
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
          class="p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-sm"
          :class="{
            'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800': feedbackType === 'success',
            'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800': feedbackType === 'error',
            'bg-sky-50 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-800': feedbackType === 'info'
          }"
        >
          <div class="flex items-center gap-3">
            <i
              class="text-lg shrink-0"
              :class="{
                'fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400': feedbackType === 'success',
                'fa-solid fa-triangle-exclamation text-rose-600 dark:text-rose-400': feedbackType === 'error',
                'fa-solid fa-circle-info text-sky-600 dark:text-sky-400': feedbackType === 'info'
              }"
            ></i>
            <span class="text-sm font-semibold">{{ feedbackMessage }}</span>
          </div>
          <button
            type="button"
            @click="feedbackMessage = ''"
            class="w-8 h-8 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-xs"
            aria-label="Tutup notifikasi"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </Transition>

      <!-- SPINNER LOADING JIKA DATA SEDANG DIAMBIL -->
      <div v-if="isLoading" class="p-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <i class="fa-solid fa-circle-notch fa-spin text-4xl text-[#0284C7]"></i>
        <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">Memuat biodata siswa untuk pengeditan...</p>
      </div>

      <!-- FORMULIR EDIT UTAMA -->
      <form v-else @submit.prevent="handleSave" class="space-y-6">
        
        <!-- CARD HEADER HERO: PROFIL & FOTO SISWA -->
        <div class="rounded-3xl bg-gradient-to-br from-[#0284C7] via-[#0369A1] to-[#075985] text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div class="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div class="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-400/15 rounded-full blur-2xl pointer-events-none"></div>

          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <!-- Foto Profil / Inisial Avatar -->
              <div class="relative group shrink-0">
                <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-white/15 backdrop-blur-md border-2 border-white/40 text-white flex items-center justify-center font-display font-extrabold text-2xl sm:text-3xl shadow-lg">
                  <img
                    v-if="form.photo"
                    :src="form.photo"
                    :alt="form.name"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ initials }}</span>
                </div>

                <!-- Tombol Kamera Cepat -->
                <button
                  type="button"
                  @click="triggerFileInput"
                  :disabled="isUploadingPhoto"
                  class="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center shadow-md transition-transform hover:scale-110 border-2 border-white dark:border-slate-900"
                  title="Unggah Foto Baru"
                >
                  <i v-if="isUploadingPhoto" class="fa-solid fa-spinner fa-spin text-xs"></i>
                  <i v-else class="fa-solid fa-camera text-xs"></i>
                </button>
              </div>

              <!-- Info Identitas Ringkas -->
              <div class="space-y-1.5 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/20">
                    Kelas {{ form.classRoom || '-' }}
                  </span>
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400/90 text-slate-950">
                    Angkatan {{ form.angkatan || 61 }} (Lulusan {{ form.cohort }})
                  </span>
                  <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/80 text-white">
                    {{ form.category }}
                  </span>
                </div>

                <h1 class="font-display font-extrabold text-xl sm:text-3xl tracking-tight text-white drop-shadow-xs truncate">
                  {{ form.name || 'Nama Siswa' }}
                </h1>

                <p class="text-xs sm:text-sm text-sky-100 flex flex-wrap items-center gap-3 font-mono">
                  <span>NISN: <strong>{{ form.nisn || '-' }}</strong></span>
                  <span>&bull;</span>
                  <span>NIS: <strong>{{ form.nis || '-' }}</strong></span>
                </p>
              </div>
            </div>

            <!-- Tombol Kelola Foto Profil -->
            <div class="flex items-center gap-2 shrink-0">
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handlePhotoFile"
              />
              <button
                type="button"
                @click="triggerFileInput"
                :disabled="isUploadingPhoto"
                class="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <i class="fa-solid fa-cloud-arrow-up text-xs"></i>
                <span>Ganti Foto</span>
              </button>
              <button
                v-if="form.photo"
                type="button"
                @click="removePhoto"
                class="px-3 py-2 rounded-xl bg-rose-500/80 hover:bg-rose-600 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5"
                title="Hapus Foto"
              >
                <i class="fa-solid fa-trash text-xs"></i>
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>

        <!-- GRID 2 KOLOM: SEMUA FORMULIR BIODATA -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <!-- KOLOM KIRI: DATA POKOK & KONTAK SISWA -->
          <div class="space-y-6">

            <!-- KARTU 1: IDENTITAS POKOK SISWA (NAMA BISA DIUBAH) -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-4">
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div class="w-8 h-8 rounded-lg bg-sky-100 text-[#0284C7] dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-sm">
                  <i class="fa-solid fa-id-card"></i>
                </div>
                <div>
                  <h2 class="font-display font-bold text-base text-slate-900 dark:text-white">
                    1. Identitas Pokok Siswa
                  </h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Nama lengkap, NIS, NISN, dan rombongan belajar.
                  </p>
                </div>
              </div>

              <!-- Input Nama Lengkap (Wajib & Bebas Diedit oleh Admin) -->
              <div>
                <label for="edit-name" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Nama Lengkap Siswa <span class="text-rose-500">*</span>
                </label>
                <input
                  id="edit-name"
                  v-model="form.name"
                  type="text"
                  required
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none transition-shadow font-medium"
                  placeholder="Masukkan nama lengkap siswa..."
                />
              </div>

              <!-- NISN & NIS -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="edit-nisn" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    NISN (10 Digit)
                  </label>
                  <input
                    id="edit-nisn"
                    v-model="form.nisn"
                    type="text"
                    maxlength="10"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    placeholder="00xxxxxxx"
                  />
                </div>
                <div>
                  <label for="edit-nis" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    NIS (Nomor Induk Sekolah)
                  </label>
                  <input
                    id="edit-nis"
                    v-model="form.nis"
                    type="text"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    placeholder="Contoh: 12345"
                  />
                </div>
              </div>

              <!-- Kelas & Angkatan / Tahun Lulus -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="edit-classroom" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Kelas
                  </label>
                  <input
                    id="edit-classroom"
                    v-model="form.classRoom"
                    type="text"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    placeholder="Contoh: XII-1, XII-2, dll."
                  />
                </div>
                <div>
                  <label for="edit-cohort" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Tahun Kelulusan
                  </label>
                  <input
                    id="edit-cohort"
                    v-model="form.cohort"
                    type="number"
                    min="2000"
                    max="2035"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    placeholder="2027"
                  />
                </div>
              </div>

              <!-- Tempat, Tanggal Lahir (TTL) -->
              <div>
                <label for="edit-ttl" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Tempat, Tanggal Lahir (TTL)
                </label>
                <input
                  id="edit-ttl"
                  v-model="form.ttl"
                  type="text"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                  placeholder="Contoh: Ngawi, 15 Juli 2008"
                />
              </div>

              <!-- Asal SMP / MTs -->
              <div>
                <label for="edit-asal-smp" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Asal Sekolah (SMP / MTs)
                </label>
                <input
                  id="edit-asal-smp"
                  v-model="form.asal_smp"
                  type="text"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                  placeholder="Contoh: SMPN 2 Ngawi"
                />
              </div>
            </div>

            <!-- KARTU 2: DOMISILI & TRANSPORTASI -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-4">
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center text-sm">
                  <i class="fa-solid fa-house-chimney-user"></i>
                </div>
                <div>
                  <h2 class="font-display font-bold text-base text-slate-900 dark:text-white">
                    2. Tempat Tinggal &amp; Transportasi
                  </h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Alamat lengkap domisili dan mobilitas harian siswa.
                  </p>
                </div>
              </div>

              <div>
                <label for="edit-alamat" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Alamat Lengkap
                </label>
                <textarea
                  id="edit-alamat"
                  v-model="form.alamat_lengkap"
                  rows="3"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                  placeholder="Nama jalan, RT/RW, Dusun/Kelurahan, Kecamatan, Kabupaten..."
                ></textarea>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="edit-jenis-tinggal" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Jenis Tinggal
                  </label>
                  <select
                    id="edit-jenis-tinggal"
                    v-model="form.jenis_tinggal"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                  >
                    <option value="Bersama Orang Tua">Bersama Orang Tua</option>
                    <option value="Anggota Keluarga Lainnya">Anggota Keluarga Lainnya</option>
                    <option value="Sendiri / Kost">Sendiri / Kost</option>
                    <option value="Asrama / Pondok">Asrama / Pondok</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label for="edit-transport" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Alat Transportasi ke Sekolah
                  </label>
                  <select
                    id="edit-transport"
                    v-model="form.alat_transportasi"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                  >
                    <option value="Sepeda Motor">Sepeda Motor</option>
                    <option value="Mobil Pribadi">Mobil Pribadi</option>
                    <option value="Sepeda Onthel">Sepeda Onthel</option>
                    <option value="Jalan Kaki">Jalan Kaki</option>
                    <option value="Angkutan Umum">Angkutan Umum</option>
                    <option value="Antar Jemput">Antar Jemput</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- KARTU 3: KONTAK SISWA & ORANG TUA -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-4">
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center text-sm">
                  <i class="fa-solid fa-address-book"></i>
                </div>
                <div>
                  <h2 class="font-display font-bold text-base text-slate-900 dark:text-white">
                    3. Kontak Siswa &amp; Orang Tua / Wali
                  </h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    No. WhatsApp, Email, dan informasi wali siswa.
                  </p>
                </div>
              </div>

              <!-- WhatsApp Siswa & Email -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="edit-phone" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    No. WhatsApp Siswa
                  </label>
                  <input
                    id="edit-phone"
                    v-model="form.phone"
                    type="tel"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div>
                  <label for="edit-email" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Email Siswa
                  </label>
                  <input
                    id="edit-email"
                    v-model="form.email"
                    type="email"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    placeholder="nama@siswa.belajar.id"
                  />
                </div>
              </div>

              <!-- Nama Ortu & Pekerjaan -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label for="edit-nama-ortu" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Nama Orang Tua / Wali
                  </label>
                  <input
                    id="edit-nama-ortu"
                    v-model="form.nama_ortu"
                    type="text"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    placeholder="Nama Ayah / Ibu / Wali..."
                  />
                </div>
                <div>
                  <label for="edit-pekerjaan-ortu" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Pekerjaan Orang Tua / Wali
                  </label>
                  <input
                    id="edit-pekerjaan-ortu"
                    v-model="form.pekerjaan_ortu"
                    type="text"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    placeholder="PNS, Wiraswasta, Petani, dll."
                  />
                </div>
              </div>

              <div>
                <label for="edit-wa-ortu" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  No. WhatsApp Orang Tua / Wali
                </label>
                <input
                  id="edit-wa-ortu"
                  v-model="form.no_wa_ortu"
                  type="tel"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                  placeholder="08xxxxxxxxxx (salah satu)"
                />
              </div>
            </div>

          </div>

          <!-- KOLOM KANAN: STATUS KARIR / TRACER STUDY & KEAMANAN AKUN -->
          <div class="space-y-6">

            <!-- KARTU 4: STATUS KELULUSAN & TRACER STUDY -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-4">
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center text-sm">
                  <i class="fa-solid fa-graduation-cap"></i>
                </div>
                <div>
                  <h2 class="font-display font-bold text-base text-slate-900 dark:text-white">
                    4. Status Kelulusan &amp; Tracer Study
                  </h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Status lanjutan studi, kampus, jurusan, atau karir pekerjaan.
                  </p>
                </div>
              </div>

              <!-- Kategori / Status Kelanjutan -->
              <div>
                <label for="edit-category" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Status / Kategori Utama
                </label>
                <select
                  id="edit-category"
                  v-model="form.category"
                  @change="onCategoryChange"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                >
                  <option value="Siswa Aktif">Siswa Aktif (Belum Lulus)</option>
                  <option value="PTN">Perguruan Tinggi Negeri (PTN)</option>
                  <option value="PTS">Perguruan Tinggi Swasta (PTS)</option>
                  <option value="Kedinasan">Sekolah Kedinasan</option>
                  <option value="TNI/Polri">TNI / POLRI</option>
                  <option value="Bekerja">Bekerja / Karyawan</option>
                  <option value="Wirausaha">Wirausaha / Bisnis Mandiri</option>
                  <option value="Pelatihan / LPK">Pelatihan / LPK / Magang Luar Negeri</option>
                  <option value="Masa Tunggu">Masa Tunggu / Persiapan Ujian Depan</option>
                  <option value="Belum Lapor Diri">Belum Lapor Diri</option>
                </select>
              </div>

              <!-- Jalur Masuk (Dinamis Sesuai Kategori) -->
              <div>
                <label for="edit-pathway" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Jalur Masuk / Sub-Kategori
                </label>
                <select
                  id="edit-pathway"
                  v-model="form.pathway"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                >
                  <option v-for="opt in currentPathwayOptions" :key="opt" :value="opt">
                    {{ opt }}
                  </option>
                </select>
              </div>

              <!-- Kampus / Instansi / Perusahaan -->
              <div>
                <label for="edit-institution" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Kampus / Instansi / Perusahaan
                </label>
                <CampusCombobox
                  v-if="form.category === 'PTN' || form.category === 'PTS'"
                  v-model="form.institution"
                  placeholder="Cari atau ketik nama kampus (contoh: Universitas Brawijaya)..."
                />
                <input
                  v-else
                  id="edit-institution"
                  v-model="form.institution"
                  type="text"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                  placeholder="Nama instansi / perusahaan / lembaga..."
                />
              </div>

              <!-- Program Studi / Jurusan / Posisi -->
              <div>
                <label for="edit-major" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Program Studi / Jurusan / Posisi Pekerjaan
                </label>
                <ProdiCombobox
                  id="edit-major"
                  v-model="form.major"
                  :campus="form.institution"
                  placeholder="Pilih atau cari Program Studi resmi..."
                />
              </div>

              <!-- Pesan / Motivasi / Tips -->
              <div>
                <label for="edit-message" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Pesan &amp; Motivasi Siswa / Alumni
                </label>
                <textarea
                  id="edit-message"
                  v-model="form.message"
                  rows="3"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                  placeholder="Catatan prestasi, pesan untuk adik kelas, atau motivasi..."
                ></textarea>
              </div>
            </div>

            <!-- KARTU 5: KEAMANAN & RESET KATA SANDI AKUN (KHUSUS ANGKATAN 2027 KE ATAS YANG MEMILIKI AKUN) -->
            <div v-if="hasUserAccount" class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-4">
              <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center text-sm">
                  <i class="fa-solid fa-key"></i>
                </div>
                <div>
                  <h2 class="font-display font-bold text-base text-slate-900 dark:text-white">
                    5. Reset Kata Sandi Akun Siswa
                  </h2>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Khusus Guru BK jika siswa lupa kata sandi login.
                  </p>
                </div>
              </div>

              <div>
                <label for="edit-new-pass" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Kata Sandi Baru (Opsional)
                </label>
                <div class="relative">
                  <input
                    id="edit-new-pass"
                    v-model="form.newPassword"
                    :type="showPassword ? 'text' : 'password'"
                    class="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-[#0284C7] focus:outline-none"
                    placeholder="Kosongkan jika tidak ingin mengubah kata sandi..."
                  />
                  <button
                    type="button"
                    @click="showPassword = !showPassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                    tabindex="-1"
                  >
                    <i :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
                  </button>
                </div>
                <p class="text-[11px] text-slate-400 mt-1">
                  Masukkan minimal 6 karakter jika ingin mereset password akun siswa ini.
                </p>
              </div>
            </div>

            <!-- TOMBOL SIMPAN UTAMA DI BAGIAN BAWAH -->
            <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="text-xs text-slate-500 dark:text-slate-400">
                Pastikan seluruh data telah diperiksa dengan benar sebelum menekan tombol simpan.
              </div>
              <div class="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  @click="closeCurrentTab"
                  class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
                >
                  Tutup Tab
                </button>
                <button
                  type="submit"
                  :disabled="isSaving"
                  class="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-bold text-sm transition-all duration-150 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <i v-if="isSaving" class="fa-solid fa-spinner fa-spin text-sm"></i>
                  <i v-else class="fa-solid fa-check text-sm"></i>
                  <span>{{ isSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </form>
    </main>

    <!-- Footer Standar -->
    <footer class="mt-auto border-t border-slate-200 dark:border-slate-800 py-6 bg-white/60 dark:bg-slate-900/60 text-center text-xs text-slate-500 dark:text-slate-400">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>&copy; {{ new Date().getFullYear() }} Bimbingan dan Konseling SMA Negeri 2 Ngawi. Hak cipta dilindungi.</p>
        <div class="flex items-center gap-4">
          <router-link to="/data" class="hover:text-[#0284C7] dark:hover:text-sky-400 transition-colors">Direktori Alumni</router-link>
          <router-link to="/import-export" class="hover:text-[#0284C7] dark:hover:text-sky-400 transition-colors">Kelola Data</router-link>
          <router-link to="/" class="hover:text-[#0284C7] dark:hover:text-sky-400 transition-colors">Portal Berita</router-link>
        </div>
      </div>
    </footer>
  </div>
</template>

