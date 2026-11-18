<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useEligibleStore } from '@/stores/eligible'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
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

// Tab 3: Filter Ranking Matriks
const rankingCategoryFilter = ref('ALL') // 'ALL' | 'Wajib' | 'IPA' | 'IPS' | 'Bahasa'

// Tab 4: Form Mapel
const subjectForm = ref({ id: null, name: '', category: 'Wajib' })
const isEditingSubject = ref(false)
const subjectFeedback = ref({ type: '', text: '' })

// Tab 5: Sync SNPMB
const isSyncingSnpmb = ref(false)
const syncProgressText = ref('')
const syncFeedback = ref({ type: '', text: '' })

// Modal Detail Nilai Siswa untuk ACC
const selectedEligibleDetail = ref(null)
const isGradeDetailModalOpen = ref(false)

onMounted(async () => {
  if (authStore.userRole !== 'admin') {
    router.replace('/')
    return
  }

  await Promise.all([
    eligibleStore.fetchAdminEligibleList(),
    eligibleStore.fetchMasterSubjects(),
    eligibleStore.fetchUniversities()
  ])
})

// Pencarian siswa aktif untuk di-add ke eligible (Live Search as you type)
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

    // Tandai apakah sudah ada di eligible
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

// ACC Pilihan Jurusan
async function handleSetChoiceStatus(item, status) {
  const res = await eligibleStore.updateChoiceStatus(item.id, status)
  toast.value.show(res.message, res.success ? 'success' : 'error')
}

// ACC Nilai Rapor
async function handleSetGradeStatus(item, status) {
  const res = await eligibleStore.updateGradeStatus(item.id, status)
  toast.value.show(res.message, res.success ? 'success' : 'error')
}

function openGradeDetail(item) {
  selectedEligibleDetail.value = item
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

// Sync SNPMB
async function handleSyncSnpmb() {
  const confirmed = await confirmModal.value.open({
    title: 'Sinkronisasi Data SNPMB',
    message: 'Jalankan sinkronisasi data Perguruan Tinggi dan Program Studi dari portal SNPMB? Proses ini membutuhkan koneksi internet.',
    confirmText: 'Mulai Sinkronisasi',
    cancelText: 'Batal',
    type: 'info'
  })
  if (!confirmed) return

  isSyncingSnpmb.value = true
  syncFeedback.value = { type: '', text: '' }
  syncProgressText.value = 'Menghubungkan ke layanan data SNPMB...'

  try {
    const res = await fetch('/api/sync-snpmb', { method: 'POST' }).catch(() => null)
    await eligibleStore.fetchUniversities()
    syncFeedback.value = { type: 'success', text: 'Data Perguruan Tinggi & Prodi berhasil disinkronkan!' }
    toast.value.show('Data Perguruan Tinggi & Prodi berhasil disinkronkan!', 'success')
  } catch (err) {
    syncFeedback.value = { type: 'error', text: 'Gagal sinkronisasi data: ' + err.message }
    toast.value.show('Gagal sinkronisasi data SNPMB', 'error')
  } finally {
    isSyncingSnpmb.value = false
    syncProgressText.value = ''
  }
}

// Kalkulasi Dinamis Auto-Ranking dengan Filter Rumpun
const filteredRankingList = computed(() => {
  const list = eligibleStore.allEligibleStudents.map(item => {
    let grades = item.eligible_grades || []
    if (rankingCategoryFilter.value !== 'ALL') {
      grades = grades.filter(g => g.subjects?.category === rankingCategoryFilter.value)
    }

    let dynamicAverage = 0
    if (grades.length > 0) {
      const sum = grades.reduce((acc, g) => acc + (Number(g.subject_average) || 0), 0)
      dynamicAverage = Number((sum / grades.length).toFixed(2))
    } else {
      dynamicAverage = Number(item.overall_average) || 0
    }

    return {
      ...item,
      filteredAverage: dynamicAverage,
      filteredGradesCount: grades.length
    }
  })

  // Urutkan dari nilai tertinggi ke terendah
  return list.sort((a, b) => b.filteredAverage - a.filteredAverage)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col">
    <!-- SIDEBAR KHUSUS MODUL ELIGIBLE (STYLE PERSIS TRACER STUDY) -->
    <EligibleSidebar v-model:activeTab="activeTab" />

    <!-- KONTEN UTAMA DENGAN OFFSET SIDEBAR lg:pl-64 xl:pl-72 -->
    <div class="flex-1 flex flex-col min-w-0 lg:pl-64 xl:pl-72 pb-16">
      
      <!-- TOP BAR RINGKAS -->
      <header class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-purple-100 dark:border-slate-800 sticky top-0 z-20 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        <div>
          <h1 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
            <span>Kelola Siswa Eligible SNBP</span>
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">Ruang BK SMA Negeri 2 Ngawi &bull; Tahun Ajaran {{ eligibleStore.currentAcademicYear }}</p>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <span class="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300/70 shadow-2xs">
            Total Siswa: {{ eligibleStore.allEligibleStudents.length }}
          </span>
        </div>
      </header>

      <main class="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-6 space-y-6">
      
      <!-- TAB 1: DAFTAR SISWA & PENCARIAN ADD -->
      <section v-if="activeTab === 'siswa'" class="space-y-6">
        
        <!-- PENCARIAN SISWA UNTUK ADD ELIGIBLE -->
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Tambahkan Siswa ke Kuota Eligible
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Cari nama siswa aktif dari database sekolah, lalu klik tombol "Add Eligible".
            </p>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                v-model="studentSearchQuery"
                @keyup.enter="handleSearchStudents"
                placeholder="Ketik nama siswa, NISN, atau NIS untuk mencari otomatis..."
                class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
              />

              <!-- Indikator Loading / Tombol Clear di Kanan Input -->
              <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                <i v-if="isSearchingStudents" class="fa-solid fa-spinner fa-spin text-purple-600 dark:text-purple-400 text-sm"></i>
                <button
                  v-else-if="studentSearchQuery"
                  type="button"
                  @click="clearStudentSearch"
                  class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
                  title="Hapus pencarian"
                >
                  <i class="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>
            </div>
            <button
              type="button"
              @click="handleSearchStudents"
              :disabled="isSearchingStudents || !studentSearchQuery.trim()"
              class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <i v-if="isSearchingStudents" class="fa-solid fa-spinner fa-spin"></i>
              <span v-else>Cari</span>
            </button>
          </div>

          <!-- HASIL PENCARIAN OTOMATIS -->
          <div v-if="studentSearchResults.length > 0" class="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xs">
            <div
              v-for="s in studentSearchResults"
              :key="s.id"
              class="p-3.5 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
            >
              <div>
                <span class="font-bold text-sm text-slate-900 dark:text-white">{{ s.nama }}</span>
                <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>Kelas {{ s.kelas || '-' }}</span>
                  <span>&bull;</span>
                  <span>NISN: {{ s.nisn || '-' }}</span>
                  <span>&bull;</span>
                  <span>NIS: {{ s.nis || '-' }}</span>
                </div>
              </div>

              <div>
                <button
                  v-if="!s.isAlreadyEligible"
                  type="button"
                  @click="handleAddEligible(s)"
                  class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <i class="fa-solid fa-plus"></i>
                  <span>Add Eligible</span>
                </button>
                <span v-else class="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-200">
                  Sudah Terdaftar
                </span>
              </div>
            </div>
          </div>

          <!-- PESAN JIKA TIDAK DITEMUKAN -->
          <div
            v-else-if="hasSearched && !isSearchingStudents && studentSearchQuery.trim()"
            class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2"
          >
            <i class="fa-solid fa-circle-info text-amber-600 text-sm"></i>
            <span>Tidak ditemukan siswa aktif dengan nama atau NISN "<strong>{{ studentSearchQuery }}</strong>".</span>
          </div>
        </div>

        <!-- TABEL SELURUH SISWA ELIGIBLE SAAT INI -->
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Daftar Siswa Eligible Aktif ({{ eligibleStore.allEligibleStudents.length }})
            </h2>
          </div>

          <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="p-3">Nama Siswa</th>
                  <th class="p-3">Kelas / NISN</th>
                  <th class="p-3 text-center">Status Pilihan</th>
                  <th class="p-3 text-center">Status Nilai</th>
                  <th class="p-3 text-center">Rata-Rata</th>
                  <th class="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="item in eligibleStore.allEligibleStudents" :key="item.id" class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td class="p-3">
                    <span class="font-bold text-slate-900 dark:text-white">{{ item.users?.nama }}</span>
                  </td>
                  <td class="p-3 text-xs text-slate-500 dark:text-slate-400">
                    <div>Kelas {{ item.users?.kelas || '-' }}</div>
                    <div class="font-mono">NISN: {{ item.users?.nisn || '-' }}</div>
                  </td>
                  <td class="p-3 text-center">
                    <span
                      class="px-2.5 py-1 rounded-full text-xs font-bold"
                      :class="item.choice_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : (item.choice_status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')"
                    >
                      {{ item.choice_status }}
                    </span>
                  </td>
                  <td class="p-3 text-center">
                    <span
                      class="px-2.5 py-1 rounded-full text-xs font-bold"
                      :class="item.grade_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : (item.grade_status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')"
                    >
                      {{ item.grade_status }}
                    </span>
                  </td>
                  <td class="p-3 text-center font-mono font-bold text-[#0284C7] dark:text-sky-300">
                    {{ item.overall_average || '0.00' }}
                  </td>
                  <td class="p-3 text-right">
                    <button
                      type="button"
                      @click="handleRemoveEligible(item)"
                      class="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
                      title="Keluarkan dari daftar eligible"
                    >
                      <i class="fa-solid fa-trash-can mr-1"></i>
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
      <section v-if="activeTab === 'validasi'" class="space-y-6">
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Panel Verifikasi / ACC Ganda Guru BK
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              ACC Pilihan Jurusan agar siswa tampil di list publik. ACC Nilai Rapor untuk mengunci tabel nilai siswa.
            </p>
          </div>

          <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="p-3">Nama Siswa</th>
                  <th class="p-3">Pilihan 1 &amp; 2 (Prodi &amp; Kampus)</th>
                  <th class="p-3 text-center">ACC Pilihan Jurusan</th>
                  <th class="p-3 text-center">ACC Nilai Rapor</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="item in eligibleStore.allEligibleStudents" :key="item.id" class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td class="p-3">
                    <span class="font-bold text-slate-900 dark:text-white block">{{ item.users?.nama }}</span>
                    <span class="text-xs text-slate-400">Kelas {{ item.users?.kelas || '-' }}</span>
                  </td>

                  <td class="p-3 text-xs space-y-1">
                    <div v-for="c in (item.eligible_choices || [])" :key="c.id" class="flex items-center gap-1.5">
                      <span class="font-bold text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">P{{ c.priority }}</span>
                      <span class="font-medium text-slate-800 dark:text-slate-200">{{ c.majors?.name }} &bull; {{ c.universities?.name }}</span>
                    </div>
                    <div v-if="!item.eligible_choices || item.eligible_choices.length === 0" class="text-slate-400 italic">
                      Belum memilih prodi
                    </div>
                  </td>

                  <!-- AKSI ACC PILIHAN -->
                  <td class="p-3 text-center">
                    <div class="inline-flex items-center gap-1">
                      <button
                        type="button"
                        @click="handleSetChoiceStatus(item, 'approved')"
                        class="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
                        :class="item.choice_status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'"
                      >
                        ACC
                      </button>
                      <button
                        type="button"
                        @click="handleSetChoiceStatus(item, 'rejected')"
                        class="px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                        :class="item.choice_status === 'rejected' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'"
                      >
                        Tolak
                      </button>
                    </div>
                  </td>

                  <!-- AKSI ACC NILAI -->
                  <td class="p-3 text-center">
                    <div class="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        @click="openGradeDetail(item)"
                        class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-colors"
                        title="Periksa Rincian Nilai"
                      >
                        <i class="fa-solid fa-eye mr-1"></i>
                        <span>Cek ({{ item.overall_average || '0' }})</span>
                      </button>

                      <button
                        type="button"
                        @click="handleSetGradeStatus(item, 'approved')"
                        class="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
                        :class="item.grade_status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'"
                      >
                        ACC &amp; Kunci
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 3: MATRIKS NILAI & AUTO-RANKING DENGAN FILTER RUMPUN -->
      <section v-if="activeTab === 'ranking'" class="space-y-6">
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Matriks Nilai &amp; Auto-Ranking Siswa Eligible
              </h2>
              <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Peringkat otomatis terhitung dari rata-rata nilai rapor.
              </p>
            </div>

            <!-- FILTER RUMPUN MAPEL -->
            <div class="flex items-center gap-2">
              <label class="text-xs font-bold text-slate-500">Filter Rumpun:</label>
              <select
                v-model="rankingCategoryFilter"
                class="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-[#0284C7] dark:text-sky-300 focus:outline-none"
              >
                <option value="ALL">Semua Mapel</option>
                <option value="Wajib">Mapel Wajib Saja</option>
                <option value="IPA">Rumpun IPA Saja</option>
                <option value="IPS">Rumpun IPS Saja</option>
                <option value="Bahasa">Rumpun Bahasa Saja</option>
              </select>
            </div>
          </div>

          <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="p-3 text-center w-14">Rank</th>
                  <th class="p-3">Nama Siswa</th>
                  <th class="p-3">Kelas</th>
                  <th class="p-3">Pilihan Prodi (SNBP)</th>
                  <th class="p-3 text-center">Status ACC Nilai</th>
                  <th class="p-3 text-center font-mono bg-sky-50 dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-300">
                    Nilai Rata-Rata
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="(item, idx) in filteredRankingList" :key="item.id" class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td class="p-3 text-center font-mono font-bold text-sm">
                    <span
                      class="w-7 h-7 rounded-full inline-flex items-center justify-center text-xs"
                      :class="idx === 0 ? 'bg-amber-400 text-amber-950 font-black' : (idx === 1 ? 'bg-slate-300 text-slate-900 font-bold' : (idx === 2 ? 'bg-amber-700 text-white font-bold' : 'text-slate-500'))"
                    >
                      #{{ idx + 1 }}
                    </span>
                  </td>

                  <td class="p-3 font-bold text-slate-900 dark:text-white">
                    {{ item.users?.nama }}
                  </td>

                  <td class="p-3 text-xs text-slate-500">
                    {{ item.users?.kelas || '-' }}
                  </td>

                  <td class="p-3 text-xs space-y-1">
                    <div v-for="c in (item.eligible_choices || [])" :key="c.id">
                      <span class="font-bold text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 mr-1">P{{ c.priority }}</span>
                      <span>{{ c.majors?.name }} ({{ c.universities?.name }})</span>
                    </div>
                  </td>

                  <td class="p-3 text-center">
                    <span
                      class="px-2 py-0.5 rounded text-[11px] font-bold"
                      :class="item.grade_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
                    >
                      {{ item.grade_status === 'approved' ? 'Sudah ACC' : 'Belum ACC' }}
                    </span>
                  </td>

                  <td class="p-3 text-center font-mono font-extrabold text-base text-[#0284C7] dark:text-sky-300 bg-sky-50/50 dark:bg-sky-950/30">
                    {{ item.filteredAverage }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 4: MASTER MATA PELAJARAN -->
      <section v-if="activeTab === 'mapel'" class="space-y-6">
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Kelola Master Mata Pelajaran (Dropdown Siswa)
            </h2>
          </div>

          <div v-if="subjectFeedback.text" class="p-3.5 rounded-xl text-xs font-semibold" :class="subjectFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'">
            {{ subjectFeedback.text }}
          </div>

          <!-- FORM TAMBAH / EDIT MAPEL -->
          <div class="flex flex-col sm:flex-row items-end gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div class="flex-1 w-full">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Mata Pelajaran
              </label>
              <input
                type="text"
                v-model="subjectForm.name"
                placeholder="Contoh: Matematika Tingkat Lanjut"
                class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div class="w-full sm:w-44">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kategori Rumpun
              </label>
              <select
                v-model="subjectForm.category"
                class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold"
              >
                <option value="Wajib">Wajib</option>
                <option value="IPA">IPA</option>
                <option value="IPS">IPS</option>
                <option value="Bahasa">Bahasa</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="handleSaveSubject"
                class="px-4 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-bold shadow-xs transition-colors"
              >
                {{ isEditingSubject ? 'Simpan Perubahan' : 'Tambah Mapel' }}
              </button>
              <button
                v-if="isEditingSubject"
                type="button"
                @click="resetSubjectForm"
                class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
            </div>
          </div>

          <!-- TABEL MASTER MAPEL -->
          <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th class="p-3">Nama Mata Pelajaran</th>
                  <th class="p-3 text-center">Rumpun Kategori</th>
                  <th class="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="s in eligibleStore.masterSubjects" :key="s.id" class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td class="p-3 font-semibold text-slate-900 dark:text-white">
                    {{ s.name }}
                  </td>
                  <td class="p-3 text-center">
                    <span
                      class="px-2.5 py-0.5 rounded-full text-xs font-bold"
                      :class="s.category === 'IPA' ? 'bg-sky-100 text-sky-800' : (s.category === 'IPS' ? 'bg-emerald-100 text-emerald-800' : (s.category === 'Bahasa' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'))"
                    >
                      {{ s.category }}
                    </span>
                  </td>
                  <td class="p-3 text-right space-x-2">
                    <button
                      type="button"
                      @click="startEditSubject(s)"
                      class="text-xs text-sky-600 hover:underline font-bold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      @click="handleDeleteSubject(s)"
                      class="text-xs text-rose-600 hover:underline font-bold"
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
        <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Sinkronisasi Data Perguruan Tinggi &amp; Program Studi (SNPMB)
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Perbarui daftar Perguruan Tinggi Negeri dan daya tampung program studi resmi SNBP/SNBT.
            </p>
          </div>

          <div v-if="syncFeedback.text" class="p-4 rounded-xl text-sm font-semibold flex items-center gap-2" :class="syncFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'">
            <i :class="syncFeedback.type === 'success' ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-solid fa-triangle-exclamation text-rose-600'"></i>
            <span>{{ syncFeedback.text }}</span>
          </div>

          <div class="p-6 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="space-y-1 text-center sm:text-left">
              <div class="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i class="fa-solid fa-database text-[#0284C7]"></i>
                <span>Database SNPMB Tersimpan: {{ eligibleStore.universitiesList.length }} Perguruan Tinggi</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Klik tombol di samping untuk mengambil update daya tampung dan jurusan terbaru.
              </p>
            </div>

            <button
              type="button"
              @click="handleSyncSnpmb"
              :disabled="isSyncingSnpmb"
              class="px-5 py-3 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              <i v-if="isSyncingSnpmb" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-rotate"></i>
              <span>{{ isSyncingSnpmb ? 'Sedang Sinkronisasi...' : 'Sync Data SNPMB Sekarang' }}</span>
            </button>
          </div>
        </div>
      </section>

    </main>

    <!-- MODAL RINCIAN NILAI SISWA UNTUK ACC -->
    <div
      v-if="isGradeDetailModalOpen && selectedEligibleDetail"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
      @click.self="isGradeDetailModalOpen = false"
    >
      <div class="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white">
              Rincian Nilai: {{ selectedEligibleDetail.users?.nama }}
            </h3>
            <p class="text-xs text-slate-400">Kelas {{ selectedEligibleDetail.users?.kelas || '-' }} &bull; NISN: {{ selectedEligibleDetail.users?.nisn || '-' }}</p>
          </div>
          <button @click="isGradeDetailModalOpen = false" class="text-slate-400 hover:text-slate-600">
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th class="p-2.5">Mapel</th>
                <th class="p-2 text-center">S1</th>
                <th class="p-2 text-center">S2</th>
                <th class="p-2 text-center">S3</th>
                <th class="p-2 text-center">S4</th>
                <th class="p-2 text-center">S5</th>
                <th class="p-2 text-center bg-sky-50 dark:bg-sky-950/50">Rata-Rata</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="g in (selectedEligibleDetail.eligible_grades || [])" :key="g.id">
                <td class="p-2.5 font-medium">{{ g.subjects?.name }}</td>
                <td class="p-2 text-center font-mono">{{ g.sem_1 }}</td>
                <td class="p-2 text-center font-mono">{{ g.sem_2 }}</td>
                <td class="p-2 text-center font-mono">{{ g.sem_3 }}</td>
                <td class="p-2 text-center font-mono">{{ g.sem_4 }}</td>
                <td class="p-2 text-center font-mono">{{ g.sem_5 }}</td>
                <td class="p-2 text-center font-mono font-bold text-[#0284C7]">{{ g.subject_average }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between pt-2">
          <span class="text-xs font-bold text-slate-500">
            Rata-Rata Kumulatif: <strong class="text-base font-mono text-[#0284C7]">{{ selectedEligibleDetail.overall_average }}</strong>
          </span>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handleSetGradeStatus(selectedEligibleDetail, 'approved'); isGradeDetailModalOpen = false"
              class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              ACC &amp; Kunci Nilai
            </button>
            <button
              type="button"
              @click="isGradeDetailModalOpen = false"
              class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>

    </div>

    <!-- MODAL KONFIRMASI MODERN & NOTIFIKASI TOAST (PENGGANTI POPUP BROWSER) -->
    <ConfirmModal ref="confirmModal" />
    <Toast ref="toast" />
  </div>
</template>
