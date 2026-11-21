<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEligibleStore } from '@/stores/eligible'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getInstitutionLogo } from '@/lib/campusList'
import PublicNavbar from '@/components/PublicNavbar.vue'
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

// Tab 2: Filter, Pencarian & Mode Tampilan Panel Validasi
const validasiSearch = ref('')
const validasiFilter = ref('all') // 'all' | 'has_choice' | 'pending' | 'choice_approved' | 'grade_locked'
const validasiViewMode = ref('cards') // 'cards' | 'table'
const updatingIds = ref({})

// Tab 3: Filter & Pengurutan Matriks Auto-Ranking
const rankingSearch = ref('')
const rankingClassFilter = ref('ALL')
const rankingCampusFilter = ref('ALL') // 'ALL' | 'NONE' | university_id
const rankingSubjectFilter = ref('ALL') // 'ALL' | subject_id
const rankingSortBy = ref('score_desc') // 'score_desc' | 'score_asc' | 'class_asc' | 'name_asc' | 'campus_asc'

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

// Hitungan riil untuk tab filter validasi
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

  // Prioritaskan siswa yang sudah mengisi pilihan / nilai di bagian atas
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

  // Auto-sinkronisasi 23 mata pelajaran standar SMADA bila database masih memuat daftar mapel lama
  const hasLegacySubjects = eligibleStore.masterSubjects.some(s =>
    ['Pendidikan Agama dan Budi Pekerti', 'Matematika (Umum)', 'Antropologi', 'Bahasa Asing Lainnya (Jepang/Mandarin/Jerman)'].includes(s.name)
  ) || eligibleStore.masterSubjects.length === 0
  if (hasLegacySubjects) {
    eligibleStore.syncDefaultSubjects()
  }

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

// Helper tampilan inisial (bersihkan tanda baca seperti apostrof agar 'AZIZAH -> A, bukan ')
function getInitials(name) {
  const parts = String(name || 'S')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
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
      text: 'text-emerald-700 dark:text-emerald-400',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
    }
  }
  if (status === 'rejected') {
    return {
      label: 'Ditolak',
      dot: 'bg-rose-500',
      text: 'text-rose-700 dark:text-rose-400',
      badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
    }
  }
  return {
    label: 'Menunggu ACC',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
  }
}

function getGradeStatusMeta(status) {
  if (status === 'approved') {
    return {
      label: 'Terkunci',
      fullLabel: 'Terkunci (ACC)',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
    }
  }
  if (status === 'rejected') {
    return {
      label: 'Perlu Revisi',
      fullLabel: 'Perlu Revisi',
      dot: 'bg-rose-500',
      text: 'text-rose-700 dark:text-rose-400',
      badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
    }
  }
  return {
    label: 'Belum ACC',
    fullLabel: 'Terbuka (Belum ACC)',
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }
}

function formatAverage(val) {
  const num = Number(val)
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

function computeSubjectAverage(g) {
  if (!g) return null
  const filled = [g.sem_1, g.sem_2, g.sem_3, g.sem_4, g.sem_5]
    .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)))
    .map(Number)
  if (filled.length === 0) return null
  return Number((filled.reduce((a, b) => a + b, 0) / filled.length).toFixed(2))
}

function formatSemScore(val) {
  if (val === null || val === undefined || val === '' || isNaN(Number(val))) return '-'
  return String(Math.trunc(Number(val)))
}

function getModalSemesterAverage(grades, sNum) {
  if (!Array.isArray(grades) || grades.length === 0) return '-'
  const filled = grades
    .map(g => g[`sem_${sNum}`])
    .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)))
    .map(Number)
  if (filled.length === 0) return '-'
  return (filled.reduce((a, b) => a + b, 0) / filled.length).toFixed(2)
}

function getStudentAverage(item) {
  const grades = item?.eligible_grades || []
  if (grades.length > 0) {
    const subjectAverages = grades
      .map(computeSubjectAverage)
      .filter(avg => avg !== null)
    if (subjectAverages.length > 0) {
      const sum = subjectAverages.reduce((acc, avg) => acc + avg, 0)
      return Number((sum / subjectAverages.length).toFixed(2))
    }
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

async function handleResetDefaultSubjects() {
  const confirmed = await confirmModal.value.open({
    title: 'Sinkronkan 23 Mapel Standar SMADA',
    message: 'Perbarui daftar master mata pelajaran ke 23 mata pelajaran resmi SMA Negeri 2 Ngawi? Nilai rapor siswa pada mapel yang sama akan tetap aman.',
    confirmText: 'Ya, Perbarui Mapel',
    cancelText: 'Batal',
    type: 'info'
  })
  if (!confirmed) return

  const res = await eligibleStore.syncDefaultSubjects()
  toast.value.show(res.message, res.success ? 'success' : 'error')
}

// Sync SNPMB (katalog resmi SNPMB yang sama persis dengan Tracer Study)
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

// Daftar kelas unik (diurutkan natural: XI 1, XI 2, ..., XI 11)
const rankingAvailableClasses = computed(() => {
  const set = new Set()
  eligibleStore.allEligibleStudents.forEach(s => {
    const k = String(s.users?.kelas || '').trim()
    if (k) set.add(k)
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }))
})

// Daftar PTN unik yang dipilih siswa eligible beserta jumlah peminatnya
const rankingAvailableCampuses = computed(() => {
  const map = new Map()
  eligibleStore.allEligibleStudents.forEach(s => {
    const seenForStudent = new Set()
    ;(s.eligible_choices || []).forEach(c => {
      const id = String(c.university_id || '')
      const name = c.universities?.name
      if (!id || !name || seenForStudent.has(id)) return
      seenForStudent.add(id)
      const prev = map.get(id)
      map.set(id, { id, name, count: (prev?.count || 0) + 1 })
    })
  })
  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id'))
})

// Peta deteksi bentrok lintas pilihan (PTN + Prodi yang dipilih oleh >= 2 siswa eligible)
const choiceClashMap = computed(() => {
  const counts = new Map()
  eligibleStore.allEligibleStudents.forEach(s => {
    const seen = new Set()
    ;(s.eligible_choices || []).forEach(c => {
      const key = `${c.university_id}::${c.major_id}`
      if (!seen.has(key)) {
        seen.add(key)
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    })
  })
  return counts
})

function getChoiceClashCount(choice) {
  return choiceClashMap.value.get(`${choice.university_id}::${choice.major_id}`) || 0
}

const selectedRankingSubjectObj = computed(() => {
  if (rankingSubjectFilter.value === 'ALL') return null
  return eligibleStore.masterSubjects.find(s => String(s.id) === String(rankingSubjectFilter.value)) || null
})

const hasActiveRankingFilters = computed(() => {
  return (
    rankingSearch.value.trim() !== '' ||
    rankingClassFilter.value !== 'ALL' ||
    rankingCampusFilter.value !== 'ALL' ||
    rankingSubjectFilter.value !== 'ALL' ||
    rankingSortBy.value !== 'score_desc'
  )
})

function resetRankingFilters() {
  rankingSearch.value = ''
  rankingClassFilter.value = 'ALL'
  rankingCampusFilter.value = 'ALL'
  rankingSubjectFilter.value = 'ALL'
  rankingSortBy.value = 'score_desc'
}

// Kalkulasi Auto-Ranking dinamis berdasarkan filter kelas, PTN, mata pelajaran, dan kriteria urut
const filteredRankingList = computed(() => {
  const subjectId = rankingSubjectFilter.value
  const isSubjectMode = subjectId !== 'ALL'

  let list = eligibleStore.allEligibleStudents.map(item => {
    const grades = item.eligible_grades || []
    const overallAvg = getStudentAverage(item)
    const subjectGrade = isSubjectMode
      ? grades.find(g => String(g.subject_id) === String(subjectId)) || null
      : null

    const hasActiveScore = isSubjectMode
      ? Boolean(subjectGrade)
      : (grades.length > 0 || overallAvg > 0)

    const activeScore = isSubjectMode
      ? (subjectGrade ? (computeSubjectAverage(subjectGrade) ?? 0) : 0)
      : overallAvg

    const p1 = (item.eligible_choices || []).find(c => c.priority === 1) || (item.eligible_choices || [])[0] || null

    return {
      ...item,
      overallAverageCalc: overallAvg,
      subjectGrade,
      activeScore,
      hasActiveScore,
      filteredGradesCount: grades.length,
      primaryCampusName: p1?.universities?.name || ''
    }
  })

  // Filter Kelas
  if (rankingClassFilter.value !== 'ALL') {
    list = list.filter(item => String(item.users?.kelas || '').trim() === rankingClassFilter.value)
  }

  // Filter Kampus / PTN
  if (rankingCampusFilter.value === 'NONE') {
    list = list.filter(item => !hasChoices(item))
  } else if (rankingCampusFilter.value !== 'ALL') {
    list = list.filter(item =>
      (item.eligible_choices || []).some(c => String(c.university_id) === String(rankingCampusFilter.value))
    )
  }

  // Filter Pencarian Cepat
  const q = rankingSearch.value.trim().toLowerCase()
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

  // Pengurutan
  const sortMode = rankingSortBy.value
  return list.sort((a, b) => {
    if (sortMode === 'score_desc') {
      if (a.hasActiveScore !== b.hasActiveScore) return a.hasActiveScore ? -1 : 1
      if (b.activeScore !== a.activeScore) return b.activeScore - a.activeScore
      return b.overallAverageCalc - a.overallAverageCalc || (a.users?.nama || '').localeCompare(b.users?.nama || '', 'id')
    }
    if (sortMode === 'score_asc') {
      if (a.hasActiveScore !== b.hasActiveScore) return a.hasActiveScore ? -1 : 1
      if (a.activeScore !== b.activeScore) return a.activeScore - b.activeScore
      return (a.users?.nama || '').localeCompare(b.users?.nama || '', 'id')
    }
    if (sortMode === 'class_asc') {
      const clsCmp = String(a.users?.kelas || 'ZZZ').localeCompare(String(b.users?.kelas || 'ZZZ'), 'id', { numeric: true })
      if (clsCmp !== 0) return clsCmp
      return b.activeScore - a.activeScore || (a.users?.nama || '').localeCompare(b.users?.nama || '', 'id')
    }
    if (sortMode === 'campus_asc') {
      const hasA = Boolean(a.primaryCampusName)
      const hasB = Boolean(b.primaryCampusName)
      if (hasA !== hasB) return hasA ? -1 : 1
      const cCmp = a.primaryCampusName.localeCompare(b.primaryCampusName, 'id')
      if (cCmp !== 0) return cCmp
      return b.activeScore - a.activeScore
    }
    if (sortMode === 'name_asc') {
      return (a.users?.nama || '').localeCompare(b.users?.nama || '', 'id')
    }
    return 0
  })
})
</script>

<template>
  <div class="min-h-screen w-full max-w-full overflow-x-clip bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col">
    <!-- Navbar Global di Paling Atas Modul Eligible -->
    <PublicNavbar />

    <!-- SIDEBAR KHUSUS MODUL ELIGIBLE -->
    <EligibleSidebar v-model:activeTab="activeTab" />

    <!-- KONTEN UTAMA DENGAN OFFSET SIDEBAR -->
    <div class="flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-clip lg:pl-64 xl:pl-72 pb-16">
      
      <!-- TOP BAR RINGKAS MODUL -->
      <div class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full max-w-full">
        <div>
          <h1 class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
            Kelola Siswa Eligible SNBP
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Ruang BK SMA Negeri 2 Ngawi &bull; Tahun Ajaran {{ eligibleStore.currentAcademicYear }}
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <span
            v-if="isSyncingSnpmb"
            class="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-sky-50 text-[#0369A1] dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 inline-flex items-center gap-2"
          >
            <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            <span class="hidden sm:inline">Sinkronisasi SNPMB...</span>
          </span>
          <span class="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            {{ eligibleStore.allEligibleStudents.length }} Siswa Eligible
          </span>
        </div>
      </div>

      <main class="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
      
      <!-- TAB 1: DAFTAR SISWA & PENCARIAN ADD -->
      <section v-if="activeTab === 'siswa'" class="space-y-6">
        
        <!-- PENCARIAN SISWA UNTUK ADD ELIGIBLE -->
        <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] space-y-4">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Tambahkan Siswa ke Kuota Eligible
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Cari nama siswa aktif, NISN, atau NIS dari database sekolah, lalu klik tombol "Add Eligible".
            </p>
          </div>

          <div class="flex items-center gap-2.5">
            <div class="relative flex-1">
              <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
              <input
                type="text"
                v-model="studentSearchQuery"
                @keyup.enter="handleSearchStudents"
                placeholder="Ketik nama siswa, NISN, atau NIS untuk mencari otomatis..."
                class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15"
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
              class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              class="px-4 py-3.5 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-sky-50/40 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div class="flex items-center gap-3.5 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 font-bold text-sm flex items-center justify-center shrink-0 border border-sky-200/80 dark:border-slate-700">
                  {{ getInitials(s.nama) }}
                </div>
                <div class="min-w-0">
                  <span class="font-semibold text-sm sm:text-base text-slate-900 dark:text-white block truncate">{{ s.nama }}</span>
                  <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
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
                  class="px-4 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <i class="fa-solid fa-plus" aria-hidden="true"></i>
                  <span>Add Eligible</span>
                </button>
                <span v-else class="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Sudah terdaftar
                </span>
              </div>
            </div>
          </div>

          <div
            v-else-if="hasSearched && !isSearchingStudents && studentSearchQuery.trim()"
            class="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300 text-sm flex items-center gap-2"
          >
            <i class="fa-solid fa-circle-info text-amber-600" aria-hidden="true"></i>
            <span>Tidak ditemukan siswa aktif dengan nama atau NISN "<strong>{{ studentSearchQuery }}</strong>".</span>
          </div>
        </div>

        <!-- TABEL SELURUH SISWA ELIGIBLE SAAT INI -->
        <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] overflow-hidden">
          <div class="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Daftar Siswa Eligible Aktif ({{ eligibleStore.allEligibleStudents.length }})
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Siswa dalam daftar ini memiliki akses ke menu pemilihan PTN dan pengisian nilai rapor SNBP.
            </p>
          </div>

          <div v-if="eligibleStore.isLoading && eligibleStore.allEligibleStudents.length === 0" class="p-10 text-center text-sm text-slate-500">
            <i class="fa-solid fa-spinner fa-spin mr-2 text-[#0284C7]" aria-hidden="true"></i>
            Memuat daftar siswa eligible...
          </div>

          <div v-else-if="eligibleStore.allEligibleStudents.length === 0" class="p-10 text-center space-y-1.5">
            <p class="text-base font-semibold text-slate-700 dark:text-slate-300">Belum ada siswa eligible terdaftar</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">Gunakan kolom pencarian di atas untuk menambahkan siswa ke kuota SNBP.</p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-sky-50/70 dark:bg-slate-800/80 text-[#0369A1] dark:text-sky-200 font-semibold text-sm border-b border-sky-100 dark:border-slate-700">
                <tr>
                  <th class="px-6 py-4">Nama Siswa</th>
                  <th class="px-4 py-4">Kelas / NISN</th>
                  <th class="px-4 py-4">Status Pilihan</th>
                  <th class="px-4 py-4">Status Nilai</th>
                  <th class="px-4 py-4 text-right">Rata-Rata</th>
                  <th class="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="item in eligibleStore.allEligibleStudents" :key="item.id" class="hover:bg-sky-50/35 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3.5">
                      <img
                        v-if="item.users?.foto_url"
                        :src="item.users.foto_url"
                        :alt="item.users?.nama"
                        width="40"
                        height="40"
                        class="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        onerror="this.style.display='none'"
                      />
                      <div
                        v-else
                        class="w-10 h-10 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 border border-sky-200/80 dark:border-slate-700 font-bold text-sm flex items-center justify-center shrink-0"
                      >
                        {{ getInitials(item.users?.nama) }}
                      </div>
                      <span class="font-semibold text-base text-slate-900 dark:text-white">{{ item.users?.nama }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                    <div>Kelas {{ item.users?.kelas || '-' }}</div>
                    <div class="font-mono text-xs text-slate-400">NISN: {{ item.users?.nisn || '-' }}</div>
                  </td>
                  <td class="px-4 py-4 text-sm">
                    <span class="inline-flex items-center gap-2 font-medium" :class="hasChoices(item) ? getChoiceStatusMeta(item.choice_status).text : 'text-slate-400'">
                      <span class="w-2 h-2 rounded-full" :class="hasChoices(item) ? getChoiceStatusMeta(item.choice_status).dot : 'bg-slate-300 dark:bg-slate-600'" aria-hidden="true"></span>
                      <span>{{ hasChoices(item) ? getChoiceStatusMeta(item.choice_status).label : 'Belum memilih' }}</span>
                    </span>
                  </td>
                  <td class="px-4 py-4 text-sm">
                    <span class="inline-flex items-center gap-2 font-medium" :class="hasGrades(item) || item.grade_status === 'approved' ? getGradeStatusMeta(item.grade_status).text : 'text-slate-400'">
                      <span class="w-2 h-2 rounded-full" :class="hasGrades(item) || item.grade_status === 'approved' ? getGradeStatusMeta(item.grade_status).dot : 'bg-slate-300 dark:bg-slate-600'" aria-hidden="true"></span>
                      <span>{{ hasGrades(item) || item.grade_status === 'approved' ? getGradeStatusMeta(item.grade_status).label : 'Belum diisi' }}</span>
                    </span>
                  </td>
                  <td class="px-4 py-4 text-right font-mono font-bold text-base text-slate-800 dark:text-slate-200 tabular-nums">
                    {{ hasGrades(item) || Number(item.overall_average) > 0 ? formatAverage(getStudentAverage(item)) : '-' }}
                  </td>
                  <td class="px-6 py-4 text-right">
                    <button
                      type="button"
                      @click="handleRemoveEligible(item)"
                      class="px-3.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-sm font-semibold transition-colors cursor-pointer"
                      title="Keluarkan dari daftar eligible"
                    >
                      <i class="fa-solid fa-trash-can mr-1.5" aria-hidden="true"></i>
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

        <!-- TOOLBAR PENCARIAN, FILTER & PILIHAN TAMPILAN (KARTU / TABEL) -->
        <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] overflow-hidden">
          <div class="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Verifikasi Pilihan Jurusan &amp; Kunci Nilai Rapor
              </h2>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Periksa pilihan PTN, prodi, dan nilai rapor siswa. Guru BK dapat mengunci atau membuka kunci nilai kapan saja.
              </p>
            </div>

            <!-- Switch Tampilan Kartu / Tabel (seperti DataAlumniView) -->
            <div class="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto shrink-0">
              <button
                type="button"
                @click="validasiViewMode = 'cards'"
                class="px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                :class="validasiViewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-[#0369A1] dark:text-sky-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
              >
                <i class="fa-solid fa-table-cells-large text-xs" aria-hidden="true"></i>
                <span>Kartu</span>
              </button>
              <button
                type="button"
                @click="validasiViewMode = 'table'"
                class="px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                :class="validasiViewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-[#0369A1] dark:text-sky-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
              >
                <i class="fa-solid fa-list text-xs" aria-hidden="true"></i>
                <span>Tabel</span>
              </button>
            </div>
          </div>

          <!-- Baris Pencarian -->
          <div class="px-5 sm:px-6 py-3.5 bg-sky-50/35 dark:bg-slate-900/60 border-b border-sky-100/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="relative w-full sm:max-w-lg">
              <label for="validasi-search" class="sr-only">Cari siswa eligible</label>
              <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true"></i>
              <input
                id="validasi-search"
                type="text"
                v-model="validasiSearch"
                placeholder="Cari nama siswa, kelas, PTN, atau program studi..."
                class="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15"
              />
              <button
                v-if="validasiSearch"
                type="button"
                @click="validasiSearch = ''"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Bersihkan pencarian"
              >
                <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <div class="text-sm text-slate-500 dark:text-slate-400 shrink-0">
              Menampilkan <strong class="text-slate-900 dark:text-white font-semibold">{{ filteredValidasiList.length }}</strong> dari {{ eligibleStore.allEligibleStudents.length }} siswa
            </div>
          </div>

          <!-- Baris Filter Tabs dengan Angka Riil -->
          <div class="px-5 sm:px-6 py-3.5 overflow-x-auto flex items-center gap-2 scrollbar-none">
            <button
              v-for="tab in validasiFilterTabs"
              :key="tab.key"
              type="button"
              @click="validasiFilter = tab.key"
              class="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 shrink-0 border cursor-pointer"
              :class="validasiFilter === tab.key
                ? 'bg-[#0369A1] text-white border-[#0369A1] font-semibold'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-sky-50/70 dark:hover:bg-slate-800'"
            >
              <span>{{ tab.label }}</span>
              <span
                class="px-2 py-0.5 rounded-md text-xs font-bold tabular-nums"
                :class="validasiFilter === tab.key
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'"
              >
                {{ tab.count }}
              </span>
            </button>
          </div>
        </div>

        <!-- STATE LOADING -->
        <div
          v-if="eligibleStore.isLoading && eligibleStore.allEligibleStudents.length === 0"
          class="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-base text-slate-500"
        >
          <i class="fa-solid fa-spinner fa-spin mr-2 text-[#0284C7]" aria-hidden="true"></i>
          Memuat data validasi siswa eligible...
        </div>

        <!-- STATE KOSONG / FILTER NIHIL -->
        <div
          v-else-if="filteredValidasiList.length === 0"
          class="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3"
        >
          <p class="text-base font-semibold text-slate-700 dark:text-slate-300">
            {{ eligibleStore.allEligibleStudents.length === 0 ? 'Belum ada siswa eligible terdaftar.' : 'Tidak ada siswa pada kategori filter ini.' }}
          </p>
          <button
            v-if="validasiSearch || validasiFilter !== 'all'"
            type="button"
            @click="validasiSearch = ''; validasiFilter = 'all'"
            class="px-4 py-2 rounded-xl bg-sky-50 hover:bg-[#0369A1] text-[#0369A1] hover:text-white border border-sky-200 text-sm font-semibold transition-colors cursor-pointer"
          >
            Reset Filter
          </button>
        </div>

        <!-- MODE 1 (DEFAULT): GRID KARTU VERIFIKASI YANG LEGA & MUDAH DIBACA -->
        <div
          v-else-if="validasiViewMode === 'cards'"
          class="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5"
        >
          <article
            v-for="item in filteredValidasiList"
            :key="item.id"
            class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border shadow-[var(--shadow-sm)] flex flex-col justify-between gap-4 transition-colors"
            :class="hasChoices(item) || hasGrades(item)
              ? 'border-sky-200/90 dark:border-sky-900/70'
              : 'border-slate-200 dark:border-slate-800'"
          >
            <!-- HEADER KARTU: IDENTITAS SISWA -->
            <div class="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-3.5 min-w-0">
                <img
                  v-if="item.users?.foto_url"
                  :src="item.users.foto_url"
                  :alt="item.users?.nama"
                  width="48"
                  height="48"
                  class="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  onerror="this.style.display='none'"
                />
                <div
                  v-else
                  class="w-12 h-12 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 border border-sky-200/80 dark:border-slate-700 font-bold text-base flex items-center justify-center shrink-0"
                >
                  {{ getInitials(item.users?.nama) }}
                </div>

                <div class="min-w-0">
                  <h3 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-snug truncate">
                    {{ item.users?.nama }}
                  </h3>
                  <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Kelas <strong class="font-semibold text-slate-700 dark:text-slate-300">{{ item.users?.kelas || '-' }}</strong>
                    <template v-if="item.users?.nisn"> &bull; NISN <span class="font-mono">{{ item.users.nisn }}</span></template>
                  </p>
                </div>
              </div>
            </div>

            <!-- ISI KARTU: 2 PANEL SEJAJAR (PILIHAN PTN & NILAI RAPOR) -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
              
              <!-- PANEL KIRI (7 KOLOM): PILIHAN PTN & PRODI -->
              <div class="md:col-span-7 p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 flex flex-col justify-between gap-4">
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Pilihan PTN &amp; Prodi
                    </span>
                    <span
                      v-if="hasChoices(item)"
                      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border"
                      :class="getChoiceStatusMeta(item.choice_status).badge"
                    >
                      <span class="w-1.5 h-1.5 rounded-full" :class="getChoiceStatusMeta(item.choice_status).dot" aria-hidden="true"></span>
                      <span>{{ getChoiceStatusMeta(item.choice_status).label }}</span>
                    </span>
                  </div>

                  <div v-if="hasChoices(item)" class="space-y-3">
                    <div
                      v-for="c in item.eligible_choices"
                      :key="c.id"
                      class="flex items-start gap-3"
                    >
                      <span
                        class="text-xs font-bold px-2 py-0.5 rounded-md shrink-0 mt-0.5"
                        :class="c.priority === 1
                          ? 'bg-[#0369A1] text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'"
                      >
                        P{{ c.priority }}
                      </span>
                      <img
                        v-if="getInstitutionLogo(c.universities?.name)"
                        :src="getInstitutionLogo(c.universities?.name)"
                        :alt="c.universities?.name || 'Logo PTN'"
                        width="28"
                        height="28"
                        class="w-7 h-7 rounded-lg object-contain bg-white p-0.5 border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5"
                        onerror="this.style.display='none'"
                      />
                      <div class="min-w-0 leading-snug">
                        <div class="text-sm font-bold text-slate-900 dark:text-white">
                          {{ c.majors?.degree ? `${c.majors.degree} ` : '' }}{{ c.majors?.name || '-' }}
                        </div>
                        <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          {{ c.universities?.name || '-' }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p v-else class="text-sm text-slate-400 dark:text-slate-500 py-3">
                    Siswa belum memilih PTN dan program studi.
                  </p>
                </div>

                <!-- Tombol Aksi Pilihan -->
                <div v-if="hasChoices(item)" class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                  <button
                    v-if="item.choice_status === 'approved'"
                    type="button"
                    @click="handleSetChoiceStatus(item, 'pending')"
                    :disabled="updatingIds[`choice-${item.id}`]"
                    class="flex-1 py-2 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-600 dark:hover:text-white border border-amber-200 dark:border-amber-800 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <i class="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
                    <span>Batalkan ACC</span>
                  </button>

                  <template v-else>
                    <button
                      type="button"
                      @click="handleSetChoiceStatus(item, 'approved')"
                      :disabled="updatingIds[`choice-${item.id}`]"
                      class="flex-1 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
                      <span>ACC Pilihan</span>
                    </button>

                    <button
                      v-if="item.choice_status !== 'rejected'"
                      type="button"
                      @click="handleSetChoiceStatus(item, 'rejected')"
                      :disabled="updatingIds[`choice-${item.id}`]"
                      class="py-2 px-3.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Tolak
                    </button>

                    <button
                      v-else
                      type="button"
                      @click="handleSetChoiceStatus(item, 'pending')"
                      :disabled="updatingIds[`choice-${item.id}`]"
                      class="py-2 px-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-sm font-semibold transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </template>
                </div>
              </div>

              <!-- PANEL KANAN (5 KOLOM): NILAI RAPOR & KUNCI -->
              <div class="md:col-span-5 p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 flex flex-col justify-between gap-4">
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Nilai Rapor
                    </span>
                    <span
                      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border"
                      :class="getGradeStatusMeta(item.grade_status).badge"
                    >
                      <span class="w-1.5 h-1.5 rounded-full" :class="getGradeStatusMeta(item.grade_status).dot" aria-hidden="true"></span>
                      <span>{{ getGradeStatusMeta(item.grade_status).label }}</span>
                    </span>
                  </div>

                  <div v-if="hasGrades(item) || Number(item.overall_average) > 0">
                    <div class="text-xs text-slate-500 dark:text-slate-400">Rata-rata kumulatif</div>
                    <div class="text-2xl sm:text-3xl font-display font-bold font-mono text-[#0369A1] dark:text-sky-300 tabular-nums mt-0.5">
                      {{ formatAverage(getStudentAverage(item)) }}
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {{ item.eligible_grades?.length || 0 }} mata pelajaran terisi
                    </div>
                  </div>
                  <p v-else class="text-sm text-slate-400 dark:text-slate-500 py-3">
                    Siswa belum menginput nilai rapor.
                  </p>
                </div>

                <!-- Tombol Aksi Nilai (Cek + Kunci / Buka Kunci) -->
                <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                  <button
                    type="button"
                    @click="openGradeDetail(item)"
                    class="py-2 px-3.5 rounded-xl bg-white hover:bg-sky-50 text-[#0369A1] dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    :class="!hasGrades(item) && item.grade_status !== 'approved' ? 'w-full' : ''"
                  >
                    <i class="fa-solid fa-eye text-xs" aria-hidden="true"></i>
                    <span>Cek Nilai</span>
                  </button>

                  <!-- BUKA KUNCI BILA SUDAH TERKUNCI -->
                  <button
                    v-if="item.grade_status === 'approved'"
                    type="button"
                    @click="handleSetGradeStatus(item, 'pending')"
                    :disabled="updatingIds[`grade-${item.id}`]"
                    class="flex-1 py-2 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Batalkan kunci nilai agar siswa dapat mengedit ulang"
                  >
                    <i class="fa-solid fa-lock-open text-xs" aria-hidden="true"></i>
                    <span>Buka Kunci</span>
                  </button>

                  <!-- KUNCI NILAI BILA SUDAH ADA NILAI -->
                  <button
                    v-else-if="hasGrades(item)"
                    type="button"
                    @click="handleSetGradeStatus(item, 'approved')"
                    :disabled="updatingIds[`grade-${item.id}`]"
                    class="flex-1 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <i class="fa-solid fa-lock text-xs" aria-hidden="true"></i>
                    <span>Kunci Nilai</span>
                  </button>
                </div>
              </div>

            </div>
          </article>
        </div>

        <!-- MODE 2: TAMPILAN TABEL DENGAN TIPOGRAFI & TOMBOL PROPORSIONAL -->
        <div
          v-else
          class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] overflow-hidden"
        >
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-sky-50/70 dark:bg-slate-800/80 text-[#0369A1] dark:text-sky-200 font-semibold text-sm border-b border-sky-100 dark:border-slate-700">
                <tr>
                  <th class="px-6 py-4">Siswa</th>
                  <th class="px-4 py-4">Pilihan PTN &amp; Prodi</th>
                  <th class="px-4 py-4">Verifikasi Pilihan</th>
                  <th class="px-6 py-4">Nilai Rapor &amp; Kunci</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr
                  v-for="item in filteredValidasiList"
                  :key="item.id"
                  class="align-middle hover:bg-sky-50/35 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3.5">
                      <div class="w-10 h-10 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 border border-sky-200/80 dark:border-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
                        {{ getInitials(item.users?.nama) }}
                      </div>
                      <div>
                        <div class="font-bold text-base text-slate-900 dark:text-white">{{ item.users?.nama }}</div>
                        <div class="text-xs sm:text-sm text-slate-500">
                          Kelas {{ item.users?.kelas || '-' }} &bull; <span class="font-mono">{{ item.users?.nisn || '-' }}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td class="px-4 py-4">
                    <div v-if="hasChoices(item)" class="space-y-2">
                      <div v-for="c in item.eligible_choices" :key="c.id" class="flex items-start gap-2.5">
                        <span
                          class="text-xs font-bold px-2 py-0.5 rounded shrink-0 mt-0.5"
                          :class="c.priority === 1 ? 'bg-[#0369A1] text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'"
                        >
                          P{{ c.priority }}
                        </span>
                        <div class="leading-snug">
                          <div class="text-sm font-semibold text-slate-900 dark:text-white">
                            {{ c.majors?.degree ? `${c.majors.degree} ` : '' }}{{ c.majors?.name || '-' }}
                          </div>
                          <div class="text-xs text-slate-500">{{ c.universities?.name || '-' }}</div>
                        </div>
                      </div>
                    </div>
                    <span v-else class="text-sm text-slate-400">Belum memilih</span>
                  </td>

                  <td class="px-4 py-4">
                    <div v-if="hasChoices(item)" class="space-y-2">
                      <div class="inline-flex items-center gap-1.5 text-sm font-semibold" :class="getChoiceStatusMeta(item.choice_status).text">
                        <span class="w-2 h-2 rounded-full" :class="getChoiceStatusMeta(item.choice_status).dot" aria-hidden="true"></span>
                        <span>{{ getChoiceStatusMeta(item.choice_status).label }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          v-if="item.choice_status === 'approved'"
                          type="button"
                          @click="handleSetChoiceStatus(item, 'pending')"
                          class="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 text-sm font-semibold transition-colors cursor-pointer"
                        >
                          Batalkan ACC
                        </button>
                        <template v-else>
                          <button
                            type="button"
                            @click="handleSetChoiceStatus(item, 'approved')"
                            class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                          >
                            ACC
                          </button>
                          <button
                            v-if="item.choice_status !== 'rejected'"
                            type="button"
                            @click="handleSetChoiceStatus(item, 'rejected')"
                            class="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold transition-colors cursor-pointer"
                          >
                            Tolak
                          </button>
                        </template>
                      </div>
                    </div>
                    <span v-else class="text-sm text-slate-400">Menunggu siswa</span>
                  </td>

                  <td class="px-6 py-4">
                    <div class="space-y-2">
                      <div class="flex items-center gap-2.5 text-sm">
                        <span class="font-mono font-bold text-base text-slate-900 dark:text-white tabular-nums">
                          {{ hasGrades(item) || Number(item.overall_average) > 0 ? formatAverage(getStudentAverage(item)) : 'Belum diisi' }}
                        </span>
                        <span class="inline-flex items-center gap-1.5 font-semibold" :class="getGradeStatusMeta(item.grade_status).text">
                          <span class="w-2 h-2 rounded-full" :class="getGradeStatusMeta(item.grade_status).dot" aria-hidden="true"></span>
                          <span>{{ getGradeStatusMeta(item.grade_status).label }}</span>
                        </span>
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          @click="openGradeDetail(item)"
                          class="px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-[#0369A1] text-[#0369A1] hover:text-white border border-sky-200 text-sm font-semibold transition-colors cursor-pointer"
                        >
                          Cek Nilai
                        </button>
                        <button
                          v-if="item.grade_status === 'approved'"
                          type="button"
                          @click="handleSetGradeStatus(item, 'pending')"
                          class="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <i class="fa-solid fa-lock-open text-xs" aria-hidden="true"></i>
                          <span>Buka Kunci</span>
                        </button>
                        <button
                          v-else-if="hasGrades(item)"
                          type="button"
                          @click="handleSetGradeStatus(item, 'approved')"
                          class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <i class="fa-solid fa-lock text-xs" aria-hidden="true"></i>
                          <span>Kunci Nilai</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 3: MATRIKS NILAI & AUTO-RANKING -->
      <section v-if="activeTab === 'ranking'" class="space-y-5">
        <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] overflow-hidden">
          <!-- Header Matriks -->
          <div class="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Matriks Nilai &amp; Auto-Ranking Siswa Eligible
              </h2>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                <template v-if="selectedRankingSubjectObj">
                  Menampilkan peringkat &amp; rincian Semester 1–5 khusus mata pelajaran
                  <strong class="text-[#0369A1] dark:text-sky-300">{{ selectedRankingSubjectObj.name }}</strong>.
                </template>
                <template v-else>
                  Peringkat otomatis berdasarkan rata-rata nilai rapor seluruh mata pelajaran. Saring per kelas, PTN, atau mata pelajaran pendukung SNBP.
                </template>
              </p>
            </div>

            <button
              v-if="hasActiveRankingFilters"
              type="button"
              @click="resetRankingFilters"
              class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 transition-colors cursor-pointer"
            >
              <i class="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
              <span>Reset Filter</span>
            </button>
          </div>

          <!-- Toolbar Filter & Pengurutan -->
          <div class="px-5 sm:px-6 py-4 bg-sky-50/35 dark:bg-slate-900/60 border-b border-sky-100/70 dark:border-slate-800 space-y-3.5">
            <!-- Baris 1: Pencarian + Info Jumlah -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="relative w-full sm:max-w-md">
                <label for="ranking-search" class="sr-only">Cari siswa, PTN, atau prodi</label>
                <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true"></i>
                <input
                  id="ranking-search"
                  type="text"
                  v-model="rankingSearch"
                  placeholder="Cari nama siswa, kelas, PTN, atau prodi..."
                  class="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15"
                />
                <button
                  v-if="rankingSearch"
                  type="button"
                  @click="rankingSearch = ''"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  aria-label="Bersihkan pencarian"
                >
                  <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
                </button>
              </div>

              <div class="text-sm text-slate-500 dark:text-slate-400 shrink-0">
                Menampilkan <strong class="text-slate-900 dark:text-white font-semibold">{{ filteredRankingList.length }}</strong> dari {{ eligibleStore.allEligibleStudents.length }} siswa
              </div>
            </div>

            <!-- Baris 2: 4 Kontrol Filter & Urutkan (Kelas, PTN, Mata Pelajaran, Urutkan) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <!-- Filter Kelas -->
              <div>
                <label for="ranking-filter-class" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Filter Kelas
                </label>
                <select
                  id="ranking-filter-class"
                  v-model="rankingClassFilter"
                  class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15 cursor-pointer"
                >
                  <option value="ALL">Semua Kelas</option>
                  <option v-for="cls in rankingAvailableClasses" :key="cls" :value="cls">
                    Kelas {{ cls }}
                  </option>
                </select>
              </div>

              <!-- Filter Pilihan Kampus / PTN -->
              <div>
                <label for="ranking-filter-campus" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Pilihan Kampus (PTN)
                </label>
                <select
                  id="ranking-filter-campus"
                  v-model="rankingCampusFilter"
                  class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15 cursor-pointer"
                >
                  <option value="ALL">Semua Kampus</option>
                  <option v-for="u in rankingAvailableCampuses" :key="u.id" :value="u.id">
                    {{ u.name }} ({{ u.count }})
                  </option>
                  <option value="NONE">Belum Memilih PTN</option>
                </select>
              </div>

              <!-- Filter / Fokus Mata Pelajaran -->
              <div>
                <label for="ranking-filter-subject" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Fokus Nilai Mata Pelajaran
                </label>
                <select
                  id="ranking-filter-subject"
                  v-model="rankingSubjectFilter"
                  class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border text-sm font-medium focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15 cursor-pointer"
                  :class="rankingSubjectFilter !== 'ALL'
                    ? 'border-[#0284C7] text-[#0369A1] dark:text-sky-300 font-semibold'
                    : 'border-[#CBD5E1] dark:border-slate-700 text-slate-800 dark:text-slate-200'"
                >
                  <option value="ALL">Semua Mapel (Rata-Rata Total)</option>
                  <option v-for="s in eligibleStore.masterSubjects" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>

              <!-- Urutkan Berdasarkan -->
              <div>
                <label for="ranking-sort-by" class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Urutkan Berdasarkan
                </label>
                <select
                  id="ranking-sort-by"
                  v-model="rankingSortBy"
                  class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15 cursor-pointer"
                >
                  <option value="score_desc">
                    {{ selectedRankingSubjectObj ? `Nilai ${selectedRankingSubjectObj.name} Tertinggi` : 'Nilai Rapor Tertinggi' }}
                  </option>
                  <option value="score_asc">
                    {{ selectedRankingSubjectObj ? `Nilai ${selectedRankingSubjectObj.name} Terendah` : 'Nilai Rapor Terendah' }}
                  </option>
                  <option value="class_asc">Kelas (XII 1 → XII 12)</option>
                  <option value="campus_asc">Kampus Pilihan 1 (A–Z)</option>
                  <option value="name_asc">Nama Siswa (A–Z)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- STATE KOSONG -->
          <div v-if="filteredRankingList.length === 0" class="p-12 text-center space-y-3">
            <p class="text-base font-semibold text-slate-700 dark:text-slate-300">
              {{ eligibleStore.allEligibleStudents.length === 0 ? 'Belum ada data siswa eligible untuk diperingkatkan.' : 'Tidak ada siswa yang sesuai dengan filter saat ini.' }}
            </p>
            <button
              v-if="hasActiveRankingFilters"
              type="button"
              @click="resetRankingFilters"
              class="px-4 py-2 rounded-xl bg-sky-50 hover:bg-[#0369A1] text-[#0369A1] hover:text-white border border-sky-200 text-sm font-semibold transition-colors cursor-pointer"
            >
              Reset Semua Filter
            </button>
          </div>

          <!-- TAMPILAN DESKTOP: TABEL MATRIKS LEGA -->
          <div v-else>
            <div class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="bg-sky-50/70 dark:bg-slate-800/80 text-[#0369A1] dark:text-sky-200 font-semibold text-sm border-b border-sky-100 dark:border-slate-700">
                  <tr>
                    <th class="px-5 py-4 text-center w-20">Rank</th>
                    <th class="px-4 py-4">Siswa</th>
                    <th class="px-4 py-4">Pilihan PTN &amp; Prodi (SNBP)</th>
                    <th class="px-4 py-4">Status Nilai</th>
                    <th class="px-4 py-4 text-right">
                      {{ selectedRankingSubjectObj ? `Nilai ${selectedRankingSubjectObj.name}` : 'Rata-Rata Rapor' }}
                    </th>
                    <th class="px-6 py-4 text-right">Rincian</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr
                    v-for="(item, idx) in filteredRankingList"
                    :key="item.id"
                    class="align-middle hover:bg-sky-50/35 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <!-- RANK (MEDALI HANYA UNTUK SISWA YANG SUDAH PUNYA NILAI > 0) -->
                    <td class="px-5 py-4 text-center font-mono font-bold text-sm">
                      <span
                        v-if="item.hasActiveScore && rankingSortBy === 'score_desc' && idx < 3"
                        class="w-9 h-9 rounded-xl inline-flex items-center justify-center text-sm font-extrabold border"
                        :class="idx === 0
                          ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700'
                          : (idx === 1
                            ? 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600'
                            : 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/80 dark:text-orange-200 dark:border-orange-700')"
                      >
                        #{{ idx + 1 }}
                      </span>
                      <span v-else class="text-slate-400 dark:text-slate-500 font-semibold">
                        #{{ idx + 1 }}
                      </span>
                    </td>

                    <!-- SISWA -->
                    <td class="px-4 py-4">
                      <div class="flex items-center gap-3.5">
                        <img
                          v-if="item.users?.foto_url"
                          :src="item.users.foto_url"
                          :alt="item.users?.nama"
                          width="40"
                          height="40"
                          class="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          onerror="this.style.display='none'"
                        />
                        <div
                          v-else
                          class="w-10 h-10 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 border border-sky-200/80 dark:border-slate-700 font-bold text-sm flex items-center justify-center shrink-0"
                        >
                          {{ getInitials(item.users?.nama) }}
                        </div>
                        <div>
                          <div class="font-bold text-base text-slate-900 dark:text-white leading-snug">
                            {{ item.users?.nama }}
                          </div>
                          <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            Kelas {{ item.users?.kelas || '-' }}
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- PILIHAN PTN & PRODI + DETEKSI BENTROK -->
                    <td class="px-4 py-4">
                      <div v-if="hasChoices(item)" class="space-y-2">
                        <div
                          v-for="c in item.eligible_choices"
                          :key="c.id"
                          class="flex items-start gap-2.5"
                        >
                          <span
                            class="text-xs font-bold px-2 py-0.5 rounded-md shrink-0 mt-0.5"
                            :class="c.priority === 1
                              ? 'bg-[#0369A1] text-white'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'"
                          >
                            P{{ c.priority }}
                          </span>
                          <img
                            v-if="getInstitutionLogo(c.universities?.name)"
                            :src="getInstitutionLogo(c.universities?.name)"
                            :alt="c.universities?.name || 'Logo PTN'"
                            width="24"
                            height="24"
                            class="w-6 h-6 rounded-md object-contain bg-white p-0.5 border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5"
                            onerror="this.style.display='none'"
                          />
                          <div class="min-w-0 leading-snug">
                            <div class="flex items-center gap-2 flex-wrap">
                              <span class="text-sm font-semibold text-slate-900 dark:text-white">
                                {{ c.majors?.degree ? `${c.majors.degree} ` : '' }}{{ c.majors?.name || '-' }}
                              </span>
                              <span
                                v-if="getChoiceClashCount(c) > 1"
                                class="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800"
                                :title="`Dipilih oleh ${getChoiceClashCount(c)} siswa eligible`"
                              >
                                Bentrok ({{ getChoiceClashCount(c) }})
                              </span>
                            </div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">
                              {{ c.universities?.name || '-' }}
                            </div>
                          </div>
                        </div>
                      </div>
                      <span v-else class="text-sm text-slate-400 dark:text-slate-500">Belum memilih</span>
                    </td>

                    <!-- STATUS NILAI -->
                    <td class="px-4 py-4">
                      <span
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
                        :class="getGradeStatusMeta(item.grade_status).badge"
                      >
                        <span class="w-1.5 h-1.5 rounded-full" :class="getGradeStatusMeta(item.grade_status).dot" aria-hidden="true"></span>
                        <span>{{ getGradeStatusMeta(item.grade_status).label }}</span>
                      </span>
                    </td>

                    <!-- NILAI RATA-RATA (TOTAL ATAU PER MAPEL + S1-S5) -->
                    <td class="px-4 py-4 text-right">
                      <template v-if="selectedRankingSubjectObj">
                        <div v-if="item.subjectGrade" class="space-y-1">
                          <div class="font-mono font-extrabold text-xl text-[#0369A1] dark:text-sky-300 tabular-nums">
                            {{ formatAverage(item.activeScore) }}
                          </div>
                          <div class="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                            S1:{{ formatSemScore(item.subjectGrade.sem_1) }} &middot;
                            S2:{{ formatSemScore(item.subjectGrade.sem_2) }} &middot;
                            S3:{{ formatSemScore(item.subjectGrade.sem_3) }} &middot;
                            S4:{{ formatSemScore(item.subjectGrade.sem_4) }} &middot;
                            S5:{{ formatSemScore(item.subjectGrade.sem_5) }}
                          </div>
                          <div class="text-[11px] text-slate-400">
                            Rata-rata total: <span class="font-mono font-semibold">{{ formatAverage(item.overallAverageCalc) }}</span>
                          </div>
                        </div>
                        <span v-else class="text-sm text-slate-400 dark:text-slate-500">
                          Belum diisi
                        </span>
                      </template>

                      <template v-else>
                        <div v-if="item.hasActiveScore">
                          <div class="font-mono font-extrabold text-xl text-[#0369A1] dark:text-sky-300 tabular-nums">
                            {{ formatAverage(item.activeScore) }}
                          </div>
                          <div class="text-xs text-slate-400 mt-0.5">
                            {{ item.filteredGradesCount }} mapel
                          </div>
                        </div>
                        <span v-else class="text-sm text-slate-400 dark:text-slate-500">
                          Belum diisi
                        </span>
                      </template>
                    </td>

                    <!-- AKSI RINCIAN -->
                    <td class="px-6 py-4 text-right">
                      <button
                        type="button"
                        @click="openGradeDetail(item)"
                        class="px-4 py-2 rounded-xl bg-sky-50 hover:bg-[#0369A1] text-[#0369A1] hover:text-white dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-[#0369A1] dark:hover:text-white border border-sky-200 dark:border-sky-800 text-sm font-semibold transition-colors cursor-pointer"
                      >
                        Lihat Nilai
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- TAMPILAN MOBILE & TABLET (< lg): KARTU RANKING RAPI -->
            <div class="lg:hidden divide-y divide-slate-200 dark:divide-slate-800">
              <div
                v-for="(item, idx) in filteredRankingList"
                :key="item.id"
                class="p-4 sm:p-5 space-y-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <span
                      class="w-9 h-9 rounded-xl inline-flex items-center justify-center font-mono text-sm font-extrabold shrink-0 border"
                      :class="item.hasActiveScore && rankingSortBy === 'score_desc' && idx === 0
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : (item.hasActiveScore && rankingSortBy === 'score_desc' && idx === 1
                          ? 'bg-slate-200 text-slate-800 border-slate-300'
                          : (item.hasActiveScore && rankingSortBy === 'score_desc' && idx === 2
                            ? 'bg-orange-100 text-orange-900 border-orange-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'))"
                    >
                      #{{ idx + 1 }}
                    </span>
                    <div class="min-w-0">
                      <div class="font-bold text-base text-slate-900 dark:text-white truncate">{{ item.users?.nama }}</div>
                      <div class="text-xs sm:text-sm text-slate-500">Kelas {{ item.users?.kelas || '-' }}</div>
                    </div>
                  </div>

                  <div class="text-right shrink-0">
                    <div class="text-[11px] text-slate-400">
                      {{ selectedRankingSubjectObj ? selectedRankingSubjectObj.name : 'Rata-Rata' }}
                    </div>
                    <div class="font-mono font-extrabold text-xl text-[#0369A1] dark:text-sky-300 tabular-nums">
                      {{ item.hasActiveScore ? formatAverage(item.activeScore) : '-' }}
                    </div>
                  </div>
                </div>

                <!-- Rincian S1-S5 bila filter mapel aktif -->
                <div
                  v-if="selectedRankingSubjectObj && item.subjectGrade"
                  class="px-3 py-2 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center justify-between flex-wrap gap-2"
                >
                  <span>
                    S1:{{ formatSemScore(item.subjectGrade.sem_1) }} &middot;
                    S2:{{ formatSemScore(item.subjectGrade.sem_2) }} &middot;
                    S3:{{ formatSemScore(item.subjectGrade.sem_3) }} &middot;
                    S4:{{ formatSemScore(item.subjectGrade.sem_4) }} &middot;
                    S5:{{ formatSemScore(item.subjectGrade.sem_5) }}
                  </span>
                  <span class="text-slate-500">Total: {{ formatAverage(item.overallAverageCalc) }}</span>
                </div>

                <!-- Pilihan Prodi -->
                <div v-if="hasChoices(item)" class="space-y-1.5">
                  <div v-for="c in item.eligible_choices" :key="c.id" class="flex items-start gap-2 text-xs sm:text-sm">
                    <span
                      class="text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                      :class="c.priority === 1 ? 'bg-[#0369A1] text-white' : 'bg-slate-200 text-slate-700'"
                    >
                      P{{ c.priority }}
                    </span>
                    <div class="min-w-0 leading-snug">
                      <span class="font-semibold text-slate-900 dark:text-white">
                        {{ c.majors?.degree ? `${c.majors.degree} ` : '' }}{{ c.majors?.name }}
                      </span>
                      <span class="text-slate-500"> &bull; {{ c.universities?.name }}</span>
                      <span
                        v-if="getChoiceClashCount(c) > 1"
                        class="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900"
                      >
                        Bentrok ({{ getChoiceClashCount(c) }})
                      </span>
                    </div>
                  </div>
                </div>
                <p v-else class="text-xs text-slate-400">Belum memilih PTN &amp; prodi</p>

                <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
                    :class="getGradeStatusMeta(item.grade_status).badge"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" :class="getGradeStatusMeta(item.grade_status).dot" aria-hidden="true"></span>
                    <span>{{ getGradeStatusMeta(item.grade_status).label }}</span>
                  </span>

                  <button
                    type="button"
                    @click="openGradeDetail(item)"
                    class="px-3.5 py-1.5 rounded-xl bg-sky-50 text-[#0369A1] border border-sky-200 text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Lihat Nilai
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 4: MASTER MATA PELAJARAN -->
      <section v-if="activeTab === 'mapel'" class="space-y-6">
        <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] space-y-5">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                Kelola Master Mata Pelajaran ({{ eligibleStore.masterSubjects.length }})
              </h2>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar mata pelajaran yang muncul pada dropdown pengisian nilai rapor siswa eligible.
              </p>
            </div>
            <button
              type="button"
              @click="handleResetDefaultSubjects"
              class="px-4 py-2 rounded-xl bg-sky-50 hover:bg-[#0369A1] text-[#0369A1] hover:text-white dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-sm font-semibold transition-colors inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
            >
              <i class="fa-solid fa-rotate" aria-hidden="true"></i>
              <span>Sinkronkan 23 Mapel SMADA</span>
            </button>
          </div>

          <div v-if="subjectFeedback.text" class="p-4 rounded-xl text-sm font-semibold" :class="subjectFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'">
            {{ subjectFeedback.text }}
          </div>

          <div class="flex flex-col sm:flex-row items-end gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="flex-1 w-full">
              <label for="subject-name-input" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Mata Pelajaran
              </label>
              <input
                id="subject-name-input"
                type="text"
                v-model="subjectForm.name"
                @keyup.enter="handleSaveSubject"
                placeholder="Contoh: Bahasa Jerman"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 text-sm sm:text-base focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/15"
              />
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="handleSaveSubject"
                class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {{ isEditingSubject ? 'Simpan Perubahan' : 'Tambah Mapel' }}
              </button>
              <button
                v-if="isEditingSubject"
                type="button"
                @click="resetSubjectForm"
                class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>

          <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-sm">
              <thead class="bg-sky-50/70 dark:bg-slate-800/80 text-[#0369A1] dark:text-sky-200 text-sm font-semibold border-b border-sky-100 dark:border-slate-700">
                <tr>
                  <th class="px-4 py-3.5 w-14 text-center">No</th>
                  <th class="px-4 py-3.5">Nama Mata Pelajaran</th>
                  <th class="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="(s, idx) in eligibleStore.masterSubjects" :key="s.id" class="hover:bg-sky-50/35 dark:hover:bg-slate-800/40">
                  <td class="px-4 py-3.5 text-center text-sm font-mono text-slate-400">
                    {{ idx + 1 }}
                  </td>
                  <td class="px-4 py-3.5 font-medium text-base text-slate-900 dark:text-white">
                    {{ s.name }}
                  </td>
                  <td class="px-5 py-3.5 text-right space-x-4">
                    <button
                      type="button"
                      @click="startEditSubject(s)"
                      class="text-sm text-[#0369A1] dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      @click="handleDeleteSubject(s)"
                      class="text-sm text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
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
        <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[var(--shadow-sm)] space-y-5">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">
              Sinkronisasi Data Perguruan Tinggi &amp; Program Studi (SNPMB)
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Perbarui daftar Perguruan Tinggi Negeri dan program studi resmi SNBP/SNBT yang sama dengan Tracer Study.
            </p>
          </div>

          <div v-if="syncFeedback.text" class="p-4 rounded-xl text-sm font-semibold flex items-center gap-2.5" :class="syncFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'">
            <i :class="syncFeedback.type === 'success' ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-solid fa-triangle-exclamation text-rose-600'" aria-hidden="true"></i>
            <span>{{ syncFeedback.text }}</span>
          </div>

          <div class="p-5 sm:p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="space-y-1.5 text-center sm:text-left">
              <div class="font-bold text-base text-slate-900 dark:text-white flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <i class="fa-solid fa-database text-[#0369A1]" aria-hidden="true"></i>
                <span>
                  Tersimpan di Database: {{ eligibleStore.snpmbDbStats.universitiesCount }} PTN &amp; {{ eligibleStore.snpmbDbStats.majorsCount }} Prodi
                </span>
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border"
                  :class="isSnpmbSynced
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="isSnpmbSynced ? 'bg-emerald-500' : 'bg-amber-500'" aria-hidden="true"></span>
                  <span>{{ isSnpmbSynced ? 'Tersinkron' : 'Belum Lengkap' }}</span>
                </span>
              </div>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Katalog Tracer Study siap sinkron: <strong>{{ eligibleStore.snpmbDbStats.localUniversitiesCount }} PTN</strong> &amp; <strong>{{ eligibleStore.snpmbDbStats.localMajorsCount }} Program Studi</strong> resmi SNPMB.
              </p>
              <p v-if="syncProgressText" class="text-sm font-semibold text-[#0369A1] dark:text-sky-300 pt-1">
                <i class="fa-solid fa-spinner fa-spin mr-1.5" aria-hidden="true"></i>
                {{ syncProgressText }}
              </p>
            </div>

            <button
              type="button"
              @click="handleSyncSnpmb"
              :disabled="isSyncingSnpmb"
              class="px-5 py-3 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-sm transition-colors flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div class="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <!-- Header Modal -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-sky-50 dark:bg-slate-800 text-[#0369A1] dark:text-sky-300 border border-sky-200/80 dark:border-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
              {{ getInitials(selectedEligibleDetail.users?.nama) }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2.5 flex-wrap">
                <h3 id="grade-modal-title" class="font-display font-bold text-lg text-slate-900 dark:text-white truncate">
                  {{ selectedEligibleDetail.users?.nama }}
                </h3>
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border"
                  :class="getGradeStatusMeta(selectedEligibleDetail.grade_status).badge"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="getGradeStatusMeta(selectedEligibleDetail.grade_status).dot" aria-hidden="true"></span>
                  <span>{{ getGradeStatusMeta(selectedEligibleDetail.grade_status).fullLabel }}</span>
                </span>
              </div>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Kelas {{ selectedEligibleDetail.users?.kelas || '-' }} &bull; NISN: {{ selectedEligibleDetail.users?.nisn || '-' }}
              </p>
            </div>
          </div>

          <button
            type="button"
            @click="isGradeDetailModalOpen = false"
            class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Tutup modal rincian nilai"
          >
            <i class="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Isi Modal -->
        <div class="p-6 overflow-y-auto flex-1">
          <div
            v-if="!hasGrades(selectedEligibleDetail)"
            class="p-10 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center space-y-1.5"
          >
            <p class="text-base font-semibold text-slate-700 dark:text-slate-300">Belum ada data nilai rapor</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Siswa ini belum menginput dan menyimpan nilai rapor semester 1 s.d. 5.
            </p>
          </div>

          <div v-else class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-sm">
              <thead class="bg-sky-50/70 dark:bg-slate-800 font-semibold text-[#0369A1] dark:text-sky-200 border-b border-sky-100 dark:border-slate-700">
                <tr>
                  <th class="px-4 py-3.5">Mata Pelajaran</th>
                  <th class="px-3 py-3.5 text-center">S1</th>
                  <th class="px-3 py-3.5 text-center">S2</th>
                  <th class="px-3 py-3.5 text-center">S3</th>
                  <th class="px-3 py-3.5 text-center">S4</th>
                  <th class="px-3 py-3.5 text-center">S5</th>
                  <th class="px-4 py-3.5 text-right">Rata-Rata</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="g in selectedEligibleDetail.eligible_grades" :key="g.id" class="hover:bg-sky-50/35 dark:hover:bg-slate-800/40">
                  <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{{ g.subjects?.name }}</td>
                  <td class="px-3 py-3 text-center font-mono tabular-nums">{{ formatSemScore(g.sem_1) }}</td>
                  <td class="px-3 py-3 text-center font-mono tabular-nums">{{ formatSemScore(g.sem_2) }}</td>
                  <td class="px-3 py-3 text-center font-mono tabular-nums">{{ formatSemScore(g.sem_3) }}</td>
                  <td class="px-3 py-3 text-center font-mono tabular-nums">{{ formatSemScore(g.sem_4) }}</td>
                  <td class="px-3 py-3 text-center font-mono tabular-nums">{{ formatSemScore(g.sem_5) }}</td>
                  <td class="px-4 py-3 text-right font-mono font-bold text-[#0369A1] dark:text-sky-300 tabular-nums">
                    {{ computeSubjectAverage(g) !== null ? computeSubjectAverage(g).toFixed(2) : '-' }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-amber-50/70 dark:bg-amber-950/40 font-bold text-xs border-t-2 border-amber-200 dark:border-amber-900/60">
                <tr>
                  <td class="px-4 py-3 text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                    Rata-Rata per Semester:
                  </td>
                  <td class="px-3 py-3 text-center font-mono text-amber-950 dark:text-amber-200" v-for="sNum in [1, 2, 3, 4, 5]" :key="sNum">
                    {{ getModalSemesterAverage(selectedEligibleDetail.eligible_grades, sNum) }}
                  </td>
                  <td class="px-4 py-3 text-right font-mono font-extrabold text-sm text-[#0369A1] dark:text-sky-300 bg-sky-100/70 dark:bg-sky-950/80">
                    {{ formatAverage(getStudentAverage(selectedEligibleDetail)) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Footer Modal: Aksi Kunci / Batalkan Kunci -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="text-sm font-medium text-slate-600 dark:text-slate-300">
            Rata-Rata Kumulatif:
            <strong class="text-lg font-mono font-bold text-[#0369A1] dark:text-sky-300 ml-1.5 tabular-nums">
              {{ hasGrades(selectedEligibleDetail) || Number(selectedEligibleDetail.overall_average) > 0 ? formatAverage(getStudentAverage(selectedEligibleDetail)) : '-' }}
            </strong>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2.5">
            <!-- Jika sudah terkunci -> tombol Batalkan Kunci Nilai -->
            <button
              v-if="selectedEligibleDetail.grade_status === 'approved'"
              type="button"
              @click="handleSetGradeStatus(selectedEligibleDetail, 'pending')"
              :disabled="updatingIds[`grade-${selectedEligibleDetail.id}`]"
              class="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
                class="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Minta Revisi
              </button>
              <button
                type="button"
                @click="handleSetGradeStatus(selectedEligibleDetail, 'approved')"
                :disabled="updatingIds[`grade-${selectedEligibleDetail.id}`]"
                class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <i class="fa-solid fa-lock" aria-hidden="true"></i>
                <span>ACC &amp; Kunci Nilai</span>
              </button>
            </template>

            <button
              type="button"
              @click="isGradeDetailModalOpen = false"
              class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold cursor-pointer"
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
