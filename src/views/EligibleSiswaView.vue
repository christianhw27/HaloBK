<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEligibleStore } from '@/stores/eligible'
import EligibleSidebar from '@/components/EligibleSidebar.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import Toast from '@/components/Toast.vue'

const router = useRouter()
const authStore = useAuthStore()
const eligibleStore = useEligibleStore()

const confirmModal = ref(null)
const toast = ref(null)

const activeTab = ref('pilihan') // 'pilihan' | 'nilai' | 'sertifikat' | 'teman'

// State Pilihan 1 & 2
const p1Uni = ref('')
const p1Major = ref('')
const p2Uni = ref('')
const p2Major = ref('')

const p1MajorOptions = ref([])
const p2MajorOptions = ref([])

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

// Inisialisasi formulir pilihan dari store
function initChoicesForm() {
  const choices = eligibleStore.myChoices
  const c1 = choices.find(c => c.priority === 1)
  const c2 = choices.find(c => c.priority === 2)

  if (c1) {
    p1Uni.value = c1.university_id
    onP1UniChange(true).then(() => {
      p1Major.value = c1.major_id
      checkP1Clash()
    })
  }

  if (c2) {
    p2Uni.value = c2.university_id
    onP2UniChange(true).then(() => {
      p2Major.value = c2.major_id
      checkP2Clash()
    })
  }
}

async function onP1UniChange(skipResetMajor = false) {
  if (!skipResetMajor) p1Major.value = ''
  if (!p1Uni.value) {
    p1MajorOptions.value = []
    p1Clash.value = { total: 0, names: [] }
    return
  }
  p1MajorOptions.value = await eligibleStore.fetchMajorsByUniversity(p1Uni.value)
}

async function onP2UniChange(skipResetMajor = false) {
  if (!skipResetMajor) p2Major.value = ''
  if (!p2Uni.value) {
    p2MajorOptions.value = []
    p2Clash.value = { total: 0, names: [] }
    return
  }
  p2MajorOptions.value = await eligibleStore.fetchMajorsByUniversity(p2Uni.value)
}

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
    choiceFeedback.value = { type: 'error', text: 'Pilihan 1 (Universitas dan Program Studi) wajib diisi!' }
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
    checkP1Clash()
    checkP2Clash()
  } else {
    choiceFeedback.value = { type: 'error', text: res.message }
  }
}

// Helper sanitasi nilai rapor: bilangan bulat 0 - 100 (tanpa minus, tanpa koma, max 100)
function clampGradeInt(val) {
  const num = parseInt(String(val ?? '').replace(/[^0-9]/g, ''), 10)
  if (isNaN(num) || num < 0) return 0
  if (num > 100) return 100
  return num
}

function preventInvalidGradeKey(e) {
  if (['.', ',', '-', '+', 'e', 'E'].includes(e.key)) {
    e.preventDefault()
  }
}

function sanitizeGradeInput(row, field, e) {
  const raw = e?.target?.value ?? row[field]
  if (raw === '' || raw === null || raw === undefined) {
    row[field] = 0
    if (e?.target) e.target.value = '0'
    return
  }
  const clean = clampGradeInt(raw)
  row[field] = clean
  if (e?.target && String(e.target.value) !== String(clean)) {
    e.target.value = String(clean)
  }
}

// Inisialisasi formulir nilai dari store
function initGradesForm() {
  const existing = eligibleStore.myGrades
  if (existing && existing.length > 0) {
    gradesRows.value = existing.map(g => ({
      subject_id: g.subject_id,
      sem_1: clampGradeInt(Math.trunc(Number(g.sem_1) || 0)),
      sem_2: clampGradeInt(Math.trunc(Number(g.sem_2) || 0)),
      sem_3: clampGradeInt(Math.trunc(Number(g.sem_3) || 0)),
      sem_4: clampGradeInt(Math.trunc(Number(g.sem_4) || 0)),
      sem_5: clampGradeInt(Math.trunc(Number(g.sem_5) || 0))
    }))
  } else {
    // Default tambahkan baris mapel
    gradesRows.value = []
    const defaultSubjects = eligibleStore.masterSubjects.slice(0, 6)
    defaultSubjects.forEach(s => {
      gradesRows.value.push({
        subject_id: s.id,
        sem_1: 0,
        sem_2: 0,
        sem_3: 0,
        sem_4: 0,
        sem_5: 0
      })
    })
  }
}

function addGradeRow() {
  gradesRows.value.push({
    subject_id: '',
    sem_1: 0,
    sem_2: 0,
    sem_3: 0,
    sem_4: 0,
    sem_5: 0
  })
}

function removeGradeRow(index) {
  gradesRows.value.splice(index, 1)
}

// Daftar subject_id yang sudah dipilih agar tidak dobel dropdown
const selectedSubjectIds = computed(() => {
  return new Set(gradesRows.value.map(r => r.subject_id).filter(Boolean))
})

// Kalkulasi rata-rata per baris mapel (horizontal) — boleh koma (2 angka di belakang koma)
function calculateRowAverage(row) {
  const sum =
    clampGradeInt(row.sem_1) +
    clampGradeInt(row.sem_2) +
    clampGradeInt(row.sem_3) +
    clampGradeInt(row.sem_4) +
    clampGradeInt(row.sem_5)
  return Number((sum / 5).toFixed(2))
}

// Kalkulasi rata-rata per semester (vertikal) — 2 angka di belakang koma
const semesterAverages = computed(() => {
  const count = gradesRows.value.length || 1
  const totals = [0, 0, 0, 0, 0]
  gradesRows.value.forEach(r => {
    totals[0] += clampGradeInt(r.sem_1)
    totals[1] += clampGradeInt(r.sem_2)
    totals[2] += clampGradeInt(r.sem_3)
    totals[3] += clampGradeInt(r.sem_4)
    totals[4] += clampGradeInt(r.sem_5)
  })
  return totals.map(t => (t / count).toFixed(2))
})

// Rata-rata kumulatif keseluruhan — 2 angka di belakang koma
const calculatedOverallAverage = computed(() => {
  if (gradesRows.value.length === 0) return '0.00'
  const rowAverages = gradesRows.value.map(calculateRowAverage)
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

  // Validasi ketat setiap nilai: bilangan bulat 0 - 100 (tanpa minus, tanpa koma)
  for (const r of gradesRows.value) {
    for (const sKey of ['sem_1', 'sem_2', 'sem_3', 'sem_4', 'sem_5']) {
      const v = Number(r[sKey])
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        gradeFeedback.value = {
          type: 'error',
          text: 'Nilai rapor harus berupa bilangan bulat antara 0 sampai 100 (tidak boleh minus atau koma).'
        }
        return
      }
    }
  }

  isSavingGrades.value = true
  const res = await eligibleStore.saveGrades(gradesRows.value)
  isSavingGrades.value = false

  if (res.success) {
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
  <div class="min-h-screen bg-gradient-to-br from-[#EFF6FF]/90 via-[#F8FAFC] to-[#FFFBEB]/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100 font-sans flex flex-col">
    <!-- SIDEBAR KHUSUS SISWA ELIGIBLE (STYLE PERSIS TRACER STUDY) -->
    <EligibleSidebar v-model:activeTab="activeTab" />

    <!-- KONTEN UTAMA DENGAN OFFSET SIDEBAR lg:pl-64 xl:pl-72 -->
    <div class="flex-1 flex flex-col min-w-0 lg:pl-64 xl:pl-72 pb-16">
      <main class="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-6 space-y-6">
      
      <!-- HEADER STATUS ELIGIBLE -->
      <section class="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
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
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60'"
              >
                <i :class="eligibleStore.myEligibleData?.choice_status === 'approved' ? 'fa-solid fa-check-double' : 'fa-solid fa-clock'"></i>
                <span>{{ eligibleStore.myEligibleData?.choice_status === 'approved' ? 'ACC Guru BK' : 'Belum ACC' }}</span>
              </span>
            </div>

            <div class="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

            <div class="text-xs space-y-1">
              <div class="text-slate-400 text-[11px] font-semibold uppercase">Status Nilai:</div>
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                :class="eligibleStore.myEligibleData?.grade_status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/60'"
              >
                <i :class="eligibleStore.myEligibleData?.grade_status === 'approved' ? 'fa-solid fa-lock' : 'fa-solid fa-pen-to-square'"></i>
                <span>{{ eligibleStore.myEligibleData?.grade_status === 'approved' ? 'ACC & Terkunci' : 'Belum ACC' }}</span>
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
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Perguruan Tinggi Negeri (PTN)
                </label>
                <select
                  v-model="p1Uni"
                  @change="onP1UniChange(false)"
                  :disabled="!eligibleStore.canEditChoices"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0284C7] disabled:opacity-60"
                >
                  <option value="">-- Pilih Perguruan Tinggi --</option>
                  <option v-for="u in eligibleStore.universitiesList" :key="u.id" :value="u.id">
                    {{ u.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Program Studi (Prodi)
                </label>
                <select
                  v-model="p1Major"
                  @change="checkP1Clash"
                  :disabled="!eligibleStore.canEditChoices || !p1Uni"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0284C7] disabled:opacity-60"
                >
                  <option value="">-- Pilih Program Studi --</option>
                  <option v-for="m in p1MajorOptions" :key="m.id" :value="m.id">
                    {{ m.degree }} {{ m.name }} (Daya Tampung: {{ m.quota || '-' }})
                  </option>
                </select>
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
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Perguruan Tinggi Negeri (PTN)
                </label>
                <select
                  v-model="p2Uni"
                  @change="onP2UniChange(false)"
                  :disabled="!eligibleStore.canEditChoices"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0284C7] disabled:opacity-60"
                >
                  <option value="">-- Pilih Perguruan Tinggi (Opsional) --</option>
                  <option v-for="u in eligibleStore.universitiesList" :key="u.id" :value="u.id">
                    {{ u.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Program Studi (Prodi)
                </label>
                <select
                  v-model="p2Major"
                  @change="checkP2Clash"
                  :disabled="!eligibleStore.canEditChoices || !p2Uni"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0284C7] disabled:opacity-60"
                >
                  <option value="">-- Pilih Program Studi (Opsional) --</option>
                  <option v-for="m in p2MajorOptions" :key="m.id" :value="m.id">
                    {{ m.degree }} {{ m.name }} (Daya Tampung: {{ m.quota || '-' }})
                  </option>
                </select>
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
                Isi nilai rapor bilangan bulat skala 0–100 (maksimal 100, tanpa minus &amp; tanpa koma). Rata-rata otomatis dihitung hingga 2 angka di belakang koma.
              </p>
            </div>

            <button
              v-if="eligibleStore.canEditGrades"
              type="button"
              @click="addGradeRow"
              class="px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-[#0284C7] dark:text-sky-300 text-xs font-bold transition-colors flex items-center gap-1.5 border border-sky-200 dark:border-sky-800"
            >
              <i class="fa-solid fa-plus"></i>
              <span>Tambah Mapel</span>
            </button>
          </div>

          <!-- TABEL INPUT NILAI RESPONSIVE -->
          <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700/80">
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
                <tr v-for="(row, idx) in gradesRows" :key="idx" class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
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
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      inputmode="numeric"
                      :value="row[`sem_${sNum}`]"
                      @keydown="preventInvalidGradeKey"
                      @input="sanitizeGradeInput(row, `sem_${sNum}`, $event)"
                      @blur="sanitizeGradeInput(row, `sem_${sNum}`, $event)"
                      :disabled="!eligibleStore.canEditGrades"
                      class="w-16 px-1.5 py-1.5 rounded-lg text-center font-mono text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-[#0284C7] disabled:opacity-75"
                    />
                  </td>

                  <td class="p-2 text-center font-mono font-bold text-xs sm:text-sm bg-sky-50/50 dark:bg-sky-950/30 text-[#0284C7] dark:text-sky-300">
                    {{ calculateRowAverage(row).toFixed(2) }}
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

          <div class="flex items-center justify-between pt-3">
            <span v-if="!eligibleStore.canEditGrades" class="text-xs text-emerald-600 font-bold flex items-center gap-1.5">
              <i class="fa-solid fa-lock"></i>
              <span>Nilai telah disetujui (ACC) oleh Guru BK dan terkunci dari perubahan.</span>
            </span>
            <span v-else class="text-xs text-slate-400">
              *Setelah divalidasi oleh Guru BK, nilai tidak dapat diubah lagi.
            </span>

            <button
              type="button"
              @click="submitGrades"
              :disabled="!eligibleStore.canEditGrades || isSavingGrades"
              class="px-6 py-3 rounded-2xl bg-[#0369A1] hover:bg-[#075985] text-white font-bold text-sm sm:text-base shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 ml-auto"
            >
              <i v-if="isSavingGrades" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-floppy-disk"></i>
              <span>{{ isSavingGrades ? 'Menyimpan...' : 'Simpan Tabel Nilai' }}</span>
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
