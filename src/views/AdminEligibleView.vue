<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEligibleStore } from '@/stores/eligible'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getInstitutionLogo } from '@/lib/campusList'
import EligibleSidebar from '@/components/EligibleSidebar.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import Toast from '@/components/Toast.vue'

const router = useRouter()
const authStore = useAuthStore()
const eligibleStore = useEligibleStore()

const confirmModal = ref(null)
const toast = ref(null)

const activeTab = ref('siswa') // 'siswa' | 'validasi' | 'ranking' | 'mapel' | 'sync'

// Tab 1: Pencarian Siswa untuk Add Eligible (Live Search)
const studentSearchQuery = ref('')
const studentSearchResults = ref([])
const isSearchingStudents = ref(false)
const hasSearched = ref(false)

// Tab 2: Filter & Pencarian Panel Validasi
const validasiSearch = ref('')
const validasiFilter = ref('all') // 'all' | 'has_choice' | 'pending' | 'choice_approved' | 'grade_locked'
const updatingIds = ref({})

// Tab 4: Form Mapel
const subjectForm = ref({ id: null, name: '', category: 'Wajib' })
const isEditingSubject = ref(false)
const subjectFeedback = ref({ type: '', text: '' })

// Tab 5: Sync SNPMB
const isSyncingSnpmb = ref(false)
const syncProgressText = ref('')
const syncFeedback = ref({ type: '', text: '' })

// Modal Detail Nilai Siswa untuk ACC / Buka Kunci
const selectedEligibleId = ref(null)
const isGradeDetailModalOpen = ref(false)

const selectedEligibleDetail = computed(() => {
  if (!selectedEligibleId.value) return null
  return eligibleStore.allEligibleStudents.find(s => s.id === selectedEligibleId.value) || null
})

const isSnpmbSynced = computed(() => {
  const s = eligibleStore.snpmbDbStats
  return s.universitiesCount >= s.localUniversitiesCount && s.majorsCount >= s.localMajorsCount && s.universitiesCount > 0
})

// Hitungan riil untuk tab filter validasi (satu sumber kebenaran, tanpa duplikasi stat card)
const validasiCounts = computed(() => {
  const list = eligibleStore.allEligibleStudents
  return {
    all: list.length,
    has_choice: list.filter(s => (s.eligible_choices || []).length > 0).length,
    pending: list.filter(
      s => ((s.eligible_choices || []).length > 0 && s.choice_status === 'pending') ||
        ((s.eligible_grades || []).length > 0 && s.grade_status === 'pending')
    ).length,
    choice_approved: list.filter(s => s.choice_status === 'approved').length,
    grade_locked: list.filter(s => s.grade_status === 'approved').length
  }
})

const validasiFilterTabs = computed(() => [
  { key: 'all', label: 'Semua', count: validasiCounts.value.all },
  { key: 'has_choice', label: 'Sudah Pilih Prodi', count: validasiCounts.value.has_choice },
  { key: 'pending', label: 'Perlu Validasi', count: validasiCounts.value.pending },
  { key: 'choice_approved', label: 'Pilihan ACC', count: validasiCounts.value.choice_approved },
  { key: 'grade_locked', label: 'Nilai Terkunci', count: validasiCounts.value.grade_locked }
])

// Daftar Siswa Tersaring untuk Tab 2 Validasi
const filteredValidasiList = computed(() => {
  let list = [...eligibleStore.allEligibleStudents]

  if (validasiFilter.value === 'has_choice') {
    list = list.filter(s => (s.eligible_choices || []).length > 0)
  } else if (validasiFilter.value === 'pending') {
    list = list.filter(
      s => ((s.eligible_choices || []).length > 0 && s.choice_status === 'pending') ||
        ((s.eligible_grades || []).length > 0 && s.grade_status === 'pending')
    )
  } else if (validasiFilter.value === 'choice_approved') {
    list = list.filter(s => s.choice_status === 'approved')
  } else if (validasiFilter.value === 'grade_locked') {
    list = list.filter(s => s.grade_status === 'approved')
  }

  const q = validasiSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter(item => {
      const nama = (item.users?.nama || '').toLowerCase()
      const kelas = (item.users?.kelas || '').toLowerCase()
      const nisn = (item.users?.nisn || '').toLowerCase()
      const choicesText = (item.eligible_choices || [])
        .map(c => `${c.universities?.name || ''} ${c.majors?.name || ''} ${c.majors?.degree || ''}`)
        .join(' ')
        .toLowerCase()
      return nama.includes(q) || kelas.includes(q) || nisn.includes(q) || choicesText.includes(q)
    })
  }

  // Prioritaskan siswa yang sudah mengisi pilihan / nilai di baris teratas
  return list.sort((a, b) => {
    const aScore = ((a.eligible_choices || []).length > 0 ? 2 : 0) + ((a.eligible_grades || []).length > 0 ? 1 : 0)
    const bScore = ((b.eligible_choices || []).length > 0 ? 2 : 0) + ((b.eligible_grades || []).length > 0 ? 1 : 0)
    if (bScore !== aScore) return bScore - aScore
    return (a.users?.nama || '').localeCompare(b.users?.nama || '', 'id')
  })
})

function handleGlobalKeydown(e) {
  if (e.key === 'Escape' && isGradeDetailModalOpen.value) {
    isGradeDetailModalOpen.value = false
  }
}

onMounted(async () => {
  if (authStore.userRole !== 'admin') {
    router.replace('/')
    return
  }

  window.addEventListener('keydown', handleGlobalKeydown)

  await Promise.all([
    eligibleStore.fetchAdminEligibleList(),
    eligibleStore.fetchMasterSubjects(),
    eligibleStore.fetchUniversities()
  ])

  // Auto-sinkronisasi katalog PTN & Prodi Tracer Study (SNPMB) bila database Supabase masih kosong / belum lengkap
  if (!isSnpmbSynced.value && !isSyncingSnpmb.value) {
    runSyncSnpmb({ silent: true })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

watch(activeTab, (tab) => {
  if (tab === 'sync') {
    eligibleStore.fetchSnpmbDbStats()
  }
})

// Helper tampilan inisial, status & nilai
function getInitials(name) {
  const parts = String(name || 'S').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'S'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function hasChoices(item) {
  return Array.isArray(item?.eligible_choices) && item.eligible_choices.length > 0
}

function hasGrades(item) {
  return Array.isArray(item?.eligible_grades) && item.eligible_grades.length > 0
}

function getChoiceStatusMeta(status) {
  if (status === 'approved') {
    return {
      label: 'Disetujui (ACC)',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400'
    }
  }
  if (status === 'rejected') {
    return {
      label: 'Ditolak',
      dot: 'bg-rose-500',
      text: 'text-rose-700 dark:text-rose-400'
    }
  }
  return {
    label: 'Menunggu ACC',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400'
  }
}

function getGradeStatusMeta(status) {
  if (status === 'approved') {
    return {
      label: 'Terkunci',
      fullLabel: 'Terkunci (ACC)',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400'
    }
  }
  if (status === 'rejected') {
    return {
      label: 'Perlu Revisi',
      fullLabel: 'Perlu Revisi',
      dot: 'bg-rose-500',
      text: 'text-rose-700 dark:text-rose-400'
    }
  }
  return {
    label: 'Belum ACC',
    fullLabel: 'Terbuka (Belum ACC)',
    dot: 'bg-slate-400',
    text: 'text-slate-500 dark:text-slate-400'
  }
}

function formatAverage(val) {
  const num = Number(val)
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

function getStudentAverage(item) {
  const grades = item?.eligible_grades || []
  if (grades.length > 0) {
    const sum = grades.reduce((acc, g) => acc + (Number(g.subject_average) || 0), 0)
    return Number((sum / grades.length).toFixed(2))
  }
  return Number(item?.overall_average) || 0
}

// Pencarian siswa aktif untuk di-add ke eligible (Live Search)
let searchDebounceTimer = null

watch(studentSearchQuery, (newVal) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  const q = (newVal || '').trim()
  if (!q) {
    studentSearchResults.value = []
    hasSearched.value = false
    isSearchingStudents.value = false
    return
  }

  isSearchingStudents.value = true
  searchDebounceTimer = setTimeout(() => {
    handleSearchStudents()
  }, 220)
})

async function handleSearchStudents() {
  const q = studentSearchQuery.value.trim()
  if (!q || !isSupabaseConfigured || !supabase) {
    studentSearchResults.value = []
    hasSearched.value = false
    isSearchingStudents.value = false
    return
  }

  isSearchingStudents.value = true
  try {
    const { data } = await supabase
      .from('users')
      .select('id, nama, nis, nisn, kelas, angkatan')
      .eq('role', 'siswa')
      .or(`nama.ilike.%${q}%,nisn.ilike.%${q}%,nis.ilike.%${q}%`)
      .limit(10)

    const eligibleStudentIds = new Set(eligibleStore.allEligibleStudents.map(e => e.student_id))
    studentSearchResults.value = (data || []).map(s => ({
      ...s,
      isAlreadyEligible: eligibleStudentIds.has(s.id)
    }))
    hasSearched.value = true
  } catch (e) {
    console.warn('Error search students:', e)
  } finally {
    isSearchingStudents.value = false
  }
}

function clearStudentSearch() {
  studentSearchQuery.value = ''
  studentSearchResults.value = []
  hasSearched.value = false
}

async function handleAddEligible(student) {
  const confirmed = await confirmModal.value.open({
    title: 'Tambahkan Siswa Eligible',
    message: `Tambahkan "${student.nama}" ke daftar kuota Siswa Eligible SNBP?`,
    confirmText: 'Tambahkan Siswa',
    cancelText: 'Batal',
    type: 'primary'
  })
  if (!confirmed) return

  const res = await eligibleStore.addEligibleStudent(student.id)
  if (res.success) {
    toast.value.show(res.message, 'success')
    student.isAlreadyEligible = true
  } else {
    toast.value.show(res.message, 'error')
  }
}

async function handleRemoveEligible(item) {
  const name = item.users?.nama || 'Siswa'
  const confirmed = await confirmModal.value.open({
    title: 'Hapus Siswa Eligible',
    message: `Hapus "${name}" dari daftar Siswa Eligible? Seluruh data pilihan jurusan dan nilai rapor siswa ini akan ikut terhapus.`,
    confirmText: 'Ya, Hapus Siswa',
    cancelText: 'Batalkan',
    type: 'danger'
  })
  if (!confirmed) return

  const res = await eligibleStore.removeEligibleStudent(item.id)
  if (res.success) {
    toast.value.show(res.message, 'success')
  } else {
    toast.value.show(res.message, 'error')
  }
}

// ACC / Tolak / Batalkan ACC Pilihan Jurusan
async function handleSetChoiceStatus(item, status) {
  const name = item.users?.nama || 'Siswa'
  if (status === 'pending') {
    const confirmed = await confirmModal.value.open({
      title: 'Batalkan Status Pilihan',
      message: `Kembalikan status pilihan jurusan "${name}" ke Menunggu ACC? Siswa dapat mengubah kembali pilihan PTN dan prodi-nya.`,
      confirmText: 'Ya, Batalkan',
      cancelText: 'Batal',
      type: 'warning'
    })
    if (!confirmed) return
  } else if (status === 'rejected') {
    const confirmed = await confirmModal.value.open({
      title: 'Tolak Pilihan Jurusan',
      message: `Tandai pilihan jurusan "${name}" sebagai ditolak agar siswa memperbaiki pilihannya?`,
      confirmText: 'Ya, Tolak',
      cancelText: 'Batal',
      type: 'danger'
    })
    if (!confirmed) return
  }

  updatingIds.value[`choice-${item.id}`] = true
  const res = await eligibleStore.updateChoiceStatus(item.id, status)
  updatingIds.value[`choice-${item.id}`] = false
  toast.value.show(res.message, res.success ? 'success' : 'error')
}

// ACC & Kunci / Buka Kunci / Minta Revisi Nilai Rapor
async function handleSetGradeStatus(item, status) {
  const name = item.users?.nama || 'Siswa'

  if (status === 'pending') {
    const confirmed = await confirmModal.value.open({
      title: 'Batalkan Kunci Nilai Rapor',
      message: `Buka kunci nilai rapor milik "${name}"? Setelah kunci dibatalkan, siswa dapat mengedit dan menyimpan ulang nilai rapornya.`,
      confirmText: 'Ya, Buka Kunci',
      cancelText: 'Batal',
      type: 'warning'
    })
    if (!confirmed) return
  } else if (status === 'approved') {
    const confirmed = await confirmModal.value.open({
      title: 'ACC & Kunci Nilai Rapor',
      message: `Setujui dan kunci nilai rapor milik "${name}"? Siswa tidak akan dapat mengubah nilai selama status terkunci.`,
      confirmText: 'Ya, Kunci Nilai',
      cancelText: 'Batal',
      type: 'success'
    })
    if (!confirmed) return
  } else if (status === 'rejected') {
    const confirmed = await confirmModal.value.open({
      title: 'Minta Perbaikan Nilai',
      message: `Tandai nilai rapor "${name}" perlu diperbaiki? Tabel nilai tetap terbuka agar siswa dapat merevisinya.`,
      confirmText: 'Minta Perbaikan',
      cancelText: 'Batal',
      type: 'danger'
    })
    if (!confirmed) return
  }

  updatingIds.value[`grade-${item.id}`] = true
  const res = await eligibleStore.updateGradeStatus(item.id, status)
  updatingIds.value[`grade-${item.id}`] = false
  toast.value.show(res.message, res.success ? 'success' : 'error')
}

function openGradeDetail(item) {
  selectedEligibleId.value = item.id
  isGradeDetailModalOpen.value = true
}

// CRUD Master Mata Pelajaran
function startEditSubject(s) {
  subjectForm.value = { id: s.id, name: s.name, category: s.category }
  isEditingSubject.value = true
}

function resetSubjectForm() {
  subjectForm.value = { id: null, name: '', category: 'Wajib' }
  isEditingSubject.value = false
  subjectFeedback.value = { type: '', text: '' }
}

async function handleSaveSubject() {
  subjectFeedback.value = { type: '', text: '' }
  if (!subjectForm.value.name.trim()) {
    subjectFeedback.value = { type: 'error', text: 'Nama mata pelajaran wajib diisi!' }
    return
  }

  const res = await eligibleStore.saveSubject(subjectForm.value)
  if (res.success) {
    toast.value.show(res.message, 'success')
    subjectFeedback.value = { type: 'success', text: res.message }
    resetSubjectForm()
  } else {
    toast.value.show(res.message, 'error')
    subjectFeedback.value = { type: 'error', text: res.message }
  }
}

async function handleDeleteSubject(s) {
  const confirmed = await confirmModal.value.open({
    title: 'Hapus Mata Pelajaran',
    message: `Hapus mata pelajaran "${s.name}" dari kurikulum rapor? Tindakan ini tidak dapat dibatalkan.`,
    confirmText: 'Ya, Hapus Mapel',
    cancelText: 'Batal',
    type: 'danger'
  })
  if (!confirmed) return

  const res = await eligibleStore.deleteSubject(s.id)
  toast.value.show(res.message, res.success ? 'success' : 'error')
}

// Sync SNPMB (menggunakan katalog resmi SNPMB yang sama persis dengan Tracer Study)
async function runSyncSnpmb({ silent = false } = {}) {
  if (isSyncingSnpmb.value) return
  isSyncingSnpmb.value = true
  if (!silent) syncFeedback.value = { type: '', text: '' }
  syncProgressText.value = 'Mempersiapkan data PTN & Program Studi SNPMB...'

  try {
    const res = await eligibleStore.syncSnpmbToDatabase((progressMsg) => {
      syncProgressText.value = progressMsg
    })
    if (res.success) {
      syncFeedback.value = { type: 'success', text: res.message }
      if (toast.value) toast.value.show(res.message, 'success')
    } else {
      syncFeedback.value = { type: 'error', text: res.message }
      if (!silent && toast.value) toast.value.show(res.message, 'error')
    }
  } catch (err) {
    syncFeedback.value = { type: 'error', text: 'Gagal sinkronisasi data: ' + err.message }
    if (!silent && toast.value) toast.value.show('Gagal sinkronisasi data SNPMB', 'error')
  } finally {
    isSyncingSnpmb.value = false
    syncProgressText.value = ''
  }
}

async function handleSyncSnpmb() {
  const confirmed = await confirmModal.value.open({
    title: 'Sinkronisasi Data PTN & Prodi SNPMB',
    message: `Sinkronkan seluruh ${eligibleStore.snpmbDbStats.localUniversitiesCount} Perguruan Tinggi Negeri dan ${eligibleStore.snpmbDbStats.localMajorsCount} Program Studi (data yang sama dengan Tracer Study) ke database Supabase?`,
    confirmText: 'Mulai Sinkronisasi',
    cancelText: 'Batal',
    type: 'info'
  })
  if (!confirmed) return

  await runSyncSnpmb({ silent: false })
}

// Kalkulasi Auto-Ranking berdasarkan rata-rata nilai rapor siswa
const filteredRankingList = computed(() => {
  const list = eligibleStore.allEligibleStudents.map(item => {
    const grades = item.eligible_grades || []
    return {
      ...item,
      filteredAverage: getStudentAverage(item),
      filteredGradesCount: grades.length
    }
  })

  return list.sort((a, b) => b.filteredAverage - a.filteredAverage)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col">
    <!-- SIDEBAR KHUSUS MODUL ELIGIBLE -->
    <EligibleSidebar v-model:activeTab="activeTab" />

    <!-- KONTEN UTAMA DENGAN OFFSET SIDEBAR -->
    <div class="flex-1 flex flex-col min-w-0 lg:pl-64 xl:pl-72 pb-16">
      
      <!-- TOP BAR RINGKAS -->
      <header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        <div>
          <h1 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
            Kelola Siswa Eligible SNBP
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Ruang BK SMA Negeri 2 Ngawi &bull; Tahun Ajaran {{ eligibleStore.currentAcademicYear }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <span
            v-if="isSyncingSnpmb"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-[#0369A1] dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 inline-flex items-center gap-1.5"
          >
            <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            <span class="hidden sm:inline">Sinkronisasi SNPMB...</span>
          </span>
          <span class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            {{ eligibleStore.allEligibleStudents.length }} Siswa Eligible
          </span>
        </div>
      </header>

      <main class="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
      
      <!-- TAB 1: DAFTAR SISWA & PENCARIAN ADD -->
      <section v-if="activeTab === 'siswa'" class="space-y-6">
        
        <!-- PENCARIAN SISWA UNTUK ADD ELIGIBLE -->
        <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] space-y-4">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              Tambahkan Siswa ke Kuota Eligible
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Cari nama siswa aktif, NISN, atau NIS dari database sekolah, lalu klik tombol "Add Eligible".
            </p>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
              <input
                type="text"
                v-model="studentSearchQuery"
                @keyup.enter="handleSearchStudents"
                placeholder="Ketik nama siswa, NISN, atau NIS untuk mencari otomatis..."
                class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15"
              />

              <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                <i v-if="isSearchingStudents" class="fa-solid fa-spinner fa-spin text-[#0284C7] text-sm" aria-hidden="true"></i>
                <button
                  v-else-if="studentSearchQuery"
                  type="button"
                  @click="clearStudentSearch"
                  class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer"
                  aria-label="Hapus kata pencarian"
                >
                  <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <button
              type="button"
              @click="handleSearchStudents"
              :disabled="isSearchingStudents || !studentSearchQuery.trim()"
              class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i v-if="isSearchingStudents" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
              <span v-else>Cari</span>
            </button>
          </div>

          <!-- HASIL PENCARIAN OTOMATIS -->
          <div v-if="studentSearchResults.length > 0" class="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div
              v-for="s in studentSearchResults"
              :key="s.id"
              class="px-4 py-3 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-sky-50/40 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 font-bold text-xs flex items-center justify-center shrink-0 border border-sky-200/80 dark:border-slate-700">
                  {{ getInitials(s.nama) }}
                </div>
                <div class="min-w-0">
                  <span class="font-semibold text-sm text-slate-900 dark:text-white block truncate">{{ s.nama }}</span>
                  <div class="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span>Kelas {{ s.kelas || '-' }}</span>
                    <span>&bull;</span>
                    <span class="font-mono">NISN: {{ s.nisn || '-' }}</span>
                    <span>&bull;</span>
                    <span class="font-mono">NIS: {{ s.nis || '-' }}</span>
                  </div>
                </div>
              </div>

              <div class="shrink-0">
                <button
                  v-if="!s.isAlreadyEligible"
                  type="button"
                  @click="handleAddEligible(s)"
                  class="px-3.5 py-1.5 rounded-lg bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <i class="fa-solid fa-plus" aria-hidden="true"></i>
                  <span>Add Eligible</span>
                </button>
                <span v-else class="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Sudah terdaftar
                </span>
              </div>
            </div>
          </div>

          <div
            v-else-if="hasSearched && !isSearchingStudents && studentSearchQuery.trim()"
            class="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300 text-xs flex items-center gap-2"
          >
            <i class="fa-solid fa-circle-info text-amber-600 text-sm" aria-hidden="true"></i>
            <span>Tidak ditemukan siswa aktif dengan nama atau NISN "<strong>{{ studentSearchQuery }}</strong>".</span>
          </div>
        </div>

        <!-- TABEL SELURUH SISWA ELIGIBLE SAAT INI -->
        <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] overflow-hidden">
          <div class="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              Daftar Siswa Eligible Aktif ({{ eligibleStore.allEligibleStudents.length }})
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Siswa dalam daftar ini memiliki akses ke menu pemilihan PTN dan pengisian nilai rapor SNBP.
            </p>
          </div>

          <div v-if="eligibleStore.isLoading && eligibleStore.allEligibleStudents.length === 0" class="p-10 text-center text-sm text-slate-500">
            <i class="fa-solid fa-spinner fa-spin mr-2 text-[#0284C7]" aria-hidden="true"></i>
            Memuat daftar siswa eligible...
          </div>

          <div v-else-if="eligibleStore.allEligibleStudents.length === 0" class="p-10 text-center space-y-1.5">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Belum ada siswa eligible terdaftar</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">Gunakan kolom pencarian di atas untuk menambahkan siswa ke kuota SNBP.</p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-sky-50/70 dark:bg-slate-800/80 text-[#0369A1] dark:text-sky-200 font-semibold text-xs border-b border-sky-100 dark:border-slate-700">
                <tr>
                  <th class="px-5 py-3.5">Nama Siswa</th>
                  <th class="px-4 py-3.5">Kelas / NISN</th>
                  <th class="px-4 py-3.5">Status Pilihan</th>
                  <th class="px-4 py-3.5">Status Nilai</th>
                  <th class="px-4 py-3.5 text-right">Rata-Rata</th>
                  <th class="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="item in eligibleStore.allEligibleStudents" :key="item.id" class="hover:bg-sky-50/35 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="px-5 py-3.5">
                    <div class="flex items-center gap-3">
                      <img
                        v-if="item.users?.foto_url"
                        :src="item.users.foto_url"
                        :alt="item.users?.nama"
                        width="34"
                        height="34"
                        class="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        onerror="this.style.display='none'"
                      />
                      <div
                        v-else
                        class="w-8 h-8 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 border border-sky-200/80 dark:border-slate-700 font-bold text-xs flex items-center justify-center shrink-0"
                      >
                        {{ getInitials(item.users?.nama) }}
                      </div>
                      <span class="font-semibold text-slate-900 dark:text-white">{{ item.users?.nama }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                    <div>Kelas {{ item.users?.kelas || '-' }}</div>
                    <div class="font-mono text-slate-400">NISN: {{ item.users?.nisn || '-' }}</div>
                  </td>
                  <td class="px-4 py-3.5 text-xs">
                    <span class="inline-flex items-center gap-1.5 font-medium" :class="hasChoices(item) ? getChoiceStatusMeta(item.choice_status).text : 'text-slate-400'">
                      <span class="w-1.5 h-1.5 rounded-full" :class="hasChoices(item) ? getChoiceStatusMeta(item.choice_status).dot : 'bg-slate-300 dark:bg-slate-600'" aria-hidden="true"></span>
                      <span>{{ hasChoices(item) ? getChoiceStatusMeta(item.choice_status).label : 'Belum memilih' }}</span>
                    </span>
                  </td>
                  <td class="px-4 py-3.5 text-xs">
                    <span class="inline-flex items-center gap-1.5 font-medium" :class="hasGrades(item) || item.grade_status === 'approved' ? getGradeStatusMeta(item.grade_status).text : 'text-slate-400'">
                      <span class="w-1.5 h-1.5 rounded-full" :class="hasGrades(item) || item.grade_status === 'approved' ? getGradeStatusMeta(item.grade_status).dot : 'bg-slate-300 dark:bg-slate-600'" aria-hidden="true"></span>
                      <span>{{ hasGrades(item) || item.grade_status === 'approved' ? getGradeStatusMeta(item.grade_status).label : 'Belum diisi' }}</span>
                    </span>
                  </td>
                  <td class="px-4 py-3.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {{ hasGrades(item) || Number(item.overall_average) > 0 ? formatAverage(getStudentAverage(item)) : '-' }}
                  </td>
                  <td class="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      @click="handleRemoveEligible(item)"
                      class="px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold transition-colors cursor-pointer"
                      title="Keluarkan dari daftar eligible"
                    >
                      <i class="fa-solid fa-trash-can mr-1" aria-hidden="true"></i>
                      <span>Hapus</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </section>

      <!-- TAB 2: VALIDASI / ACC GANDA (PILIHAN & NILAI) -->
      <section v-if="activeTab === 'validasi'" class="space-y-5">
        <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] overflow-hidden">
          
          <!-- Baris 1: Judul Panel -->
          <div class="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Verifikasi Pilihan Jurusan &amp; Kunci Nilai Rapor
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Setujui pilihan prodi siswa agar tampil di daftar publik, atau kunci dan buka kembali nilai rapor siswa kapan saja.
            </p>
          </div>

          <!-- Baris 2: Pencarian & Ringkasan Hasil (konsisten dengan DataAlumniView) -->
          <div class="px-5 sm:px-6 py-3.5 bg-sky-50/35 dark:bg-slate-900/60 border-b border-sky-100/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="relative w-full sm:max-w-md">
              <label for="validasi-search" class="sr-only">Cari siswa eligible</label>
              <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true"></i>
              <input
                id="validasi-search"
                type="text"
                v-model="validasiSearch"
                placeholder="Cari nama siswa, kelas, PTN, atau prodi..."
                class="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15"
              />
              <button
                v-if="validasiSearch"
                type="button"
                @click="validasiSearch = ''"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Bersihkan pencarian"
              >
                <i class="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
              </button>
            </div>

            <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">
              Menampilkan <strong class="text-slate-800 dark:text-slate-200 font-semibold">{{ filteredValidasiList.length }}</strong> dari {{ eligibleStore.allEligibleStudents.length }} siswa
            </div>
          </div>

          <!-- Baris 3: Segmented Filter Tabs dengan Angka Riil (satu-satunya kontrol filter, tanpa KPI duplikat) -->
          <div class="px-5 sm:px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 overflow-x-auto flex items-center gap-2 scrollbar-none">
            <button
              v-for="tab in validasiFilterTabs"
              :key="tab.key"
              type="button"
              @click="validasiFilter = tab.key"
              class="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 shrink-0 border cursor-pointer"
              :class="validasiFilter === tab.key
                ? 'bg-[#0369A1] text-white border-[#0369A1] font-semibold'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-sky-50/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'"
            >
              <span>{{ tab.label }}</span>
              <span
                class="px-1.5 py-0.5 rounded-md text-[11px] font-semibold tabular-nums"
                :class="validasiFilter === tab.key
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'"
              >
                {{ tab.count }}
              </span>
            </button>
          </div>

          <!-- STATE LOADING -->
          <div v-if="eligibleStore.isLoading && eligibleStore.allEligibleStudents.length === 0" class="p-10 text-center text-sm text-slate-500">
            <i class="fa-solid fa-spinner fa-spin mr-2 text-[#0284C7]" aria-hidden="true"></i>
            Memuat data validasi siswa eligible...
          </div>

          <!-- STATE KOSONG / FILTER NIHIL -->
          <div v-else-if="filteredValidasiList.length === 0" class="p-10 text-center space-y-2.5">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {{ eligibleStore.allEligibleStudents.length === 0 ? 'Belum ada siswa eligible terdaftar.' : 'Tidak ada siswa pada kategori ini.' }}
            </p>
            <button
              v-if="validasiSearch || validasiFilter !== 'all'"
              type="button"
              @click="validasiSearch = ''; validasiFilter = 'all'"
              class="px-3.5 py-1.5 rounded-lg bg-sky-50 hover:bg-[#0369A1] text-[#0369A1] hover:text-white border border-sky-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          </div>

          <!-- TABEL DESKTOP (>= lg) -->
          <div v-else>
            <div class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="bg-sky-50/70 dark:bg-slate-800/80 text-[#0369A1] dark:text-sky-200 font-semibold text-xs border-b border-sky-100 dark:border-slate-700">
                  <tr>
                    <th class="px-5 py-3.5 w-[23%]">Siswa</th>
                    <th class="px-4 py-3.5 w-[33%]">Pilihan PTN &amp; Prodi</th>
                    <th class="px-4 py-3.5 w-[21%]">Verifikasi Pilihan</th>
                    <th class="px-5 py-3.5 w-[23%]">Nilai Rapor &amp; Kunci</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr
                    v-for="item in filteredValidasiList"
                    :key="item.id"
                    class="align-middle hover:bg-sky-50/35 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <!-- KOLOM 1: SISWA -->
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-3">
                        <img
                          v-if="item.users?.foto_url"
                          :src="item.users.foto_url"
                          :alt="item.users?.nama"
                          width="36"
                          height="36"
                          class="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          onerror="this.style.display='none'"
                        />
                        <div
                          v-else
                          class="w-9 h-9 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 border border-sky-200/80 dark:border-slate-700 font-bold text-xs flex items-center justify-center shrink-0"
                        >
                          {{ getInitials(item.users?.nama) }}
                        </div>
                        <div class="min-w-0">
                          <div class="font-semibold text-slate-900 dark:text-white leading-snug truncate">
                            {{ item.users?.nama }}
                          </div>
                          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Kelas {{ item.users?.kelas || '-' }}<template v-if="item.users?.nisn"> &bull; <span class="font-mono">{{ item.users.nisn }}</span></template>
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- KOLOM 2: PILIHAN PTN & PRODI (BERSIH TANPA KOTAK BERSARANG) -->
                    <td class="px-4 py-3.5">
                      <div v-if="hasChoices(item)" class="space-y-2">
                        <div
                          v-for="c in item.eligible_choices"
                          :key="c.id"
                          class="flex items-start gap-2.5"
                        >
                          <span
                            class="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                            :class="c.priority === 1
                              ? 'bg-sky-100 text-[#0369A1] dark:bg-sky-950 dark:text-sky-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'"
                          >
                            P{{ c.priority }}
                          </span>
                          <img
                            v-if="getInstitutionLogo(c.universities?.name)"
                            :src="getInstitutionLogo(c.universities?.name)"
                            :alt="c.universities?.name || 'Logo PTN'"
                            width="20"
                            height="20"
                            class="w-5 h-5 rounded object-contain bg-white p-0.5 border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5"
                            onerror="this.style.display='none'"
                          />
                          <div class="min-w-0 leading-snug">
                            <div class="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {{ c.majors?.degree ? `${c.majors.degree} ` : '' }}{{ c.majors?.name || '-' }}
                            </div>
                            <div class="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {{ c.universities?.name || '-' }}
                            </div>
                          </div>
                        </div>
                      </div>
                      <span v-else class="text-xs text-slate-400 dark:text-slate-500 italic">
                        Belum memilih PTN &amp; prodi
                      </span>
                    </td>

                    <!-- KOLOM 3: VERIFIKASI PILIHAN (TENANG BILA BELUM MEMILIH, JELAS BILA ADA PILIHAN) -->
                    <td class="px-4 py-3.5">
                      <template v-if="hasChoices(item)">
                        <div class="space-y-2">
                          <div class="inline-flex items-center gap-1.5 text-xs font-semibold" :class="getChoiceStatusMeta(item.choice_status).text">
                            <span class="w-1.5 h-1.5 rounded-full" :class="getChoiceStatusMeta(item.choice_status).dot" aria-hidden="true"></span>
                            <span>{{ getChoiceStatusMeta(item.choice_status).label }}</span>
                          </div>

                          <div class="flex items-center gap-1.5">
                            <button
                              v-if="item.choice_status === 'approved'"
                              type="button"
                              @click="handleSetChoiceStatus(item, 'pending')"
                              :disabled="updatingIds[`choice-${item.id}`]"
                              class="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-600 dark:hover:text-white border border-amber-200 dark:border-amber-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Batalkan ACC
                            </button>

                            <template v-else>
                              <button
                                type="button"
                                @click="handleSetChoiceStatus(item, 'approved')"
                                :disabled="updatingIds[`choice-${item.id}`]"
                                class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                              >
                                ACC
                              </button>

                              <button
                                v-if="item.choice_status !== 'rejected'"
                                type="button"
                                @click="handleSetChoiceStatus(item, 'rejected')"
                                :disabled="updatingIds[`choice-${item.id}`]"
                                class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white border border-rose-200 dark:border-rose-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Tolak
                              </button>

                              <button
                                v-else
                                type="button"
                                @click="handleSetChoiceStatus(item, 'pending')"
                                :disabled="updatingIds[`choice-${item.id}`]"
                                class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Reset
                              </button>
                            </template>
                          </div>
                        </div>
                      </template>
                      <span v-else class="text-xs text-slate-400 dark:text-slate-500">
                        Menunggu siswa
                      </span>
                    </td>

                    <!-- KOLOM 4: NILAI RAPOR & KUNCI / BUKA KUNCI -->
                    <td class="px-5 py-3.5">
                      <div class="space-y-2">
                        <div class="flex items-center gap-2 text-xs">
                          <span class="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {{ hasGrades(item) || Number(item.overall_average) > 0 ? formatAverage(getStudentAverage(item)) : 'Belum diisi' }}
                          </span>
                          <span class="text-slate-300 dark:text-slate-700">&bull;</span>
                          <span class="inline-flex items-center gap-1.5 font-semibold" :class="getGradeStatusMeta(item.grade_status).text">
                            <span class="w-1.5 h-1.5 rounded-full" :class="getGradeStatusMeta(item.grade_status).dot" aria-hidden="true"></span>
                            <span>{{ getGradeStatusMeta(item.grade_status).label }}</span>
                          </span>
                        </div>

                        <div class="flex items-center gap-1.5">
                          <button
                            type="button"
                            @click="openGradeDetail(item)"
                            class="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-[#0369A1] text-[#0369A1] hover:text-white dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-[#0369A1] dark:hover:text-white border border-sky-200 dark:border-sky-800 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Cek Nilai
                          </button>

                          <!-- BUKA KUNCI BILA SUDAH TERKUNCI -->
                          <button
                            v-if="item.grade_status === 'approved'"
                            type="button"
                            @click="handleSetGradeStatus(item, 'pending')"
                            :disabled="updatingIds[`grade-${item.id}`]"
                            class="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-600 dark:hover:text-white border border-amber-200 dark:border-amber-800 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Batalkan kunci nilai agar siswa dapat mengedit ulang"
                          >
                            <i class="fa-solid fa-lock-open text-[10px]" aria-hidden="true"></i>
                            <span>Buka Kunci</span>
                          </button>

                          <!-- KUNCI NILAI BILA SISWA SUDAH MENGINPUT NILAI -->
                          <button
                            v-else-if="hasGrades(item)"
                            type="button"
                            @click="handleSetGradeStatus(item, 'approved')"
                            :disabled="updatingIds[`grade-${item.id}`]"
                            class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <i class="fa-solid fa-lock text-[10px]" aria-hidden="true"></i>
                            <span>Kunci Nilai</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- TAMPILAN MOBILE & TABLET (< lg) -->
            <div class="lg:hidden divide-y divide-slate-200 dark:divide-slate-800">
              <div
                v-for="item in filteredValidasiList"
                :key="item.id"
                class="p-4 sm:p-5 space-y-3.5"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 border border-sky-200/80 dark:border-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {{ getInitials(item.users?.nama) }}
                    </div>
                    <div class="min-w-0">
                      <div class="font-semibold text-sm text-slate-900 dark:text-white truncate">{{ item.users?.nama }}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-400">
                        Kelas {{ item.users?.kelas || '-' }} &bull; NISN {{ item.users?.nisn || '-' }}
                      </div>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="text-[11px] text-slate-400">Rata-rata</div>
                    <div class="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                      {{ hasGrades(item) || Number(item.overall_average) > 0 ? formatAverage(getStudentAverage(item)) : '-' }}
                    </div>
                  </div>
                </div>

                <!-- Pilihan -->
                <div class="space-y-1.5">
                  <div v-if="hasChoices(item)" class="space-y-1.5">
                    <div v-for="c in item.eligible_choices" :key="c.id" class="flex items-start gap-2 text-xs">
                      <span
                        class="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                        :class="c.priority === 1 ? 'bg-sky-100 text-[#0369A1]' : 'bg-slate-100 text-slate-600'"
                      >
                        P{{ c.priority }}
                      </span>
                      <div class="min-w-0 leading-snug">
                        <div class="font-semibold text-slate-900 dark:text-white">
                          {{ c.majors?.degree ? `${c.majors.degree} ` : '' }}{{ c.majors?.name }}
                        </div>
                        <div class="text-slate-500">{{ c.universities?.name }}</div>
                      </div>
                    </div>
                  </div>
                  <p v-else class="text-xs text-slate-400 italic">Belum memilih PTN &amp; prodi</p>
                </div>

                <!-- Aksi Mobile -->
                <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <template v-if="hasChoices(item)">
                      <button
                        v-if="item.choice_status === 'approved'"
                        type="button"
                        @click="handleSetChoiceStatus(item, 'pending')"
                        class="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold cursor-pointer"
                      >
                        Batalkan ACC Pilihan
                      </button>
                      <template v-else>
                        <button
                          type="button"
                          @click="handleSetChoiceStatus(item, 'approved')"
                          class="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-pointer"
                        >
                          ACC Pilihan
                        </button>
                        <button
                          v-if="item.choice_status !== 'rejected'"
                          type="button"
                          @click="handleSetChoiceStatus(item, 'rejected')"
                          class="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer"
                        >
                          Tolak
                        </button>
                      </template>
                    </template>
                  </div>

                  <div class="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      @click="openGradeDetail(item)"
                      class="px-3 py-1.5 rounded-lg bg-sky-50 text-[#0369A1] border border-sky-200 text-xs font-semibold cursor-pointer"
                    >
                      Cek Nilai
                    </button>
                    <button
                      v-if="item.grade_status === 'approved'"
                      type="button"
                      @click="handleSetGradeStatus(item, 'pending')"
                      class="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold cursor-pointer"
                    >
                      Buka Kunci
                    </button>
                    <button
                      v-else-if="hasGrades(item)"
                      type="button"
                      @click="handleSetGradeStatus(item, 'approved')"
                      class="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-pointer"
                    >
                      Kunci Nilai
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 3: MATRIKS NILAI & AUTO-RANKING -->
      <section v-if="activeTab === 'ranking'" class="space-y-6">
        <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] overflow-hidden">
          <div class="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Matriks Nilai &amp; Auto-Ranking Siswa Eligible
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Peringkat otomatis terhitung dari rata-rata nilai rapor seluruh mata pelajaran (2 angka di belakang koma).
            </p>
          </div>

          <div v-if="filteredRankingList.length === 0" class="p-10 text-center text-sm text-slate-500">
            Belum ada data siswa eligible untuk diperingkatkan.
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-sky-50/70 dark:bg-slate-800/80 text-[#0369A1] dark:text-sky-200 font-semibold text-xs border-b border-sky-100 dark:border-slate-700">
                <tr>
                  <th class="px-4 py-3.5 text-center w-16">Rank</th>
                  <th class="px-4 py-3.5">Siswa</th>
                  <th class="px-4 py-3.5">Pilihan Prodi (SNBP)</th>
                  <th class="px-4 py-3.5">Status Nilai</th>
                  <th class="px-4 py-3.5 text-right">Rata-Rata</th>
                  <th class="px-5 py-3.5 text-right">Rincian</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="(item, idx) in filteredRankingList" :key="item.id" class="hover:bg-sky-50/35 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="px-4 py-3.5 text-center font-mono font-bold text-xs">
                    <span
                      class="w-7 h-7 rounded-lg inline-flex items-center justify-center"
                      :class="idx === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : (idx === 1 ? 'bg-slate-200 text-slate-800' : (idx === 2 ? 'bg-orange-100 text-orange-900' : 'text-slate-500'))"
                    >
                      #{{ idx + 1 }}
                    </span>
                  </td>

                  <td class="px-4 py-3.5">
                    <div class="font-semibold text-slate-900 dark:text-white">{{ item.users?.nama }}</div>
                    <div class="text-xs text-slate-500">Kelas {{ item.users?.kelas || '-' }}</div>
                  </td>

                  <td class="px-4 py-3.5 text-xs space-y-1">
                    <div v-for="c in (item.eligible_choices || [])" :key="c.id" class="flex items-center gap-1.5">
                      <span class="font-bold text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-[#0369A1] dark:bg-sky-950 dark:text-sky-300">P{{ c.priority }}</span>
                      <span class="font-medium text-slate-800 dark:text-slate-200">{{ c.majors?.degree ? `${c.majors.degree} ` : '' }}{{ c.majors?.name }} ({{ c.universities?.name }})</span>
                    </div>
                    <span v-if="!hasChoices(item)" class="text-slate-400 italic">Belum memilih</span>
                  </td>

                  <td class="px-4 py-3.5 text-xs">
                    <span class="inline-flex items-center gap-1.5 font-semibold" :class="getGradeStatusMeta(item.grade_status).text">
                      <span class="w-1.5 h-1.5 rounded-full" :class="getGradeStatusMeta(item.grade_status).dot" aria-hidden="true"></span>
                      <span>{{ getGradeStatusMeta(item.grade_status).label }}</span>
                    </span>
                  </td>

                  <td class="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {{ formatAverage(item.filteredAverage) }}
                  </td>

                  <td class="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      @click="openGradeDetail(item)"
                      class="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-[#0369A1] text-[#0369A1] hover:text-white dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 4: MASTER MATA PELAJARAN -->
      <section v-if="activeTab === 'mapel'" class="space-y-6">
        <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] space-y-4">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              Kelola Master Mata Pelajaran
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daftar mata pelajaran yang muncul pada dropdown pengisian nilai rapor siswa eligible.
            </p>
          </div>

          <div v-if="subjectFeedback.text" class="p-3.5 rounded-xl text-xs font-semibold" :class="subjectFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'">
            {{ subjectFeedback.text }}
          </div>

          <div class="flex flex-col sm:flex-row items-end gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="flex-1 w-full">
              <label for="subject-name-input" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Mata Pelajaran
              </label>
              <input
                id="subject-name-input"
                type="text"
                v-model="subjectForm.name"
                @keyup.enter="handleSaveSubject"
                placeholder="Contoh: Matematika Tingkat Lanjut"
                class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 text-sm focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15"
              />
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="handleSaveSubject"
                class="px-4 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {{ isEditingSubject ? 'Simpan Perubahan' : 'Tambah Mapel' }}
              </button>
              <button
                v-if="isEditingSubject"
                type="button"
                @click="resetSubjectForm"
                class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>

          <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-sm">
              <thead class="bg-sky-50/70 dark:bg-slate-800/80 text-[#0369A1] dark:text-sky-200 text-xs font-semibold border-b border-sky-100 dark:border-slate-700">
                <tr>
                  <th class="p-3 w-12 text-center">No</th>
                  <th class="p-3">Nama Mata Pelajaran</th>
                  <th class="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="(s, idx) in eligibleStore.masterSubjects" :key="s.id" class="hover:bg-sky-50/35 dark:hover:bg-slate-800/40">
                  <td class="p-3 text-center text-xs font-mono text-slate-400">
                    {{ idx + 1 }}
                  </td>
                  <td class="p-3 font-medium text-slate-900 dark:text-white">
                    {{ s.name }}
                  </td>
                  <td class="p-3 text-right space-x-3">
                    <button
                      type="button"
                      @click="startEditSubject(s)"
                      class="text-xs text-[#0369A1] dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      @click="handleDeleteSubject(s)"
                      class="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 5: SYNC DATA SNPMB -->
      <section v-if="activeTab === 'sync'" class="space-y-6">
        <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] space-y-4">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              Sinkronisasi Data Perguruan Tinggi &amp; Program Studi (SNPMB)
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Perbarui daftar Perguruan Tinggi Negeri dan program studi resmi SNBP/SNBT yang sama dengan Tracer Study.
            </p>
          </div>

          <div v-if="syncFeedback.text" class="p-4 rounded-xl text-sm font-semibold flex items-center gap-2" :class="syncFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'">
            <i :class="syncFeedback.type === 'success' ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-solid fa-triangle-exclamation text-rose-600'" aria-hidden="true"></i>
            <span>{{ syncFeedback.text }}</span>
          </div>

          <div class="p-5 sm:p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="space-y-1 text-center sm:text-left">
              <div class="font-semibold text-slate-900 dark:text-white flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <i class="fa-solid fa-database text-[#0369A1]" aria-hidden="true"></i>
                <span>
                  Tersimpan di Database: {{ eligibleStore.snpmbDbStats.universitiesCount }} PTN &amp; {{ eligibleStore.snpmbDbStats.majorsCount }} Prodi
                </span>
                <span
                  class="inline-flex items-center gap-1.5 text-xs font-semibold"
                  :class="isSnpmbSynced ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="isSnpmbSynced ? 'bg-emerald-500' : 'bg-amber-500'" aria-hidden="true"></span>
                  <span>{{ isSnpmbSynced ? 'Tersinkron' : 'Belum Lengkap' }}</span>
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Katalog Tracer Study siap sinkron: <strong>{{ eligibleStore.snpmbDbStats.localUniversitiesCount }} PTN</strong> &amp; <strong>{{ eligibleStore.snpmbDbStats.localMajorsCount }} Program Studi</strong> resmi SNPMB.
              </p>
              <p v-if="syncProgressText" class="text-xs font-semibold text-[#0369A1] dark:text-sky-300 pt-1">
                <i class="fa-solid fa-spinner fa-spin mr-1" aria-hidden="true"></i>
                {{ syncProgressText }}
              </p>
            </div>

            <button
              type="button"
              @click="handleSyncSnpmb"
              :disabled="isSyncingSnpmb"
              class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-sm transition-colors flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i v-if="isSyncingSnpmb" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
              <i v-else class="fa-solid fa-rotate" aria-hidden="true"></i>
              <span>{{ isSyncingSnpmb ? 'Sedang Sinkronisasi...' : 'Sync Data SNPMB Sekarang' }}</span>
            </button>
          </div>
        </div>
      </section>

    </main>

    <!-- MODAL RINCIAN NILAI SISWA (DENGAN FITUR KUNCI & BATALKAN KUNCI NILAI) -->
    <div
      v-if="isGradeDetailModalOpen && selectedEligibleDetail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grade-modal-title"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
      @click.self="isGradeDetailModalOpen = false"
    >
      <div class="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <!-- Header Modal -->
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 border border-sky-200/80 dark:border-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
              {{ getInitials(selectedEligibleDetail.users?.nama) }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2.5 flex-wrap">
                <h3 id="grade-modal-title" class="font-bold text-base text-slate-900 dark:text-white truncate">
                  {{ selectedEligibleDetail.users?.nama }}
                </h3>
                <span class="inline-flex items-center gap-1.5 text-xs font-semibold" :class="getGradeStatusMeta(selectedEligibleDetail.grade_status).text">
                  <span class="w-1.5 h-1.5 rounded-full" :class="getGradeStatusMeta(selectedEligibleDetail.grade_status).dot" aria-hidden="true"></span>
                  <span>{{ getGradeStatusMeta(selectedEligibleDetail.grade_status).fullLabel }}</span>
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kelas {{ selectedEligibleDetail.users?.kelas || '-' }} &bull; NISN: {{ selectedEligibleDetail.users?.nisn || '-' }}
              </p>
            </div>
          </div>

          <button
            type="button"
            @click="isGradeDetailModalOpen = false"
            class="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Tutup modal rincian nilai"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Isi Modal -->
        <div class="p-6 overflow-y-auto flex-1">
          <div
            v-if="!hasGrades(selectedEligibleDetail)"
            class="p-8 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center space-y-1.5"
          >
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Belum ada data nilai rapor</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Siswa ini belum menginput dan menyimpan nilai rapor semester 1 s.d. 5.
            </p>
          </div>

          <div v-else class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-xs">
              <thead class="bg-sky-50/70 dark:bg-slate-800 font-semibold text-[#0369A1] dark:text-sky-200 border-b border-sky-100 dark:border-slate-700">
                <tr>
                  <th class="p-3">Mata Pelajaran</th>
                  <th class="p-2.5 text-center">S1</th>
                  <th class="p-2.5 text-center">S2</th>
                  <th class="p-2.5 text-center">S3</th>
                  <th class="p-2.5 text-center">S4</th>
                  <th class="p-2.5 text-center">S5</th>
                  <th class="p-2.5 text-right">Rata-Rata</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="g in selectedEligibleDetail.eligible_grades" :key="g.id" class="hover:bg-sky-50/35 dark:hover:bg-slate-800/40">
                  <td class="p-3 font-medium text-slate-800 dark:text-slate-200">{{ g.subjects?.name }}</td>
                  <td class="p-2.5 text-center font-mono tabular-nums">{{ Math.trunc(Number(g.sem_1) || 0) }}</td>
                  <td class="p-2.5 text-center font-mono tabular-nums">{{ Math.trunc(Number(g.sem_2) || 0) }}</td>
                  <td class="p-2.5 text-center font-mono tabular-nums">{{ Math.trunc(Number(g.sem_3) || 0) }}</td>
                  <td class="p-2.5 text-center font-mono tabular-nums">{{ Math.trunc(Number(g.sem_4) || 0) }}</td>
                  <td class="p-2.5 text-center font-mono tabular-nums">{{ Math.trunc(Number(g.sem_5) || 0) }}</td>
                  <td class="p-2.5 text-right font-mono font-bold text-[#0369A1] dark:text-sky-300 tabular-nums">
                    {{ Number(g.subject_average || 0).toFixed(2) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer Modal: Aksi Kunci / Batalkan Kunci -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="text-xs font-medium text-slate-600 dark:text-slate-300">
            Rata-Rata Kumulatif:
            <strong class="text-sm font-mono font-bold text-slate-900 dark:text-white ml-1 tabular-nums">
              {{ hasGrades(selectedEligibleDetail) || Number(selectedEligibleDetail.overall_average) > 0 ? formatAverage(getStudentAverage(selectedEligibleDetail)) : '-' }}
            </strong>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2">
            <!-- Jika sudah terkunci -> tombol Batalkan Kunci Nilai -->
            <button
              v-if="selectedEligibleDetail.grade_status === 'approved'"
              type="button"
              @click="handleSetGradeStatus(selectedEligibleDetail, 'pending')"
              :disabled="updatingIds[`grade-${selectedEligibleDetail.id}`]"
              class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <i class="fa-solid fa-lock-open" aria-hidden="true"></i>
              <span>Batalkan Kunci Nilai</span>
            </button>

            <!-- Jika belum terkunci -> tombol Minta Revisi & ACC & Kunci Nilai -->
            <template v-else-if="hasGrades(selectedEligibleDetail)">
              <button
                v-if="selectedEligibleDetail.grade_status !== 'rejected'"
                type="button"
                @click="handleSetGradeStatus(selectedEligibleDetail, 'rejected')"
                :disabled="updatingIds[`grade-${selectedEligibleDetail.id}`]"
                class="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Minta Revisi
              </button>
              <button
                type="button"
                @click="handleSetGradeStatus(selectedEligibleDetail, 'approved')"
                :disabled="updatingIds[`grade-${selectedEligibleDetail.id}`]"
                class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <i class="fa-solid fa-lock" aria-hidden="true"></i>
                <span>ACC &amp; Kunci Nilai</span>
              </button>
            </template>

            <button
              type="button"
              @click="isGradeDetailModalOpen = false"
              class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>

    </div>

    <!-- Custom UI Confirm Modal & Toast -->
    <ConfirmModal ref="confirmModal" />
    <Toast ref="toast" />
  </div>
</template>
