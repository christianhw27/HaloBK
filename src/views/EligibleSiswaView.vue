<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEligibleStore } from '@/stores/eligible'
import PublicNavbar from '@/components/PublicNavbar.vue'
import EligibleSidebar from '@/components/EligibleSidebar.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import Toast from '@/components/Toast.vue'
import CampusCombobox from '@/components/CampusCombobox.vue'
import ProdiCombobox from '@/components/ProdiCombobox.vue'
import { findSnpmbPtn, getProdiListForCampus } from '@/lib/snpmbService'

const router = useRouter()
const authStore = useAuthStore()
const eligibleStore = useEligibleStore()

const confirmModal = ref(null)
const toast = ref(null)

const activeTab = ref('pilihan') // 'pilihan' | 'nilai' | 'sertifikat'

// State Pilihan 1 & 2 (terhubung ke katalog PTN & Prodi SNPMB yang sama dengan Tracer Study)
const p1Uni = ref('')
const p1Major = ref('')
const p1UniName = ref('')
const p1MajorName = ref('')

const p2Uni = ref('')
const p2Major = ref('')
const p2UniName = ref('')
const p2MajorName = ref('')

const p1Clash = ref({ total: 0, names: [] })
const p2Clash = ref({ total: 0, names: [] })

const isSavingChoices = ref(false)
const choiceFeedback = ref({ type: '', text: '' })

// State Tabel Nilai
const gradesRows = ref([])
const isSavingGrades = ref(false)
const gradeFeedback = ref({ type: '', text: '' })

// State Sertifikat
const certTitle = ref('')
const certFile = ref(null)
const certFileInput = ref(null)
const isUploadingCert = ref(false)
const certFeedback = ref({ type: '', text: '' })

onMounted(async () => {
  if (!authStore.isLoggedIn) {
    router.replace('/login')
    return
  }
  if (authStore.userRole === 'admin') {
    router.replace('/admin/eligible')
    return
  }

  const status = await eligibleStore.checkMyEligibleStatus()
  if (!status) {
    router.replace('/')
    return
  }

  await Promise.all([
    eligibleStore.fetchMasterSubjects(),
    eligibleStore.fetchUniversities()
  ])

  initChoicesForm()
  initGradesForm()
})

// Helper cari PTN & Prodi dari katalog SNPMB Tracer Study berdasarkan ID
function findUniById(uniId) {
  return eligibleStore.universitiesList.find(u => String(u.id) === String(uniId)) || null
}

function findMajorById(uniId, majorId) {
  const u = findUniById(uniId)
  if (!u || !Array.isArray(u.prodi)) return null
  return u.prodi.find(m => String(m.id) === String(majorId)) || null
}

// Inisialisasi formulir pilihan dari store
function initChoicesForm() {
  const choices = eligibleStore.myChoices
  const c1 = choices.find(c => c.priority === 1)
  const c2 = choices.find(c => c.priority === 2)

  if (c1) {
    const u1 = findUniById(c1.university_id)
    const m1 = findMajorById(c1.university_id, c1.major_id)
    p1Uni.value = String(c1.university_id)
    p1Major.value = String(c1.major_id)
    p1UniName.value = u1?.name || c1.universities?.name || ''
    p1MajorName.value = m1?.fullName || (c1.majors ? `${c1.majors.degree || ''} ${c1.majors.name}`.trim() : '')
    checkP1Clash()
  }

  if (c2) {
    const u2 = findUniById(c2.university_id)
    const m2 = findMajorById(c2.university_id, c2.major_id)
    p2Uni.value = String(c2.university_id)
    p2Major.value = String(c2.major_id)
    p2UniName.value = u2?.name || c2.universities?.name || ''
    p2MajorName.value = m2?.fullName || (c2.majors ? `${c2.majors.degree || ''} ${c2.majors.name}`.trim() : '')
    checkP2Clash()
  }
}

// Helper pencocokan tepat nama PTN SNPMB agar pengetikan sebagian (misal "Univ") tidak salah pilih PTN lain
function findExactSnpmbPtn(text) {
  const clean = (text || '').trim().toLowerCase()
  if (!clean) return null
  return eligibleStore.universitiesList.find(
    u => u.name.toLowerCase() === clean || (u.rawName || '').toLowerCase() === clean
  ) || null
}

// Sinkronisasi Pilihan 1 (CampusCombobox & ProdiCombobox)
function handleP1UniSelect(campus) {
  const ptn = (campus?.snpmbId ? findUniById(campus.snpmbId) : null) || findSnpmbPtn(campus?.name || p1UniName.value)
  if (ptn) {
    const nextId = String(ptn.id)
    if (p1Uni.value !== nextId) {
      p1Uni.value = nextId
      p1Major.value = ''
      p1MajorName.value = ''
      p1Clash.value = { total: 0, names: [] }
    }
    p1UniName.value = ptn.name
  }
}

watch(p1UniName, (val) => {
  const clean = (val || '').trim()
  if (!clean) {
    p1Uni.value = ''
    p1Major.value = ''
    p1MajorName.value = ''
    p1Clash.value = { total: 0, names: [] }
    return
  }
  const ptn = findExactSnpmbPtn(clean)
  if (ptn) {
    const nextId = String(ptn.id)
    if (p1Uni.value !== nextId) {
      p1Uni.value = nextId
      p1Major.value = ''
      p1MajorName.value = ''
      p1Clash.value = { total: 0, names: [] }
    }
  } else {
    p1Uni.value = ''
    p1Major.value = ''
    p1Clash.value = { total: 0, names: [] }
  }
})

function handleP1ProdiSelect(prodi) {
  if (prodi?.id_prodi) {
    p1Major.value = String(prodi.id_prodi)
    p1MajorName.value = prodi.fullName || `${prodi.jenjang || 'S1'} ${prodi.nama}`
    checkP1Clash()
  }
}

watch(p1MajorName, (val) => {
  const clean = (val || '').trim().toLowerCase()
  if (!clean) {
    p1Major.value = ''
    p1Clash.value = { total: 0, names: [] }
    return
  }
  const list = getProdiListForCampus(p1UniName.value)
  const matched = list.find(p => p.fullName.toLowerCase() === clean || p.nama.toLowerCase() === clean)
  if (matched) {
    p1Major.value = String(matched.id_prodi)
    checkP1Clash()
  } else {
    p1Major.value = ''
    p1Clash.value = { total: 0, names: [] }
  }
})

// Sinkronisasi Pilihan 2 (CampusCombobox & ProdiCombobox)
function handleP2UniSelect(campus) {
  const ptn = (campus?.snpmbId ? findUniById(campus.snpmbId) : null) || findSnpmbPtn(campus?.name || p2UniName.value)
  if (ptn) {
    const nextId = String(ptn.id)
    if (p2Uni.value !== nextId) {
      p2Uni.value = nextId
      p2Major.value = ''
      p2MajorName.value = ''
      p2Clash.value = { total: 0, names: [] }
    }
    p2UniName.value = ptn.name
  }
}

watch(p2UniName, (val) => {
  const clean = (val || '').trim()
  if (!clean) {
    p2Uni.value = ''
    p2Major.value = ''
    p2MajorName.value = ''
    p2Clash.value = { total: 0, names: [] }
    return
  }
  const ptn = findExactSnpmbPtn(clean)
  if (ptn) {
    const nextId = String(ptn.id)
    if (p2Uni.value !== nextId) {
      p2Uni.value = nextId
      p2Major.value = ''
      p2MajorName.value = ''
      p2Clash.value = { total: 0, names: [] }
    }
  } else {
    p2Uni.value = ''
    p2Major.value = ''
    p2Clash.value = { total: 0, names: [] }
  }
})

function handleP2ProdiSelect(prodi) {
  if (prodi?.id_prodi) {
    p2Major.value = String(prodi.id_prodi)
    p2MajorName.value = prodi.fullName || `${prodi.jenjang || 'S1'} ${prodi.nama}`
    checkP2Clash()
  }
}

watch(p2MajorName, (val) => {
  const clean = (val || '').trim().toLowerCase()
  if (!clean) {
    p2Major.value = ''
    p2Clash.value = { total: 0, names: [] }
    return
  }
  const list = getProdiListForCampus(p2UniName.value)
  const matched = list.find(p => p.fullName.toLowerCase() === clean || p.nama.toLowerCase() === clean)
  if (matched) {
    p2Major.value = String(matched.id_prodi)
    checkP2Clash()
  } else {
    p2Major.value = ''
    p2Clash.value = { total: 0, names: [] }
  }
})

async function checkP1Clash() {
  if (!p1Uni.value || !p1Major.value) {
    p1Clash.value = { total: 0, names: [] }
    return
  }
  p1Clash.value = await eligibleStore.checkChoiceClash(
    p1Uni.value,
    p1Major.value,
    eligibleStore.myEligibleData?.id
  )
}

async function checkP2Clash() {
  if (!p2Uni.value || !p2Major.value) {
    p2Clash.value = { total: 0, names: [] }
    return
  }
  p2Clash.value = await eligibleStore.checkChoiceClash(
    p2Uni.value,
    p2Major.value,
    eligibleStore.myEligibleData?.id
  )
}

async function submitChoices() {
  choiceFeedback.value = { type: '', text: '' }
  if (!p1Uni.value || !p1Major.value) {
    choiceFeedback.value = { type: 'error', text: 'Pilihan 1 (PTN dan Program Studi resmi SNPMB) wajib dipilih dari daftar!' }
    return
  }

  if (p2UniName.value.trim() && (!p2Uni.value || !p2Major.value)) {
    choiceFeedback.value = { type: 'error', text: 'Pilihan 2 belum lengkap. Pilih PTN & Program Studi dari daftar, atau kosongkan keduanya.' }
    return
  }

  isSavingChoices.value = true
  const p1 = { university_id: p1Uni.value, major_id: p1Major.value }
  const p2 = p2Uni.value && p2Major.value
    ? { university_id: p2Uni.value, major_id: p2Major.value }
    : { remove: true }

  const res = await eligibleStore.saveChoices(p1, p2)
  isSavingChoices.value = false

  if (res.success) {
    choiceFeedback.value = { type: 'success', text: res.message }
    if (toast.value) toast.value.show(res.message, 'success')
    checkP1Clash()
    checkP2Clash()
  } else {
    choiceFeedback.value = { type: 'error', text: res.message }
    if (toast.value) toast.value.show(res.message, 'error')
  }
}

// Helper parsing nilai rapor: bilangan bulat 0 - 100 atau null jika kosong/tidak diajarkan
function parseGradeOrNull(val) {
  if (val === null || val === undefined) return null
  const str = String(val).trim()
  if (str === '' || str === '-') return null
  const cleanStr = str.replace(/[^0-9]/g, '')
  if (cleanStr === '') return null
  const num = parseInt(cleanStr, 10)
  if (isNaN(num) || num < 0) return null
  return Math.min(100, Math.max(0, num))
}

// Navigasi 4 arah (Panah Atas, Bawah, Kiri, Kanan + Enter) ala Excel pada tabel nilai rapor
function focusGradeCell(targetRow, targetCol) {
  const selector = `input[data-grade-cell="${targetRow}-${targetCol}"]`
  const inputs = document.querySelectorAll(selector)
  for (const el of inputs) {
    if (el.offsetParent !== null && !el.disabled) {
      el.focus()
      el.select()
      break
    }
  }
}

function handleGradeKeydown(e, rowIdx, colIdx) {
  const key = e.key
  const maxRow = gradesRows.value.length - 1

  if (key === 'ArrowUp') {
    e.preventDefault()
    if (rowIdx > 0) focusGradeCell(rowIdx - 1, colIdx)
    return
  }
  if (key === 'ArrowDown' || key === 'Enter') {
    e.preventDefault()
    if (rowIdx < maxRow) focusGradeCell(rowIdx + 1, colIdx)
    return
  }
  if (key === 'ArrowLeft') {
    e.preventDefault()
    if (colIdx > 1) {
      focusGradeCell(rowIdx, colIdx - 1)
    } else if (rowIdx > 0) {
      focusGradeCell(rowIdx - 1, 5)
    }
    return
  }
  if (key === 'ArrowRight') {
    e.preventDefault()
    if (colIdx < 5) {
      focusGradeCell(rowIdx, colIdx + 1)
    } else if (rowIdx < maxRow) {
      focusGradeCell(rowIdx + 1, 1)
    }
    return
  }

  // Izinkan shortcut Ctrl/Cmd (Copy, Paste, Select All, Undo) dan tombol edit standar
  if (e.ctrlKey || e.metaKey) return
  if (['Backspace', 'Delete', 'Tab', 'Home', 'End', 'Escape'].includes(key)) return

  // Hanya izinkan digit angka 0-9 (blokir titik, koma, minus, plus, huruf)
  if (!/^[0-9]$/.test(key)) {
    e.preventDefault()
  }
}

function sanitizeGradeInput(row, field, e) {
  const raw = e?.target ? e.target.value : row[field]
  if (raw === '' || raw === null || raw === undefined) {
    row[field] = null
    if (e?.target) e.target.value = ''
    return
  }
  const clean = parseGradeOrNull(raw)
  row[field] = clean
  if (e?.target && String(e.target.value) !== (clean !== null ? String(clean) : '')) {
    e.target.value = clean !== null ? String(clean) : ''
  }
}

// Inisialisasi formulir nilai dari store
function initGradesForm() {
  const existing = eligibleStore.myGrades
  if (existing && existing.length > 0) {
    gradesRows.value = existing.map(g => ({
      subject_id: g.subject_id,
      sem_1: parseGradeOrNull(g.sem_1),
      sem_2: parseGradeOrNull(g.sem_2),
      sem_3: parseGradeOrNull(g.sem_3),
      sem_4: parseGradeOrNull(g.sem_4),
      sem_5: parseGradeOrNull(g.sem_5)
    }))
  } else {
    // Default tambahkan baris mapel (nilai null = belum terisi / tidak diambil)
    gradesRows.value = []
    const defaultSubjects = eligibleStore.masterSubjects.slice(0, 6)
    defaultSubjects.forEach(s => {
      gradesRows.value.push({
        subject_id: s.id,
        sem_1: null,
        sem_2: null,
        sem_3: null,
        sem_4: null,
        sem_5: null
      })
    })
  }
}

function addGradeRow() {
  gradesRows.value.push({
    subject_id: '',
    sem_1: null,
    sem_2: null,
    sem_3: null,
    sem_4: null,
    sem_5: null
  })
}

function removeGradeRow(index) {
  gradesRows.value.splice(index, 1)
}

// Daftar subject_id yang sudah dipilih agar tidak dobel dropdown
const selectedSubjectIds = computed(() => {
  return new Set(gradesRows.value.map(r => r.subject_id).filter(Boolean))
})

// Deteksi perubahan nilai/mapel yang belum disimpan ke database
const hasUnsavedGradeChanges = computed(() => {
  if (!eligibleStore.canEditGrades) return false
  const normalize = (list) =>
    (list || [])
      .map(r => ({
        subject_id: String(r.subject_id || ''),
        sem_1: parseGradeOrNull(r.sem_1),
        sem_2: parseGradeOrNull(r.sem_2),
        sem_3: parseGradeOrNull(r.sem_3),
        sem_4: parseGradeOrNull(r.sem_4),
        sem_5: parseGradeOrNull(r.sem_5)
      }))
      .sort((a, b) => a.subject_id.localeCompare(b.subject_id))

  return JSON.stringify(normalize(gradesRows.value)) !== JSON.stringify(normalize(eligibleStore.myGrades))
})

// Kalkulasi rata-rata per baris mapel (horizontal) — HANYA dibagi dengan total berapa kali nilainya muncul (semester yang terisi)
function calculateRowAverage(row) {
  const filled = [1, 2, 3, 4, 5]
    .map(s => parseGradeOrNull(row[`sem_${s}`]))
    .filter(v => v !== null)

  if (filled.length === 0) return null
  const sum = filled.reduce((acc, v) => acc + v, 0)
  return Number((sum / filled.length).toFixed(2))
}

// Kalkulasi rata-rata per semester (vertikal) — HANYA dibagi dengan jumlah mapel yang terisi pada semester terkait
const semesterAverages = computed(() => {
  return [1, 2, 3, 4, 5].map(sNum => {
    const filledValues = gradesRows.value
      .map(r => parseGradeOrNull(r[`sem_${sNum}`]))
      .filter(v => v !== null)

    if (filledValues.length === 0) return '-'
    const sum = filledValues.reduce((acc, v) => acc + v, 0)
    return (sum / filledValues.length).toFixed(2)
  })
})

// Rata-rata kumulatif keseluruhan — rata-rata dari seluruh mata pelajaran yang terisi
const calculatedOverallAverage = computed(() => {
  if (gradesRows.value.length === 0) return '0.00'
  const rowAverages = gradesRows.value
    .map(calculateRowAverage)
    .filter(avg => avg !== null)

  if (rowAverages.length === 0) return '0.00'
  const sum = rowAverages.reduce((acc, curr) => acc + curr, 0)
  return (sum / rowAverages.length).toFixed(2)
})

async function submitGrades() {
  gradeFeedback.value = { type: '', text: '' }
  if (gradesRows.value.length === 0) {
    gradeFeedback.value = { type: 'error', text: 'Tabel nilai belum memiliki baris mata pelajaran!' }
    return
  }

  // Cek apakah ada subject yang belum dipilih
  const hasEmptySubject = gradesRows.value.some(r => !r.subject_id)
  if (hasEmptySubject) {
    gradeFeedback.value = { type: 'error', text: 'Pastikan seluruh baris telah memilih mata pelajaran.' }
    return
  }

  // Cek apakah ada baris yang sama sekali tidak memiliki nilai di semester mana pun
  const completelyEmptyRow = gradesRows.value.find(r => {
    return [1, 2, 3, 4, 5].every(s => parseGradeOrNull(r[`sem_${s}`]) === null)
  })
  if (completelyEmptyRow) {
    const subj = eligibleStore.masterSubjects.find(s => s.id === completelyEmptyRow.subject_id)
    gradeFeedback.value = {
      type: 'error',
      text: `Mata pelajaran "${subj?.name || 'terpilih'}" belum memiliki nilai pada semester mana pun. Silakan isi minimal 1 semester atau hapus baris jika tidak diajarkan.`
    }
    return
  }

  // Validasi nilai: jika terisi harus berupa bilangan bulat 0 - 100
  for (const r of gradesRows.value) {
    for (const sKey of ['sem_1', 'sem_2', 'sem_3', 'sem_4', 'sem_5']) {
      const v = r[sKey]
      if (v === null || v === undefined || v === '') continue
      const num = Number(v)
      if (!Number.isInteger(num) || num < 0 || num > 100) {
        gradeFeedback.value = {
          type: 'error',
          text: 'Nilai rapor harus berupa bilangan bulat antara 0 sampai 100.'
        }
        return
      }
    }
  }

  isSavingGrades.value = true
  const res = await eligibleStore.saveGrades(gradesRows.value)
  isSavingGrades.value = false

  if (res.success) {
    initGradesForm()
    gradeFeedback.value = { type: 'success', text: res.message }
    if (toast.value) toast.value.show(res.message, 'success')
  } else {
    gradeFeedback.value = { type: 'error', text: res.message }
    if (toast.value) toast.value.show(res.message, 'error')
  }
}

// Upload Sertifikat
function handleFileSelect(e) {
  const f = e.target.files[0]
  if (f) {
    if (f.size > 5 * 1024 * 1024) {
      if (toast.value) {
        toast.value.show('Ukuran berkas melebihi batas maksimal 5MB!', 'error')
      }
      return
    }
    certFile.value = f
  }
}

async function submitCertificate() {
  certFeedback.value = { type: '', text: '' }
  if (!certTitle.value.trim() || !certFile.value) {
    certFeedback.value = { type: 'error', text: 'Judul prestasi dan berkas gambar sertifikat wajib diisi!' }
    return
  }

  isUploadingCert.value = true
  const res = await eligibleStore.uploadCertificate(certFile.value, certTitle.value)
  isUploadingCert.value = false

  if (res.success) {
    certFeedback.value = { type: 'success', text: res.message }
    if (toast.value) toast.value.show(res.message, 'success')
    certTitle.value = ''
    certFile.value = null
    if (certFileInput.value) certFileInput.value.value = ''
  } else {
    certFeedback.value = { type: 'error', text: res.message }
    if (toast.value) toast.value.show(res.message, 'error')
  }
}

async function handleDeleteCert(id) {
  const confirmed = await confirmModal.value.open({
    title: 'Hapus Sertifikat Prestasi',
    message: 'Apakah Anda yakin ingin menghapus berkas sertifikat ini? Tindakan ini tidak dapat dibatalkan.',
    confirmText: 'Ya, Hapus Sertifikat',
    cancelText: 'Batal',
    type: 'danger'
  })
  if (!confirmed) return

  const res = await eligibleStore.deleteCertificate(id)
  if (toast.value) toast.value.show('Sertifikat berhasil dihapus.', 'success')
}
</script>

<template>
  <div class="min-h-screen w-full max-w-full overflow-x-clip bg-gradient-to-br from-[#EFF6FF]/90 via-[#F8FAFC] to-[#FFFBEB]/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100 font-sans flex flex-col">
    <!-- Navbar Global di Paling Atas Modul Siswa Eligible -->
    <PublicNavbar />

    <!-- SIDEBAR KHUSUS SISWA ELIGIBLE (STYLE PERSIS TRACER STUDY) -->
    <EligibleSidebar v-model:activeTab="activeTab" />

    <!-- KONTEN UTAMA DENGAN OFFSET SIDEBAR lg:pl-64 xl:pl-72 -->
    <div class="flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-clip lg:pl-64 xl:pl-72 pb-16">
      <main class="w-full max-w-full min-w-0 px-3.5 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-6 space-y-6">
      
      <!-- HEADER STATUS ELIGIBLE -->
      <section class="p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden min-w-0 max-w-full">
        <div class="absolute -right-8 -top-8 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>

        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800">
                <i class="fa-solid fa-crown text-amber-500"></i>
                <span>Siswa Eligible SNBP {{ eligibleStore.currentAcademicYear }}</span>
              </span>
              <span class="text-xs text-slate-400 font-medium">SMA Negeri 2 Ngawi</span>
            </div>

            <h1 class="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white">
              {{ authStore.userName }}
            </h1>

            <p class="text-sm text-slate-500 dark:text-slate-400">
              NISN: <span class="font-mono font-semibold text-slate-700 dark:text-slate-300">{{ authStore.userNisn || '-' }}</span> &bull;
              Kelas: <span class="font-semibold text-slate-700 dark:text-slate-300">{{ authStore.currentUser?.kelas || '-' }}</span>
            </p>
          </div>

          <!-- STATUS BADGE DOUBLE ACC -->
          <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 bg-slate-50 dark:bg-slate-800/80 p-3 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/80">
            <div class="text-xs space-y-1">
              <div class="text-slate-400 text-[11px] font-semibold uppercase">Status Pilihan:</div>
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                :class="eligibleStore.myEligibleData?.choice_status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60'
                  : (eligibleStore.myEligibleData?.choice_status === 'rejected'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/80 dark:border-rose-800'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60')"
              >
                <span v-if="eligibleStore.myEligibleData?.choice_status === 'rejected'" class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <i v-else :class="eligibleStore.myEligibleData?.choice_status === 'approved' ? 'fa-solid fa-check-double' : 'fa-solid fa-clock'"></i>
                <span>
                  {{
                    eligibleStore.myEligibleData?.choice_status === 'approved'
                      ? 'ACC Guru BK'
                      : (eligibleStore.myEligibleData?.choice_status === 'rejected' ? 'Perlu Revisi' : 'Belum ACC')
                  }}
                </span>
              </span>
            </div>

            <div class="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

            <div class="text-xs space-y-1">
              <div class="text-slate-400 text-[11px] font-semibold uppercase">Status Nilai:</div>
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                :class="eligibleStore.myEligibleData?.grade_status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60'
                  : (eligibleStore.myEligibleData?.grade_status === 'rejected'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/80 dark:border-rose-800'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60')"
              >
                <span v-if="eligibleStore.myEligibleData?.grade_status === 'rejected'" class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <i v-else :class="eligibleStore.myEligibleData?.grade_status === 'approved' ? 'fa-solid fa-lock' : 'fa-solid fa-pen-to-square'"></i>
                <span>
                  {{
                    eligibleStore.myEligibleData?.grade_status === 'approved'
                      ? 'ACC & Terkunci'
                      : (eligibleStore.myEligibleData?.grade_status === 'rejected' ? 'Perlu Revisi' : 'Belum ACC')
                  }}
                </span>
              </span>
            </div>

            <div class="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

            <div class="text-xs space-y-1">
              <div class="text-slate-400 text-[11px] font-semibold uppercase">Rata-Rata:</div>
              <span class="font-mono font-extrabold text-base text-[#0284C7] dark:text-sky-400">
                {{ Number(eligibleStore.myEligibleData?.overall_average || calculatedOverallAverage || 0).toFixed(2) }}
              </span>
            </div>
          </div>
        </div>

        <!-- BANNER PERINGATAN REVISI DARI GURU BK -->
        <div
          v-if="eligibleStore.myEligibleData?.choice_status === 'rejected' || eligibleStore.myEligibleData?.grade_status === 'rejected'"
          class="mt-4 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          role="alert"
        >
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
              <i class="fa-solid fa-triangle-exclamation text-sm"></i>
            </div>
            <div class="text-xs sm:text-sm text-rose-900 dark:text-rose-200 space-y-0.5">
              <p class="font-bold">
                Permintaan Revisi dari Guru BK
              </p>
              <p class="text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
                Guru BK menandai
                <strong v-if="eligibleStore.myEligibleData?.choice_status === 'rejected' && eligibleStore.myEligibleData?.grade_status === 'rejected'">
                  Pilihan PTN &amp; Prodi serta Nilai Rapor S1–S5
                </strong>
                <strong v-else-if="eligibleStore.myEligibleData?.choice_status === 'rejected'">
                  Pilihan PTN &amp; Prodi
                </strong>
                <strong v-else>
                  Nilai Rapor S1–S5
                </strong>
                Anda perlu diperbaiki. Silakan periksa kembali lalu klik tombol <strong>Simpan</strong> untuk mengajukan validasi ulang.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              v-if="eligibleStore.myEligibleData?.choice_status === 'rejected' && activeTab !== 'pilihan'"
              type="button"
              @click="activeTab = 'pilihan'"
              class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              Periksa Pilihan PTN
            </button>
            <button
              v-if="eligibleStore.myEligibleData?.grade_status === 'rejected' && activeTab !== 'nilai'"
              type="button"
              @click="activeTab = 'nilai'"
              class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              Periksa Nilai Rapor
            </button>
          </div>
        </div>
      </section>

      <!-- TAB 1: PILIHAN JURUSAN & DETEKSI BENTROK -->
      <section v-if="activeTab === 'pilihan'" class="space-y-6">
        <div v-if="choiceFeedback.text" class="p-4 rounded-2xl text-sm font-semibold flex items-center gap-2" :class="choiceFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'">
          <i :class="choiceFeedback.type === 'success' ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-solid fa-triangle-exclamation text-rose-600'"></i>
          <span>{{ choiceFeedback.text }}</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- PILIHAN 1 -->
          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-sky-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold bg-[#0284C7] text-white">
                PILIHAN 1 (UTAMA)
              </span>
              <span class="text-xs text-rose-500 font-bold">*Wajib Diisi</span>
            </div>

            <div class="space-y-3">
              <div>
                <label for="p1-campus" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Perguruan Tinggi Negeri (PTN)
                </label>
                <CampusCombobox
                  id="p1-campus"
                  v-model="p1UniName"
                  :only-ptn="true"
                  :disabled="!eligibleStore.canEditChoices"
                  placeholder="Ketik nama PTN (contoh: UGM, ITS, UB, UNESA)..."
                  @select="handleP1UniSelect"
                />
                <p v-if="p1UniName && !p1Uni" class="text-[11px] text-rose-500 mt-1 font-medium">
                  Pilih salah satu PTN resmi SNPMB dari daftar saran di atas.
                </p>
              </div>

              <div>
                <label for="p1-prodi" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Program Studi (Prodi)
                </label>
                <ProdiCombobox
                  id="p1-prodi"
                  v-model="p1MajorName"
                  :campus="p1UniName"
                  :disabled="!eligibleStore.canEditChoices || !p1Uni"
                  placeholder="Pilih atau cari Program Studi resmi..."
                  @select="handleP1ProdiSelect"
                />
                <p v-if="p1Uni && p1MajorName && !p1Major" class="text-[11px] text-rose-500 mt-1 font-medium">
                  Pilih program studi resmi dari daftar saran di atas.
                </p>
              </div>

              <!-- WARNING BENTROK LINTAS PILIHAN 1 -->
              <div v-if="p1Clash.total > 0" class="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs space-y-1 animate-in">
                <div class="font-bold flex items-center gap-1.5">
                  <i class="fa-solid fa-triangle-exclamation text-amber-600"></i>
                  <span>Perhatian: Pilihan ini bentrok dengan {{ p1Clash.total }} siswa eligible lainnya!</span>
                </div>
                <p class="text-[11px] text-amber-800 dark:text-amber-300">
                  Siswa yang juga memilih prodi ini: <strong>{{ p1Clash.names.join(', ') }}</strong>. Diskusikan dengan Guru BK untuk peluang kelulusan maksimal.
                </p>
              </div>
            </div>
          </div>

          <!-- PILIHAN 2 -->
          <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold bg-slate-700 text-white">
                PILIHAN 2 (OPSIONAL)
              </span>
              <span class="text-xs text-slate-400 font-medium">Boleh Dikosongkan</span>
            </div>

            <div class="space-y-3">
              <div>
                <label for="p2-campus" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Perguruan Tinggi Negeri (PTN)
                </label>
                <CampusCombobox
                  id="p2-campus"
                  v-model="p2UniName"
                  :only-ptn="true"
                  :disabled="!eligibleStore.canEditChoices"
                  placeholder="Ketik nama PTN Pilihan 2 (opsional)..."
                  @select="handleP2UniSelect"
                />
                <p v-if="p2UniName && !p2Uni" class="text-[11px] text-rose-500 mt-1 font-medium">
                  Pilih salah satu PTN resmi SNPMB dari daftar saran di atas.
                </p>
              </div>

              <div>
                <label for="p2-prodi" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Program Studi (Prodi)
                </label>
                <ProdiCombobox
                  id="p2-prodi"
                  v-model="p2MajorName"
                  :campus="p2UniName"
                  :disabled="!eligibleStore.canEditChoices || !p2Uni"
                  placeholder="Pilih atau cari Program Studi Pilihan 2 (opsional)..."
                  @select="handleP2ProdiSelect"
                />
                <p v-if="p2Uni && p2MajorName && !p2Major" class="text-[11px] text-rose-500 mt-1 font-medium">
                  Pilih program studi resmi dari daftar saran di atas.
                </p>
              </div>

              <!-- WARNING BENTROK LINTAS PILIHAN 2 -->
              <div v-if="p2Clash.total > 0" class="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs space-y-1 animate-in">
                <div class="font-bold flex items-center gap-1.5">
                  <i class="fa-solid fa-triangle-exclamation text-amber-600"></i>
                  <span>Perhatian: Pilihan ini bentrok dengan {{ p2Clash.total }} siswa eligible lainnya!</span>
                </div>
                <p class="text-[11px] text-amber-800 dark:text-amber-300">
                  Siswa yang juga memilih prodi ini: <strong>{{ p2Clash.names.join(', ') }}</strong>.
                </p>
              </div>
            </div>
          </div>

        </div>

        <div class="flex items-center justify-end">
          <button
            type="button"
            @click="submitChoices"
            :disabled="!eligibleStore.canEditChoices || isSavingChoices"
            class="px-6 py-3 rounded-2xl bg-[#0369A1] hover:bg-[#075985] text-white font-bold text-sm sm:text-base shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <i v-if="isSavingChoices" class="fa-solid fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-floppy-disk"></i>
            <span>{{ isSavingChoices ? 'Menyimpan...' : 'Simpan Pilihan Jurusan' }}</span>
          </button>
        </div>
      </section>

      <!-- TAB 2: TABEL NILAI RAPOR (SEMESTER 1-5) -->
      <section v-if="activeTab === 'nilai'" class="space-y-6">
        <div v-if="gradeFeedback.text" class="p-4 rounded-2xl text-sm font-semibold flex items-center gap-2" :class="gradeFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'">
          <i :class="gradeFeedback.type === 'success' ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-solid fa-triangle-exclamation text-rose-600'"></i>
          <span>{{ gradeFeedback.text }}</span>
        </div>

        <div class="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Tabel Nilai Rapor Semester 1 s.d. 5
              </h2>
              <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Isi nilai rapor bilangan bulat 0–100. Kosongkan sel (-) apabila mata pelajaran tidak diajarkan pada semester terkait. Rata-rata otomatis dihitung sesuai jumlah kemunculan nilai yang terisi. Gunakan panah (&uarr; &darr; &larr; &rarr;) atau Enter untuk berpindah sel.
              </p>
            </div>

            <button
              v-if="eligibleStore.canEditGrades"
              type="button"
              @click="addGradeRow"
              class="w-full sm:w-auto justify-center px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-[#0284C7] dark:text-sky-300 text-xs font-bold transition-colors flex items-center gap-1.5 border border-sky-200 dark:border-sky-800 shrink-0"
            >
              <i class="fa-solid fa-plus"></i>
              <span>Tambah Mapel</span>
            </button>
          </div>

          <!-- TAMPILAN MOBILE: KARTU COMPACT MAPEL (SEM 1 S.D. 5 & RATA-RATA TANPA GESER LAYAR) -->
          <div class="sm:hidden space-y-3">
            <div
              v-for="(row, idx) in gradesRows"
              :key="'mob-row-' + idx"
              class="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 shadow-xs space-y-2.5 transition-all"
            >
              <!-- Baris 1: Nomor Urut + Dropdown Mapel Full-Width + Hapus -->
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-[#0284C7] dark:text-sky-300 font-bold text-xs flex items-center justify-center shrink-0 border border-sky-200/60 dark:border-sky-800/60">
                  {{ idx + 1 }}
                </span>

                <div class="relative flex-1 min-w-0">
                  <select
                    v-model="row.subject_id"
                    :disabled="!eligibleStore.canEditGrades"
                    class="w-full pl-2.5 pr-7 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0284C7] disabled:opacity-75 transition-colors truncate"
                  >
                    <option value="">-- Pilih Mata Pelajaran --</option>
                    <option
                      v-for="s in eligibleStore.masterSubjects"
                      :key="s.id"
                      :value="s.id"
                      :disabled="selectedSubjectIds.has(s.id) && row.subject_id !== s.id"
                    >
                      {{ s.name }}
                    </option>
                  </select>
                </div>

                <button
                  v-if="eligibleStore.canEditGrades"
                  type="button"
                  @click="removeGradeRow(idx)"
                  class="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors flex items-center justify-center shrink-0 border border-transparent hover:border-rose-200"
                  title="Hapus baris"
                >
                  <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
              </div>

              <!-- Baris 2: Grid 6 Kolom Kompak (Sem 1 s.d. 5 + Rata-Rata) -->
              <div class="grid grid-cols-6 gap-1.5 items-center pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                <div v-for="sNum in [1, 2, 3, 4, 5]" :key="sNum" class="flex flex-col items-center">
                  <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter mb-1">
                    S{{ sNum }}
                  </span>
                  <input
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    maxlength="3"
                    placeholder="-"
                    :data-grade-cell="`${idx}-${sNum}`"
                    :value="row[`sem_${sNum}`] !== null && row[`sem_${sNum}`] !== undefined ? row[`sem_${sNum}`] : ''"
                    @focus="$event.target.select()"
                    @keydown="handleGradeKeydown($event, idx, sNum)"
                    @input="sanitizeGradeInput(row, `sem_${sNum}`, $event)"
                    @blur="sanitizeGradeInput(row, `sem_${sNum}`, $event)"
                    :disabled="!eligibleStore.canEditGrades"
                    class="w-full h-9 text-center font-mono text-xs font-bold py-1 px-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0284C7] disabled:opacity-75 transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>

                <!-- Rata-rata per Mapel -->
                <div class="flex flex-col items-center">
                  <span class="text-[10px] font-extrabold text-[#0284C7] dark:text-sky-400 uppercase tracking-tighter mb-1">
                    RATA
                  </span>
                  <div class="w-full h-9 flex items-center justify-center text-center font-mono text-xs font-black text-[#0284C7] dark:text-sky-300 bg-sky-50 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 rounded-lg">
                    {{ calculateRowAverage(row) !== null ? calculateRowAverage(row).toFixed(1) : '-' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Rekap Rata-Rata per Semester (Mobile) -->
            <div class="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <i class="fa-solid fa-chart-line text-amber-600"></i>
                  <span>Rata-Rata per Semester</span>
                </div>
                <div class="text-xs font-mono font-black text-[#0284C7] dark:text-sky-300 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded-lg border border-sky-200 dark:border-sky-800">
                  Total: {{ calculatedOverallAverage }}
                </div>
              </div>

              <div class="grid grid-cols-5 gap-1.5 pt-1 text-center font-mono">
                <div
                  v-for="(avg, i) in semesterAverages"
                  :key="'mobile-avg-' + i"
                  class="py-1.5 px-0.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-amber-200/70 dark:border-amber-900/40"
                >
                  <div class="text-[9px] font-bold text-amber-800 dark:text-amber-300">SEM {{ i + 1 }}</div>
                  <div class="text-xs font-black text-amber-950 dark:text-amber-100 mt-0.5">{{ avg }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- TABEL INPUT NILAI DESKTOP / TABLET (>= SM) -->
          <div class="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs uppercase font-extrabold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="p-3 min-w-[220px]">Mata Pelajaran</th>
                  <th class="p-3 text-center w-20">Sem 1</th>
                  <th class="p-3 text-center w-20">Sem 2</th>
                  <th class="p-3 text-center w-20">Sem 3</th>
                  <th class="p-3 text-center w-20">Sem 4</th>
                  <th class="p-3 text-center w-20">Sem 5</th>
                  <th class="p-3 text-center w-24 bg-sky-50 dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-300">Rata-Rata</th>
                  <th v-if="eligibleStore.canEditGrades" class="p-3 text-center w-12">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="(row, idx) in gradesRows" :key="'desk-row-' + idx" class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td class="p-2.5">
                    <select
                      v-model="row.subject_id"
                      :disabled="!eligibleStore.canEditGrades"
                      class="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium focus:ring-1 focus:ring-[#0284C7] disabled:opacity-75"
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      <option
                        v-for="s in eligibleStore.masterSubjects"
                        :key="s.id"
                        :value="s.id"
                        :disabled="selectedSubjectIds.has(s.id) && row.subject_id !== s.id"
                      >
                        {{ s.name }}
                      </option>
                    </select>
                  </td>

                  <td class="p-2 text-center" v-for="sNum in [1, 2, 3, 4, 5]" :key="sNum">
                    <input
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      maxlength="3"
                      placeholder="-"
                      :data-grade-cell="`${idx}-${sNum}`"
                      :value="row[`sem_${sNum}`] !== null && row[`sem_${sNum}`] !== undefined ? row[`sem_${sNum}`] : ''"
                      @focus="$event.target.select()"
                      @keydown="handleGradeKeydown($event, idx, sNum)"
                      @input="sanitizeGradeInput(row, `sem_${sNum}`, $event)"
                      @blur="sanitizeGradeInput(row, `sem_${sNum}`, $event)"
                      :disabled="!eligibleStore.canEditGrades"
                      class="w-16 px-1.5 py-1.5 rounded-lg text-center font-mono text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0284C7] disabled:opacity-75 transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </td>

                  <td class="p-2 text-center font-mono font-bold text-xs sm:text-sm bg-sky-50/50 dark:bg-sky-950/30 text-[#0284C7] dark:text-sky-300">
                    {{ calculateRowAverage(row) !== null ? calculateRowAverage(row).toFixed(2) : '-' }}
                  </td>

                  <td v-if="eligibleStore.canEditGrades" class="p-2 text-center">
                    <button
                      type="button"
                      @click="removeGradeRow(idx)"
                      class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                      title="Hapus baris"
                    >
                      <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </td>
                </tr>

                <!-- BARIS RATA-RATA SEMESTER (BAWAH) -->
                <tr class="bg-amber-50/60 dark:bg-amber-950/40 font-bold text-xs sm:text-sm border-t-2 border-amber-200 dark:border-amber-900/60">
                  <td class="p-3 text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                    Rata-Rata per Semester:
                  </td>
                  <td class="p-2 text-center font-mono text-amber-950 dark:text-amber-200" v-for="(avg, i) in semesterAverages" :key="i">
                    {{ avg }}
                  </td>
                  <td class="p-2 text-center font-mono font-extrabold text-sm text-[#0284C7] dark:text-sky-300 bg-sky-100/70 dark:bg-sky-950/80">
                    {{ calculatedOverallAverage }}
                  </td>
                  <td v-if="eligibleStore.canEditGrades"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- FOOTER AKSI & TOMBOL SIMPAN -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3">
            <div v-if="!eligibleStore.canEditGrades" class="text-xs text-emerald-600 font-bold flex items-center gap-1.5 order-2 sm:order-1 text-center sm:text-left justify-center sm:justify-start">
              <i class="fa-solid fa-lock shrink-0"></i>
              <span>Nilai telah disetujui (ACC) oleh Guru BK dan terkunci dari perubahan.</span>
            </div>
            <div v-else-if="hasUnsavedGradeChanges" class="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl font-semibold order-2 sm:order-1 text-center sm:text-left flex items-center justify-center sm:justify-start gap-1.5">
              <i class="fa-solid fa-triangle-exclamation text-amber-500 text-xs shrink-0"></i>
              <span>Ada perubahan nilai atau mapel yang belum disimpan. Klik <strong>Simpan Tabel Nilai</strong>.</span>
            </div>
            <div v-else class="text-xs text-slate-500 dark:text-slate-400 order-2 sm:order-1 text-center sm:text-left flex items-center justify-center sm:justify-start gap-1.5">
              <i class="fa-solid fa-circle-info text-sky-500 text-xs shrink-0"></i>
              <span>*Setelah divalidasi oleh Guru BK, nilai tidak dapat diubah lagi.</span>
            </div>

            <button
              type="button"
              @click="submitGrades"
              :disabled="!eligibleStore.canEditGrades || isSavingGrades"
              class="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#0369A1] hover:bg-[#075985] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 order-1 sm:order-2 shrink-0 ml-auto whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
            >
              <i v-if="isSavingGrades" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-floppy-disk text-base"></i>
              <span class="whitespace-nowrap">{{ isSavingGrades ? 'Menyimpan...' : 'Simpan Tabel Nilai' }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- TAB 3: SERTIFIKAT PRESTASI -->
      <section v-if="activeTab === 'sertifikat'" class="space-y-6">
        <div v-if="certFeedback.text" class="p-4 rounded-2xl text-sm font-semibold flex items-center gap-2" :class="certFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'">
          <i :class="certFeedback.type === 'success' ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-solid fa-triangle-exclamation text-rose-600'"></i>
          <span>{{ certFeedback.text }}</span>
        </div>

        <!-- FORM UPLOAD SERTIFIKAT -->
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Unggah Sertifikat Prestasi Pendukung
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Judul Sertifikat / Nama Kejuaraan
              </label>
              <input
                type="text"
                v-model="certTitle"
                placeholder="Contoh: Juara 1 OSN Matematika Tingkat Provinsi"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Berkas Foto Sertifikat (JPG / PNG / WebP, Maks. 5MB)
              </label>
              <input
                ref="certFileInput"
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                @change="handleFileSelect"
                class="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 dark:file:bg-sky-950/60 file:text-[#0284C7] dark:file:text-sky-300 hover:file:bg-sky-100 cursor-pointer"
              />
            </div>
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              @click="submitCertificate"
              :disabled="isUploadingCert || !certTitle || !certFile"
              class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <i v-if="isUploadingCert" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-cloud-arrow-up"></i>
              <span>{{ isUploadingCert ? 'Mengunggah ke Cloud...' : 'Unggah Sertifikat' }}</span>
            </button>
          </div>
        </div>

        <!-- DAFTAR SERTIFIKAT TERSIMPAN -->
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <h3 class="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Daftar Sertifikat Terunggah ({{ eligibleStore.myCertificates.length }})
          </h3>

          <div v-if="eligibleStore.myCertificates.length === 0" class="text-center py-8 text-slate-400 text-sm">
            Belum ada sertifikat yang diunggah.
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div
              v-for="cert in eligibleStore.myCertificates"
              :key="cert.id"
              class="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5 bg-slate-50/50 dark:bg-slate-800/40"
            >
              <div class="h-36 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700">
                <img :src="cert.image_url" :alt="cert.title" class="w-full h-full object-cover" />
              </div>
              <div class="flex items-start justify-between gap-2">
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                  {{ cert.title }}
                </span>
                <button
                  type="button"
                  @click="handleDeleteCert(cert.id)"
                  class="text-slate-400 hover:text-rose-600 transition-colors p-1"
                  title="Hapus sertifikat"
                >
                  <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
    </div>

    <!-- MODAL KONFIRMASI MODERN & NOTIFIKASI TOAST -->
    <ConfirmModal ref="confirmModal" />
    <Toast ref="toast" />
  </div>
</template>
