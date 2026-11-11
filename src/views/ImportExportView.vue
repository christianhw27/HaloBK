<script setup>
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import AdminOnlyGuard from '@/components/AdminOnlyGuard.vue'
import EditModal from '@/components/EditModal.vue'
import { CATEGORY_COLORS } from '@/lib/initialData'
import { compressImage } from '@/lib/imageHelper'
import { processAndUploadPhoto, isCloudinaryConfigured } from '@/lib/cloudinary'
import { getInstitutionLogo, findCampus } from '@/lib/campusList'
import CampusCombobox from '@/components/CampusCombobox.vue'
import * as XLSX from 'xlsx'

const authStore = useAuthStore()
const alumniStore = useAlumniStore()

// Tab aktif: 'input' | 'import' | 'export' | 'table'
const activeTab = ref('input')

// --- TAB 1: FORM TAMBAH MANUAL (CREATE) ---
const manualForm = reactive({
  name: '',
  nis: '',
  classRoom: 'XII-1',
  cohort: '2026',
  phone: '',
  category: 'PTN',
  pathway: 'SNBP',
  institution: '',
  major: '',
  message: '',
  photo: ''
})

const isAdding = ref(false)
const isUploadingManualPhoto = ref(false)
const manualPhotoError = ref('')
const manualSuccessMsg = ref('')
const manualErrorMsg = ref('')

async function handleManualPhotoUpload(e) {
  const file = e.target.files[0]
  if (!file) return

  manualPhotoError.value = ''

  if (isCloudinaryConfigured()) {
    isUploadingManualPhoto.value = true
    try {
      const url = await processAndUploadPhoto(file)
      manualForm.photo = url
    } catch (err) {
      manualPhotoError.value = err.message
      alert(err.message)
    } finally {
      isUploadingManualPhoto.value = false
    }
  } else {
    try {
      const compressed = await compressImage(file, 400, 0.75)
      manualForm.photo = compressed
      manualPhotoError.value = 'Perhatian: Kredensial Cloudinary belum diatur di .env (foto disimpan sementara di memori).'
    } catch (err) {
      manualPhotoError.value = err.message
      alert(err.message)
    }
  }
}

const pathwaysByCategory = {
  'PTN': ['SNBP', 'SNBT', 'Mandiri PTN', 'Beasiswa KIP-Kuliah', 'Jalur Prestasi'],
  'PTS': ['Jalur Prestasi Rapor', 'Beasiswa Yayasan', 'Mandiri PTS', 'Tes Masuk PTS'],
  'Kedinasan': ['Ikatan Dinas', 'Politeknik Kedinasan', 'Beasiswa Ikatan Kerja'],
  'TNI/Polri': ['Seleksi Akmil / Akpol', 'Bintara Polri', 'Bintara TNI AD/AL/AU', 'Tamtama'],
  'Bekerja': ['Rekrutmen Kerja Perusahaan', 'BUMN / BUMD', 'Freelance / Remote Work'],
  'Wirausaha': ['Wirausaha Mandiri', 'Bisnis Kuliner / UMKM', 'Digital Creator / Agensi'],
  'Pelatihan / LPK': ['Program Pelatihan / LPK', 'Magang Luar Negeri / Jepang', 'Balai Latihan Kerja (BLK)'],
  'Masa Tunggu': ['Persiapan UTBK / Kedinasan Tahun Depan (Gap Year)', 'Kursus / Les Intensif']
}

function onManualCategoryChange() {
  const options = pathwaysByCategory[manualForm.category] || ['Lainnya']
  manualForm.pathway = options[0]
}

async function handleManualSubmit() {
  if (!manualForm.name.trim() || !manualForm.institution.trim()) {
    manualErrorMsg.value = 'Nama lengkap dan nama instansi/kampus wajib diisi.'
    return
  }

  isAdding.value = true
  manualSuccessMsg.value = ''
  manualErrorMsg.value = ''

  const res = await alumniStore.addAlumni(manualForm)
  isAdding.value = false

  if (res.success) {
    manualSuccessMsg.value = `Alumni "${manualForm.name}" berhasil ditambahkan dan langsung dipublikasikan!`
    manualForm.name = ''
    manualForm.nis = ''
    manualForm.institution = ''
    manualForm.major = ''
    manualForm.phone = ''
    manualForm.message = ''
    manualForm.photo = ''
  } else {
    manualErrorMsg.value = res.message || 'Gagal menambahkan alumni.'
  }
}

// --- TAB 2: IMPORT EXCEL ---
const fileInput = ref(null)
const previewRows = ref([])
const fileName = ref('')
const importSuccessMsg = ref('')
const importWarningMsg = ref('')
const importCohort = ref('2025')
const isImporting = ref(false)

function updateImportCohort(newCohort) {
  importCohort.value = newCohort
  previewRows.value = previewRows.value.map(r => ({
    ...r,
    cohort: newCohort,
    message: 'Alumni Angkatan ' + (newCohort === '2025' ? '60' : (newCohort === '2026' ? '61' : newCohort)) + ' SMA Negeri 2 Ngawi.'
  }))
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return

  fileName.value = file.name
  importSuccessMsg.value = ''
  importWarningMsg.value = ''
  previewRows.value = []

  // Deteksi otomatis angkatan dari nama file
  if (file.name.includes('60') || file.name.includes('2025')) {
    importCohort.value = '2025'
  } else if (file.name.includes('61') || file.name.includes('2026')) {
    importCohort.value = '2026'
  }

  const reader = new FileReader()
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

      const parsedRows = []
      let currentHeaders = null

      for (let r = 0; r < rawRows.length; r++) {
        const row = rawRows[r]
        if (!row || !Array.isArray(row) || row.length === 0) continue

        // Deteksi apakah baris ini merupakan baris judul kolom (Header)
        const upperRow = row.map(cell => String(cell || '').trim().toUpperCase())
        const hasName = upperRow.some(c => c.includes('NAMA'))
        const hasNisOrClass = upperRow.some(c => c.includes('NIS') || c.includes('KELAS') || c.includes('LEMBAGA') || c.includes('INSTANSI'))

        if (hasName && (hasNisOrClass || upperRow.includes('NO') || upperRow.includes('NO.'))) {
          currentHeaders = upperRow
          continue
        }

        // Jika header sudah ditemukan, proses baris data siswa
        if (currentHeaders) {
          const idxNo = currentHeaders.findIndex(c => c === 'NO' || c === 'NO.')
          const idxName = currentHeaders.findIndex(c => c.includes('NAMA'))
          const idxNis = currentHeaders.findIndex(c => c === 'NIS' || c.includes('INDUK'))
          const idxClass = currentHeaders.findIndex(c => c.includes('KELAS') || c.includes('ROMBEL'))
          const idxCategory = currentHeaders.findIndex(c => c.includes('KARIR') || c.includes('KATEGORI'))
          const idxPathway = currentHeaders.findIndex(c => c.includes('JALUR'))
          const idxInst = currentHeaders.findIndex(c => c.includes('LEMBAGA') || c.includes('INSTANSI') || c.includes('KAMPUS') || c.includes('UNIVERSITAS'))
          const idxMajor = currentHeaders.findIndex(c => c.includes('JURUSAN') || c.includes('PRODI'))
          const idxPhone = currentHeaders.findIndex(c => c.includes('WA') || c.includes('HP') || c.includes('TELP'))

          const rawName = String(row[idxName] || '').trim()
          if (!rawName || rawName.toUpperCase().includes('NAMA') || rawName.toUpperCase().includes('TOTAL') || rawName.toUpperCase().includes('JUMLAH')) {
            continue
          }

          const rawNis = idxNis !== -1 ? String(row[idxNis] || '').trim() : ''
          let rawClass = idxClass !== -1 ? String(row[idxClass] || '').trim() : 'XII-1'
          if (rawClass && !rawClass.startsWith('XII') && rawClass.includes('-')) {
            rawClass = 'XII-' + rawClass.split('-')[1].trim()
          } else if (!rawClass || !rawClass.startsWith('XII')) {
            rawClass = 'XII-1'
          }

          let rawCategory = idxCategory !== -1 ? String(row[idxCategory] || '').trim() : ''
          let rawPathway = idxPathway !== -1 ? String(row[idxPathway] || '').trim() : ''
          let rawInst = idxInst !== -1 ? String(row[idxInst] || '').trim() : ''
          let rawMajor = idxMajor !== -1 ? String(row[idxMajor] || '').trim() : ''
          let rawPhone = idxPhone !== -1 ? String(row[idxPhone] || '').trim() : '-'

          // Cocokkan nama kampus resmi bila dikenali
          const matchedCampus = findCampus(rawInst)
          if (matchedCampus) {
            rawInst = matchedCampus.name
            if (!rawCategory) rawCategory = matchedCampus.category
          }

          // Normalisasi kategori 4-pilar
          const upperCat = rawCategory.toUpperCase()
          let finalCat = 'PTN'
          if (upperCat.includes('PTN')) finalCat = 'PTN'
          else if (upperCat.includes('PTS')) finalCat = 'PTS'
          else if (upperCat.includes('DINAS') || upperCat.includes('KEDINASAN')) finalCat = 'Kedinasan'
          else if (upperCat.includes('TNI') || upperCat.includes('POLRI') || upperCat.includes('POLISI')) finalCat = 'TNI/Polri'
          else if (upperCat.includes('KERJA') || upperCat.includes('BEKERJA')) finalCat = 'Bekerja'
          else if (upperCat.includes('WIRAUSAHA') || upperCat.includes('BISNIS') || upperCat.includes('USAHA')) finalCat = 'Wirausaha'
          else if (upperCat.includes('PELATIHAN') || upperCat.includes('LPK') || upperCat.includes('KURSUS')) finalCat = 'Pelatihan / LPK'
          else if (upperCat.includes('GAP') || upperCat.includes('TUNGGU') || !rawInst) finalCat = 'Masa Tunggu'

          if (!rawInst) {
            rawInst = finalCat === 'Masa Tunggu' ? 'Persiapan Ulang (Gap Year)' : '-'
          }
          if (!rawMajor) rawMajor = '-'
          if (!rawPathway) rawPathway = finalCat === 'PTN' ? 'SNBP' : 'Mandiri'

          parsedRows.push({
            name: rawName,
            nis: rawNis || '-',
            classRoom: rawClass,
            cohort: importCohort.value,
            phone: rawPhone || '-',
            category: finalCat,
            pathway: rawPathway,
            institution: rawInst,
            major: rawMajor,
            message: 'Alumni Angkatan ' + (importCohort.value === '2025' ? '60' : (importCohort.value === '2026' ? '61' : importCohort.value)) + ' SMA Negeri 2 Ngawi.'
          })
        }
      }

      if (parsedRows.length === 0) {
        importWarningMsg.value = `Berkas "${file.name}" terbaca, namun format baris/kolom tidak dikenali. Pastikan file memiliki baris judul NAMA, KELAS, LEMBAGA atau unduh Format Template resmi di samping.`
      } else {
        previewRows.value = parsedRows
      }
    } catch (err) {
      alert('Gagal membaca file Excel/CSV: ' + err.message)
    }
  }
  reader.readAsArrayBuffer(file)
}

async function commitImport() {
  if (previewRows.value.length === 0) return
  isImporting.value = true
  importSuccessMsg.value = ''
  importWarningMsg.value = ''

  const count = await alumniStore.importData(previewRows.value)
  isImporting.value = false

  if (count > 0) {
    importSuccessMsg.value = `Alhamdulillah! Berhasil menyimpan ${count} data lulusan angkatan ${importCohort.value} ke database Supabase!`
    previewRows.value = []
    fileName.value = ''
    if (fileInput.value) fileInput.value.value = ''
  } else {
    importWarningMsg.value = 'Gagal menyimpan data ke database. Periksa koneksi internet atau pengaturan Supabase Anda.'
  }
}

// --- TAB 3: EXPORT EXCEL ---
function downloadTemplate() {
  const templateData = [
    {
      'Nama Lengkap': 'Ahmad Fauzi',
      'NIS': '12345',
      'Kelas XII': 'XII-1',
      'Angkatan': 2026,
      'No. WhatsApp': '081234567890',
      'Kategori': 'PTN',
      'Jalur Masuk': 'SNBP',
      'Kampus / Instansi / Perusahaan': 'Universitas Indonesia (UI)',
      'Jurusan / Posisi Pekerjaan': 'S1 Ilmu Komputer',
      'Pesan & Tips Alumni': 'Perbanyak latihan soal dan minta restu orang tua.'
    },
    {
      'Nama Lengkap': 'Siti Nurhaliza',
      'NIS': '12346',
      'Kelas XII': 'XII-3',
      'Angkatan': 2026,
      'No. WhatsApp': '081234567891',
      'Kategori': 'Kedinasan',
      'Jalur Masuk': 'Ikatan Dinas',
      'Kampus / Instansi / Perusahaan': 'IPDN',
      'Jurusan / Posisi Pekerjaan': 'D4 Politik Pemerintahan',
      'Pesan & Tips Alumni': 'Jaga kebugaran fisik dan persiapan tes CAT sejak dini.'
    }
  ]

  const ws = XLSX.utils.json_to_sheet(templateData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template Import Alumni')
  XLSX.writeFile(wb, 'Template_Import_Alumni_SMADA.xlsx')
}

// --- TAB 4: TABEL MANAJEMEN CRUD (EDIT & DELETE) ---
const manageSearch = ref('')
const selectedEditAlumni = ref(null)
const isEditModalOpen = ref(false)

const filteredManageList = computed(() => {
  if (!manageSearch.value.trim()) return alumniStore.alumniList
  const q = manageSearch.value.toLowerCase().trim()
  return alumniStore.alumniList.filter(a =>
    a.name.toLowerCase().includes(q) ||
    (a.nis && a.nis.toLowerCase().includes(q)) ||
    a.institution.toLowerCase().includes(q) ||
    a.major.toLowerCase().includes(q) ||
    a.cohort.includes(q)
  )
})

function openEdit(alumni) {
  selectedEditAlumni.value = alumni
  isEditModalOpen.value = true
}

async function handleDelete(alumni) {
  if (confirm(`Apakah Anda yakin ingin menghapus data alumni "${alumni.name}" secara permanen dari database?`)) {
    const res = await alumniStore.deleteAlumni(alumni.id)
    if (!res.success) {
      alert('Gagal menghapus data: ' + res.message)
    }
  }
}
</script>

<template>
  <div class="space-y-6 w-full">
    <AdminOnlyGuard
      v-if="authStore.userRole !== 'admin'"
      title="Kelola Data & Excel Khusus Guru BK"
      description="Anda sedang menggunakan mode akses Alumni. Pengelolaan database, tambah data manual, import, maupun export Excel hanya tersedia untuk Guru BK."
    />

    <template v-else>
    <!-- Header Halaman Pusat Kelola Data -->
    <section class="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#D1FAE5]/60 via-white to-[#E0F2FE]/70 dark:from-emerald-950/25 dark:via-slate-900 dark:to-sky-950/25 border border-emerald-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" aria-labelledby="manage-heading">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D1FAE5] text-[#047857] border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800 text-xs font-bold mb-2">
          <i class="fa-solid fa-file-excel text-[11px]" aria-hidden="true"></i>
          <span>Kelola Database &amp; Spreadsheet</span>
        </div>
        <h1 id="manage-heading" class="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
          Kelola Data &amp; Excel Alumni
        </h1>
        <p class="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
          Tambah alumni manual, unggah file Excel/CSV secara massal, atau rapikan data yang sudah masuk
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto text-sm">
        <span class="px-4 py-2 rounded-2xl bg-white/90 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[#0369A1] dark:text-sky-300 font-bold shadow-xs">
          Total Terdata: {{ alumniStore.statistics.total }}
        </span>
      </div>
    </section>

    <!-- Navigasi Tab Pengelolaan -->
    <div class="flex flex-wrap items-center gap-2 p-2 bg-sky-50/70 dark:bg-slate-800/80 rounded-2xl border border-sky-200/70 dark:border-slate-700/80 text-sm font-semibold" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'input'"
        @click="activeTab = 'input'"
        class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
        :class="activeTab === 'input'
          ? 'bg-[#0369A1] text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white'"
      >
        <i class="fa-solid fa-user-plus text-sm" aria-hidden="true"></i>
        <span>1. Input Data Manual (Tambah Baru)</span>
      </button>

      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'import'"
        @click="activeTab = 'import'"
        class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
        :class="activeTab === 'import'
          ? 'bg-[#F59E0B] text-slate-950 shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white'"
      >
        <i class="fa-solid fa-cloud-arrow-up text-sm" aria-hidden="true"></i>
        <span>2. Import File Excel / CSV</span>
      </button>

      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'export'"
        @click="activeTab = 'export'"
        class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
        :class="activeTab === 'export'
          ? 'bg-[#047857] text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white'"
      >
        <i class="fa-solid fa-file-excel text-sm" aria-hidden="true"></i>
        <span>3. Export &amp; Backup Data</span>
      </button>

      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'table'"
        @click="activeTab = 'table'"
        class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
        :class="activeTab === 'table'
          ? 'bg-[#BE123C] text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white'"
      >
        <i class="fa-solid fa-list-check text-sm" aria-hidden="true"></i>
        <span>4. Kelola Data (Edit &amp; Hapus)</span>
      </button>
    </div>

    <!-- ========================================== -->
    <!-- TAB 1: FORM TAMBAH DATA MANUAL (CREATE) -->
    <!-- ========================================== -->
    <section v-if="activeTab === 'input'" class="p-6 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-5">
      <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
        <h2 class="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
          Formulir Penambahan Alumni Manual
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Data yang ditambahkan oleh Guru BK di sini akan langsung tersimpan dan berstatus terverifikasi di database.
        </p>
      </div>

      <!-- Alert Sukses / Error -->
      <div v-if="manualSuccessMsg" class="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm font-semibold flex items-center gap-2">
        <i class="fa-solid fa-circle-check text-emerald-600" aria-hidden="true"></i>
        <span>{{ manualSuccessMsg }}</span>
      </div>

      <div v-if="manualErrorMsg" class="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm font-semibold flex items-center gap-2">
        <i class="fa-solid fa-circle-exclamation text-rose-600" aria-hidden="true"></i>
        <span>{{ manualErrorMsg }}</span>
      </div>

      <form @submit.prevent="handleManualSubmit" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Lengkap Alumni <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="manualForm.name"
              type="text"
              required
              placeholder="Contoh: Muhammad Ilham Pratama"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              NIS (Nomor Induk Siswa)
            </label>
            <input
              v-model="manualForm.nis"
              type="text"
              placeholder="Contoh: 12345"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kelas Terakhir
            </label>
            <select
              v-model="manualForm.classRoom"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            >
              <option v-for="i in 10" :key="i" :value="`XII-${i}`">XII-{{ i }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tahun Angkatan Lulus <span class="text-rose-500">*</span>
            </label>
            <select
              v-model="manualForm.cohort"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
              <option value="2020">2020</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kategori Karir / Pendidikan <span class="text-rose-500">*</span>
            </label>
            <select
              v-model="manualForm.category"
              @change="onManualCategoryChange"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            >
              <option value="PTN">PTN (Perguruan Tinggi Negeri)</option>
              <option value="PTS">PTS (Perguruan Tinggi Swasta)</option>
              <option value="Kedinasan">Sekolah Kedinasan</option>
              <option value="TNI/Polri">TNI / Polri</option>
              <option value="Bekerja">Dunia Kerja / Karyawan</option>
              <option value="Wirausaha">Wirausaha / UMKM / Bisnis</option>
              <option value="Pelatihan / LPK">Pelatihan / LPK / Luar Negeri</option>
              <option value="Masa Tunggu">Masa Tunggu / Persiapan Ulang</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jalur Masuk / Seleksi <span class="text-rose-500">*</span>
            </label>
            <select
              v-model="manualForm.pathway"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            >
              <option v-for="p in pathwaysByCategory[manualForm.category]" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>

          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Kampus / Perusahaan / Instansi <span class="text-rose-500">*</span>
            </label>
            <CampusCombobox
              id="manual-institution"
              v-model="manualForm.institution"
              placeholder="Cari atau ketik nama kampus (contoh: UNESA, UGM, ITS)..."
              required
              @select="(campus) => {
                if (['PTN', 'PTS', 'Kedinasan', 'TNI/Polri'].includes(campus.category)) {
                  manualForm.category = campus.category
                  onManualCategoryChange()
                }
              }"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jurusan / Program Studi / Posisi
            </label>
            <input
              v-model="manualForm.major"
              type="text"
              placeholder="Contoh: S1 Teknik Sipil"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nomor WhatsApp Alumni (Opsional)
            </label>
            <input
              v-model="manualForm.phone"
              type="tel"
              placeholder="081234567890"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Pesan & Motivasi untuk Adik Kelas
            </label>
            <textarea
              v-model="manualForm.message"
              rows="2"
              placeholder="Tuliskan pesan motivasi atau tips lolos seleksi..."
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            ></textarea>
          </div>

          <!-- Foto Profil / Almamater (Opsional) -->
          <div class="sm:col-span-3">
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Foto Profil / Almamater (Opsional)
              </label>
              <span class="text-xs text-slate-500 dark:text-slate-400">
                Cloudinary Storage
              </span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-3">
              <!-- Pratinjau Foto -->
              <div
                v-if="manualForm.photo"
                class="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800"
              >
                <img :src="manualForm.photo" alt="Pratinjau Foto" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="manualForm.photo = ''"
                  class="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] hover:bg-rose-700 transition-colors"
                  title="Hapus foto"
                >
                  <i class="fa-solid fa-xmark"></i>
                </button>
                <div v-if="manualForm.photo.includes('cloudinary.com')" class="absolute bottom-0 inset-x-0 bg-[#0369A1]/90 text-white text-[8px] text-center py-0.5 font-medium tracking-tight">
                  Cloudinary
                </div>
              </div>

              <!-- Indikator Loading Upload -->
              <div
                v-else-if="isUploadingManualPhoto"
                class="w-14 h-14 rounded-lg border border-dashed border-[#0284C7] bg-[#E0F2FE] dark:bg-sky-950/40 shrink-0 flex flex-col items-center justify-center text-[#0369A1] dark:text-sky-400"
              >
                <i class="fa-solid fa-spinner fa-spin text-sm" aria-hidden="true"></i>
                <span class="text-[9px] font-semibold mt-1">Unggah...</span>
              </div>

              <div class="flex-1">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  :disabled="isUploadingManualPhoto"
                  @change="handleManualPhotoUpload"
                  class="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-700 cursor-pointer disabled:opacity-50"
                />
                <p v-if="!manualPhotoError" class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Format gambar .jpg, .png, .webp (Otomatis dioptimasi dan disimpan ke Cloudinary CDN).
                </p>
                <p v-else class="text-xs sm:text-sm text-amber-600 dark:text-amber-400 mt-1 font-medium">
                  {{ manualPhotoError }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="submit"
            :disabled="isAdding || isUploadingManualPhoto"
            class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-sm sm:text-base shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <i v-if="isAdding || isUploadingManualPhoto" class="fa-solid fa-spinner fa-spin text-sm" aria-hidden="true"></i>
            <i v-else class="fa-solid fa-plus text-sm" aria-hidden="true"></i>
            <span>{{ isUploadingManualPhoto ? 'Mengunggah Foto...' : (isAdding ? 'Menyimpan...' : 'Tambahkan Alumni ke Database') }}</span>
          </button>
        </div>
      </form>
    </section>

    <!-- ========================================== -->
    <!-- TAB 2: IMPORT FILE EXCEL                   -->
    <!-- ========================================== -->
    <section v-else-if="activeTab === 'import'" class="p-6 sm:p-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h2 class="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
            Unggah Berkas Spreadsheet (.xlsx / .xls / .csv)
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Impor puluhan atau ratusan data lulusan secara massal dari rekapan Excel
          </p>
        </div>

        <button
          @click="downloadTemplate"
          type="button"
          class="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <i class="fa-solid fa-download text-sm text-slate-400" aria-hidden="true"></i>
          <span>Unduh Format Template Excel</span>
        </button>
      </div>

      <div v-if="importSuccessMsg" class="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm font-semibold flex items-center gap-2">
        <i class="fa-solid fa-circle-check text-emerald-600 text-base" aria-hidden="true"></i>
        <span>{{ importSuccessMsg }}</span>
      </div>

      <div v-if="importWarningMsg" class="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm font-semibold flex items-center gap-2">
        <i class="fa-solid fa-triangle-exclamation text-amber-600 text-base" aria-hidden="true"></i>
        <span>{{ importWarningMsg }}</span>
      </div>

      <!-- Area Dropzone -->
      <div class="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center hover:border-[#0284C7] dark:hover:border-sky-500 transition-colors cursor-pointer relative bg-slate-50/60 dark:bg-slate-800/30">
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx, .xls, .csv"
          @change="handleFileSelect"
          class="absolute inset-0 opacity-0 cursor-pointer"
          aria-label="Pilih file spreadsheet"
        />

        <div class="space-y-2 pointer-events-none">
          <div class="w-11 h-11 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto text-lg">
            <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
          </div>
          <div>
            <span class="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-200">
              {{ fileName ? fileName : 'Klik atau seret file spreadsheet (.xlsx / .csv) ke area ini' }}
            </span>
            <p class="text-xs sm:text-sm text-slate-400 mt-0.5">Mendukung format file Microsoft Excel dan CSV</p>
          </div>
        </div>
      </div>

      <!-- Tabel Pratinjau -->
      <div v-if="previewRows.length > 0" class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
              Pratinjau Berkas ({{ previewRows.length }} Baris Terbaca)
            </h3>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Periksa data di bawah sebelum disimpan ke database
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <div class="flex items-center gap-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <label for="import-cohort-select" class="font-semibold text-slate-700 dark:text-slate-300">Target Angkatan:</label>
              <select
                id="import-cohort-select"
                :value="importCohort"
                @change="updateImportCohort($event.target.value)"
                class="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-[#0369A1] dark:text-sky-300 text-xs sm:text-sm"
              >
                <option value="2025">2025 (Smada 60)</option>
                <option value="2026">2026 (Smada 61)</option>
                <option value="2024">2024 (Smada 59)</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
              </select>
            </div>

            <button
              @click="commitImport"
              :disabled="isImporting"
              type="button"
              class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-bold text-sm sm:text-base shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              <i v-if="isImporting" class="fa-solid fa-spinner fa-spin text-sm" aria-hidden="true"></i>
              <i v-else class="fa-solid fa-cloud-arrow-up text-sm" aria-hidden="true"></i>
              <span>{{ isImporting ? 'Sedang Menyimpan...' : `Simpan Masal ${previewRows.length} Data ke Supabase` }}</span>
            </button>
          </div>
        </div>

        <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs sm:text-sm border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th class="p-3">Nama</th>
                <th class="p-3">NIS</th>
                <th class="p-3">Kelas</th>
                <th class="p-3">Angkatan</th>
                <th class="p-3">Kategori</th>
                <th class="p-3">Instansi</th>
                <th class="p-3">Jurusan / Posisi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="(row, idx) in previewRows.slice(0, 10)" :key="idx" class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td class="p-3 font-semibold text-slate-900 dark:text-white">{{ row.name }}</td>
                <td class="p-3 text-slate-600 dark:text-slate-300">{{ row.nis || '-' }}</td>
                <td class="p-3 text-slate-600 dark:text-slate-300">{{ row.classRoom }}</td>
                <td class="p-3 text-slate-600 dark:text-slate-300">{{ row.cohort }}</td>
                <td class="p-3 text-slate-700 dark:text-slate-200">{{ row.category }}</td>
                <td class="p-3 text-slate-800 dark:text-slate-200">
                  <div class="flex items-center gap-1.5">
                    <img
                      v-if="getInstitutionLogo(row.institution)"
                      :src="getInstitutionLogo(row.institution)"
                      :alt="row.institution"
                      class="w-4 h-4 rounded object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
                      loading="lazy"
                    />
                    <i v-else class="fa-solid fa-building-columns text-slate-400 text-sm shrink-0" aria-hidden="true"></i>
                    <span>{{ row.institution }}</span>
                  </div>
                </td>
                <td class="p-3 text-slate-500">{{ row.major }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="previewRows.length > 10" class="p-2.5 text-center text-xs sm:text-sm text-slate-500 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
            Menampilkan 10 dari total {{ previewRows.length }} baris data.
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- TAB 3: EXPORT & BACKUP DATA                -->
    <!-- ========================================== -->
    <section v-else-if="activeTab === 'export'" class="p-6 sm:p-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
        <h2 class="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
          Export & Cadangan Database Alumni
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Unduh seluruh arsip data lulusan ke dalam format Microsoft Excel (.xlsx) untuk laporan dinas atau arsip sekolah
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Kartu Export Semua Data -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-4 flex flex-col justify-between">
          <div>
            <div class="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-lg mb-2.5">
              <i class="fa-solid fa-file-excel" aria-hidden="true"></i>
            </div>
            <h3 class="font-semibold text-base text-slate-900 dark:text-white">
              Export Seluruh Database Terverifikasi
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Menghasilkan berkas Excel lengkap berisi {{ alumniStore.alumniList.length }} data alumni aktif beserta rincian kontak, kelas, jalur masuk, dan instansi.
            </p>
          </div>

          <button
            @click="alumniStore.exportExcel"
            type="button"
            class="w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <i class="fa-solid fa-download text-sm" aria-hidden="true"></i>
            <span>Unduh Data Excel (.xlsx)</span>
          </button>
        </div>

        <!-- Kartu Unduh Format Template -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-4 flex flex-col justify-between">
          <div>
            <div class="w-10 h-10 rounded-lg bg-[#E0F2FE] dark:bg-sky-950/70 text-[#0369A1] dark:text-sky-300 flex items-center justify-center text-lg mb-2.5">
              <i class="fa-solid fa-table" aria-hidden="true"></i>
            </div>
            <h3 class="font-semibold text-base text-slate-900 dark:text-white">
              Unduh Format Template Kosong
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Gunakan berkas template standar ini untuk membagikan form input ke wali kelas atau alumni sebelum diimpor ke sistem.
            </p>
          </div>

          <button
            @click="downloadTemplate"
            type="button"
            class="w-full py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <i class="fa-solid fa-file-arrow-down text-sm text-slate-500" aria-hidden="true"></i>
            <span>Unduh Template (.xlsx)</span>
          </button>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- TAB 4: TABEL MANAJEMEN CRUD (EDIT & HAPUS) -->
    <!-- ========================================== -->
    <section v-else-if="activeTab === 'table'" class="p-6 sm:p-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h2 class="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
            Kelola, Perbarui & Hapus Data Alumni
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Perbaiki kesalahan data nama/jurusan alumni atau hapus data duplikat secara langsung di Supabase
          </p>
        </div>

        <!-- Kolom Pencarian Cepat -->
        <div class="w-full sm:w-72">
          <input
            v-model="manageSearch"
            type="text"
            placeholder="Cari nama atau instansi..."
            class="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <!-- Tabel Data Lengkap -->
      <div v-if="filteredManageList.length > 0" class="overflow-x-auto rounded-2xl border border-sky-200/70 dark:border-slate-800">
        <table class="w-full text-left text-sm">
          <thead class="bg-sky-50/70 dark:bg-slate-800 text-[#0369A1] dark:text-sky-200 font-semibold text-xs sm:text-sm border-b border-sky-100 dark:border-slate-700">
            <tr>
              <th class="p-3.5">Nama Alumni</th>
              <th class="p-3.5">Kelas / Angkatan</th>
              <th class="p-3.5">Kategori</th>
              <th class="p-3.5">Instansi / Kampus</th>
              <th class="p-3.5">Jurusan / Posisi</th>
              <th class="p-3.5 text-right">Aksi Kelola</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="alumni in filteredManageList"
              :key="alumni.id"
              class="hover:bg-sky-50/40 dark:hover:bg-slate-800/40 transition-colors"
            >
              <td class="p-3.5 font-semibold text-slate-900 dark:text-white">
                <div>{{ alumni.name }}</div>
                <div v-if="alumni.nis && alumni.nis !== '-'" class="text-xs font-normal text-slate-500 dark:text-slate-400">
                  NIS: {{ alumni.nis }}
                </div>
              </td>
              <td class="p-3.5 text-slate-600 dark:text-slate-300">
                {{ alumni.classRoom }} ({{ alumni.cohort }})
              </td>
              <td class="p-3.5">
                <span
                  class="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  :class="CATEGORY_COLORS[alumni.category]?.badge || 'bg-slate-100 text-slate-700'"
                >
                  {{ alumni.category }}
                </span>
              </td>
              <td class="p-3.5 text-slate-800 dark:text-slate-200 font-medium">
                <div class="flex items-center gap-2">
                  <img
                    v-if="getInstitutionLogo(alumni.institution)"
                    :src="getInstitutionLogo(alumni.institution)"
                    :alt="alumni.institution"
                    class="w-4 h-4 rounded object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
                    loading="lazy"
                  />
                  <i v-else class="fa-solid fa-building-columns text-slate-400 text-sm shrink-0" aria-hidden="true"></i>
                  <span>{{ alumni.institution }}</span>
                </div>
              </td>
              <td class="p-3.5 text-slate-600 dark:text-slate-300">
                {{ alumni.major }}
              </td>
              <td class="p-3.5 text-right whitespace-nowrap">
                <button
                  @click="openEdit(alumni)"
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-[#0369A1] dark:text-sky-200 border border-sky-200 dark:border-sky-800 text-sm font-semibold transition-colors mr-1.5"
                >
                  <i class="fa-solid fa-pen-to-square mr-1 text-xs" aria-hidden="true"></i>
                  Edit
                </button>
                <button
                  @click="handleDelete(alumni)"
                  type="button"
                  class="px-3 py-1.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-sm font-semibold transition-colors"
                >
                  <i class="fa-solid fa-trash mr-1 text-xs" aria-hidden="true"></i>
                  Hapus
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="py-10 text-center text-sm text-slate-400">
        Belum ada data alumni yang cocok untuk dikelola.
      </div>
    </section>

    <!-- Modal Edit Alumni -->
    <EditModal
      :is-open="isEditModalOpen"
      :alumni="selectedEditAlumni"
      @close="isEditModalOpen = false"
    />
    </template>

  </div>
</template>
