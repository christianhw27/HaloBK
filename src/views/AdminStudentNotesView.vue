<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore, COUNSELORS, NOTE_CATEGORIES } from '@/stores/chat'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import PublicNavbar from '@/components/PublicNavbar.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

// State Data Seluruh Siswa (Master Siswa Sekolah)
const allStudents = ref([])
const isLoadingStudents = ref(false)
const selectedStudent = ref(null)

// State Filter & Pencarian
const searchQuery = ref('')
const selectedGradeFilter = ref('ALL') // 'ALL' | 'X' | 'XI' | 'XII'
const selectedCounselorFilter = ref('ALL') // 'ALL' | nama konselor
const selectedCategoryFilter = ref('ALL') // 'ALL' | id kategori

// State Dropdown Interaktif Custom (Menghilangkan tampilan kaku native select)
const isFilterCounselorOpen = ref(false)
const isFilterCategoryOpen = ref(false)
const isModalCounselorOpen = ref(false)
const isModalCategoryOpen = ref(false)
const isStudentComboboxOpen = ref(false)

// State Lembar Full-Screen Workspace Tambah & Edit Catatan (Menggantikan Pop-up Modal)
const isEditorOpen = ref(false)
const isEditorExpanded = ref(false)
const isPreviousNotesOpen = ref(false)
// modalMode: 'NEW_STUDENT' (dari tombol Catat Siswa) | 'CURRENT_STUDENT' (dari tombol Tambah Catatan) | 'EDIT_NOTE'
const modalMode = ref('CURRENT_STUDENT')
const currentNoteId = ref(null)
const isSubmitting = ref(false)
const targetStudentId = ref('')
const studentSearchInModal = ref('')

const noteForm = ref({
  category: 'umum',
  title: '',
  content: '',
  counselor_name: ''
})

// Siswa yang dipilih di dalam modal mode NEW_STUDENT
const selectedTargetStudent = computed(() => {
  if (!targetStudentId.value) return null
  return allStudents.value.find(s => s.id === targetStudentId.value) || null
})

// State Modal Hapus Catatan
const isDeleteModalOpen = ref(false)
const noteToDelete = ref(null)
const isDeleting = ref(false)

// State Mobile View (list / detail)
const mobileView = ref('list') // 'list' | 'detail'

// Opsi Guru BK Penanggung Jawab
const counselorOptions = computed(() => {
  const set = new Set(COUNSELORS)
  if (authStore.userName && (authStore.userRole === 'admin' || authStore.userRole === 'guru')) {
    set.add(authStore.userName)
  }
  return Array.from(set)
})

function handleClickOutside(e) {
  if (!e.target.closest('#filter-counselor-container')) {
    isFilterCounselorOpen.value = false
  }
  if (!e.target.closest('#filter-category-container')) {
    isFilterCategoryOpen.value = false
  }
  if (!e.target.closest('#modal-counselor-container') && !e.target.closest('#editor-counselor-container')) {
    isModalCounselorOpen.value = false
  }
  if (!e.target.closest('#modal-category-container') && !e.target.closest('#editor-category-container')) {
    isModalCategoryOpen.value = false
  }
  if (!e.target.closest('#modal-student-combobox-container') && !e.target.closest('#editor-student-combobox-container')) {
    isStudentComboboxOpen.value = false
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    isFilterCounselorOpen.value = false
    isFilterCategoryOpen.value = false
    isModalCounselorOpen.value = false
    isModalCategoryOpen.value = false
    isStudentComboboxOpen.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('keydown', handleKeydown)

  await Promise.all([
    fetchStudentsList(),
    chatStore.fetchAllStudentNotes()
  ])

  // Cek apakah ada query studentId di URL (misal dibuka dari Chat Konseling)
  if (route.query.studentId) {
    const s = allStudents.value.find(item => item.id === route.query.studentId)
    if (s) {
      selectStudent(s)
    } else {
      // Jika siswa belum ada di master tapi ada di catatan
      const sample = chatStore.allStudentNotes.find(n => n.student_id === route.query.studentId)
      if (sample) {
        selectStudent({
          id: sample.student_id,
          nama: sample.student_name || 'Siswa',
          kelas: sample.student_class || '',
          nis: '',
          nisn: ''
        })
      }
    }
    if (route.query.action === 'new') {
      openAddNoteForCurrentStudent()
    }
  } else if (route.query.action === 'new') {
    openRecordNewStudentModal()
  } else if (filteredStudents.value.length > 0 && window.innerWidth >= 1024) {
    // Di desktop otomatis pilih siswa pertama yang memiliki catatan
    selectStudent(filteredStudents.value[0])
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleKeydown)
})

function selectModalStudent(student) {
  targetStudentId.value = student.id
  isStudentComboboxOpen.value = false
  studentSearchInModal.value = ''
}

function clearSelectedModalStudent() {
  targetStudentId.value = ''
  studentSearchInModal.value = ''
  isStudentComboboxOpen.value = true
}

function selectFilterCounselor(counselor) {
  selectedCounselorFilter.value = counselor
  isFilterCounselorOpen.value = false
}

function selectFilterCategory(catId) {
  selectedCategoryFilter.value = catId
  isFilterCategoryOpen.value = false
}

function selectModalCounselor(counselor) {
  noteForm.value.counselor_name = counselor
  isModalCounselorOpen.value = false
}

function selectModalCategory(catId) {
  noteForm.value.category = catId
  isModalCategoryOpen.value = false
}

// Mengambil master daftar akun siswa dari Supabase (untuk opsi tambah manual)
async function fetchStudentsList() {
  isLoadingStudents.value = true
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, foto_url')
        .eq('role', 'siswa')
        .order('nama', { ascending: true })

      if (!error && data) {
        allStudents.value = data
        return
      }
    }
    // Fallback jika database offline / belum terhubung
    allStudents.value = [
      { id: 'siswa-1', nama: 'Bernadetta Andini Emanuella', kelas: 'XII 3', nis: '12345', nisn: '0071234567' },
      { id: 'siswa-2', nama: 'Ahmad Faisal Rahman', kelas: 'XII MIPA 1', nis: '12346', nisn: '0061234568' },
      { id: 'siswa-3', nama: 'Dewi Lestari Putri', kelas: 'X 2', nis: '12347', nisn: '0081234569' }
    ]
  } catch (err) {
    console.warn('Gagal memuat daftar siswa:', err.message)
  } finally {
    isLoadingStudents.value = false
  }
}

// Map jumlah catatan per student_id
const studentNotesCountMap = computed(() => {
  const map = {}
  chatStore.allStudentNotes.forEach(note => {
    if (note.student_id) {
      map[note.student_id] = (map[note.student_id] || 0) + 1
    }
  })
  return map
})

// HANYA SISWA YANG SUDAH MEMILIKI CATATAN YANG TAMPIL DI BUKU CATATAN
const studentsWithNotes = computed(() => {
  const registeredMap = new Map(allStudents.value.map(s => [s.id, s]))
  const map = new Map()

  chatStore.allStudentNotes.forEach(note => {
    if (!note.student_id) return
    if (!map.has(note.student_id)) {
      let student = registeredMap.get(note.student_id)
      if (!student) {
        // Fallback jika siswa belum ada di master users (misal data chat anonim/tersimpan)
        student = {
          id: note.student_id,
          nama: note.student_name || 'Siswa',
          kelas: note.student_class || '',
          nis: '',
          nisn: ''
        }
      }
      map.set(note.student_id, student)
    }
  })

  return Array.from(map.values()).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
})

// Filter siswa berdasarkan pencarian, kelas, guru BK, dan kategori
const filteredStudents = computed(() => {
  return studentsWithNotes.value.filter(s => {
    // 1. Filter Pencarian (Nama, Kelas, NISN)
    const q = searchQuery.value.trim().toLowerCase()
    const matchSearch = !q ||
      (s.nama && s.nama.toLowerCase().includes(q)) ||
      (s.kelas && s.kelas.toLowerCase().includes(q)) ||
      (s.nis && s.nis.toLowerCase().includes(q)) ||
      (s.nisn && s.nisn.toLowerCase().includes(q))

    // 2. Filter Tingkat Kelas
    let matchGrade = true
    if (selectedGradeFilter.value !== 'ALL') {
      const k = (s.kelas || '').toUpperCase()
      if (selectedGradeFilter.value === 'X') {
        matchGrade = k.startsWith('X ') || k === 'X' || k.startsWith('X-')
      } else if (selectedGradeFilter.value === 'XI') {
        matchGrade = k.startsWith('XI ') || k === 'XI' || k.startsWith('XI-')
      } else if (selectedGradeFilter.value === 'XII') {
        matchGrade = k.startsWith('XII ') || k === 'XII' || k.startsWith('XII-')
      }
    }

    // 3. Filter berdasarkan Guru BK & Kategori Catatan
    const notesOfStudent = chatStore.allStudentNotes.filter(n => n.student_id === s.id)
    
    let matchCounselor = true
    if (selectedCounselorFilter.value !== 'ALL') {
      matchCounselor = notesOfStudent.some(n => n.counselor_name === selectedCounselorFilter.value)
    }

    let matchCategory = true
    if (selectedCategoryFilter.value !== 'ALL') {
      matchCategory = notesOfStudent.some(n => n.category === selectedCategoryFilter.value)
    }

    return matchSearch && matchGrade && matchCounselor && matchCategory
  })
})

// Catatan milik siswa yang sedang dipilih (difilter jika filter aktif)
const currentStudentNotes = computed(() => {
  if (!selectedStudent.value) return []
  let list = chatStore.allStudentNotes.filter(n => n.student_id === selectedStudent.value.id)

  if (selectedCounselorFilter.value !== 'ALL') {
    list = list.filter(n => n.counselor_name === selectedCounselorFilter.value)
  }
  if (selectedCategoryFilter.value !== 'ALL') {
    list = list.filter(n => n.category === selectedCategoryFilter.value)
  }

  return list
})

// Daftar siswa yang dapat dipilih saat Guru BK ingin mencatat siswa baru
const selectableStudentsInModal = computed(() => {
  const q = studentSearchInModal.value.trim().toLowerCase()
  let list = allStudents.value

  if (q) {
    list = list.filter(s =>
      (s.nama && s.nama.toLowerCase().includes(q)) ||
      (s.kelas && s.kelas.toLowerCase().includes(q)) ||
      (s.nis && s.nis.toLowerCase().includes(q)) ||
      (s.nisn && s.nisn.toLowerCase().includes(q))
    )
  }

  // Prioritaskan siswa yang BELUM memiliki catatan di posisi atas
  return [...list].sort((a, b) => {
    const hasNotesA = (studentNotesCountMap.value[a.id] || 0) > 0 ? 1 : 0
    const hasNotesB = (studentNotesCountMap.value[b.id] || 0) > 0 ? 1 : 0
    if (hasNotesA !== hasNotesB) return hasNotesA - hasNotesB
    return (a.nama || '').localeCompare(b.nama || '')
  })
})

function selectStudent(student) {
  selectedStudent.value = student
  isEditorOpen.value = false
  isEditorExpanded.value = false
  mobileView.value = 'detail'
}

function handleBackToListMobile() {
  isEditorOpen.value = false
  isEditorExpanded.value = false
  mobileView.value = 'list'
}

function closeEditor() {
  isEditorOpen.value = false
  isEditorExpanded.value = false
  isStudentComboboxOpen.value = false
  isModalCounselorOpen.value = false
  isModalCategoryOpen.value = false
  if (selectedStudent.value) {
    mobileView.value = 'detail'
  } else {
    mobileView.value = 'list'
  }
}

function resetAllFilters() {
  searchQuery.value = ''
  selectedGradeFilter.value = 'ALL'
  selectedCounselorFilter.value = 'ALL'
  selectedCategoryFilter.value = 'ALL'
}

function getCategoryInfo(catId) {
  return NOTE_CATEGORIES.find(c => c.id === catId) || NOTE_CATEGORIES[0]
}

function getCategoryDescription(catId) {
  switch (catId) {
    case 'pribadi': return 'Karakter & Masalah Pribadi'
    case 'sosial': return 'Hubungan Teman & Lingkungan'
    case 'belajar': return 'Motivasi & Nilai Akademik'
    case 'karir': return 'Peminatan & Kuliah / Kerja'
    case 'tatap_muka': return 'Konseling Tatap Muka Ruang BK'
    case 'home_visit': return 'Kunjungan Rumah'
    default: return 'Catatan Bimbingan Umum'
  }
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) + ' • ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
}

// 1. Aksi Tombol Kiri: Catat Siswa Baru (Mencari dan mencatat siswa yang belum tercatat)
function openRecordNewStudentModal() {
  modalMode.value = 'NEW_STUDENT'
  currentNoteId.value = null
  targetStudentId.value = ''
  studentSearchInModal.value = ''
  isStudentComboboxOpen.value = false
  isModalCounselorOpen.value = false
  isModalCategoryOpen.value = false
  noteForm.value = {
    category: 'umum',
    title: '',
    content: '',
    counselor_name: authStore.userName || COUNSELORS[0]
  }
  isEditorOpen.value = true
  isEditorExpanded.value = false
  mobileView.value = 'editor'
}

// 2. Aksi Tombol Kanan: Tambah Catatan untuk Siswa Saat Ini (Terkunci langsung ke selectedStudent)
function openAddNoteForCurrentStudent() {
  if (!selectedStudent.value) {
    openRecordNewStudentModal()
    return
  }
  modalMode.value = 'CURRENT_STUDENT'
  currentNoteId.value = null
  targetStudentId.value = selectedStudent.value.id
  studentSearchInModal.value = ''
  isStudentComboboxOpen.value = false
  isModalCounselorOpen.value = false
  isModalCategoryOpen.value = false
  noteForm.value = {
    category: 'umum',
    title: '',
    content: '',
    counselor_name: authStore.userName || COUNSELORS[0]
  }
  isEditorOpen.value = true
  isEditorExpanded.value = false
  mobileView.value = 'editor'
}

// 3. Aksi Edit Catatan
function openEditNoteModal(note) {
  modalMode.value = 'EDIT_NOTE'
  currentNoteId.value = note.id
  targetStudentId.value = note.student_id
  isStudentComboboxOpen.value = false
  isModalCounselorOpen.value = false
  isModalCategoryOpen.value = false
  noteForm.value = {
    category: note.category || 'umum',
    title: note.title || '',
    content: note.content || '',
    counselor_name: note.counselor_name || authStore.userName || COUNSELORS[0]
  }
  isEditorOpen.value = true
  isEditorExpanded.value = false
  mobileView.value = 'editor'
}

// Sisipkan Format Asesmen BK
function insertAssessmentTemplate() {
  const template = `[Hasil Asesmen Guru BK]
• Latar Belakang Masalah: 
• Dinamika Psikologis/Akademik: 
• Rencana Tindak Lanjut / Jadwal Pertemuan: `

  if (!noteForm.value.content.trim()) {
    noteForm.value.content = template
  } else {
    noteForm.value.content += `\n\n${template}`
  }
}

// Submit Catatan (Create / Update)
async function handleSubmitNote() {
  let student = null
  if (modalMode.value === 'NEW_STUDENT') {
    if (!targetStudentId.value) {
      alert('Mohon pilih siswa baru yang ingin dicatat terlebih dahulu.')
      return
    }
    student = allStudents.value.find(s => s.id === targetStudentId.value)
  } else {
    // CURRENT_STUDENT atau EDIT_NOTE
    student = selectedStudent.value || allStudents.value.find(s => s.id === targetStudentId.value)
  }

  if (!student) {
    alert('Data siswa tidak ditemukan.')
    return
  }
  if (!noteForm.value.title.trim() || !noteForm.value.content.trim()) {
    alert('Mohon isi judul dan isi catatan bimbingan.')
    return
  }

  isSubmitting.value = true
  try {
    if (modalMode.value === 'EDIT_NOTE' && currentNoteId.value) {
      await chatStore.updateStudentNote(currentNoteId.value, {
        category: noteForm.value.category,
        title: noteForm.value.title.trim(),
        content: noteForm.value.content.trim(),
        counselor_name: noteForm.value.counselor_name
      })
    } else {
      await chatStore.createStudentNote({
        student_id: student.id,
        student_name: student.nama,
        student_class: student.kelas || '',
        counselor_name: noteForm.value.counselor_name || authStore.userName || 'Guru BK SMADA',
        category: noteForm.value.category,
        title: noteForm.value.title.trim(),
        content: noteForm.value.content.trim()
      })
      // Otomatis arahkan dan buka siswa tersebut di panel kanan
      selectStudent(student)
    }
    isEditorOpen.value = false
    isEditorExpanded.value = false
    mobileView.value = 'detail'
  } catch (err) {
    alert('Gagal menyimpan catatan: ' + (err.message || 'Error'))
  } finally {
    isSubmitting.value = false
  }
}

// Konfirmasi Hapus Catatan
function openDeleteNoteModal(note) {
  noteToDelete.value = note
  isDeleteModalOpen.value = true
}

async function confirmDeleteNote() {
  if (!noteToDelete.value) return
  isDeleting.value = true
  try {
    await chatStore.deleteStudentNote(noteToDelete.value.id)
    isDeleteModalOpen.value = false
    noteToDelete.value = null

    // Jika siswa ini sudah tidak memiliki catatan sama sekali setelah dihapus,
    // refresh pilihan jika perlu
    if (selectedStudent.value && currentStudentNotes.value.length === 0) {
      if (filteredStudents.value.length > 0) {
        selectStudent(filteredStudents.value[0])
      } else {
        selectedStudent.value = null
      }
    }
  } catch (err) {
    alert('Gagal menghapus catatan: ' + (err.message || 'Error'))
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="h-screen h-[100dvh] bg-[#F8FAFC] dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans overflow-hidden">
    
    <!-- Navbar Header -->
    <header class="shrink-0 z-30">
      <PublicNavbar />
    </header>

    <!-- MAIN WORKSPACE -->
    <main class="flex-1 w-full p-0 m-0 flex flex-col min-h-0 overflow-hidden">
      <div class="flex-1 w-full bg-white dark:bg-slate-900 flex flex-col lg:grid lg:grid-cols-12 overflow-hidden min-h-0">
        
        <!-- ============================================================== -->
        <!-- KOLOM KIRI: DAFTAR SISWA YANG MEMILIKI CATATAN                -->
        <!-- Tampil di mobile jika mobileView === 'list'                    -->
        <!-- ============================================================== -->
        <aside
          class="flex-1 lg:flex-initial border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 h-full min-h-0 transition-all duration-200"
          :class="[
            mobileView === 'list' ? 'flex' : 'hidden lg:flex',
            isEditorOpen && isEditorExpanded ? 'lg:hidden' : 'lg:col-span-4 xl:col-span-4 2xl:col-span-3'
          ]"
        >
          <!-- Toolbar Header Kiri -->
          <div class="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0 bg-slate-50/50 dark:bg-slate-900">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center text-sm shadow-2xs font-bold shrink-0">
                  <i class="fa-solid fa-book-bookmark"></i>
                </div>
                <div class="min-w-0">
                  <h1 class="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight truncate">
                    Buku Catatan Siswa
                  </h1>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {{ filteredStudents.length }} Siswa Tercatat
                  </p>
                </div>
              </div>

              <!-- Tombol 1: CATAT SISWA BARU (Kiri) -->
              <button
                type="button"
                @click="openRecordNewStudentModal"
                class="px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                title="Catat Siswa Baru (Pilih dari direktori sekolah)"
              >
                <i class="fa-solid fa-user-plus text-[10px]"></i>
                <span class="hidden sm:inline">Catat Siswa</span>
                <span class="sm:hidden">Catat</span>
              </button>
            </div>

            <!-- Input Pencarian Siswa -->
            <div class="relative">
              <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-xs"></i>
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Cari siswa tercatat..."
                class="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-2xs"
              />
            </div>

            <!-- Filter Tabs Tingkat Kelas -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-semibold pt-0.5">
              <button
                type="button"
                @click="selectedGradeFilter = 'ALL'"
                class="px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap text-[11px]"
                :class="selectedGradeFilter === 'ALL'
                  ? 'bg-purple-600 text-white font-bold shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
              >
                Semua
              </button>
              <button
                v-for="grade in ['X', 'XI', 'XII']"
                :key="grade"
                type="button"
                @click="selectedGradeFilter = grade"
                class="px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap text-[11px]"
                :class="selectedGradeFilter === grade
                  ? 'bg-purple-600 text-white font-bold shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
              >
                Kelas {{ grade }}
              </button>
            </div>

            <!-- BARIS DROPDOWN FILTER: GURU BK & KATEGORI LAYANAN (MODERN CUSTOM POPOVER) -->
            <div class="grid grid-cols-2 gap-2 pt-0.5">
              <!-- Dropdown Filter Guru BK -->
              <div id="filter-counselor-container" class="relative">
                <button
                  type="button"
                  @click="isFilterCounselorOpen = !isFilterCounselorOpen; isFilterCategoryOpen = false"
                  class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1.5 transition-all shadow-2xs hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer"
                  :class="isFilterCounselorOpen ? 'border-purple-500 ring-2 ring-purple-500/20' : (selectedCounselorFilter !== 'ALL' ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' : 'border-slate-200 dark:border-slate-700')"
                >
                  <div class="flex items-center gap-1.5 min-w-0 truncate">
                    <i class="fa-solid fa-user-tie text-[10px]" :class="selectedCounselorFilter !== 'ALL' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'"></i>
                    <span class="truncate">{{ selectedCounselorFilter === 'ALL' ? 'Semua Guru' : selectedCounselorFilter }}</span>
                  </div>
                  <i class="fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 shrink-0" :class="{ 'rotate-180 text-purple-600': isFilterCounselorOpen }"></i>
                </button>

                <!-- Floating Popover Filter Guru -->
                <Transition
                  enter-active-class="transition duration-150 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <div
                    v-if="isFilterCounselorOpen"
                    class="absolute top-full left-0 right-0 sm:w-56 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/70 dark:shadow-slate-950/90 border border-slate-200 dark:border-slate-800 overflow-hidden py-1.5 backdrop-blur-md"
                  >
                    <button
                      type="button"
                      @click="selectFilterCounselor('ALL')"
                      class="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      :class="selectedCounselorFilter === 'ALL'
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                    >
                      <span class="flex items-center gap-2">
                        <i class="fa-solid fa-users text-xs text-slate-400"></i>
                        <span>Semua Guru BK</span>
                      </span>
                      <i v-if="selectedCounselorFilter === 'ALL'" class="fa-solid fa-check text-xs text-purple-600"></i>
                    </button>

                    <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>

                    <button
                      v-for="c in counselorOptions"
                      :key="c"
                      type="button"
                      @click="selectFilterCounselor(c)"
                      class="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      :class="selectedCounselorFilter === c
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                    >
                      <span class="truncate flex items-center gap-2 min-w-0">
                        <span class="w-5 h-5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {{ c.slice(0, 1) }}
                        </span>
                        <span class="truncate">{{ c }}</span>
                      </span>
                      <i v-if="selectedCounselorFilter === c" class="fa-solid fa-check text-xs text-purple-600 shrink-0 ml-1.5"></i>
                    </button>
                  </div>
                </Transition>
              </div>

              <!-- Dropdown Filter Kategori Layanan -->
              <div id="filter-category-container" class="relative">
                <button
                  type="button"
                  @click="isFilterCategoryOpen = !isFilterCategoryOpen; isFilterCounselorOpen = false"
                  class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1.5 transition-all shadow-2xs hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer"
                  :class="isFilterCategoryOpen ? 'border-purple-500 ring-2 ring-purple-500/20' : (selectedCategoryFilter !== 'ALL' ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' : 'border-slate-200 dark:border-slate-700')"
                >
                  <div class="flex items-center gap-1.5 min-w-0 truncate">
                    <i class="fa-solid fa-tags text-[10px]" :class="selectedCategoryFilter !== 'ALL' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'"></i>
                    <span class="truncate">{{ selectedCategoryFilter === 'ALL' ? 'Semua Layanan' : getCategoryInfo(selectedCategoryFilter).label }}</span>
                  </div>
                  <i class="fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 shrink-0" :class="{ 'rotate-180 text-purple-600': isFilterCategoryOpen }"></i>
                </button>

                <!-- Floating Popover Filter Layanan -->
                <Transition
                  enter-active-class="transition duration-150 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <div
                    v-if="isFilterCategoryOpen"
                    class="absolute top-full right-0 sm:left-auto w-56 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/70 dark:shadow-slate-950/90 border border-slate-200 dark:border-slate-800 overflow-hidden py-1.5 backdrop-blur-md"
                  >
                    <button
                      type="button"
                      @click="selectFilterCategory('ALL')"
                      class="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      :class="selectedCategoryFilter === 'ALL'
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                    >
                      <span class="flex items-center gap-2">
                        <i class="fa-solid fa-layer-group text-xs text-slate-400"></i>
                        <span>Semua Layanan</span>
                      </span>
                      <i v-if="selectedCategoryFilter === 'ALL'" class="fa-solid fa-check text-xs text-purple-600"></i>
                    </button>

                    <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>

                    <button
                      v-for="cat in NOTE_CATEGORIES"
                      :key="cat.id"
                      type="button"
                      @click="selectFilterCategory(cat.id)"
                      class="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      :class="selectedCategoryFilter === cat.id
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                    >
                      <span class="truncate flex items-center gap-2 min-w-0">
                        <span class="w-2 h-2 rounded-full shrink-0" :class="cat.id === 'pribadi' ? 'bg-purple-500' : (cat.id === 'sosial' ? 'bg-sky-500' : (cat.id === 'belajar' ? 'bg-emerald-500' : 'bg-amber-500'))"></span>
                        <span class="truncate">{{ cat.label }}</span>
                      </span>
                      <i v-if="selectedCategoryFilter === cat.id" class="fa-solid fa-check text-xs text-purple-600 shrink-0 ml-1.5"></i>
                    </button>
                  </div>
                </Transition>
              </div>
            </div>
          </div>

          <!-- Daftar Baris Siswa yang Memiliki Catatan -->
          <div class="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100 dark:divide-slate-800/60">
            <!-- Skeleton Loading State Siswa -->
            <div v-if="isLoadingStudents" class="divide-y divide-slate-100 dark:divide-slate-800/60">
              <div v-for="i in 5" :key="i" class="p-3.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3 animate-pulse">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-950/40 shrink-0"></div>
                  <div class="space-y-1.5 min-w-0 flex-1">
                    <div class="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div class="h-3 w-20 bg-slate-100 dark:bg-slate-800/70 rounded"></div>
                  </div>
                </div>
                <div class="h-5 w-8 rounded-full bg-purple-100/70 dark:bg-purple-950/40 shrink-0"></div>
              </div>
            </div>

            <!-- Empty State jika BELUM ADA SISWA YANG MEMILIKI CATATAN -->
            <div
              v-else-if="studentsWithNotes.length === 0"
              class="p-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-3"
            >
              <div class="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center text-xl shadow-2xs">
                <i class="fa-solid fa-book-open"></i>
              </div>
              <div class="space-y-1">
                <p class="font-bold text-slate-800 dark:text-white text-sm">Belum Ada Siswa Tercatat</p>
                <p class="text-[11px] leading-relaxed text-slate-400">
                  Halaman ini hanya menampilkan siswa yang memiliki catatan bimbingan.
                </p>
              </div>
              <button
                type="button"
                @click="openRecordNewStudentModal"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <i class="fa-solid fa-user-plus text-xs"></i>
                <span>Catat Siswa Pertama</span>
              </button>
            </div>

            <!-- Empty State jika filter pencarian tidak menemukan hasil -->
            <div
              v-else-if="filteredStudents.length === 0"
              class="p-6 text-center text-xs text-slate-400 space-y-2.5"
            >
              <i class="fa-solid fa-filter-circle-xmark text-2xl text-slate-300 dark:text-slate-600"></i>
              <p>Tidak ditemukan siswa yang cocok dengan filter aktif.</p>
              <button
                type="button"
                @click="resetAllFilters"
                class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                Reset Semua Filter
              </button>
            </div>

            <!-- List Siswa -->
            <button
              v-for="s in filteredStudents"
              :key="s.id"
              type="button"
              @click="selectStudent(s)"
              class="w-full text-left p-3.5 sm:px-4 sm:py-3 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
              :class="selectedStudent?.id === s.id
                ? 'bg-purple-50/80 dark:bg-purple-950/40 border-l-4 border-purple-600 dark:border-purple-400'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <!-- Avatar Siswa -->
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  {{ s.nama ? s.nama.slice(0, 2).toUpperCase() : 'SW' }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <h3 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {{ s.nama }}
                    </h3>
                  </div>
                  <div class="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span class="font-semibold text-purple-700 dark:text-purple-300">{{ s.kelas || 'Siswa' }}</span>
                    <span v-if="s.nisn" class="text-slate-300 dark:text-slate-600">•</span>
                    <span v-if="s.nisn" class="truncate font-mono text-[10px]">NISN: {{ s.nisn }}</span>
                  </div>
                </div>
              </div>

              <!-- Badge Jumlah Catatan Siswa -->
              <div class="shrink-0 flex items-center gap-1">
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
                >
                  <i class="fa-solid fa-book-bookmark text-[9px]"></i>
                  <span>{{ studentNotesCountMap[s.id] || 0 }}</span>
                </span>
                <i class="fa-solid fa-chevron-right text-[10px] text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform"></i>
              </div>
            </button>
          </div>
        </aside>

        <!-- ============================================================== -->
        <!-- KOLOM KANAN: WORKSPACE UTAMA (EDITOR / DOSSIER SISWA)          -->
        <!-- Tampil di mobile jika mobileView !== 'list'                    -->
        <!-- ============================================================== -->
        <section
          class="flex-1 flex flex-col bg-[#F8FAFC] dark:bg-slate-950 h-full min-h-0 transition-all duration-200"
          :class="[
            mobileView === 'list' ? 'hidden lg:flex' : 'flex',
            isEditorOpen && isEditorExpanded ? 'lg:col-span-12' : 'lg:col-span-8 xl:col-span-8 2xl:col-span-9'
          ]"
        >
          <!-- ============================================================== -->
          <!-- 1. LEMBAR FULL-SCREEN WORKSPACE: TAMBAH / EDIT CATATAN ASESMEN -->
          <!-- Menampilkan editor terpadu di layar penuh (bukan pop up modal) -->
          <!-- ============================================================== -->
          <div
            v-if="isEditorOpen"
            class="flex-1 flex flex-col h-full min-h-0 bg-[#F8FAFC] dark:bg-slate-950 animate-in fade-in duration-150"
          >
            <!-- HEADER WORKSPACE EDITOR -->
            <div class="px-4 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-2xs">
              <div class="flex items-center justify-between gap-3">
                
                <!-- Left: Tombol Kembali & Info Mode Catatan -->
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    @click="closeEditor"
                    class="w-9 h-9 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    title="Kembali (Batal Edit)"
                  >
                    <i class="fa-solid fa-arrow-left text-sm"></i>
                  </button>

                  <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center text-base font-bold shrink-0 shadow-2xs">
                    <i class="fa-solid" :class="modalMode === 'NEW_STUDENT' ? 'fa-user-plus' : (modalMode === 'EDIT_NOTE' ? 'fa-pen-to-square' : 'fa-book-bookmark')"></i>
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h2 class="font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-tight truncate">
                        <template v-if="modalMode === 'NEW_STUDENT'">
                          Catat Siswa Baru
                        </template>
                        <template v-else-if="modalMode === 'EDIT_NOTE'">
                          Edit Catatan Asesmen
                        </template>
                        <template v-else>
                          Tambah Catatan Siswa
                        </template>
                      </h2>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80">
                        <i class="fa-solid fa-lock text-[9px] mr-1"></i>Dossier Privat BK
                      </span>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      <template v-if="modalMode === 'NEW_STUDENT'">
                        Pilih siswa baru dari direktori sekolah dan buat lembar rekam catatan pertamanya
                      </template>
                      <template v-else-if="modalMode === 'EDIT_NOTE'">
                        Perbarui lembar rekam kasus siswa: <strong class="text-slate-700 dark:text-slate-200">{{ selectedStudent?.nama }}</strong>
                      </template>
                      <template v-else>
                        Menambahkan lembar catatan baru untuk: <strong class="text-purple-700 dark:text-purple-300">{{ selectedStudent?.nama }}</strong> ({{ selectedStudent?.kelas }})
                      </template>
                    </p>
                  </div>
                </div>

                <!-- Right: Action Buttons & Expand Toggle -->
                <div class="flex items-center gap-2 shrink-0">
                  <!-- Toggle Full-Width Focus (Desktop Only) -->
                  <button
                    type="button"
                    @click="isEditorExpanded = !isEditorExpanded"
                    class="hidden lg:flex w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 items-center justify-center transition-colors cursor-pointer"
                    :title="isEditorExpanded ? 'Kecilkan ke 2 Kolom' : 'Fokus Layar Penuh'"
                  >
                    <i class="fa-solid" :class="isEditorExpanded ? 'fa-compress' : 'fa-expand'"></i>
                  </button>

                  <!-- Tombol Batal -->
                  <button
                    type="button"
                    @click="closeEditor"
                    class="px-3.5 sm:px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    Batal
                  </button>

                  <!-- Tombol Simpan Catatan (Primary) -->
                  <button
                    type="button"
                    @click="handleSubmitNote"
                    :disabled="isSubmitting"
                    class="px-4 sm:px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
                  >
                    <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin text-xs"></i>
                    <i v-else class="fa-solid fa-floppy-disk text-xs"></i>
                    <span>
                      {{ isSubmitting ? 'Menyimpan...' : (modalMode === 'NEW_STUDENT' ? 'Catat Siswa' : (modalMode === 'EDIT_NOTE' ? 'Perbarui Catatan' : 'Simpan Catatan')) }}
                    </span>
                  </button>
                </div>

              </div>
            </div>

            <!-- BODY WORKSPACE EDITOR (SCROLLABLE) -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5 min-h-0 bg-[#F8FAFC] dark:bg-slate-950">
              <div class="max-w-4xl mx-auto space-y-5">
                
                <!-- 1. IDENTITAS SISWA -->
                <!-- JIKA MODE: CATAT SISWA BARU -> TAMPILKAN SEARCHABLE COMBOBOX -->
                <div v-if="modalMode === 'NEW_STUDENT'" id="editor-student-combobox-container" class="space-y-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/70 shadow-2xs">
                  <div class="flex items-center justify-between">
                    <label class="block font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      Pilih Siswa yang Ingin Dicatat: <span class="text-rose-500">*</span>
                    </label>
                    <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                      Direktori Siswa SMADA
                    </span>
                  </div>

                  <!-- JIKA SUDAH MEMILIH SISWA -> KARTU SISWA TERPILIH DENGAN TOMBOL GANTI -->
                  <div
                    v-if="selectedTargetStudent"
                    class="p-3.5 sm:p-4 rounded-2xl bg-purple-50/60 dark:bg-slate-800 border-2 border-purple-500 shadow-xs flex items-center justify-between gap-3 animate-in fade-in duration-200"
                  >
                    <div class="flex items-center gap-3.5 min-w-0 flex-1">
                      <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        {{ selectedTargetStudent.nama ? selectedTargetStudent.nama.slice(0, 2).toUpperCase() : 'SW' }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-200/80 text-purple-900 dark:bg-purple-900 dark:text-purple-200">
                            {{ selectedTargetStudent.kelas || 'Siswa SMADA' }}
                          </span>
                          <span v-if="selectedTargetStudent.nisn" class="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            NISN: {{ selectedTargetStudent.nisn }}
                          </span>
                          <span v-if="selectedTargetStudent.nis" class="text-xs text-slate-400 font-mono">
                            NIS: {{ selectedTargetStudent.nis }}
                          </span>
                          <span class="text-xs font-semibold" :class="(studentNotesCountMap[selectedTargetStudent.id] || 0) === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'">
                            &bull; {{ (studentNotesCountMap[selectedTargetStudent.id] || 0) === 0 ? 'Belum Ada Catatan' : `${studentNotesCountMap[selectedTargetStudent.id]} Catatan Tersimpan` }}
                          </span>
                        </div>
                        <h4 class="font-bold text-base text-slate-900 dark:text-white truncate mt-1">
                          {{ selectedTargetStudent.nama }}
                        </h4>
                      </div>
                    </div>

                    <!-- Tombol Ganti Siswa -->
                    <button
                      type="button"
                      @click="clearSelectedModalStudent"
                      class="px-3 py-1.5 rounded-xl bg-white hover:bg-purple-100 dark:bg-slate-900 dark:hover:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border border-purple-200 dark:border-purple-800 cursor-pointer active:scale-95 shadow-2xs"
                      title="Ganti ke siswa lain"
                    >
                      <i class="fa-solid fa-arrows-rotate text-xs"></i>
                      <span>Ganti Siswa</span>
                    </button>
                  </div>

                  <!-- JIKA BELUM MEMILIH SISWA -> INPUT PENCARIAN REAL-TIME COMBOBOX DENGAN HASIL -->
                  <div v-else class="relative">
                    <div class="relative">
                      <i class="fa-solid fa-magnifying-glass text-purple-500 absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"></i>
                      <input
                        v-model="studentSearchInModal"
                        @focus="isStudentComboboxOpen = true"
                        @input="isStudentComboboxOpen = true"
                        type="text"
                        placeholder="Ketik nama siswa, kelas, atau NISN..."
                        class="w-full pl-10 pr-9 py-3 rounded-xl border border-purple-300 dark:border-purple-700 bg-slate-50/50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs font-medium"
                      />
                      <button
                        v-if="studentSearchInModal"
                        type="button"
                        @click="studentSearchInModal = ''"
                        class="w-6 h-6 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-xs cursor-pointer"
                      >
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <!-- Popover Hasil Pencarian Siswa -->
                    <Transition
                      enter-active-class="transition duration-150 ease-out"
                      enter-from-class="transform scale-95 opacity-0"
                      enter-to-class="transform scale-100 opacity-100"
                      leave-active-class="transition duration-100 ease-in"
                      leave-from-class="transform scale-100 opacity-100"
                      leave-to-class="transform scale-95 opacity-0"
                    >
                      <div
                        v-if="isStudentComboboxOpen"
                        class="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-purple-200 dark:border-purple-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 flex flex-col max-h-72"
                      >
                        <div class="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                          <span>Ditemukan {{ selectableStudentsInModal.length }} siswa</span>
                          <span class="text-purple-600 dark:text-purple-400">Klik siswa untuk memilih</span>
                        </div>

                        <div class="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 flex-1">
                          <button
                            v-for="s in selectableStudentsInModal"
                            :key="s.id"
                            type="button"
                            @click="selectModalStudent(s)"
                            class="w-full p-3 text-left flex items-center justify-between gap-3 hover:bg-purple-50/70 dark:hover:bg-purple-950/50 transition-colors cursor-pointer group"
                          >
                            <div class="flex items-center gap-3 min-w-0 flex-1">
                              <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                {{ s.nama ? s.nama.slice(0, 2).toUpperCase() : 'SW' }}
                              </div>
                              <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2">
                                  <span class="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-purple-700 dark:group-hover:text-purple-300">
                                    {{ s.nama }}
                                  </span>
                                  <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                                    {{ s.kelas || 'Siswa' }}
                                  </span>
                                </div>
                                <p class="text-xs text-slate-400 font-mono mt-0.5 truncate">
                                  NISN: {{ s.nisn || '-' }} &bull; NIS: {{ s.nis || '-' }}
                                </p>
                              </div>
                            </div>

                            <div class="shrink-0 text-right">
                              <span
                                v-if="(studentNotesCountMap[s.id] || 0) === 0"
                                class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              >
                                <span>Belum Ada Catatan</span>
                              </span>
                              <span
                                v-else
                                class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              >
                                <span>{{ studentNotesCountMap[s.id] }} Catatan</span>
                              </span>
                            </div>
                          </button>

                          <div v-if="selectableStudentsInModal.length === 0" class="p-6 text-center text-slate-400 space-y-1.5">
                            <i class="fa-solid fa-user-xmark text-2xl text-slate-300 dark:text-slate-600"></i>
                            <p class="text-xs">Tidak ada siswa yang cocok dengan &ldquo;{{ studentSearchInModal }}&rdquo;</p>
                          </div>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>

                <!-- JIKA MODE: CURRENT_STUDENT ATAU EDIT_NOTE -> BANNER IDENTITAS SISWA TERPILIH -->
                <div v-else class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3.5 min-w-0 flex-1">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                      {{ selectedStudent?.nama ? selectedStudent.nama.slice(0, 2).toUpperCase() : 'SW' }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          {{ selectedStudent?.kelas || 'Siswa SMADA' }}
                        </span>
                        <span v-if="selectedStudent?.nisn" class="text-xs text-slate-400 font-mono">
                          NISN: {{ selectedStudent.nisn }}
                        </span>
                        <span v-if="selectedStudent?.nis" class="text-xs text-slate-400 font-mono">
                          NIS: {{ selectedStudent.nis }}
                        </span>
                      </div>
                      <h3 class="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate mt-1">
                        {{ selectedStudent?.nama }}
                      </h3>
                    </div>
                  </div>

                  <span class="hidden sm:inline-flex px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800 shrink-0">
                    {{ currentStudentNotes.length }} Catatan Tersimpan
                  </span>
                </div>

                <!-- 2. PENGATURAN SESI: GURU BK & BIDANG LAYANAN -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <!-- Dropdown Guru BK Penanggung Jawab -->
                  <div id="editor-counselor-container" class="relative">
                    <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-xs sm:text-sm">
                      Guru BK Penanggung Jawab: <span class="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      @click="isModalCounselorOpen = !isModalCounselorOpen; isModalCategoryOpen = false"
                      class="w-full px-4 py-3 rounded-2xl border bg-white dark:bg-slate-900 flex items-center justify-between text-xs sm:text-sm font-medium transition-all shadow-2xs hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer"
                      :class="isModalCounselorOpen ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200 dark:border-slate-800'"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">
                          {{ (noteForm.counselor_name || 'BK').slice(0, 2).toUpperCase() }}
                        </div>
                        <div class="text-left min-w-0">
                          <span class="font-bold text-slate-900 dark:text-white block truncate">{{ noteForm.counselor_name || 'Pilih Guru BK' }}</span>
                          <span class="text-[11px] text-slate-400 block">Guru Bimbingan Konseling</span>
                        </div>
                      </div>
                      <i class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200 shrink-0 ml-2" :class="{ 'rotate-180 text-purple-600': isModalCounselorOpen }"></i>
                    </button>

                    <!-- Popover Menu Guru BK -->
                    <Transition
                      enter-active-class="transition duration-150 ease-out"
                      enter-from-class="transform scale-95 opacity-0"
                      enter-to-class="transform scale-100 opacity-100"
                      leave-active-class="transition duration-100 ease-in"
                      leave-from-class="transform scale-100 opacity-100"
                      leave-to-class="transform scale-95 opacity-0"
                    >
                      <div
                        v-if="isModalCounselorOpen"
                        class="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden py-1.5 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                      >
                        <button
                          v-for="c in counselorOptions"
                          :key="c"
                          type="button"
                          @click="selectModalCounselor(c)"
                          class="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer"
                          :class="noteForm.counselor_name === c
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                        >
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">
                              {{ c.slice(0, 2).toUpperCase() }}
                            </div>
                            <div class="min-w-0">
                              <span class="block truncate">{{ c }}</span>
                              <span class="block text-[10px] text-slate-400 font-normal">Guru Bimbingan Konseling</span>
                            </div>
                          </div>
                          <i v-if="noteForm.counselor_name === c" class="fa-solid fa-check text-xs text-purple-600 shrink-0 ml-2"></i>
                        </button>
                      </div>
                    </Transition>
                  </div>

                  <!-- Dropdown Kategori / Bidang Layanan -->
                  <div id="editor-category-container" class="relative">
                    <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-xs sm:text-sm">
                      Kategori / Bidang Layanan BK: <span class="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      @click="isModalCategoryOpen = !isModalCategoryOpen; isModalCounselorOpen = false"
                      class="w-full px-4 py-3 rounded-2xl border bg-white dark:bg-slate-900 flex items-center justify-between text-xs sm:text-sm font-medium transition-all shadow-2xs hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer"
                      :class="isModalCategoryOpen ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200 dark:border-slate-800'"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border shrink-0" :class="getCategoryInfo(noteForm.category)?.badge">
                          {{ getCategoryInfo(noteForm.category)?.label }}
                        </span>
                        <span class="text-xs text-slate-600 dark:text-slate-300 truncate">
                          {{ getCategoryDescription(noteForm.category) }}
                        </span>
                      </div>
                      <i class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200 shrink-0 ml-2" :class="{ 'rotate-180 text-purple-600': isModalCategoryOpen }"></i>
                    </button>

                    <!-- Popover Menu Kategori -->
                    <Transition
                      enter-active-class="transition duration-150 ease-out"
                      enter-from-class="transform scale-95 opacity-0"
                      enter-to-class="transform scale-100 opacity-100"
                      leave-active-class="transition duration-100 ease-in"
                      leave-from-class="transform scale-100 opacity-100"
                      leave-to-class="transform scale-95 opacity-0"
                    >
                      <div
                        v-if="isModalCategoryOpen"
                        class="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden py-1.5 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                      >
                        <button
                          v-for="cat in NOTE_CATEGORIES"
                          :key="cat.id"
                          type="button"
                          @click="selectModalCategory(cat.id)"
                          class="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer"
                          :class="noteForm.category === cat.id
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                        >
                          <div class="flex items-center gap-2.5 min-w-0">
                            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0" :class="cat.badge">
                              {{ cat.label }}
                            </span>
                            <span class="text-xs text-slate-600 dark:text-slate-300 truncate">
                              {{ getCategoryDescription(cat.id) }}
                            </span>
                          </div>
                          <i v-if="noteForm.category === cat.id" class="fa-solid fa-check text-xs text-purple-600 shrink-0 ml-2"></i>
                        </button>
                      </div>
                    </Transition>
                  </div>

                </div>

                <!-- Quick Category Selector Chips -->
                <div class="space-y-1.5">
                  <label class="block font-bold text-slate-700 dark:text-slate-300 text-xs">
                    Pilihan Cepat Kategori:
                  </label>
                  <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <button
                      v-for="cat in NOTE_CATEGORIES"
                      :key="cat.id"
                      type="button"
                      @click="noteForm.category = cat.id"
                      class="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                      :class="noteForm.category === cat.id
                        ? cat.badge + ' ring-2 ring-purple-500/40 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'"
                    >
                      <i :class="cat.icon" class="text-xs"></i>
                      <span>{{ cat.label }}</span>
                    </button>
                  </div>
                </div>

                <!-- 3. JUDUL CATATAN ASESMEN -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label class="block font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                      Judul Ringkas Asesmen / Topik Kasus: <span class="text-rose-500">*</span>
                    </label>
                    <span class="text-[11px] text-slate-400">Ringkasan pokok permasalahan</span>
                  </div>
                  <input
                    v-model="noteForm.title"
                    type="text"
                    placeholder="Misal: Hasil Konseling terkait motivasi belajar & pemilihan prodi SNBP..."
                    class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs font-medium transition-colors"
                    @keydown.ctrl.enter.prevent="handleSubmitNote"
                    @keydown.meta.enter.prevent="handleSubmitNote"
                  />
                </div>

                <!-- 4. ISI CATATAN & REKAM TINDAK LANJUT (SPACIOUS FULL-SCREEN TEXTAREA) -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <label class="block font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                      Detail Catatan, Observasi &amp; Rekam Tindak Lanjut: <span class="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      @click="insertAssessmentTemplate"
                      class="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                      title="Sisipkan struktur panduan asesmen standar BK"
                    >
                      <i class="fa-solid fa-file-lines text-xs"></i>
                      <span>+ Format Asesmen BK</span>
                    </button>
                  </div>

                  <textarea
                    v-model="noteForm.content"
                    rows="12"
                    placeholder="Tuliskan latar belakang masalah siswa, observasi psikologis/akademik, hasil konseling tatap muka, dan kesepakatan rencana tindak lanjut..."
                    class="w-full p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm sm:text-base leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y shadow-2xs placeholder:text-slate-400 font-sans min-h-[260px] sm:min-h-[340px]"
                    @keydown.ctrl.enter.prevent="handleSubmitNote"
                    @keydown.meta.enter.prevent="handleSubmitNote"
                  ></textarea>

                  <div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                    <span class="flex items-center gap-1.5">
                      <i class="fa-solid fa-shield-halved text-purple-500 text-xs"></i>
                      <span>Kerahasiaan terjamin • Hanya dapat dibaca oleh Guru BK SMADA</span>
                    </span>
                    <span class="font-mono hidden sm:inline">
                      Tekan <kbd class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300">Ctrl + Enter</kbd> untuk simpan cepat
                    </span>
                  </div>
                </div>

                <!-- 5. PANEL RIWAYAT CATATAN SEBELUMNYA SISWA INI (COLLAPSIBLE REFERENCE) -->
                <div v-if="selectedStudent && currentStudentNotes.length > 0" class="border border-purple-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    @click="isPreviousNotesOpen = !isPreviousNotesOpen"
                    class="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-left text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer"
                  >
                    <div class="flex items-center gap-2.5">
                      <i class="fa-solid fa-clock-rotate-left text-purple-600"></i>
                      <span>Referensi Catatan Sebelumnya Siswa Ini ({{ currentStudentNotes.length }})</span>
                    </div>
                    <i class="fa-solid fa-chevron-down text-xs transition-transform duration-200 text-slate-400" :class="{ 'rotate-180 text-purple-600': isPreviousNotesOpen }"></i>
                  </button>
                  <div v-if="isPreviousNotesOpen" class="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 space-y-3 max-h-80 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/40">
                    <div
                      v-for="pn in currentStudentNotes"
                      :key="pn.id"
                      class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2 shadow-2xs"
                    >
                      <div class="flex items-center justify-between gap-2 flex-wrap">
                        <span class="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{{ pn.title }}</span>
                        <div class="flex items-center gap-2">
                          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border" :class="getCategoryInfo(pn.category).badge">
                            {{ getCategoryInfo(pn.category).label }}
                          </span>
                          <span class="text-slate-400 text-[11px]">{{ formatDateDisplay(pn.created_at) }}</span>
                        </div>
                      </div>
                      <p class="text-slate-600 dark:text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{{ pn.content }}</p>
                      <div class="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                        Ditulis oleh: {{ pn.counselor_name || 'Guru BK SMADA' }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 6. FOOTER ACTION BAR -->
                <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 pb-12">
                  <button
                    type="button"
                    @click="closeEditor"
                    class="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    @click="handleSubmitNote"
                    :disabled="isSubmitting"
                    class="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                  >
                    <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin text-xs"></i>
                    <i v-else class="fa-solid fa-floppy-disk text-xs"></i>
                    <span>
                      {{ isSubmitting ? 'Menyimpan...' : (modalMode === 'NEW_STUDENT' ? 'Catat Siswa Baru' : (modalMode === 'EDIT_NOTE' ? 'Perbarui Catatan' : 'Simpan Catatan')) }}
                    </span>
                  </button>
                </div>

              </div>
            </div>

          </div>

          <!-- ============================================================== -->
          <!-- 2. EMPTY STATE: BELUM ADA SISWA TERPILIH                       -->
          <!-- ============================================================== -->
          <div
            v-else-if="!selectedStudent"
            class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white dark:bg-slate-900"
          >
            <div class="w-16 h-16 rounded-3xl bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 flex items-center justify-center text-2xl shadow-xs">
              <i class="fa-solid fa-folder-open"></i>
            </div>
            <div class="space-y-1 max-w-sm">
              <h2 class="font-display font-bold text-base text-slate-800 dark:text-white">
                Pilih Siswa untuk Melihat Catatan
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Pilih siswa dari daftar di samping untuk meninjau rekam asesmen kumulatif atau catat siswa baru dari direktori sekolah.
              </p>
            </div>
            <button
              type="button"
              @click="openRecordNewStudentModal"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <i class="fa-solid fa-user-plus text-xs"></i>
              <span>Catat Siswa Baru</span>
            </button>
          </div>

          <!-- Tampilan Dossier Siswa Aktif -->
          <div v-else class="flex-1 flex flex-col h-full min-h-0">
            
            <!-- HEADER DETAIL SISWA -->
            <div class="px-4 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <!-- Tombol Kembali di Mobile -->
                  <button
                    type="button"
                    @click="handleBackToListMobile"
                    class="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 flex items-center justify-center lg:hidden shrink-0 cursor-pointer"
                    title="Kembali ke Daftar Siswa"
                  >
                    <i class="fa-solid fa-arrow-left text-sm"></i>
                  </button>

                  <!-- Avatar Siswa -->
                  <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shrink-0 shadow-sm">
                    {{ selectedStudent.nama ? selectedStudent.nama.slice(0, 2).toUpperCase() : 'SW' }}
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h2 class="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate leading-tight">
                        {{ selectedStudent.nama }}
                      </h2>
                      <span
                        v-if="selectedStudent.kelas"
                        class="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                      >
                        {{ selectedStudent.kelas }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      <span v-if="selectedStudent.nisn" class="font-mono text-[11px]">NISN: {{ selectedStudent.nisn }}</span>
                      <span v-if="selectedStudent.nisn && selectedStudent.nis" class="text-slate-300 dark:text-slate-600">•</span>
                      <span v-if="selectedStudent.nis" class="font-mono text-[11px]">NIS: {{ selectedStudent.nis }}</span>
                      <span class="text-slate-300 dark:text-slate-600">•</span>
                      <span class="font-bold text-purple-600 dark:text-purple-400">{{ currentStudentNotes.length }} Catatan Tersimpan</span>
                    </div>
                  </div>
                </div>

                <!-- Tombol 2: TAMBAH CATATAN UNTUK SISWA INI (Kanan) -->
                <button
                  type="button"
                  @click="openAddNoteForCurrentStudent"
                  class="px-3.5 sm:px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  title="Tambah Catatan untuk Siswa Ini"
                >
                  <i class="fa-solid fa-plus text-xs"></i>
                  <span>Tambah Catatan</span>
                </button>
              </div>
            </div>

            <!-- TIMELINE CATATAN ASESMEN SISWA -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 min-h-0 bg-[#F8FAFC] dark:bg-slate-950">
              
              <!-- Info Box Panduan Etika Kerahasiaan BK -->
              <div class="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 shadow-2xs">
                <i class="fa-solid fa-user-shield text-amber-600 text-base mt-0.5 shrink-0"></i>
                <div class="leading-relaxed">
                  <strong class="font-bold block text-amber-950 dark:text-amber-100 mb-0.5">Dossier Rahasia Konseling Siswa</strong>
                  <span>Seluruh catatan di halaman ini bersifat rahasia dan kumulatif per siswa. Catatan ini hanya dapat diakses oleh Guru BK SMADA dan <strong>tidak pernah ditampilkan kepada siswa</strong>.</span>
                </div>
              </div>

              <!-- State Kosong: Belum Ada Catatan untuk Siswa Ini -->
              <div
                v-if="currentStudentNotes.length === 0"
                class="p-12 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 space-y-3"
              >
                <div class="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center text-xl shadow-2xs">
                  <i class="fa-solid fa-book-open"></i>
                </div>
                <div class="space-y-1 max-w-sm mx-auto">
                  <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100">
                    Belum Ada Catatan untuk {{ selectedStudent.nama }}
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Mulai rekam perkembangan, latar belakang kasus, atau hasil bimbingan tatap muka dengan mengklik tombol di bawah.
                  </p>
                </div>
                <button
                  type="button"
                  @click="openAddNoteForCurrentStudent"
                  class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <i class="fa-solid fa-plus text-xs"></i>
                  <span>Buat Catatan Pertama</span>
                </button>
              </div>

              <!-- List Kartu Catatan (Timeline Feed) -->
              <div v-else class="space-y-3.5">
                <div
                  v-for="note in currentStudentNotes"
                  :key="note.id"
                  class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3 transition-all hover:shadow-sm"
                >
                  <!-- Baris 1: Kategori + Waktu + Tombol Aksi -->
                  <div class="flex items-start justify-between gap-2.5">
                    <div class="flex items-center gap-2 flex-wrap min-w-0">
                      <!-- Badge Kategori -->
                      <span
                        class="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 shrink-0"
                        :class="getCategoryInfo(note.category).badge"
                      >
                        <i :class="getCategoryInfo(note.category).icon" class="text-[10px]"></i>
                        <span>{{ getCategoryInfo(note.category).label }}</span>
                      </span>

                      <!-- Waktu Dibuat -->
                      <span class="text-xs text-slate-400 dark:text-slate-500 font-semibold tabular-nums">
                        {{ formatDateDisplay(note.created_at) }}
                      </span>
                    </div>

                    <!-- Tombol Edit & Hapus -->
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        @click="openEditNoteModal(note)"
                        class="w-7 h-7 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                        title="Edit Catatan"
                      >
                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                      </button>
                      <button
                        type="button"
                        @click="openDeleteNoteModal(note)"
                        class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                        title="Hapus Catatan"
                      >
                        <i class="fa-regular fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>

                  <!-- Judul Catatan -->
                  <h4 class="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                    {{ note.title }}
                  </h4>

                  <!-- Isi Catatan -->
                  <div class="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                    {{ note.content }}
                  </div>

                  <!-- Footer Kartu: Penulis Catatan (Guru BK) -->
                  <div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span class="flex items-center gap-1.5">
                      <i class="fa-solid fa-user-tie text-purple-600 text-xs"></i>
                      <span>Ditulis oleh: <strong class="text-slate-700 dark:text-slate-300 font-semibold">{{ note.counselor_name || 'Guru BK SMADA' }}</strong></span>
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

      </div>
    </main>

    <!-- ============================================================== -->
    <!-- MODAL: KONFIRMASI HAPUS CATATAN                                -->
    <!-- ============================================================== -->
    <div
      v-if="isDeleteModalOpen && noteToDelete"
      class="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      @click.self="isDeleteModalOpen = false"
    >
      <div class="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5 text-center">
        <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 mx-auto flex items-center justify-center text-xl shadow-2xs">
          <i class="fa-regular fa-trash-can"></i>
        </div>
        <div class="space-y-1">
          <h3 class="font-bold text-sm text-slate-900 dark:text-white">
            Hapus Catatan Ini?
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Catatan &ldquo;{{ noteToDelete.title }}&rdquo; akan dihapus dari riwayat dossier siswa.
          </p>
        </div>
        <div class="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            @click="isDeleteModalOpen = false"
            class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            type="button"
            @click="confirmDeleteNote"
            :disabled="isDeleting"
            class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
          >
            {{ isDeleting ? 'Menghapus...' : 'Ya, Hapus' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>