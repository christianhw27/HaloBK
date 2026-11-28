<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore, COUNSELORS, NOTE_CATEGORIES } from '@/stores/chat'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { renderNoteMarkdown, htmlToNoteMarkdown } from '@/lib/noteMarkdown'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { getOptimizedImageUrl } from '@/lib/imageOptimizer'
import PublicNavbar from '@/components/PublicNavbar.vue'
import Toast from '@/components/Toast.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

// State Data Seluruh Siswa (Master Siswa Sekolah)
const allStudents = ref([])
const isLoadingStudents = ref(false)
const studentsLoadError = ref('')
const selectedStudent = ref(null)
const toast = ref(null)

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
const editorError = ref('')
const richEditorRef = ref(null)
const activeFormats = ref({
  bold: false,
  italic: false,
  underline: false,
  ul: false,
  ol: false
})
// modalMode: 'NEW_STUDENT' (dari tombol Catat Siswa) | 'CURRENT_STUDENT' (dari tombol Tambah Catatan) | 'EDIT_NOTE'
const modalMode = ref('CURRENT_STUDENT')
const currentNoteId = ref(null)
const isSubmitting = ref(false)
const targetStudentId = ref('')
const studentSearchInModal = ref('')

const noteForm = ref({
  record_type: 'catatan', // 'catatan' | 'pelanggaran'
  category: 'umum',
  title: '',
  content: '',
  counselor_name: '',
  counseling_photo_url: '',
  statement_photo_url: ''
})

const isUploadingCounselingPhoto = ref(false)
const isUploadingStatementPhoto = ref(false)
const dossierTypeFilter = ref('ALL') // 'ALL' | 'catatan' | 'pelanggaran'
const lightboxPhoto = ref(null) // { url, label } | null

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

// Mengambil seluruh master daftar akun siswa dari Supabase dengan pagination (menghindari batas 1.000 baris)
async function fetchStudentsList() {
  isLoadingStudents.value = true
  studentsLoadError.value = ''
  try {
    if (!isSupabaseConfigured || !supabase) {
      allStudents.value = []
      return
    }

    const pageSize = 1000
    let from = 0
    const collected = []

    while (true) {
      const { data, error } = await supabase
        .from('users')
        .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, foto_url')
        .eq('role', 'siswa')
        .order('nama', { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) throw error
      if (data && data.length > 0) {
        collected.push(...data)
      }
      if (!data || data.length < pageSize) break
      from += pageSize
    }

    allStudents.value = collected
  } catch (err) {
    allStudents.value = []
    studentsLoadError.value = 'Gagal memuat daftar siswa dari server: ' + (err.message || 'Terjadi kesalahan')
    toast.value?.show(studentsLoadError.value, 'error')
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

const dossierCounts = computed(() => {
  const list = currentStudentNotes.value
  const pelanggaran = list.filter(n => n.record_type === 'pelanggaran').length
  return {
    all: list.length,
    catatan: list.length - pelanggaran,
    pelanggaran
  }
})

const filteredDossierNotes = computed(() => {
  if (dossierTypeFilter.value === 'ALL') return currentStudentNotes.value
  return currentStudentNotes.value.filter(n => (n.record_type || 'catatan') === dossierTypeFilter.value)
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
  dossierTypeFilter.value = 'ALL'
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

function isNoteModified(note) {
  if (!note?.updated_at || !note?.created_at) return false
  return Math.abs(new Date(note.updated_at).getTime() - new Date(note.created_at).getTime()) > 5000
}

function loadFormToEditor() {
  nextTick(() => {
    if (!richEditorRef.value) return
    richEditorRef.value.innerHTML = noteForm.value.content
      ? renderNoteMarkdown(noteForm.value.content)
      : ''
    updateActiveFormats()
  })
}

function syncEditorToForm() {
  if (!richEditorRef.value) return
  noteForm.value.content = htmlToNoteMarkdown(richEditorRef.value)
}

function updateActiveFormats() {
  try {
    activeFormats.value = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      ul: document.queryCommandState('insertUnorderedList'),
      ol: document.queryCommandState('insertOrderedList')
    }
  } catch {
    // Abaikan jika selection belum aktif
  }
}

// 1. Aksi Tombol Kiri: Catat Siswa Baru (Mencari dan mencatat siswa yang belum tercatat)
function openRecordNewStudentModal(type = 'catatan') {
  modalMode.value = 'NEW_STUDENT'
  currentNoteId.value = null
  targetStudentId.value = ''
  studentSearchInModal.value = ''
  editorError.value = ''
  isStudentComboboxOpen.value = false
  isModalCounselorOpen.value = false
  isModalCategoryOpen.value = false
  noteForm.value = {
    record_type: type === 'pelanggaran' ? 'pelanggaran' : 'catatan',
    category: 'umum',
    title: '',
    content: '',
    counselor_name: authStore.userName || COUNSELORS[0],
    counseling_photo_url: '',
    statement_photo_url: ''
  }
  isEditorOpen.value = true
  isEditorExpanded.value = false
  mobileView.value = 'editor'
  loadFormToEditor()
}

// 2. Aksi Tombol Kanan: Tambah Catatan / Pelanggaran untuk Siswa Saat Ini
function openAddNoteForCurrentStudent(type = 'catatan') {
  if (!selectedStudent.value) {
    openRecordNewStudentModal(type)
    return
  }
  modalMode.value = 'CURRENT_STUDENT'
  currentNoteId.value = null
  targetStudentId.value = selectedStudent.value.id
  studentSearchInModal.value = ''
  editorError.value = ''
  isStudentComboboxOpen.value = false
  isModalCounselorOpen.value = false
  isModalCategoryOpen.value = false
  noteForm.value = {
    record_type: type === 'pelanggaran' ? 'pelanggaran' : 'catatan',
    category: 'umum',
    title: '',
    content: '',
    counselor_name: authStore.userName || COUNSELORS[0],
    counseling_photo_url: '',
    statement_photo_url: ''
  }
  isEditorOpen.value = true
  isEditorExpanded.value = false
  mobileView.value = 'editor'
  loadFormToEditor()
}

// 3. Aksi Edit Catatan / Pelanggaran
function openEditNoteModal(note) {
  modalMode.value = 'EDIT_NOTE'
  currentNoteId.value = note.id
  targetStudentId.value = note.student_id
  editorError.value = ''
  isStudentComboboxOpen.value = false
  isModalCounselorOpen.value = false
  isModalCategoryOpen.value = false
  noteForm.value = {
    record_type: note.record_type === 'pelanggaran' ? 'pelanggaran' : 'catatan',
    category: note.category || 'umum',
    title: note.title || '',
    content: note.content || '',
    counselor_name: note.counselor_name || authStore.userName || COUNSELORS[0],
    counseling_photo_url: note.counseling_photo_url || '',
    statement_photo_url: note.statement_photo_url || ''
  }
  isEditorOpen.value = true
  isEditorExpanded.value = false
  mobileView.value = 'editor'
  loadFormToEditor()
}

async function handlePhotoUpload(slot, event) {
  const file = event.target?.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    toast.value?.show('Ukuran foto maksimal 5 MB.', 'error')
    event.target.value = ''
    return
  }

  const isCounseling = slot === 'counseling'
  if (isCounseling) isUploadingCounselingPhoto.value = true
  else isUploadingStatementPhoto.value = true

  try {
    const url = await uploadToCloudinary(file, { folder: 'halobk_catatan_bk' })
    if (isCounseling) noteForm.value.counseling_photo_url = url
    else noteForm.value.statement_photo_url = url
    toast.value?.show(
      isCounseling ? 'Foto konseling berhasil diunggah.' : 'Foto surat pernyataan berhasil diunggah.',
      'success'
    )
  } catch (err) {
    toast.value?.show('Gagal mengunggah foto: ' + (err.message || 'Error'), 'error')
  } finally {
    if (isCounseling) isUploadingCounselingPhoto.value = false
    else isUploadingStatementPhoto.value = false
    if (event.target) event.target.value = ''
  }
}

function removePhoto(slot) {
  if (slot === 'counseling') noteForm.value.counseling_photo_url = ''
  else noteForm.value.statement_photo_url = ''
}

function execRichCommand(command, value = null) {
  if (!richEditorRef.value) return
  richEditorRef.value.focus()
  document.execCommand(command, false, value)
  syncEditorToForm()
  updateActiveFormats()
}

// Terapkan format langsung secara visual (WYSIWYG)
function applyMarkdownFormat(type) {
  switch (type) {
    case 'bold':
      execRichCommand('bold')
      break
    case 'italic':
      execRichCommand('italic')
      break
    case 'underline':
      execRichCommand('underline')
      break
    case 'ul':
      execRichCommand('insertUnorderedList')
      break
    case 'ol':
      execRichCommand('insertOrderedList')
      break
    case 'quote':
      execRichCommand('formatBlock', 'blockquote')
      break
  }
}

// Shortcut keyboard & auto-konversi list ("1. " / "- ") saat mengetik
function handleEditorKeydown(e) {
  const isMod = e.ctrlKey || e.metaKey
  const key = (e.key || '').toLowerCase()

  if (isMod && e.key === 'Enter') {
    e.preventDefault()
    handleSubmitNote()
    return
  }

  if (isMod && !e.shiftKey && key === 'b') {
    e.preventDefault()
    execRichCommand('bold')
    return
  }
  if (isMod && !e.shiftKey && key === 'i') {
    e.preventDefault()
    execRichCommand('italic')
    return
  }
  if (isMod && !e.shiftKey && key === 'u') {
    e.preventDefault()
    execRichCommand('underline')
    return
  }
  if (isMod && e.shiftKey && (e.code === 'Digit7' || key === '7')) {
    e.preventDefault()
    execRichCommand('insertOrderedList')
    return
  }
  if (isMod && e.shiftKey && (e.code === 'Digit8' || key === '8')) {
    e.preventDefault()
    execRichCommand('insertUnorderedList')
    return
  }

  // Auto-konversi saat mengetik "1." / "-" / "*" / ">" diikuti Spasi
  if (e.key === ' ' && !isMod) {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== 3) return

    const textBeforeCaret = (node.textContent || '').slice(0, range.startOffset)
    const trimmed = textBeforeCaret.replace(/\u00A0/g, ' ')

    let cmd = null
    let val = null
    if (trimmed === '1.') cmd = 'insertOrderedList'
    else if (trimmed === '-' || trimmed === '*') cmd = 'insertUnorderedList'
    else if (trimmed === '>') {
      cmd = 'formatBlock'
      val = 'blockquote'
    }

    if (cmd) {
      e.preventDefault()
      const delRange = document.createRange()
      delRange.setStart(node, 0)
      delRange.setEnd(node, range.startOffset)
      sel.removeAllRanges()
      sel.addRange(delRange)
      document.execCommand('delete', false, null)
      document.execCommand(cmd, false, val)
      syncEditorToForm()
      updateActiveFormats()
    }
  }
}

// Sisipkan Format Asesmen BK
function insertAssessmentTemplate() {
  syncEditorToForm()
  const template = `**Hasil Asesmen Guru BK**
- **Latar Belakang Masalah:** 
- **Dinamika Psikologis/Akademik:** 
- **Rencana Tindak Lanjut / Jadwal Pertemuan:** `

  if (!noteForm.value.content.trim()) {
    noteForm.value.content = template
  } else {
    noteForm.value.content += `\n\n${template}`
  }
  loadFormToEditor()
}

// Submit Catatan (Create / Update)
async function handleSubmitNote() {
  syncEditorToForm()
  editorError.value = ''
  let student = null
  if (modalMode.value === 'NEW_STUDENT') {
    if (!targetStudentId.value) {
      editorError.value = 'Mohon pilih siswa baru yang ingin dicatat terlebih dahulu.'
      toast.value?.show(editorError.value, 'error')
      return
    }
    student = allStudents.value.find(s => s.id === targetStudentId.value)
  } else {
    // CURRENT_STUDENT atau EDIT_NOTE
    student = selectedStudent.value || allStudents.value.find(s => s.id === targetStudentId.value)
  }

  if (!student) {
    editorError.value = 'Data siswa tidak ditemukan.'
    toast.value?.show(editorError.value, 'error')
    return
  }
  if (!noteForm.value.title.trim() || !noteForm.value.content.trim()) {
    editorError.value = 'Mohon isi judul dan isi catatan bimbingan.'
    toast.value?.show(editorError.value, 'error')
    return
  }
  if (isUploadingCounselingPhoto.value || isUploadingStatementPhoto.value) {
    editorError.value = 'Mohon tunggu proses unggah foto selesai terlebih dahulu.'
    toast.value?.show(editorError.value, 'error')
    return
  }

  const isViolation = noteForm.value.record_type === 'pelanggaran'

  isSubmitting.value = true
  try {
    if (modalMode.value === 'EDIT_NOTE' && currentNoteId.value) {
      await chatStore.updateStudentNote(currentNoteId.value, {
        record_type: noteForm.value.record_type,
        category: noteForm.value.category,
        title: noteForm.value.title.trim(),
        content: noteForm.value.content.trim(),
        counselor_name: noteForm.value.counselor_name,
        counseling_photo_url: isViolation ? noteForm.value.counseling_photo_url || null : null,
        statement_photo_url: isViolation ? noteForm.value.statement_photo_url || null : null
      })
      toast.value?.show(
        isViolation ? 'Rekam pelanggaran berhasil diperbarui.' : 'Catatan asesmen berhasil diperbarui.',
        'success'
      )
    } else {
      await chatStore.createStudentNote({
        student_id: student.id,
        student_name: student.nama,
        student_class: student.kelas || '',
        counselor_name: noteForm.value.counselor_name || authStore.userName || 'Guru BK SMADA',
        record_type: noteForm.value.record_type,
        category: noteForm.value.category,
        title: noteForm.value.title.trim(),
        content: noteForm.value.content.trim(),
        counseling_photo_url: isViolation ? noteForm.value.counseling_photo_url || null : null,
        statement_photo_url: isViolation ? noteForm.value.statement_photo_url || null : null
      })
      // Otomatis arahkan dan buka siswa tersebut di panel kanan
      selectStudent(student)
      toast.value?.show(
        isViolation ? 'Rekam pelanggaran berhasil disimpan.' : 'Catatan asesmen berhasil disimpan.',
        'success'
      )
    }
    isEditorOpen.value = false
    isEditorExpanded.value = false
    mobileView.value = 'detail'
  } catch (err) {
    editorError.value = 'Gagal menyimpan catatan: ' + (err.message || 'Error')
    toast.value?.show(editorError.value, 'error')
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
    toast.value?.show('Catatan berhasil dihapus.', 'success')

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
    toast.value?.show('Gagal menghapus catatan: ' + (err.message || 'Error'), 'error')
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
                <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center text-sm shadow-2xs font-bold shrink-0">
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
                class="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
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
                class="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-2xs"
              />
            </div>

            <!-- Filter Tabs Tingkat Kelas -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-semibold pt-0.5">
              <button
                type="button"
                @click="selectedGradeFilter = 'ALL'"
                class="px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap text-[11px]"
                :class="selectedGradeFilter === 'ALL'
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
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
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
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
                  class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1.5 transition-all shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-600 cursor-pointer"
                  :class="isFilterCounselorOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : (selectedCounselorFilter !== 'ALL' ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700')"
                >
                  <div class="flex items-center gap-1.5 min-w-0 truncate">
                    <i class="fa-solid fa-user-tie text-[10px]" :class="selectedCounselorFilter !== 'ALL' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'"></i>
                    <span class="truncate">{{ selectedCounselorFilter === 'ALL' ? 'Semua Guru' : selectedCounselorFilter }}</span>
                  </div>
                  <i class="fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 shrink-0" :class="{ 'rotate-180 text-emerald-600': isFilterCounselorOpen }"></i>
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
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                    >
                      <span class="flex items-center gap-2">
                        <i class="fa-solid fa-users text-xs text-slate-400"></i>
                        <span>Semua Guru BK</span>
                      </span>
                      <i v-if="selectedCounselorFilter === 'ALL'" class="fa-solid fa-check text-xs text-emerald-600"></i>
                    </button>

                    <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>

                    <button
                      v-for="c in counselorOptions"
                      :key="c"
                      type="button"
                      @click="selectFilterCounselor(c)"
                      class="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      :class="selectedCounselorFilter === c
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                    >
                      <span class="truncate flex items-center gap-2 min-w-0">
                        <span class="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {{ c.slice(0, 1) }}
                        </span>
                        <span class="truncate">{{ c }}</span>
                      </span>
                      <i v-if="selectedCounselorFilter === c" class="fa-solid fa-check text-xs text-emerald-600 shrink-0 ml-1.5"></i>
                    </button>
                  </div>
                </Transition>
              </div>

              <!-- Dropdown Filter Kategori Layanan -->
              <div id="filter-category-container" class="relative">
                <button
                  type="button"
                  @click="isFilterCategoryOpen = !isFilterCategoryOpen; isFilterCounselorOpen = false"
                  class="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1.5 transition-all shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-600 cursor-pointer"
                  :class="isFilterCategoryOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : (selectedCategoryFilter !== 'ALL' ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'border-slate-200 dark:border-slate-700')"
                >
                  <div class="flex items-center gap-1.5 min-w-0 truncate">
                    <i class="fa-solid fa-tags text-[10px]" :class="selectedCategoryFilter !== 'ALL' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'"></i>
                    <span class="truncate">{{ selectedCategoryFilter === 'ALL' ? 'Semua Layanan' : getCategoryInfo(selectedCategoryFilter).label }}</span>
                  </div>
                  <i class="fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform duration-200 shrink-0" :class="{ 'rotate-180 text-emerald-600': isFilterCategoryOpen }"></i>
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
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                    >
                      <span class="flex items-center gap-2">
                        <i class="fa-solid fa-layer-group text-xs text-slate-400"></i>
                        <span>Semua Layanan</span>
                      </span>
                      <i v-if="selectedCategoryFilter === 'ALL'" class="fa-solid fa-check text-xs text-emerald-600"></i>
                    </button>

                    <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>

                    <button
                      v-for="cat in NOTE_CATEGORIES"
                      :key="cat.id"
                      type="button"
                      @click="selectFilterCategory(cat.id)"
                      class="w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      :class="selectedCategoryFilter === cat.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                    >
                      <span class="truncate flex items-center gap-2 min-w-0">
                        <span class="w-2 h-2 rounded-full shrink-0" :class="cat.id === 'pribadi' ? 'bg-purple-500' : (cat.id === 'sosial' ? 'bg-sky-500' : (cat.id === 'belajar' ? 'bg-emerald-500' : 'bg-amber-500'))"></span>
                        <span class="truncate">{{ cat.label }}</span>
                      </span>
                      <i v-if="selectedCategoryFilter === cat.id" class="fa-solid fa-check text-xs text-emerald-600 shrink-0 ml-1.5"></i>
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
                  <div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 shrink-0"></div>
                  <div class="space-y-1.5 min-w-0 flex-1">
                    <div class="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div class="h-3 w-20 bg-slate-100 dark:bg-slate-800/70 rounded"></div>
                  </div>
                </div>
                <div class="h-5 w-8 rounded-full bg-emerald-100/70 dark:bg-emerald-950/40 shrink-0"></div>
              </div>
            </div>

            <!-- Empty State jika BELUM ADA SISWA YANG MEMILIKI CATATAN -->
            <div
              v-else-if="studentsWithNotes.length === 0"
              class="p-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-3"
            >
              <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center text-xl shadow-2xs">
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
                class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
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
                class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
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
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-emerald-600 dark:border-emerald-400'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <!-- Avatar Siswa -->
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  {{ s.nama ? s.nama.slice(0, 2).toUpperCase() : 'SW' }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <h3 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {{ s.nama }}
                    </h3>
                  </div>
                  <div class="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span class="font-semibold text-emerald-700 dark:text-emerald-300">{{ s.kelas || 'Siswa' }}</span>
                    <span v-if="s.nisn" class="text-slate-300 dark:text-slate-600">•</span>
                    <span v-if="s.nisn" class="truncate font-mono text-[10px]">NISN: {{ s.nisn }}</span>
                  </div>
                </div>
              </div>

              <!-- Badge Jumlah Catatan Siswa -->
              <div class="shrink-0 flex items-center gap-1">
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
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
            <div class="px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-2xs">
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

                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0 shadow-2xs"
                    :class="noteForm.record_type === 'pelanggaran'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'"
                  >
                    <i
                      class="fa-solid"
                      :class="noteForm.record_type === 'pelanggaran'
                        ? 'fa-triangle-exclamation'
                        : (modalMode === 'NEW_STUDENT' ? 'fa-user-plus' : (modalMode === 'EDIT_NOTE' ? 'fa-pen-to-square' : 'fa-book-bookmark'))"
                    ></i>
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h2 class="font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-tight truncate">
                        <template v-if="modalMode === 'NEW_STUDENT'">
                          {{ noteForm.record_type === 'pelanggaran' ? 'Catat Pelanggaran Siswa' : 'Catat Siswa Baru' }}
                        </template>
                        <template v-else-if="modalMode === 'EDIT_NOTE'">
                          {{ noteForm.record_type === 'pelanggaran' ? 'Edit Rekam Pelanggaran' : 'Edit Catatan Asesmen' }}
                        </template>
                        <template v-else>
                          {{ noteForm.record_type === 'pelanggaran' ? 'Tambah Pelanggaran Siswa' : 'Tambah Catatan Siswa' }}
                        </template>
                      </h2>
                      <span
                        class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        :class="noteForm.record_type === 'pelanggaran'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80'"
                      >
                        <i class="fa-solid fa-lock text-[9px] mr-1"></i>{{ noteForm.record_type === 'pelanggaran' ? 'Pelanggaran BK' : 'Dossier Privat BK' }}
                      </span>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      <template v-if="modalMode === 'NEW_STUDENT'">
                        Pilih siswa baru dari direktori sekolah dan buat lembar rekam catatan pertamanya
                      </template>
                      <template v-else-if="modalMode === 'EDIT_NOTE'">
                        Memperbarui rekam kasus: <strong class="text-slate-700 dark:text-slate-200">{{ selectedStudent?.nama }}</strong>
                      </template>
                      <template v-else>
                        Lembar rekam asesmen bimbingan untuk: <strong class="text-emerald-700 dark:text-emerald-300">{{ selectedStudent?.nama }}</strong> ({{ selectedStudent?.kelas }})
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
                    class="px-4 sm:px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
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

            <!-- BODY WORKSPACE EDITOR: 2-COLUMN GRID PADA DESKTOP (FULL WIDTH) -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 min-h-0 bg-[#F8FAFC] dark:bg-slate-950">
              <div class="w-full lg:grid lg:grid-cols-12 gap-5 space-y-5 lg:space-y-0">
                
                <!-- KOLOM KANAN (UTAMA): CANVAS EDITOR (JUDUL + ISI CATATAN ASESMEN) -->
                <div class="lg:col-span-7 xl:col-span-8 lg:order-2 flex flex-col space-y-4">
                  
                  <!-- KARTU EDITOR UTAMA -->
                  <div class="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4 flex flex-col flex-1">
                    
                    <!-- Banner Error Validasi / Simpan -->
                    <div
                      v-if="editorError"
                      class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-2"
                    >
                      <div class="flex items-center gap-2">
                        <i class="fa-solid fa-triangle-exclamation text-rose-600 shrink-0"></i>
                        <span>{{ editorError }}</span>
                      </div>
                      <button type="button" @click="editorError = ''" class="text-rose-500 hover:text-rose-700 px-1 cursor-pointer" aria-label="Tutup pesan error">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <!-- Judul Catatan Asesmen -->
                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between">
                        <label class="block font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                          Judul Ringkas Asesmen / Topik Kasus: <span class="text-rose-500">*</span>
                        </label>
                        <span class="text-[11px] text-slate-400">Ringkasan pokok permasalahan</span>
                      </div>
                      <input
                        v-model="noteForm.title"
                        type="text"
                        placeholder="Misal: Hasil Konseling terkait motivasi belajar & pemilihan prodi SNBP..."
                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs font-semibold transition-colors"
                        @keydown.ctrl.enter.prevent="handleSubmitNote"
                        @keydown.meta.enter.prevent="handleSubmitNote"
                      />
                    </div>

                    <!-- Toolbar & Editor Isi Catatan (Live Rich-Text + Shortcut Keyboard) -->
                    <div class="space-y-2 flex-1 flex flex-col">
                      <div class="flex items-center justify-between flex-wrap gap-2 pt-1">
                        <label class="block font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                          Detail Catatan, Observasi &amp; Rekam Tindak Lanjut: <span class="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          @click="insertAssessmentTemplate"
                          class="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                          title="Sisipkan struktur panduan asesmen standar BK"
                        >
                          <i class="fa-solid fa-file-lines text-xs"></i>
                          <span>+ Format Asesmen BK</span>
                        </button>
                      </div>

                      <!-- Toolbar Pemformatan Langsung -->
                      <div class="flex flex-wrap items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          @mousedown.prevent="applyMarkdownFormat('bold')"
                          class="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
                          :class="activeFormats.bold ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300'"
                          title="Tebal (Ctrl + B)"
                        >
                          <i class="fa-solid fa-bold"></i>
                        </button>
                        <button
                          type="button"
                          @mousedown.prevent="applyMarkdownFormat('italic')"
                          class="w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-colors cursor-pointer"
                          :class="activeFormats.italic ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300'"
                          title="Miring (Ctrl + I)"
                        >
                          <i class="fa-solid fa-italic"></i>
                        </button>
                        <button
                          type="button"
                          @mousedown.prevent="applyMarkdownFormat('underline')"
                          class="w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-colors cursor-pointer"
                          :class="activeFormats.underline ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300'"
                          title="Garis Bawah (Ctrl + U)"
                        >
                          <i class="fa-solid fa-underline"></i>
                        </button>
                        <span class="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" aria-hidden="true"></span>
                        <button
                          type="button"
                          @mousedown.prevent="applyMarkdownFormat('ul')"
                          class="w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-colors cursor-pointer"
                          :class="activeFormats.ul ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300'"
                          title="Poin Bullet (ketik - lalu Spasi, atau Ctrl + Shift + 8)"
                        >
                          <i class="fa-solid fa-list-ul"></i>
                        </button>
                        <button
                          type="button"
                          @mousedown.prevent="applyMarkdownFormat('ol')"
                          class="w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-colors cursor-pointer"
                          :class="activeFormats.ol ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300'"
                          title="Poin Angka (ketik 1. lalu Spasi, atau Ctrl + Shift + 7)"
                        >
                          <i class="fa-solid fa-list-ol"></i>
                        </button>
                        <button
                          type="button"
                          @mousedown.prevent="applyMarkdownFormat('quote')"
                          class="w-7 h-7 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-100 hover:text-emerald-800 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 flex items-center justify-center transition-colors cursor-pointer"
                          title="Kutipan (ketik > lalu Spasi)"
                        >
                          <i class="fa-solid fa-quote-left"></i>
                        </button>
                        <span class="ml-auto text-[10px] text-slate-400 hidden sm:inline">
                          Ctrl+B / Ctrl+I / Ctrl+U &bull; Ketik <code class="font-mono">1.</code> + Spasi
                        </span>
                      </div>

                      <div
                        ref="richEditorRef"
                        contenteditable="true"
                        role="textbox"
                        aria-multiline="true"
                        data-placeholder="Tuliskan latar belakang masalah siswa, observasi psikologis/akademik, dinamika perkembangan kasus, hasil konseling tatap muka, dan kesepakatan rencana tindak lanjut..."
                        class="w-full p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850 text-sm sm:text-base leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs font-sans flex-1 min-h-[360px] sm:min-h-[440px] overflow-y-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_blockquote]:border-l-3 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 dark:[&_blockquote]:text-slate-300 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
                        @input="syncEditorToForm"
                        @keydown="handleEditorKeydown"
                        @keyup="updateActiveFormats"
                        @mouseup="updateActiveFormats"
                      ></div>

                      <div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                        <span class="flex items-center gap-1.5">
                          <i class="fa-solid fa-shield-halved text-emerald-500 text-xs"></i>
                          <span>Kerahasiaan terjamin • Privat Guru BK SMADA</span>
                        </span>
                        <span class="font-mono hidden sm:inline">
                          Tekan <kbd class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300">Ctrl + Enter</kbd> untuk simpan cepat
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                <!-- KOLOM KIRI: SIDEBAR PARAMETER, SISWA & LAMPIRAN -->
                <div class="lg:col-span-5 xl:col-span-4 lg:order-1 space-y-4">
                  
                  <!-- CARD 0: PILIHAN JENIS REKAM (CATATAN VS PELANGGARAN) -->
                  <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5">
                    <span class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Jenis Rekam BK:
                    </span>
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        @click="noteForm.record_type = 'catatan'"
                        class="px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        :class="noteForm.record_type === 'catatan'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-emerald-50/60'"
                      >
                        <i class="fa-solid fa-book-bookmark text-[11px]"></i>
                        <span>Catatan BK</span>
                      </button>
                      <button
                        type="button"
                        @click="noteForm.record_type = 'pelanggaran'"
                        class="px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        :class="noteForm.record_type === 'pelanggaran'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-rose-50/60'"
                      >
                        <i class="fa-solid fa-triangle-exclamation text-[11px]"></i>
                        <span>Pelanggaran</span>
                      </button>
                    </div>
                  </div>

                  <!-- CARD 1: IDENTITAS SISWA -->
                  <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <i class="fa-solid fa-user-graduate text-emerald-600"></i>
                        <span>Identitas Siswa</span>
                      </span>
                      <span v-if="selectedTargetStudent || selectedStudent" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {{ (studentNotesCountMap[(selectedTargetStudent || selectedStudent)?.id] || 0) }} Catatan
                      </span>
                    </div>

                    <!-- Jika Mode: NEW_STUDENT -> Pilihan Siswa dari Direktori -->
                    <div v-if="modalMode === 'NEW_STUDENT'" id="editor-student-combobox-container" class="space-y-2.5">
                      <!-- Sudah Pilih Siswa -->
                      <div
                        v-if="selectedTargetStudent"
                        class="p-3 rounded-xl bg-emerald-50/60 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2.5"
                      >
                        <div class="flex items-center gap-2.5 min-w-0 flex-1">
                          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {{ selectedTargetStudent.nama ? selectedTargetStudent.nama.slice(0, 2).toUpperCase() : 'SW' }}
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                                {{ selectedTargetStudent.kelas || 'Siswa' }}
                              </span>
                              <span v-if="selectedTargetStudent.nisn" class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                {{ selectedTargetStudent.nisn }}
                              </span>
                            </div>
                            <h4 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate mt-0.5">
                              {{ selectedTargetStudent.nama }}
                            </h4>
                          </div>
                        </div>

                        <button
                          type="button"
                          @click="clearSelectedModalStudent"
                          class="px-2 py-1 rounded-lg bg-white hover:bg-emerald-100 dark:bg-slate-900 dark:hover:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 border border-emerald-200 dark:border-emerald-800 cursor-pointer active:scale-95"
                          title="Ganti siswa"
                        >
                          <i class="fa-solid fa-arrows-rotate text-[10px]"></i>
                          <span>Ganti</span>
                        </button>
                      </div>

                      <!-- Belum Pilih Siswa -> Input Search Combobox -->
                      <div v-else class="relative">
                        <div class="relative">
                          <i class="fa-solid fa-magnifying-glass text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2 text-xs"></i>
                          <input
                            v-model="studentSearchInModal"
                            @focus="isStudentComboboxOpen = true"
                            @input="isStudentComboboxOpen = true"
                            type="text"
                            placeholder="Ketik nama / kelas / NISN..."
                            class="w-full pl-8 pr-8 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                          />
                          <button
                            v-if="studentSearchInModal"
                            type="button"
                            @click="studentSearchInModal = ''"
                            class="w-5 h-5 rounded-full hover:bg-slate-200 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-[10px] cursor-pointer"
                          >
                            <i class="fa-solid fa-xmark"></i>
                          </button>
                        </div>

                        <!-- Dropdown Hasil Pencarian Siswa -->
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
                            class="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 flex flex-col max-h-60"
                          >
                            <div class="px-3 py-1.5 bg-slate-50 dark:bg-slate-850 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                              <span>{{ selectableStudentsInModal.length }} siswa</span>
                              <span class="text-emerald-600 dark:text-emerald-400">Pilih siswa</span>
                            </div>

                            <div class="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 flex-1">
                              <button
                                v-for="s in selectableStudentsInModal"
                                :key="s.id"
                                type="button"
                                @click="selectModalStudent(s)"
                                class="w-full p-2.5 text-left flex items-center justify-between gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer group"
                              >
                                <div class="min-w-0 flex-1">
                                  <div class="flex items-center gap-1.5">
                                    <span class="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-emerald-700">
                                      {{ s.nama }}
                                    </span>
                                    <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                                      {{ s.kelas || 'Siswa' }}
                                    </span>
                                  </div>
                                  <p class="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                    NISN: {{ s.nisn || '-' }}
                                  </p>
                                </div>
                              </button>
                            </div>
                          </div>
                        </Transition>
                      </div>
                    </div>

                    <!-- Jika Mode: CURRENT_STUDENT / EDIT_NOTE -> Kartu Siswa Terpilih -->
                    <div v-else class="flex items-center gap-3">
                      <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        {{ selectedStudent?.nama ? selectedStudent.nama.slice(0, 2).toUpperCase() : 'SW' }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {{ selectedStudent?.kelas || 'Siswa SMADA' }}
                          </span>
                          <span v-if="selectedStudent?.nisn" class="text-[11px] text-slate-400 font-mono">
                            NISN: {{ selectedStudent.nisn }}
                          </span>
                          <span v-if="selectedStudent?.nis" class="text-[11px] text-slate-400 font-mono">
                            NIS: {{ selectedStudent.nis }}
                          </span>
                        </div>
                        <h3 class="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate mt-0.5">
                          {{ selectedStudent?.nama }}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <!-- CARD 2: GURU BK PENANGGUNG JAWAB -->
                  <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
                    <label class="block font-bold text-slate-700 dark:text-slate-300 text-xs">
                      Guru BK Penanggung Jawab: <span class="text-rose-500">*</span>
                    </label>

                    <div id="editor-counselor-container" class="relative">
                      <button
                        type="button"
                        @click="isModalCounselorOpen = !isModalCounselorOpen; isModalCategoryOpen = false"
                        class="w-full px-3.5 py-2.5 rounded-xl border bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between text-xs sm:text-sm font-medium transition-all shadow-2xs hover:border-emerald-300 cursor-pointer"
                        :class="isModalCounselorOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800'"
                      >
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
                            {{ (noteForm.counselor_name || 'BK').slice(0, 2).toUpperCase() }}
                          </div>
                          <span class="font-bold text-slate-900 dark:text-white truncate">{{ noteForm.counselor_name || 'Pilih Guru BK' }}</span>
                        </div>
                        <i class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200 shrink-0 ml-2" :class="{ 'rotate-180 text-emerald-600': isModalCounselorOpen }"></i>
                      </button>

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
                          class="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden py-1 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                        >
                          <button
                            v-for="c in counselorOptions"
                            :key="c"
                            type="button"
                            @click="selectModalCounselor(c)"
                            class="w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                            :class="noteForm.counselor_name === c
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                          >
                            <span class="truncate">{{ c }}</span>
                            <i v-if="noteForm.counselor_name === c" class="fa-solid fa-check text-xs text-emerald-600 shrink-0 ml-1.5"></i>
                          </button>
                        </div>
                      </Transition>
                    </div>
                  </div>

                  <!-- CARD 3: BIDANG / KATEGORI LAYANAN BK (CLEAN LIST/GRID SELECTOR) -->
                  <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5">
                    <div class="flex items-center justify-between">
                      <label class="block font-bold text-slate-700 dark:text-slate-300 text-xs">
                        Bidang Layanan BK: <span class="text-rose-500">*</span>
                      </label>
                      <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border" :class="getCategoryInfo(noteForm.category)?.badge">
                        {{ getCategoryInfo(noteForm.category)?.label }}
                      </span>
                    </div>

                    <!-- Pilihan Kategori Vertikal yang Rapi & Berbobot -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                      <button
                        v-for="cat in NOTE_CATEGORIES"
                        :key="cat.id"
                        type="button"
                        @click="noteForm.category = cat.id"
                        class="px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all cursor-pointer flex items-center justify-between gap-2 active:scale-98"
                        :class="noteForm.category === cat.id
                          ? cat.badge + ' ring-2 ring-emerald-500/30 font-bold shadow-2xs'
                          : 'bg-slate-50/60 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'"
                      >
                        <div class="flex items-center gap-2 min-w-0">
                          <i :class="cat.icon" class="text-xs shrink-0"></i>
                          <span class="truncate">{{ cat.label }}</span>
                        </div>
                        <i v-if="noteForm.category === cat.id" class="fa-solid fa-circle-check text-xs shrink-0"></i>
                      </button>
                    </div>
                  </div>

                  <!-- CARD 4: LAMPIRAN FOTO BUKTI PELANGGARAN (KHUSUS MODE PELANGGARAN) -->
                  <div
                    v-if="noteForm.record_type === 'pelanggaran'"
                    class="p-4 sm:p-5 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 shadow-2xs space-y-3.5"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                        <i class="fa-solid fa-camera text-rose-600"></i>
                        <span>Lampiran Bukti Pelanggaran</span>
                      </span>
                      <span class="text-[10px] font-semibold text-rose-600 dark:text-rose-300">Maks. 5 MB</span>
                    </div>

                    <!-- Slot 1: Foto Konseling -->
                    <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/70 dark:border-slate-800 space-y-2">
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-slate-700 dark:text-slate-200">1. Foto Konseling</span>
                        <button
                          v-if="noteForm.counseling_photo_url"
                          type="button"
                          @click="removePhoto('counseling')"
                          class="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>

                      <div v-if="noteForm.counseling_photo_url" class="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img
                          :src="getOptimizedImageUrl(noteForm.counseling_photo_url, 600)"
                          alt="Foto Konseling"
                          class="w-full h-32 object-cover cursor-pointer"
                          @click="lightboxPhoto = { url: noteForm.counseling_photo_url, label: 'Foto Konseling' }"
                        />
                      </div>

                      <label
                        class="w-full py-2 px-3 rounded-xl border border-dashed border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <i v-if="isUploadingCounselingPhoto" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-cloud-arrow-up"></i>
                        <span>{{ isUploadingCounselingPhoto ? 'Mengunggah...' : (noteForm.counseling_photo_url ? 'Ganti Foto Konseling' : 'Unggah Foto Konseling') }}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          class="hidden"
                          :disabled="isUploadingCounselingPhoto"
                          @change="handlePhotoUpload('counseling', $event)"
                        />
                      </label>
                    </div>

                    <!-- Slot 2: Foto Surat Pernyataan / Komitmen -->
                    <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/70 dark:border-slate-800 space-y-2">
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-slate-700 dark:text-slate-200">2. Foto Surat Pernyataan / Komitmen</span>
                        <button
                          v-if="noteForm.statement_photo_url"
                          type="button"
                          @click="removePhoto('statement')"
                          class="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>

                      <div v-if="noteForm.statement_photo_url" class="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img
                          :src="getOptimizedImageUrl(noteForm.statement_photo_url, 600)"
                          alt="Foto Surat Pernyataan / Komitmen"
                          class="w-full h-32 object-cover cursor-pointer"
                          @click="lightboxPhoto = { url: noteForm.statement_photo_url, label: 'Foto Surat Pernyataan / Komitmen' }"
                        />
                      </div>

                      <label
                        class="w-full py-2 px-3 rounded-xl border border-dashed border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <i v-if="isUploadingStatementPhoto" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-file-signature"></i>
                        <span>{{ isUploadingStatementPhoto ? 'Mengunggah...' : (noteForm.statement_photo_url ? 'Ganti Foto Surat' : 'Unggah Foto Surat Pernyataan') }}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          class="hidden"
                          :disabled="isUploadingStatementPhoto"
                          @change="handlePhotoUpload('statement', $event)"
                        />
                      </label>
                    </div>
                  </div>

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
            <div class="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl shadow-xs">
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
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
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
                  <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shrink-0 shadow-sm">
                    {{ selectedStudent.nama ? selectedStudent.nama.slice(0, 2).toUpperCase() : 'SW' }}
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h2 class="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate leading-tight">
                        {{ selectedStudent.nama }}
                      </h2>
                      <span
                        v-if="selectedStudent.kelas"
                        class="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      >
                        {{ selectedStudent.kelas }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      <span v-if="selectedStudent.nisn" class="font-mono text-[11px]">NISN: {{ selectedStudent.nisn }}</span>
                      <span v-if="selectedStudent.nisn && selectedStudent.nis" class="text-slate-300 dark:text-slate-600">•</span>
                      <span v-if="selectedStudent.nis" class="font-mono text-[11px]">NIS: {{ selectedStudent.nis }}</span>
                      <span class="text-slate-300 dark:text-slate-600">•</span>
                      <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ currentStudentNotes.length }} Catatan Tersimpan</span>
                    </div>
                  </div>
                </div>

                <!-- Tombol Aksi Header Dossier (Catatan & Pelanggaran) -->
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    @click="openAddNoteForCurrentStudent('catatan')"
                    class="px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                    title="Tambah Catatan Konseling"
                  >
                    <i class="fa-solid fa-plus text-xs"></i>
                    <span>Catatan</span>
                  </button>
                  <button
                    type="button"
                    @click="openAddNoteForCurrentStudent('pelanggaran')"
                    class="px-3 sm:px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                    title="Catat Pelanggaran & Lampiran Bukti"
                  >
                    <i class="fa-solid fa-triangle-exclamation text-xs"></i>
                    <span>Pelanggaran</span>
                  </button>
                </div>
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

              <!-- Filter Ringkas Jenis Rekam (Semua / Catatan / Pelanggaran) -->
              <div v-if="currentStudentNotes.length > 0" class="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  @click="dossierTypeFilter = 'ALL'"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer"
                  :class="dossierTypeFilter === 'ALL'
                    ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'"
                >
                  Semua ({{ dossierCounts.all }})
                </button>
                <button
                  type="button"
                  @click="dossierTypeFilter = 'catatan'"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer"
                  :class="dossierTypeFilter === 'catatan'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-slate-200 dark:border-slate-800 hover:bg-emerald-50'"
                >
                  Catatan ({{ dossierCounts.catatan }})
                </button>
                <button
                  type="button"
                  @click="dossierTypeFilter = 'pelanggaran'"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer"
                  :class="dossierTypeFilter === 'pelanggaran'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border-slate-200 dark:border-slate-800 hover:bg-rose-50'"
                >
                  Pelanggaran ({{ dossierCounts.pelanggaran }})
                </button>
              </div>

              <!-- State Kosong: Belum Ada Catatan untuk Siswa Ini -->
              <div
                v-if="filteredDossierNotes.length === 0"
                class="p-12 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 space-y-3"
              >
                <div class="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center text-xl shadow-2xs">
                  <i class="fa-solid fa-book-open"></i>
                </div>
                <div class="space-y-1 max-w-sm mx-auto">
                  <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {{ dossierTypeFilter === 'pelanggaran' ? 'Belum Ada Rekam Pelanggaran' : `Belum Ada Catatan untuk ${selectedStudent.nama}` }}
                  </h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Mulai rekam perkembangan, latar belakang kasus, atau pelanggaran siswa melalui tombol di kanan atas.
                  </p>
                </div>
                <button
                  type="button"
                  @click="openAddNoteForCurrentStudent(dossierTypeFilter === 'pelanggaran' ? 'pelanggaran' : 'catatan')"
                  class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <i class="fa-solid fa-plus text-xs"></i>
                  <span>{{ dossierTypeFilter === 'pelanggaran' ? 'Catat Pelanggaran Pertama' : 'Buat Catatan Pertama' }}</span>
                </button>
              </div>

              <!-- List Kartu Catatan (Timeline Feed) -->
              <div v-else class="space-y-3.5">
                <div
                  v-for="note in filteredDossierNotes"
                  :key="note.id"
                  class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3 transition-all hover:shadow-sm"
                  :class="note.record_type === 'pelanggaran' ? 'border-l-4 border-l-rose-500' : ''"
                >
                  <!-- Baris 1: Jenis Rekam + Kategori + Waktu + Tombol Aksi -->
                  <div class="flex items-start justify-between gap-2.5">
                    <div class="flex items-center gap-2 flex-wrap min-w-0">
                      <!-- Badge Pelanggaran (jika record_type === 'pelanggaran') -->
                      <span
                        v-if="note.record_type === 'pelanggaran'"
                        class="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-rose-600 text-white flex items-center gap-1 shrink-0"
                      >
                        <i class="fa-solid fa-triangle-exclamation text-[10px]"></i>
                        <span>Pelanggaran</span>
                      </span>

                      <!-- Badge Kategori -->
                      <span
                        class="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 shrink-0"
                        :class="getCategoryInfo(note.category).badge"
                      >
                        <i :class="getCategoryInfo(note.category).icon" class="text-[10px]"></i>
                        <span>{{ getCategoryInfo(note.category).label }}</span>
                      </span>

                      <!-- Waktu Dibuat & Modified At -->
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs text-slate-400 dark:text-slate-500 font-semibold tabular-nums">
                          {{ formatDateDisplay(note.created_at) }}
                        </span>
                        <span
                          v-if="isNoteModified(note)"
                          class="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/70 px-2 py-0.5 rounded-md tabular-nums"
                          title="Terakhir diperbarui"
                        >
                          <i class="fa-solid fa-pen text-[9px]"></i>
                          <span>Diedit: {{ formatDateDisplay(note.updated_at) }}</span>
                        </span>
                      </div>
                    </div>

                    <!-- Tombol Edit & Hapus -->
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        @click="openEditNoteModal(note)"
                        class="w-7 h-7 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
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

                  <!-- Isi Catatan (Markdown Rendered) -->
                  <div
                    class="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed font-sans"
                    v-html="renderNoteMarkdown(note.content)"
                  ></div>

                  <!-- Galeri Lampiran Foto Pelanggaran (jika ada) -->
                  <div
                    v-if="note.counseling_photo_url || note.statement_photo_url"
                    class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1"
                  >
                    <button
                      v-if="note.counseling_photo_url"
                      type="button"
                      @click="lightboxPhoto = { url: note.counseling_photo_url, label: 'Foto Konseling' }"
                      class="group text-left rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-rose-400 transition-colors cursor-pointer"
                    >
                      <img
                        :src="getOptimizedImageUrl(note.counseling_photo_url, 500)"
                        alt="Foto Konseling"
                        class="w-full h-36 object-cover group-hover:scale-[1.02] transition-transform"
                      />
                      <div class="px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Foto Konseling</span>
                        <i class="fa-solid fa-magnifying-glass-plus text-slate-400 group-hover:text-rose-600"></i>
                      </div>
                    </button>

                    <button
                      v-if="note.statement_photo_url"
                      type="button"
                      @click="lightboxPhoto = { url: note.statement_photo_url, label: 'Foto Surat Pernyataan / Komitmen' }"
                      class="group text-left rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-rose-400 transition-colors cursor-pointer"
                    >
                      <img
                        :src="getOptimizedImageUrl(note.statement_photo_url, 500)"
                        alt="Foto Surat Pernyataan / Komitmen"
                        class="w-full h-36 object-cover group-hover:scale-[1.02] transition-transform"
                      />
                      <div class="px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>Foto Surat Pernyataan / Komitmen</span>
                        <i class="fa-solid fa-magnifying-glass-plus text-slate-400 group-hover:text-rose-600"></i>
                      </div>
                    </button>
                  </div>

                  <!-- Footer Kartu: Penulis Catatan (Guru BK) -->
                  <div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span class="flex items-center gap-1.5">
                      <i class="fa-solid fa-user-tie text-emerald-600 text-xs"></i>
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

    <!-- MODAL LIGHTBOX: PERBESAR FOTO BUKTI PELANGGARAN -->
    <div
      v-if="lightboxPhoto"
      class="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm"
      @click.self="lightboxPhoto = null"
    >
      <div class="relative max-w-3xl w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
        <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{{ lightboxPhoto.label }}</span>
          <button
            type="button"
            @click="lightboxPhoto = null"
            class="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
            aria-label="Tutup pratinjau foto"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="p-3 bg-slate-100 dark:bg-slate-950 flex items-center justify-center max-h-[80vh] overflow-auto">
          <img :src="lightboxPhoto.url" :alt="lightboxPhoto.label" class="max-h-[72vh] w-auto rounded-lg object-contain" />
        </div>
      </div>
    </div>

    <Toast ref="toast" />
  </div>
</template>