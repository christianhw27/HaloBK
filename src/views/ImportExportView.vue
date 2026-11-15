<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import AdminOnlyGuard from '@/components/AdminOnlyGuard.vue'
import EditModal from '@/components/EditModal.vue'
import DetailModal from '@/components/DetailModal.vue'
import { CATEGORY_COLORS } from '@/lib/initialData'
import { compressImage } from '@/lib/imageHelper'
import { processAndUploadPhoto, isCloudinaryConfigured } from '@/lib/cloudinary'
import { getInstitutionLogo, findCampus } from '@/lib/campusList'
import CampusCombobox from '@/components/CampusCombobox.vue'
import ProdiCombobox from '@/components/ProdiCombobox.vue'
import * as XLSX from 'xlsx'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const alumniStore = useAlumniStore()

// Tab aktif: 'table' (1. Kelola Data) | 'users' (2. Kelola Akun) | 'input' (3. Input Manual) | 'import' (4. Import Excel) | 'export' (5. Export)
const validTabs = ['table', 'users', 'input', 'import', 'export']
const initialTab = (route.query.tab && validTabs.includes(route.query.tab)) ? route.query.tab : 'table'
const activeTab = ref(initialTab)

function setTab(tab) {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab } })
}

watch(() => route.query.tab, (newTab) => {
  if (newTab && validTabs.includes(newTab) && newTab !== activeTab.value) {
    activeTab.value = newTab
  }
})

onMounted(async () => {
  if (authStore.userRole === 'admin') {
    authStore.fetchAllUsers()
  }
})

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
  'Belum Lapor Diri': ['Belum Menentukan Pilihan', 'Persiapan UTBK / Kedinasan Tahun Depan (Gap Year)', 'Kursus / Les Intensif'],
  'Masa Tunggu': ['Belum Menentukan Pilihan', 'Persiapan UTBK / Kedinasan Tahun Depan (Gap Year)', 'Kursus / Les Intensif']
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

          // Deteksi otomatis jika kolom Lembaga dan Jurusan tertukar pada rekap kelas
          const looksLikeMajor = /^(S1|S2|D3|D4|TEKNIK|ILMU|PENDIDIKAN|DESAIN|KEDOKTERAN|FARMASI|HUKUM|MANAJEMEN|AKUNTANSI)\b/i.test(rawInst)
          const campusFromMajor = findCampus(rawMajor)
          if (looksLikeMajor && (campusFromMajor || (rawMajor && rawMajor.length <= 8))) {
            const temp = rawInst
            rawInst = rawMajor
            rawMajor = temp
          }

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
          else if (upperCat.includes('GAP') || upperCat.includes('TUNGGU') || upperCat.includes('BELUM') || !rawInst) finalCat = 'Belum Lapor Diri'

          if (!rawInst) {
            rawInst = (finalCat === 'Belum Lapor Diri' || finalCat === 'Masa Tunggu') ? 'Belum Menentukan Kampus' : '-'
          }
          if (!rawMajor) rawMajor = '-'
          if (!rawPathway) rawPathway = (finalCat === 'Belum Lapor Diri' || finalCat === 'Masa Tunggu') ? '-' : (finalCat === 'PTN' ? 'SNBP' : 'Mandiri')

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
const selectedDetailAlumni = ref(null)
const isDetailModalOpen = ref(false)

function openDetail(alumni) {
  selectedDetailAlumni.value = alumni
  isDetailModalOpen.value = true
}

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

// Pagination untuk Kelola Data (Halaman)
const manageCurrentPage = ref(1)
const manageItemsPerPage = 12

const manageTotalPages = computed(() => {
  return Math.ceil(filteredManageList.value.length / manageItemsPerPage) || 1
})

const paginatedManageList = computed(() => {
  const start = (manageCurrentPage.value - 1) * manageItemsPerPage
  return filteredManageList.value.slice(start, start + manageItemsPerPage)
})

watch(manageSearch, () => {
  manageCurrentPage.value = 1
})

function openEdit(alumni) {
  if (!alumni?.id) return
  const routeData = router.resolve({ name: 'edit-siswa', params: { id: alumni.id } })
  window.open(routeData.href, '_blank')
}

async function handleDelete(alumni) {
  if (confirm(`Apakah Anda yakin ingin menghapus data alumni "${alumni.name}" secara permanen dari database?`)) {
    const res = await alumniStore.deleteAlumni(alumni.id)
    if (!res.success) {
      alert('Gagal menghapus data: ' + res.message)
    }
  }
}

// ==========================================
// --- TAB 2: KELOLA AKUN PENGGUNA & SISWA ---
// ==========================================
const userSearch = ref('')
const userRoleFilter = ref('all') // 'all' | 'siswa' | 'admin' | 'user'
const userClassFilter = ref('all')
const userCurrentPage = ref(1)
const userItemsPerPage = 12

// Ambil daftar kelas unik dari seluruh pengguna
const availableClasses = computed(() => {
  const classes = (authStore.allUsers || [])
    .map(u => u.kelas)
    .filter(Boolean)
  return [...new Set(classes)].sort((a, b) => {
    // Urutkan kelas rombel angka secara natural jika memungkinkan
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
})

// Filter data pengguna
const filteredUsersList = computed(() => {
  let list = authStore.allUsers || []

  if (userRoleFilter.value !== 'all') {
    list = list.filter(u => u.role === userRoleFilter.value)
  }

  if (userClassFilter.value !== 'all') {
    list = list.filter(u => u.kelas === userClassFilter.value)
  }

  if (userSearch.value.trim()) {
    const q = userSearch.value.toLowerCase().trim()
    list = list.filter(u =>
      (u.nama && u.nama.toLowerCase().includes(q)) ||
      (u.nis && String(u.nis).toLowerCase().includes(q)) ||
      (u.nisn && String(u.nisn).toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.kelas && u.kelas.toLowerCase().includes(q))
    )
  }

  return list
})

const userTotalPages = computed(() => {
  return Math.ceil(filteredUsersList.value.length / userItemsPerPage) || 1
})

const paginatedUsersList = computed(() => {
  const start = (userCurrentPage.value - 1) * userItemsPerPage
  return filteredUsersList.value.slice(start, start + userItemsPerPage)
})

watch([userSearch, userRoleFilter, userClassFilter], () => {
  userCurrentPage.value = 1
})

const userStats = computed(() => {
  const all = authStore.allUsers || []
  return {
    total: all.length,
    siswa: all.filter(u => u.role === 'siswa').length,
    admin: all.filter(u => u.role === 'admin').length,
    umum: all.filter(u => u.role !== 'siswa' && u.role !== 'admin').length
  }
})

// --- MODAL EDIT AKUN PENGGUNA ---
const isEditUserModalOpen = ref(false)
const isSavingUser = ref(false)
const showEditModalPassword = ref(false)
const editUserFeedback = ref({ type: '', text: '' })

const editUserForm = reactive({
  id: '',
  nama: '',
  nis: '',
  nisn: '',
  email: '',
  kelas: '',
  role: 'siswa',
  password: '',
  angkatan: 61,
  tahun_lulus: 2027
})

function openEditUser(user) {
  editUserForm.id = user.id
  editUserForm.nama = user.nama || ''
  editUserForm.nis = user.nis || ''
  editUserForm.nisn = user.nisn || ''
  editUserForm.email = user.email || ''
  editUserForm.kelas = user.kelas || ''
  editUserForm.role = user.role || 'siswa'
  editUserForm.password = '' // Keamanan: Kosongkan secara default
  editUserForm.angkatan = user.angkatan || 61
  editUserForm.tahun_lulus = user.tahun_lulus || 2027
  showEditModalPassword.value = false
  editUserFeedback.value = { type: '', text: '' }
  isEditUserModalOpen.value = true
}

function closeEditUserModal() {
  isEditUserModalOpen.value = false
  editUserFeedback.value = { type: '', text: '' }
}

async function handleSaveUser() {
  if (!editUserForm.nama.trim()) {
    editUserFeedback.value = { type: 'error', text: 'Nama lengkap pengguna tidak boleh kosong.' }
    return
  }

  if (editUserForm.password.trim() && editUserForm.password.trim().length < 6) {
    editUserFeedback.value = { type: 'error', text: 'Kata sandi baru minimal 6 karakter.' }
    return
  }

  isSavingUser.value = true
  editUserFeedback.value = { type: '', text: '' }

  const res = await authStore.adminUpdateUser(editUserForm.id, {
    nama: editUserForm.nama.trim(),
    nis: editUserForm.nis.trim() || null,
    nisn: editUserForm.nisn.trim() || null,
    email: editUserForm.email.trim() || null,
    kelas: editUserForm.kelas.trim() || null,
    role: editUserForm.role,
    password: editUserForm.password.trim() || null,
    angkatan: Number(editUserForm.angkatan) || 61,
    tahun_lulus: Number(editUserForm.tahun_lulus) || 2027
  })

  isSavingUser.value = false
  if (res.success) {
    editUserFeedback.value = { type: 'success', text: 'Perubahan kredensial akun berhasil disimpan secara aman ke database!' }
    setTimeout(() => {
      closeEditUserModal()
    }, 800)
  } else {
    editUserFeedback.value = { type: 'error', text: 'Gagal memperbarui akun: ' + res.message }
  }
}

async function handleQuickResetPassword(user) {
  if (confirm(`Reset kata sandi akun "${user.nama}" menjadi default: "smadahebat"?`)) {
    const res = await authStore.adminResetPassword(user.id, 'smadahebat')
    if (res.success) {
      alert(`Kata sandi akun ${user.nama} berhasil direset ke: smadahebat`)
    } else {
      alert('Gagal mereset kata sandi: ' + res.message)
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

      <div class="flex items-center gap-2 self-start sm:self-auto text-sm flex-wrap">
        <span class="px-4 py-2 rounded-2xl bg-white/90 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[#0369A1] dark:text-sky-300 font-bold shadow-xs">
          Total Alumni: {{ alumniStore.statistics.total }}
        </span>
        <span class="px-4 py-2 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[#4F46E5] dark:text-indigo-300 font-bold shadow-xs">
          Total Akun: {{ authStore.allUsers.length || 399 }}
        </span>
      </div>
    </section>

    <!-- Navigasi Tab Pengelolaan -->
    <div class="flex overflow-x-auto no-scrollbar items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-sky-50/70 dark:bg-slate-800/80 rounded-2xl border border-sky-200/70 dark:border-slate-700/80 text-xs sm:text-sm font-semibold" role="tablist">
      
      <!-- 1. Kelola Data (Edit & Hapus Alumni) -->
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'table'"
        @click="setTab('table')"
        class="shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all flex items-center gap-1.5 sm:gap-2"
        :class="activeTab === 'table'
          ? 'bg-[#BE123C] text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white'"
      >
        <i class="fa-solid fa-list-check text-xs sm:text-sm" aria-hidden="true"></i>
        <span>1. Kelola Data (Edit &amp; Hapus)</span>
      </button>

      <!-- 2. Kelola Akun Pengguna & Siswa -->
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'users'"
        @click="setTab('users')"
        class="shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all flex items-center gap-1.5 sm:gap-2"
        :class="activeTab === 'users'
          ? 'bg-[#4F46E5] text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white'"
      >
        <i class="fa-solid fa-users-gear text-xs sm:text-sm" aria-hidden="true"></i>
        <span>2. Kelola Akun Pengguna</span>
      </button>

      <!-- 3. Input Manual -->
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'input'"
        @click="setTab('input')"
        class="shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all flex items-center gap-1.5 sm:gap-2"
        :class="activeTab === 'input'
          ? 'bg-[#0369A1] text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white'"
      >
        <i class="fa-solid fa-user-plus text-xs sm:text-sm" aria-hidden="true"></i>
        <span>3. Input Manual</span>
      </button>

      <!-- 4. Import Excel -->
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'import'"
        @click="setTab('import')"
        class="shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all flex items-center gap-1.5 sm:gap-2"
        :class="activeTab === 'import'
          ? 'bg-[#F59E0B] text-slate-950 shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white'"
      >
        <i class="fa-solid fa-cloud-arrow-up text-xs sm:text-sm" aria-hidden="true"></i>
        <span>4. Import Excel</span>
      </button>

      <!-- 5. Export & Backup -->
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'export'"
        @click="setTab('export')"
        class="shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all flex items-center gap-1.5 sm:gap-2"
        :class="activeTab === 'export'
          ? 'bg-[#047857] text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white'"
      >
        <i class="fa-solid fa-file-excel text-xs sm:text-sm" aria-hidden="true"></i>
        <span>5. Export &amp; Backup</span>
      </button>
    </div>

    <!-- ======================================================= -->
    <!-- TAB 1: TABEL MANAJEMEN ALUMNI (KELOLA, EDIT & HAPUS)   -->
    <!-- ======================================================= -->
    <section v-if="activeTab === 'table'" class="p-3.5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-3.5 sm:space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-[#BE123C] border border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800 text-xs font-bold mb-1">
            <i class="fa-solid fa-list-check text-[10px]" aria-hidden="true"></i>
            <span>Data Tracer Study Terverifikasi</span>
          </div>
          <h2 class="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
            Kelola, Perbarui &amp; Hapus Data Alumni
          </h2>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Perbaiki data atau hapus data secara langsung di Supabase ({{ filteredManageList.length }} data)
          </p>
        </div>

        <!-- Kolom Pencarian Cepat -->
        <div class="relative w-full sm:w-72">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm pointer-events-none"></i>
          <input
            v-model="manageSearch"
            type="text"
            placeholder="Cari nama atau instansi..."
            class="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0284C7] focus:outline-none transition-colors"
          />
          <button
            v-if="manageSearch"
            type="button"
            @click="manageSearch = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Hapus pencarian"
          >
            <i class="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <!-- KONTEN DAFTAR DATA ALUMNI -->
      <div v-if="filteredManageList.length > 0">
        
        <!-- 1. TAMPILAN MOBILE: KARTU KOMPAK & NYAMAN (MD:HIDDEN) -->
        <div class="md:hidden space-y-2.5">
          <div
            v-for="alumni in paginatedManageList"
            :key="alumni.id"
            class="p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-sky-100/90 dark:border-slate-800 shadow-2xs space-y-2.5 hover:border-sky-300 dark:hover:border-slate-700 transition-colors"
          >
            <!-- Baris Atas: Nama, NIS, dan Kategori Badge -->
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {{ alumni.name }}
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span class="font-medium text-slate-600 dark:text-slate-300">{{ alumni.classRoom }} ({{ alumni.cohort }})</span>
                  <template v-if="alumni.nis && alumni.nis !== '-'">
                    <span class="text-slate-300 dark:text-slate-600">&bull;</span>
                    <span>NIS: {{ alumni.nis }}</span>
                  </template>
                </div>
              </div>

              <span
                class="px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap shrink-0 inline-block"
                :class="CATEGORY_COLORS[alumni.category]?.badge || 'bg-slate-100 text-slate-700 border-slate-200'"
              >
                {{ alumni.category }}
              </span>
            </div>

            <!-- Box Rincian Kampus & Jurusan -->
            <div class="p-2.5 rounded-lg bg-sky-50/60 dark:bg-slate-900/60 border border-sky-100/80 dark:border-slate-800/80 space-y-1 text-xs">
              <div class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <img
                  v-if="getInstitutionLogo(alumni.institution)"
                  :src="getInstitutionLogo(alumni.institution)"
                  :alt="alumni.institution"
                  class="w-4 h-4 rounded object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
                  loading="lazy"
                  @error="(e) => e.target.style.display = 'none'"
                />
                <i v-else class="fa-solid fa-building-columns text-[#0284C7] text-xs shrink-0" aria-hidden="true"></i>
                <span class="truncate">{{ alumni.institution || '-' }}</span>
              </div>
              <div class="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 pl-6">
                <i class="fa-solid fa-graduation-cap text-amber-500 text-[10px] shrink-0" aria-hidden="true"></i>
                <span class="truncate">{{ alumni.major || '-' }}</span>
              </div>
            </div>

            <!-- Baris Tombol Aksi Lengkap & Pas di Layar -->
            <div class="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <button
                @click="openDetail(alumni)"
                type="button"
                class="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-[#047857] dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
              >
                <i class="fa-solid fa-eye text-[11px]" aria-hidden="true"></i>
                <span>Detail</span>
              </button>

              <a
                :href="router.resolve({ name: 'edit-siswa', params: { id: alumni.id } }).href"
                target="_blank"
                class="flex-1 py-1.5 px-2.5 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-[#0369A1] dark:text-sky-200 border border-sky-200/80 dark:border-sky-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                title="Edit data alumni (buka di tab baru)"
              >
                <i class="fa-solid fa-pen-to-square text-[11px]" aria-hidden="true"></i>
                <span>Edit</span>
              </a>

              <button
                @click="handleDelete(alumni)"
                type="button"
                class="py-1.5 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                title="Hapus data alumni"
              >
                <i class="fa-solid fa-trash text-[11px]" aria-hidden="true"></i>
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. TAMPILAN DESKTOP: TABEL KOMPREHENSIF (HIDDEN MD:BLOCK) -->
        <div class="hidden md:block overflow-x-auto rounded-2xl border border-sky-200/70 dark:border-slate-800">
          <table class="w-full text-left text-sm">
            <thead class="bg-sky-50/70 dark:bg-slate-800 text-[#0369A1] dark:text-sky-200 font-semibold text-xs sm:text-sm border-b border-sky-100 dark:border-slate-700">
              <tr>
                <th class="p-3.5 whitespace-nowrap">Nama Alumni</th>
                <th class="p-3.5 whitespace-nowrap">Kelas / Angkatan</th>
                <th class="p-3.5 whitespace-nowrap">Kategori</th>
                <th class="p-3.5 whitespace-nowrap">Instansi / Kampus</th>
                <th class="p-3.5 whitespace-nowrap">Jurusan / Posisi</th>
                <th class="p-3.5 text-right whitespace-nowrap">Aksi Kelola</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr
                v-for="alumni in paginatedManageList"
                :key="alumni.id"
                class="hover:bg-sky-50/40 dark:hover:bg-slate-800/40 transition-colors"
              >
                <td class="p-3.5 font-semibold text-slate-900 dark:text-white">
                  <div>{{ alumni.name }}</div>
                  <div v-if="alumni.nis && alumni.nis !== '-'" class="text-xs font-normal text-slate-500 dark:text-slate-400">
                    NIS: {{ alumni.nis }}
                  </div>
                </td>
                <td class="p-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {{ alumni.classRoom }} ({{ alumni.cohort }})
                </td>
                <td class="p-3.5 whitespace-nowrap">
                  <span
                    class="px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap inline-block shrink-0"
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
                      @error="(e) => e.target.style.display = 'none'"
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
                    @click="openDetail(alumni)"
                    type="button"
                    class="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-[#047857] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-sm font-semibold transition-colors mr-1.5"
                    title="Lihat Detail Lengkap"
                  >
                    <i class="fa-solid fa-eye mr-1 text-xs" aria-hidden="true"></i>
                    Detail
                  </button>
                  <a
                    :href="router.resolve({ name: 'edit-siswa', params: { id: alumni.id } }).href"
                    target="_blank"
                    class="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-[#0369A1] dark:text-sky-200 border border-sky-200 dark:border-sky-800 text-sm font-semibold transition-colors mr-1.5 inline-flex items-center"
                    title="Edit data siswa/alumni (buka di tab baru)"
                  >
                    <i class="fa-solid fa-pen-to-square mr-1 text-xs" aria-hidden="true"></i>
                    Edit
                  </a>
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

        <!-- KONTROL NAVIGASI HALAMAN ALUMNI (PAGINATION) -->
        <div v-if="manageTotalPages > 1" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm" aria-label="Navigasi Halaman Kelola Data">
          <div class="text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Menampilkan <span class="font-semibold text-slate-800 dark:text-slate-200">{{ ((manageCurrentPage - 1) * manageItemsPerPage) + 1 }}-{{ Math.min(manageCurrentPage * manageItemsPerPage, filteredManageList.length) }}</span> dari <span class="font-semibold text-slate-800 dark:text-slate-200">{{ filteredManageList.length }}</span> data
          </div>

          <div class="flex items-center justify-center gap-1.5 sm:gap-2">
            <button
              :disabled="manageCurrentPage === 1"
              @click="manageCurrentPage--"
              type="button"
              class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Sebelumnya
            </button>

            <span class="font-medium text-slate-600 dark:text-slate-300 px-2">
              Halaman {{ manageCurrentPage }} dari {{ manageTotalPages }}
            </span>

            <button
              :disabled="manageCurrentPage === manageTotalPages"
              @click="manageCurrentPage++"
              type="button"
              class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        </div>

      </div>

      <div v-else class="py-10 text-center text-sm text-slate-400">
        Belum ada data alumni yang cocok untuk dikelola.
      </div>
    </section>

    <!-- ======================================================= -->
    <!-- TAB 2: MANAJEMEN AKUN PENGGUNA (SISWA & GURU BK)       -->
    <!-- ======================================================= -->
    <section v-else-if="activeTab === 'users'" class="p-3.5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-4">
      
      <!-- Baris Judul & Deskripsi -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#4F46E5] border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800 text-xs font-bold mb-1">
            <i class="fa-solid fa-user-shield text-[10px]" aria-hidden="true"></i>
            <span>Pusat Kredensial &amp; Akun Login</span>
          </div>
          <h2 class="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
            Kelola Akun Siswa &amp; Pengguna
          </h2>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Admin Guru BK dapat memantau username, NISN, NIS, email, serta melihat &amp; mengganti kata sandi akun ({{ filteredUsersList.length }} akun).
          </p>
        </div>

        <!-- Tombol Refresh Data -->
        <div class="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            @click="authStore.fetchAllUsers"
            :disabled="authStore.isLoadingUsers"
            class="px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            title="Segarkan data akun"
          >
            <i class="fa-solid fa-arrows-rotate text-xs" :class="{ 'fa-spin': authStore.isLoadingUsers }" aria-hidden="true"></i>
            <span>Segarkan Akun</span>
          </button>
        </div>
      </div>

      <!-- Ringkasan Statistik Cepat Akun (Cards) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
          <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <i class="fa-solid fa-users text-[#4F46E5]"></i>
            <span>Total Akun</span>
          </div>
          <div class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
            {{ userStats.total }}
          </div>
        </div>

        <div class="p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/60">
          <div class="text-[11px] font-semibold text-[#0369A1] dark:text-sky-300 flex items-center gap-1.5">
            <i class="fa-solid fa-graduation-cap text-[#0284C7]"></i>
            <span>Siswa Aktif</span>
          </div>
          <div class="text-lg sm:text-xl font-bold text-[#0369A1] dark:text-sky-200 mt-1">
            {{ userStats.siswa }}
          </div>
        </div>

        <div class="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
          <div class="text-[11px] font-semibold text-[#047857] dark:text-emerald-300 flex items-center gap-1.5">
            <i class="fa-solid fa-user-tie text-emerald-600"></i>
            <span>Guru BK (Admin)</span>
          </div>
          <div class="text-lg sm:text-xl font-bold text-[#047857] dark:text-emerald-200 mt-1">
            {{ userStats.admin }}
          </div>
        </div>

        <div class="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60">
          <div class="text-[11px] font-semibold text-[#92400E] dark:text-amber-300 flex items-center gap-1.5">
            <i class="fa-solid fa-user text-amber-600"></i>
            <span>Pengunjung / Tamu</span>
          </div>
          <div class="text-lg sm:text-xl font-bold text-[#92400E] dark:text-amber-200 mt-1">
            {{ userStats.umum }}
          </div>
        </div>
      </div>

      <!-- Filter & Pencarian Akun -->
      <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        
        <!-- Search bar -->
        <div class="relative flex-1">
          <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm pointer-events-none"></i>
          <input
            v-model="userSearch"
            type="text"
            placeholder="Cari nama siswa, NISN, NIS, email, atau kelas..."
            class="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#4F46E5] focus:outline-none transition-colors"
          />
          <button
            v-if="userSearch"
            type="button"
            @click="userSearch = ''"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Hapus pencarian"
          >
            <i class="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
          </button>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Filter Role -->
          <select
            v-model="userRoleFilter"
            class="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
          >
            <option value="all">Semua Peran</option>
            <option value="siswa">Siswa Aktif</option>
            <option value="admin">Guru BK (Admin)</option>
            <option value="user">Pengunjung / Tamu</option>
          </select>

          <!-- Filter Kelas -->
          <select
            v-model="userClassFilter"
            class="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
          >
            <option value="all">Semua Kelas</option>
            <option v-for="cls in availableClasses" :key="cls" :value="cls">
              Kelas {{ cls }}
            </option>
          </select>
        </div>
      </div>

      <!-- KONTEN DAFTAR AKUN PENGGUNA -->
      <div v-if="filteredUsersList.length > 0">
        
        <!-- 1. TAMPILAN MOBILE: KARTU KOMPAK & LENGKAP (MD:HIDDEN) -->
        <div class="md:hidden space-y-2.5">
          <div
            v-for="user in paginatedUsersList"
            :key="user.id"
            class="p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-indigo-100/90 dark:border-slate-800 shadow-2xs space-y-2.5 hover:border-indigo-300 dark:hover:border-slate-700 transition-colors"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-[#4F46E5] dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {{ user.nama ? user.nama.substring(0, 2).toUpperCase() : 'US' }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {{ user.nama }}
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span class="font-medium text-slate-700 dark:text-slate-300">{{ user.kelas ? 'Kelas ' + user.kelas : 'Umum' }}</span>
                    <span class="text-slate-300 dark:text-slate-600">&bull;</span>
                    <span>Angkatan {{ user.angkatan || 61 }}</span>
                  </div>
                </div>
              </div>

              <!-- Badge Peran -->
              <span
                class="px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap shrink-0"
                :class="user.role === 'admin'
                  ? 'bg-emerald-50 text-[#047857] border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                  : (user.role === 'siswa'
                    ? 'bg-sky-50 text-[#0369A1] border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800'
                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700')"
              >
                {{ user.role === 'admin' ? 'Guru BK' : (user.role === 'siswa' ? 'Siswa' : 'Tamu') }}
              </span>
            </div>

            <!-- Box Username & Kredensial -->
            <div class="p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80 space-y-1.5 text-xs">
              <div class="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span class="font-medium">NISN / NIS:</span>
                <span class="font-mono font-bold text-slate-900 dark:text-slate-200">
                  {{ user.nisn || '-' }} / {{ user.nis || '-' }}
                </span>
              </div>
              <div v-if="user.email" class="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span class="font-medium">Email:</span>
                <span class="text-slate-800 dark:text-slate-300 truncate max-w-[170px]">{{ user.email }}</span>
              </div>

              <!-- Baris Kata Sandi Mobile (Tersimpan Aman / Bcrypt) -->
              <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <span class="font-medium text-slate-600 dark:text-slate-400">Kata Sandi:</span>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-semibold border border-emerald-200/70 dark:border-emerald-800">
                  <i class="fa-solid fa-lock text-emerald-600 dark:text-emerald-400 text-[10px]" aria-hidden="true"></i>
                  <span>Terenkripsi Bcrypt</span>
                </span>
              </div>
            </div>

            <!-- Tombol Aksi Mobile -->
            <div class="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <button
                @click="openEditUser(user)"
                type="button"
                class="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-[#4F46E5] dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <i class="fa-solid fa-pen-to-square text-[11px]" aria-hidden="true"></i>
                <span>Edit Akun &amp; Sandi</span>
              </button>

              <button
                @click="handleQuickResetPassword(user)"
                type="button"
                class="py-1.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-[#92400E] dark:text-amber-200 border border-amber-200/80 dark:border-amber-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                title="Reset password ke default (smadahebat)"
              >
                <i class="fa-solid fa-rotate-left text-[11px]" aria-hidden="true"></i>
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. TAMPILAN DESKTOP: TABEL LENGKAP & RAPI (HIDDEN MD:BLOCK) -->
        <div class="hidden md:block overflow-x-auto rounded-2xl border border-indigo-200/70 dark:border-slate-800">
          <table class="w-full text-left text-sm">
            <thead class="bg-indigo-50/70 dark:bg-slate-800 text-[#4F46E5] dark:text-indigo-200 font-semibold text-xs sm:text-sm border-b border-indigo-100 dark:border-slate-700">
              <tr>
                <th class="p-3.5 whitespace-nowrap">Nama Pengguna</th>
                <th class="p-3.5 whitespace-nowrap">Username / NISN / NIS</th>
                <th class="p-3.5 whitespace-nowrap">Kelas / Angkatan</th>
                <th class="p-3.5 whitespace-nowrap">Peran</th>
                <th class="p-3.5 whitespace-nowrap">Kata Sandi</th>
                <th class="p-3.5 text-right whitespace-nowrap">Aksi Akun</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr
                v-for="user in paginatedUsersList"
                :key="user.id"
                class="hover:bg-indigo-50/30 dark:hover:bg-slate-800/50 transition-colors"
              >
                <!-- Nama & Avatar -->
                <td class="p-3.5">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-[#4F46E5] dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {{ user.nama ? user.nama.substring(0, 2).toUpperCase() : 'US' }}
                    </div>
                    <div>
                      <div class="font-bold text-slate-900 dark:text-white">
                        {{ user.nama }}
                      </div>
                      <div v-if="user.email" class="text-xs text-slate-500 dark:text-slate-400">
                        {{ user.email }}
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Username / NISN / NIS -->
                <td class="p-3.5">
                  <div class="space-y-1 text-xs">
                    <div v-if="user.nisn" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200 font-semibold">
                      <span class="text-slate-400 text-[10px]">NISN:</span> {{ user.nisn }}
                    </div>
                    <div v-if="user.nis" class="block font-mono text-slate-600 dark:text-slate-400">
                      <span class="text-slate-400 text-[10px]">NIS:</span> {{ user.nis }}
                    </div>
                    <div v-if="!user.nisn && !user.nis" class="text-slate-400 italic">
                      {{ user.email || '-' }}
                    </div>
                  </div>
                </td>

                <!-- Kelas & Angkatan -->
                <td class="p-3.5 whitespace-nowrap">
                  <div class="font-medium text-slate-800 dark:text-slate-200">
                    {{ user.kelas ? 'Kelas ' + user.kelas : 'Umum' }}
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    Angkatan {{ user.angkatan || 61 }} ({{ user.tahun_lulus || 2027 }})
                  </div>
                </td>

                <!-- Peran -->
                <td class="p-3.5 whitespace-nowrap">
                  <span
                    class="px-2.5 py-1 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5"
                    :class="user.role === 'admin'
                      ? 'bg-emerald-50 text-[#047857] border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
                      : (user.role === 'siswa'
                        ? 'bg-sky-50 text-[#0369A1] border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800'
                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700')"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full"
                      :class="user.role === 'admin' ? 'bg-emerald-500' : (user.role === 'siswa' ? 'bg-sky-500' : 'bg-slate-400')"
                    ></span>
                    {{ user.role === 'admin' ? 'Guru BK (Admin)' : (user.role === 'siswa' ? 'Siswa Aktif' : 'Pengunjung') }}
                  </span>
                </td>

                <!-- Kata Sandi dengan Status Enkripsi Bcrypt Aman -->
                <td class="p-3.5 whitespace-nowrap">
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-semibold">
                    <i class="fa-solid fa-shield-halved text-emerald-600 dark:text-emerald-400 text-xs" aria-hidden="true"></i>
                    <span>Tersimpan Aman (Bcrypt)</span>
                  </div>
                </td>

                <!-- Aksi -->
                <td class="p-3.5 text-right whitespace-nowrap">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      @click="openEditUser(user)"
                      type="button"
                      class="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-[#4F46E5] dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition-colors flex items-center gap-1"
                      title="Edit kredensial & kata sandi akun"
                    >
                      <i class="fa-solid fa-pen-to-square text-[11px]" aria-hidden="true"></i>
                      <span>Edit</span>
                    </button>

                    <button
                      @click="handleQuickResetPassword(user)"
                      type="button"
                      class="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-[#92400E] dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-semibold transition-colors flex items-center gap-1"
                      title="Reset kata sandi ke default (smadahebat)"
                    >
                      <i class="fa-solid fa-rotate-left text-[11px]" aria-hidden="true"></i>
                      <span>Reset</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginasi Akun Pengguna -->
        <div v-if="userTotalPages > 1" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm" aria-label="Navigasi Halaman Akun Pengguna">
          <div class="text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Menampilkan <span class="font-semibold text-slate-800 dark:text-slate-200">{{ ((userCurrentPage - 1) * userItemsPerPage) + 1 }}-{{ Math.min(userCurrentPage * userItemsPerPage, filteredUsersList.length) }}</span> dari <span class="font-semibold text-slate-800 dark:text-slate-200">{{ filteredUsersList.length }}</span> akun
          </div>

          <div class="flex items-center justify-center gap-1.5 sm:gap-2">
            <button
              :disabled="userCurrentPage === 1"
              @click="userCurrentPage--"
              type="button"
              class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Sebelumnya
            </button>

            <span class="font-medium text-slate-600 dark:text-slate-300 px-2">
              Halaman {{ userCurrentPage }} dari {{ userTotalPages }}
            </span>

            <button
              :disabled="userCurrentPage === userTotalPages"
              @click="userCurrentPage++"
              type="button"
              class="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        </div>

      </div>

      <div v-else class="py-10 text-center text-sm text-slate-400">
        Tidak ditemukan akun pengguna yang sesuai dengan filter pencarian.
      </div>
    </section>

    <!-- ========================================== -->
    <!-- TAB 3: FORM TAMBAH DATA MANUAL (CREATE)    -->
    <!-- ========================================== -->
    <section v-else-if="activeTab === 'input'" class="p-4 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-4 sm:space-y-5">
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
              <option value="Belum Lapor Diri">Belum Lapor Diri / Persiapan Ulang</option>
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
            <ProdiCombobox
              id="manual-major"
              v-model="manualForm.major"
              :campus="manualForm.institution"
              placeholder="Pilih atau cari Program Studi resmi..."
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
    <section v-else-if="activeTab === 'import'" class="p-4 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-4 sm:space-y-5">
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
                      @error="(e) => e.target.style.display = 'none'"
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
    <section v-else-if="activeTab === 'export'" class="p-4 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-4 sm:space-y-6">
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

    <!-- Modal Detail Alumni / Siswa -->
    <DetailModal
      :is-open="isDetailModalOpen"
      :alumni="selectedDetailAlumni"
      @close="isDetailModalOpen = false"
    />

    <!-- Modal Edit Alumni -->
    <EditModal
      :is-open="isEditModalOpen"
      :alumni="selectedEditAlumni"
      @close="isEditModalOpen = false"
    />

    <!-- MODAL EDIT AKUN & PASSWORD PENGGUNA (GURU BK / SISWA) -->
    <div
      v-if="isEditUserModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      @click.self="closeEditUserModal"
    >
      <div class="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-indigo-200/80 dark:border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 class="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <i class="fa-solid fa-user-pen text-[#4F46E5]"></i>
              <span>Edit Kredensial Akun</span>
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Perbarui username, data identitas, atau ubah kata sandi pengguna.
            </p>
          </div>
          <button
            type="button"
            @click="closeEditUserModal"
            class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-sm"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Feedback Alert -->
        <div
          v-if="editUserFeedback.text"
          class="p-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2"
          :class="editUserFeedback.type === 'success'
            ? 'bg-emerald-50 text-[#047857] border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'"
        >
          <i class="fa-solid" :class="editUserFeedback.type === 'success' ? 'fa-circle-check text-emerald-600' : 'fa-circle-exclamation text-rose-600'"></i>
          <span>{{ editUserFeedback.text }}</span>
        </div>

        <form @submit.prevent="handleSaveUser" class="space-y-3.5">
          <!-- Nama Lengkap -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Lengkap <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="editUserForm.nama"
              type="text"
              required
              class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
            />
          </div>

          <!-- NISN & NIS -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                NISN (10 Digit)
              </label>
              <input
                v-model="editUserForm.nisn"
                type="text"
                placeholder="Contoh: 3087979101"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                NIS (Nomor Induk Siswa)
              </label>
              <input
                v-model="editUserForm.nis"
                type="text"
                placeholder="Contoh: 17859"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
              />
            </div>
          </div>

          <!-- Email & Kelas -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                v-model="editUserForm.email"
                type="email"
                placeholder="opsional"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kelas
              </label>
              <input
                v-model="editUserForm.kelas"
                type="text"
                placeholder="Contoh: XI 9"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
              />
            </div>
          </div>

          <!-- Peran (Role) -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Peran Hak Akses (Role)
            </label>
            <select
              v-model="editUserForm.role"
              class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
            >
              <option value="siswa">Siswa Aktif</option>
              <option value="admin">Guru BK (Administrator Penuh)</option>
              <option value="user">Pengunjung / Tamu</option>
            </select>
          </div>

          <!-- Kata Sandi Akun -->
          <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Ganti Kata Sandi Baru <span class="text-xs text-slate-400 font-normal">(Opsional)</span>
              </label>
              <button
                type="button"
                @click="editUserForm.password = 'smadahebat'"
                class="text-[11px] font-semibold text-[#4F46E5] dark:text-indigo-300 hover:underline"
              >
                Gunakan default: smadahebat
              </button>
            </div>

            <div class="relative">
              <input
                v-model="editUserForm.password"
                :type="showEditModalPassword ? 'text' : 'password'"
                placeholder="Kosongkan jika tidak ingin mengubah kata sandi"
                class="w-full pl-3.5 pr-10 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#4F46E5] focus:outline-none"
              />
              <button
                type="button"
                @click="showEditModalPassword = !showEditModalPassword"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <i class="fa-solid" :class="showEditModalPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
              </button>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Kata sandi akan otomatis dienkripsi dengan standar Bcrypt di server database Supabase.
            </p>
          </div>

          <!-- Tombol Aksi Modal -->
          <div class="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              @click="closeEditUserModal"
              class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              :disabled="isSavingUser"
              class="px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <i v-if="isSavingUser" class="fa-solid fa-spinner fa-spin text-xs"></i>
              <i v-else class="fa-solid fa-check text-xs"></i>
              <span>{{ isSavingUser ? 'Menyimpan...' : 'Simpan Perubahan' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
    </template>

  </div>
</template>
