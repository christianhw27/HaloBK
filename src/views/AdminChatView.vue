<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  useChatStore,
  COUNSELORS,
  CATEGORIES,
  STATUS_CONFIG,
  NOTE_CATEGORIES,
  check15MinEligibility,
  isSessionPinnedForCounselor
} from '@/stores/chat'
import PublicNavbar from '@/components/PublicNavbar.vue'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

// State Filter & Pencarian
const selectedCounselorFilter = ref('ALL')
const selectedStatusFilter = ref('ALL')
const searchQuery = ref('')
const mobileView = ref('list')

// State Dropdown Kustom Filter Guru BK
const isCounselorDropdownOpen = ref(false)
const counselorDropdownRef = ref(null)

function selectCounselor(counselor) {
  selectedCounselorFilter.value = counselor
  isCounselorDropdownOpen.value = false
}

function handleCounselorDropdownClickOutside(e) {
  if (counselorDropdownRef.value && !counselorDropdownRef.value.contains(e.target)) {
    isCounselorDropdownOpen.value = false
  }
}

// State Balasan Guru
const replyText = ref('')
const chatMessagesContainer = ref(null)

// State Drawer Catatan Siswa Terpadu (Dossier BK Siswa)
const isNotesDrawerOpen = ref(false)
const isAddingNoteInDrawer = ref(false)
const isSavingNotes = ref(false)
const notesSaveFeedback = ref('')
let notesSaveTimeout = null

const drawerNoteForm = ref({
  category: 'umum',
  title: '',
  content: ''
})

const activeStudentNotes = computed(() => {
  if (!chatStore.activeSession?.student_id) return []
  return chatStore.allStudentNotes.filter(n => n.student_id === chatStore.activeSession.student_id)
})

async function openNotesDrawer() {
  if (chatStore.activeSession?.student_id) {
    await chatStore.fetchStudentNotes(chatStore.activeSession.student_id)
  }
  isAddingNoteInDrawer.value = false
  drawerNoteForm.value = {
    category: chatStore.activeSession?.category || 'umum',
    title: '',
    content: ''
  }
  notesSaveFeedback.value = ''
  isNotesDrawerOpen.value = true
}

function closeNotesDrawer() {
  isNotesDrawerOpen.value = false
  isAddingNoteInDrawer.value = false
}

function startAddNoteInDrawer() {
  drawerNoteForm.value = {
    category: chatStore.activeSession?.category || 'umum',
    title: chatStore.activeSession?.title ? `Tindak Lanjut: ${chatStore.activeSession.title}` : '',
    content: ''
  }
  isAddingNoteInDrawer.value = true
}

function insertDrawerAssessmentTemplate() {
  const template = `[Hasil Asesmen Guru BK]
• Latar Belakang Masalah: 
• Dinamika Psikologis/Akademik: 
• Rencana Tindak Lanjut / Jadwal Pertemuan: `

  if (!drawerNoteForm.value.content.trim()) {
    drawerNoteForm.value.content = template
  } else {
    drawerNoteForm.value.content += `\n\n${template}`
  }
}

async function handleSaveDrawerNote() {
  if (!chatStore.activeSession) return
  if (!drawerNoteForm.value.title.trim() || !drawerNoteForm.value.content.trim()) {
    alert('Mohon isi judul dan isi catatan asesmen.')
    return
  }

  isSavingNotes.value = true
  notesSaveFeedback.value = ''
  try {
    await chatStore.createStudentNote({
      student_id: chatStore.activeSession.student_id,
      student_name: chatStore.activeSession.student_name,
      student_class: chatStore.activeSession.student_class || '',
      counselor_name: chatStore.activeSession.counselor_name || authStore.userName || 'Guru BK SMADA',
      category: drawerNoteForm.value.category,
      title: drawerNoteForm.value.title.trim(),
      content: drawerNoteForm.value.content.trim()
    })
    isAddingNoteInDrawer.value = false
    notesSaveFeedback.value = 'Catatan asesmen berhasil ditambahkan!'
    if (notesSaveTimeout) clearTimeout(notesSaveTimeout)
    notesSaveTimeout = setTimeout(() => {
      notesSaveFeedback.value = ''
    }, 3500)
  } catch (err) {
    alert('Gagal menyimpan catatan: ' + (err.message || 'Error'))
  } finally {
    isSavingNotes.value = false
  }
}

function navigateToFullStudentDossier() {
  if (!chatStore.activeSession?.student_id) return
  closeNotesDrawer()
  router.push(`/admin/catatan-siswa?studentId=${chatStore.activeSession.student_id}`)
}

// State Action Sheet (Menu Titik Tiga Desktop & Tekan Tahan Mobile)
const actionMenuSession = ref(null)
const actionMenuMessage = ref(null)

// State Modal Hapus Sesi
const isDeleteModalOpen = ref(false)
const sessionToDelete = ref(null)
const selectedDeleteType = ref('for_me') // 'for_me' | 'for_everyone'
const isDeleting = ref(false)

// State Modal Hapus Pesan Bubble
const isDeleteMessageModalOpen = ref(false)
const messageToDelete = ref(null)
const selectedDeleteMessageType = ref('for_me')
const isDeletingMessage = ref(false)

// Logic Tekan Tahan Lama (Long Press) Mobile
let longPressTimer = null
let isLongPressTriggered = false

function handleTouchStart(item, type = 'session') {
  isLongPressTriggered = false
  longPressTimer = setTimeout(() => {
    isLongPressTriggered = true
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40)
    }
    if (type === 'session') {
      actionMenuSession.value = item
    } else {
      actionMenuMessage.value = item
    }
  }, 500)
}

function handleTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handleTouchMove() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handleClickSession(session) {
  if (isLongPressTriggered) {
    isLongPressTriggered = false
    return
  }
  handleSelectSession(session)
}

function scrollToBottom() {
  nextTick(() => {
    if (chatMessagesContainer.value) {
      chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight
    }
  })
}

watch(() => chatStore.messages.length, () => scrollToBottom())
watch(() => chatStore.activeSession?.id, () => scrollToBottom())

onMounted(async () => {
  if (!authStore.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: '/admin/chat' } })
    return
  }
  if (authStore.userRole !== 'admin') {
    router.push('/halobk')
    return
  }

  await chatStore.fetchAllSessionsAdmin()
  if (filteredSessions.value.length > 0 && window.innerWidth >= 1024 && !chatStore.activeSession) {
    await chatStore.selectSession(filteredSessions.value[0])
  }
  document.addEventListener('click', handleCounselorDropdownClickOutside)
})

onUnmounted(() => {
  chatStore.cleanupRealtime()
  document.removeEventListener('click', handleCounselorDropdownClickOutside)
})

// Daftar Sesi yang Terfilter dengan urutan SEMATKAN (PIN) di atas
const filteredSessions = computed(() => {
  let list = chatStore.sortedSessions
  if (selectedCounselorFilter.value !== 'ALL') {
    list = list.filter(s => s.counselor_name === selectedCounselorFilter.value)
  }
  if (selectedStatusFilter.value !== 'ALL') {
    list = list.filter(s => s.status === selectedStatusFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(s =>
      (s.student_name || '').toLowerCase().includes(q) ||
      (s.student_nis || '').toLowerCase().includes(q) ||
      (s.student_class || '').toLowerCase().includes(q) ||
      (s.title || '').toLowerCase().includes(q) ||
      (s.last_message_preview || '').toLowerCase().includes(q)
    )
  }

  // Sorting: Pinned sessions for the active counselor filter go to the TOP
  return [...list].sort((a, b) => {
    const pinA = isSessionPinnedForCounselor(a, selectedCounselorFilter.value)
    const pinB = isSessionPinnedForCounselor(b, selectedCounselorFilter.value)
    if (pinA !== pinB) return pinB ? 1 : -1
    const dateA = new Date(a.last_message_at || a.created_at)
    const dateB = new Date(b.last_message_at || b.created_at)
    return dateB - dateA
  })
})

const statusCounts = computed(() => ({
  menunggu: chatStore.sortedSessions.filter(s => s.status === 'menunggu').length,
  ditindaklanjuti: chatStore.sortedSessions.filter(s => s.status === 'ditindaklanjuti').length,
  selesai: chatStore.sortedSessions.filter(s => s.status === 'selesai').length,
}))

async function handleSelectSession(session) {
  await chatStore.selectSession(session)
  mobileView.value = 'detail'
  scrollToBottom()
}

function handleBackToListMobile() { mobileView.value = 'list' }

async function handleSendReply() {
  if (!replyText.value.trim() || !chatStore.activeSession) return
  const text = replyText.value
  replyText.value = ''
  try {
    await chatStore.sendMessage(chatStore.activeSession.id, text)
    scrollToBottom()
  } catch (err) {
    console.error('Gagal membalas pesan siswa:', err)
  }
}

async function handleStatusChange(newStatus, sessionId = null) {
  const targetId = sessionId || chatStore.activeSession?.id
  if (!targetId) return
  try {
    await chatStore.updateSessionStatus(targetId, newStatus)
  } catch (err) {
    alert('Gagal memperbarui status: ' + (err.message || 'Error'))
  }
}

// Aksi Ubah Status dari Action Sheet
async function handleCompleteFromMenu() {
  if (!actionMenuSession.value) return
  const s = actionMenuSession.value
  actionMenuSession.value = null
  await handleStatusChange('selesai', s.id)
}

async function handleReopenFromMenu() {
  if (!actionMenuSession.value) return
  const s = actionMenuSession.value
  actionMenuSession.value = null
  await handleStatusChange('ditindaklanjuti', s.id)
}

// Buka Menu Aksi (Titik Tiga Desktop / Long Press Mobile)
function openSessionMenu(session) {
  actionMenuSession.value = session
}

// Eksekusi Semat dari Menu Aksi
async function handlePinFromMenu() {
  if (!actionMenuSession.value) return
  const s = actionMenuSession.value
  actionMenuSession.value = null
  await chatStore.togglePinSession(s.id, selectedCounselorFilter.value)
}

// Eksekusi Hapus dari Menu Aksi
function handleDeleteFromMenu() {
  if (!actionMenuSession.value) return
  const s = actionMenuSession.value
  actionMenuSession.value = null
  openDeleteModal(s)
}

// Modal Hapus Sesi
function openDeleteModal(session) {
  sessionToDelete.value = session
  selectedDeleteType.value = 'for_me'
  isDeleteModalOpen.value = true
}

async function confirmDeleteSession() {
  if (!sessionToDelete.value) return
  isDeleting.value = true
  try {
    await chatStore.deleteSession(sessionToDelete.value.id, selectedDeleteType.value)
    isDeleteModalOpen.value = false
    sessionToDelete.value = null
  } catch (err) {
    alert(err.message || 'Gagal menghapus percakapan.')
  } finally {
    isDeleting.value = false
  }
}

// Aksi Pesan Bubble
function openMessageMenu(msg) {
  actionMenuMessage.value = msg
}

function handleCopyMessageText() {
  if (!actionMenuMessage.value?.message) return
  navigator.clipboard.writeText(actionMenuMessage.value.message)
  actionMenuMessage.value = null
  alert('Teks pesan berhasil disalin!')
}

function handleDeleteMessageFromMenu() {
  if (!actionMenuMessage.value) return
  const m = actionMenuMessage.value
  actionMenuMessage.value = null
  openDeleteMessageModal(m)
}

function openDeleteMessageModal(msg) {
  messageToDelete.value = msg
  selectedDeleteMessageType.value = 'for_me'
  isDeleteMessageModalOpen.value = true
}

async function confirmDeleteMessage() {
  if (!messageToDelete.value) return
  isDeletingMessage.value = true
  try {
    await chatStore.deleteMessage(messageToDelete.value.id, selectedDeleteMessageType.value)
    isDeleteMessageModalOpen.value = false
    messageToDelete.value = null
  } catch (err) {
    alert(err.message || 'Gagal menghapus pesan.')
  } finally {
    isDeletingMessage.value = false
  }
}

function applyQuickTemplate(t) { replyText.value = t }

function formatBubbleTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatListTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function getCategoryData(catId) {
  return CATEGORIES.find(c => c.id === catId) || CATEGORIES[0]
}
</script>

<template>
  <div class="h-screen h-[100dvh] bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans overflow-hidden">
    
    <!-- Navbar -->
    <header :class="mobileView === 'detail' ? 'hidden lg:block' : 'block'" class="shrink-0 z-30">
      <PublicNavbar />
    </header>

    <main class="flex-1 w-full p-0 m-0 flex flex-col min-h-0 overflow-hidden">
      <div class="flex-1 w-full bg-white dark:bg-slate-900 border-0 rounded-none shadow-none flex flex-col lg:grid lg:grid-cols-12 overflow-hidden min-h-0">
        
        <!-- ============================================================ -->
        <!-- PANEL KIRI: INBOX (4 col lg / 3 col xl)                     -->
        <!-- ============================================================ -->
        <aside
          class="flex-1 lg:flex-initial lg:col-span-4 xl:col-span-3 2xl:col-span-3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 h-full min-h-0"
          :class="mobileView === 'detail' ? 'hidden lg:flex' : 'flex'"
        >
          <!-- TOOLBAR: Filter Guru + Search + Status Chips (Menyatu Seamless dengan Navbar) -->
          <div class="px-4 py-3 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0 bg-white dark:bg-slate-900">
            <!-- Custom Dropdown: Filter Guru BK -->
            <div class="relative" ref="counselorDropdownRef">
              <button
                type="button"
                @click="isCounselorDropdownOpen = !isCounselorDropdownOpen"
                class="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between transition-all shadow-2xs cursor-pointer group"
                title="Pilih Guru BK"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-7 h-7 rounded-lg bg-sky-100 text-[#0284C7] dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-xs shrink-0 font-bold shadow-2xs">
                    <i v-if="selectedCounselorFilter === 'ALL'" class="fa-solid fa-users"></i>
                    <i v-else class="fa-solid fa-user-tie"></i>
                  </div>
                  <div class="text-left min-w-0">
                    <span class="block truncate leading-tight">
                      {{ selectedCounselorFilter === 'ALL' ? 'Semua Guru BK' : selectedCounselorFilter }}
                    </span>
                    <span class="block text-[10px] text-slate-400 font-normal truncate mt-0.5">
                      {{ selectedCounselorFilter === 'ALL' ? 'Filter berdasarkan guru pembimbing' : 'Guru Bimbingan Konseling' }}
                    </span>
                  </div>
                </div>
                <i
                  class="fa-solid fa-chevron-down text-xs text-slate-400 group-hover:text-[#0284C7] transition-transform duration-200 shrink-0 ml-2"
                  :class="{ 'rotate-180 text-[#0284C7]': isCounselorDropdownOpen }"
                ></i>
              </button>

              <!-- Floating Dropdown Menu -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
              >
                <div
                  v-if="isCounselorDropdownOpen"
                  class="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/70 dark:shadow-slate-950/90 border border-slate-200/90 dark:border-slate-800 overflow-hidden py-1.5 backdrop-blur-md"
                >
                  <button
                    type="button"
                    @click="selectCounselor('ALL')"
                    class="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    :class="selectedCounselorFilter === 'ALL'
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-300 font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                  >
                    <div class="flex items-center gap-2.5">
                      <div class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-500 shrink-0">
                        <i class="fa-solid fa-users"></i>
                      </div>
                      <div>
                        <span class="block">Semua Guru BK</span>
                        <span class="block text-[10px] text-slate-400 font-normal">Tampilkan seluruh pesan masuk</span>
                      </div>
                    </div>
                    <i v-if="selectedCounselorFilter === 'ALL'" class="fa-solid fa-check text-xs text-[#0284C7]"></i>
                  </button>

                  <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>

                  <button
                    v-for="c in COUNSELORS"
                    :key="c"
                    type="button"
                    @click="selectCounselor(c)"
                    class="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    :class="selectedCounselorFilter === c
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-300 font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'"
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950 text-[#0284C7] dark:text-sky-300 flex items-center justify-center text-xs shrink-0 font-bold">
                        {{ c.split(' ')[0].slice(0, 2).toUpperCase() }}
                      </div>
                      <div class="min-w-0">
                        <span class="block truncate">{{ c }}</span>
                        <span class="block text-[10px] text-slate-400 font-normal">Guru Bimbingan Konseling</span>
                      </div>
                    </div>
                    <i v-if="selectedCounselorFilter === c" class="fa-solid fa-check text-xs text-[#0284C7] shrink-0 ml-2"></i>
                  </button>
                </div>
              </Transition>
            </div>

            <div class="relative">
              <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"></i>
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Cari nama, kelas, topik..."
                class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:bg-white dark:focus:bg-slate-900 transition-colors"
              />
            </div>

            <!-- Status Chips dengan counter -->
            <div class="flex items-center gap-1.5 overflow-x-auto text-xs sm:text-sm font-semibold no-scrollbar pt-0.5">
              <button
                type="button" @click="selectedStatusFilter = 'ALL'"
                class="px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                :class="selectedStatusFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-300'"
              >
                <span>Semua</span>
                <span class="text-[11px] px-1.5 py-0.2 rounded-full font-bold" :class="selectedStatusFilter === 'ALL' ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'">{{ chatStore.sortedSessions.length }}</span>
              </button>
              <button
                type="button" @click="selectedStatusFilter = 'menunggu'"
                class="px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                :class="selectedStatusFilter === 'menunggu'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-200'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400'"
              >
                <span>Menunggu</span>
                <span v-if="statusCounts.menunggu" class="text-[10px] px-1.5 py-0.2 rounded-full font-bold" :class="selectedStatusFilter === 'menunggu' ? 'bg-slate-950/20' : 'bg-amber-200 dark:bg-amber-900/60'">{{ statusCounts.menunggu }}</span>
              </button>
              <button
                type="button" @click="selectedStatusFilter = 'ditindaklanjuti'"
                class="px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                :class="selectedStatusFilter === 'ditindaklanjuti'
                  ? 'bg-sky-600 text-white font-bold shadow-sm shadow-sky-200'
                  : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-400'"
              >
                <span>Diproses</span>
                <span v-if="statusCounts.ditindaklanjuti" class="text-[10px] px-1.5 py-0.2 rounded-full font-bold" :class="selectedStatusFilter === 'ditindaklanjuti' ? 'bg-white/25' : 'bg-sky-200 dark:bg-sky-900/60'">{{ statusCounts.ditindaklanjuti }}</span>
              </button>
              <button
                type="button" @click="selectedStatusFilter = 'selesai'"
                class="px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                :class="selectedStatusFilter === 'selesai'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-200'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'"
              >
                <span>Selesai</span>
              </button>
            </div>
          </div>

          <!-- DAFTAR PESAN (BERSIH: TITIK TIGA DI DESKTOP, TEKAN TAHAN DI MOBILE) -->
          <div class="flex-1 overflow-y-auto min-h-0">
            <div v-if="chatStore.isLoadingSessions" class="p-8 text-center">
              <i class="fa-solid fa-spinner fa-spin text-xl text-[#0284C7] mb-2"></i>
              <p class="text-xs text-slate-400">Memuat pesan masuk...</p>
            </div>

            <div v-else-if="filteredSessions.length === 0" class="p-10 text-center space-y-3">
              <div class="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <i class="fa-regular fa-envelope text-xl text-slate-300 dark:text-slate-600"></i>
              </div>
              <p class="text-xs text-slate-400">Belum ada pesan masuk.</p>
            </div>

            <!-- ROW PESAN -->
            <button
              v-for="s in filteredSessions"
              :key="s.id"
              type="button"
              @click="handleClickSession(s)"
              @touchstart="handleTouchStart(s, 'session')"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
              @contextmenu.prevent="openSessionMenu(s)"
              class="w-full text-left border-b border-slate-100 dark:border-slate-800/50 transition-all cursor-pointer group relative select-none"
              :class="[
                chatStore.activeSession?.id === s.id
                  ? 'bg-blue-50/80 dark:bg-sky-950/30'
                  : isSessionPinnedForCounselor(s, selectedCounselorFilter)
                    ? 'bg-amber-50/40 dark:bg-amber-950/15 hover:bg-amber-50/70'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
              ]"
            >
              <!-- Active indicator bar -->
              <div
                v-if="chatStore.activeSession?.id === s.id"
                class="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#0284C7]"
              ></div>

              <div class="flex items-start gap-3 sm:gap-3.5 px-4 py-3.5">
                <!-- Avatar Siswa -->
                <div
                  class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm mt-0.5"
                  :class="s.status === 'menunggu'
                    ? 'bg-gradient-to-br from-[#0369A1] to-[#0284C7] text-white ring-2 ring-sky-300 dark:ring-sky-700'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'"
                >
                  {{ s.student_name ? s.student_name.slice(0, 2).toUpperCase() : 'SW' }}
                </div>

                <!-- Konten Utama Baris -->
                <div class="flex-1 min-w-0">
                  <!-- Baris 1: Nama Siswa + Pin Badge + Waktu & Titik Tiga Desktop -->
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <!-- Badge Icon Disematkan (Hanya muncul jika pinned) -->
                      <span
                        v-if="isSessionPinnedForCounselor(s, selectedCounselorFilter)"
                        class="text-amber-500 text-sm shrink-0"
                        title="Percakapan Disematkan"
                      >
                        <i class="fa-solid fa-thumbtack rotate-45"></i>
                      </span>

                      <span
                        class="text-sm sm:text-[15px] truncate"
                        :class="s.status === 'menunggu' ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'"
                      >{{ s.student_name }}</span>
                      <span v-if="s.student_class" class="text-xs text-slate-400 dark:text-slate-500 shrink-0 font-medium">({{ s.student_class }})</span>
                    </div>

                    <!-- Waktu & Tombol Titik Tiga (Desktop Hover) -->
                    <div class="flex items-center gap-1 shrink-0">
                      <span class="text-xs font-semibold tabular-nums" :class="s.status === 'menunggu' ? 'text-[#0284C7]' : 'text-slate-400'">
                        {{ formatListTime(s.last_message_at || s.created_at) }}
                      </span>

                      <!-- Tombol Titik Tiga (Muncul di Desktop saat hover/focus) -->
                      <button
                        type="button"
                        @click.stop="openSessionMenu(s)"
                        class="w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Opsi Percakapan (Sematkan / Hapus)"
                      >
                        <i class="fa-solid fa-ellipsis-vertical text-xs"></i>
                      </button>
                    </div>
                  </div>

                  <!-- Baris 2: Judul Topik (Bold) — Preview Isi Pesan -->
                  <div class="flex items-center gap-1.5 mt-1 min-w-0">
                    <p class="truncate text-xs sm:text-sm flex-1 min-w-0">
                      <span :class="s.status === 'menunggu' ? 'font-semibold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-400'">{{ s.title }}</span>
                      <span v-if="s.last_message_preview" class="text-slate-400 dark:text-slate-500 font-normal"> &mdash; {{ s.last_message_preview }}</span>
                    </p>
                  </div>

                  <!-- Baris 3: Badges Kategori + Status + Guru Tujuan -->
                  <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span class="text-[11px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border" :class="getCategoryData(s.category)?.badge">
                      {{ s.category }}
                    </span>
                    <span class="text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md border" :class="STATUS_CONFIG[s.status]?.badge">
                      {{ STATUS_CONFIG[s.status]?.label }}
                    </span>
                    <span
                      v-if="s.needs_offline_followup"
                      class="text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1"
                    >
                      <i class="fa-solid fa-school text-[10px]"></i> Ruang BK
                    </span>
                    <span class="text-xs text-slate-400 dark:text-slate-500 truncate ml-auto">
                      Ke: {{ s.counselor_name?.split(' ')[0] }}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </aside>

        <!-- ============================================================ -->
        <!-- PANEL KANAN: READING PANE / DETAIL PERCAKAPAN               -->
        <!-- ============================================================ -->
        <section
          class="flex-1 lg:col-span-8 xl:col-span-9 2xl:col-span-9 flex flex-col h-full min-h-0"
          :class="mobileView === 'list' ? 'hidden lg:flex' : 'fixed inset-0 z-50 lg:static lg:z-auto flex'"
        >
          <!-- EMPTY STATE -->
          <div
            v-if="!chatStore.activeSession"
            class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-900"
          >
            <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#0369A1] to-sky-500 flex items-center justify-center shadow-lg shadow-sky-200/50 dark:shadow-sky-900/50">
              <i class="fa-solid fa-envelope-open text-white text-2xl"></i>
            </div>
            <div class="space-y-1 max-w-xs">
              <h3 class="font-display font-bold text-base text-slate-800 dark:text-white">Pilih Pesan Siswa</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Klik pesan dari kotak masuk di samping untuk mulai membaca dan membalas bimbingan.
              </p>
            </div>
          </div>

          <!-- ROOM CHAT / READING PANE -->
          <div v-else class="flex-1 flex flex-col h-full min-h-0 bg-white dark:bg-slate-900">
            
            <!-- HEADER DETAIL -->
            <div class="px-3 sm:px-6 py-2.5 sm:py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <!-- Row 1: Back + Identitas Siswa + Status Badge & Action Buttons -->
              <div class="flex items-center justify-between gap-2 sm:gap-3 min-w-0">
                <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <button
                    type="button" @click="handleBackToListMobile"
                    class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 flex items-center justify-center lg:hidden shrink-0 cursor-pointer transition-colors"
                  >
                    <i class="fa-solid fa-arrow-left text-sm sm:text-base"></i>
                  </button>

                  <!-- Avatar Siswa Header -->
                  <div class="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#0369A1] to-[#0284C7] text-white flex items-center justify-center font-bold text-xs sm:text-base shrink-0 shadow-sm">
                    {{ chatStore.activeSession.student_name ? chatStore.activeSession.student_name.slice(0, 2).toUpperCase() : 'SW' }}
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span
                        v-if="isSessionPinnedForCounselor(chatStore.activeSession, selectedCounselorFilter)"
                        class="text-amber-500 text-xs sm:text-sm shrink-0"
                        title="Disematkan"
                      >
                        <i class="fa-solid fa-thumbtack rotate-45"></i>
                      </span>
                      <h2 class="font-bold text-sm sm:text-lg lg:text-xl text-slate-900 dark:text-white truncate leading-tight">
                        {{ chatStore.activeSession.student_name }}
                      </h2>
                      <span
                        v-if="chatStore.activeSession.student_class"
                        class="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2.5 py-0.2 sm:py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 border border-slate-200/60 dark:border-slate-700/60"
                      >
                        {{ chatStore.activeSession.student_class }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      <!-- Status badge ringkas khusus mobile -->
                      <span
                        class="sm:hidden font-semibold flex items-center gap-1 shrink-0"
                        :class="chatStore.activeSession.status === 'selesai' ? 'text-emerald-600 dark:text-emerald-400' : chatStore.activeSession.status === 'ditindaklanjuti' ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'"
                      >
                        <i :class="STATUS_CONFIG[chatStore.activeSession.status]?.icon" class="text-[10px]"></i>
                        <span>{{ STATUS_CONFIG[chatStore.activeSession.status]?.label }}</span>
                      </span>
                      <span class="sm:hidden text-slate-300 dark:text-slate-600 shrink-0">•</span>
                      <span class="truncate">Konselor: <strong class="text-slate-700 dark:text-slate-300 font-semibold">{{ chatStore.activeSession.counselor_name }}</strong></span>
                    </div>
                  </div>
                </div>

                <!-- Right Side: Status Badge + Single 'Tandai Selesai' Button + Notes + 3-dots -->
                <div class="shrink-0 flex items-center gap-1.5 sm:gap-2">
                  <!-- Single Clean Status Badge (Desktop/Tablet Only) -->
                  <span
                    class="hidden sm:inline-flex px-3 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold border items-center gap-1.5 shadow-2xs"
                    :class="STATUS_CONFIG[chatStore.activeSession.status]?.badge"
                  >
                    <i :class="STATUS_CONFIG[chatStore.activeSession.status]?.icon" class="text-xs"></i>
                    <span>{{ STATUS_CONFIG[chatStore.activeSession.status]?.label }}</span>
                  </span>

                  <!-- Tombol 1-Klik Tandai Selesai (Desktop/Tablet Only) -->
                  <button
                    v-if="chatStore.activeSession.status !== 'selesai'"
                    type="button"
                    @click="handleStatusChange('selesai')"
                    class="hidden sm:inline-flex px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer active:scale-95 items-center gap-2 whitespace-nowrap"
                    title="Tutup sesi dan tandai selesai"
                  >
                    <i class="fa-solid fa-circle-check text-sm"></i>
                    <span>Tandai Selesai</span>
                  </button>

                  <!-- Tombol Buka Drawer Catatan Rahasia Konselor (Ikon Buku Catatan) -->
                  <button
                    type="button"
                    @click="openNotesDrawer"
                    class="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 dark:text-slate-300 dark:hover:text-purple-300 dark:hover:border-purple-800 dark:hover:bg-slate-800 flex items-center justify-center transition-all cursor-pointer shrink-0"
                    title="Buku Catatan Siswa (Dossier BK)"
                  >
                    <i class="fa-solid fa-book-bookmark text-sm sm:text-base"></i>
                    <!-- Titik indikator jika siswa memiliki catatan di dossier -->
                    <span
                      v-if="activeStudentNotes.length > 0"
                      class="absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-500 ring-2 ring-white dark:ring-slate-900"
                      title="Siswa memiliki catatan di dossier"
                    ></span>
                  </button>

                  <!-- Tombol Menu Titik Tiga Header -->
                  <button
                    type="button"
                    @click="openSessionMenu(chatStore.activeSession)"
                    class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 flex items-center justify-center transition-all cursor-pointer shrink-0"
                    title="Menu Opsi"
                  >
                    <i class="fa-solid fa-ellipsis-vertical text-sm sm:text-base"></i>
                  </button>
                </div>
              </div>

              <!-- Row 2: Topik & Kategori Banner (Konteks Masalah Konsultasi) -->
              <div class="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/70 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border border-slate-200/60 dark:border-slate-700/60 mt-2 text-[11px] sm:text-sm">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <span class="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider border shrink-0" :class="getCategoryData(chatStore.activeSession.category)?.badge">
                    {{ chatStore.activeSession.category }}
                  </span>
                  <p class="font-medium text-slate-700 dark:text-slate-200 truncate">
                    <span class="text-slate-400 font-normal">Topik:</span> {{ chatStore.activeSession.title }}
                  </p>
                </div>
                <span
                  v-if="chatStore.activeSession.needs_offline_followup"
                  class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                  title="Siswa meminta tatap muka di Ruang BK"
                >
                  <i class="fa-solid fa-school text-[10px] sm:text-xs"></i>
                  <span>Tatap Muka</span>
                </span>
              </div>
            </div>

            <!-- AREA BUBBLE CHAT -->
            <div
              ref="chatMessagesContainer"
              class="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-3.5 sm:space-y-4 min-h-0 bg-[#F8F9FB] dark:bg-slate-950/50"
            >
              <!-- Banner Penjelas Status Menunggu untuk Guru BK -->
              <div
                v-if="chatStore.activeSession.status === 'menunggu'"
                class="p-2.5 sm:p-4 mx-auto max-w-lg rounded-xl sm:rounded-2xl text-center text-xs sm:text-sm space-y-1 bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/80 shadow-2xs my-1 sm:my-2"
              >
                <div class="flex items-center justify-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-xs sm:text-sm">
                  <i class="fa-solid fa-hourglass-half text-xs sm:text-sm animate-pulse"></i>
                  <span>Menunggu Tanggapan Pertama Guru BK</span>
                </div>
                <p class="text-[11px] sm:text-xs text-amber-700 dark:text-amber-300/80 leading-relaxed">
                  Kirimkan balasan bimbingan untuk merespons siswa. Status sesi akan otomatis berubah menjadi <strong>Diproses</strong>.
                </p>
              </div>

              <!-- Banner Penjelas Status Selesai untuk Guru BK -->
              <div
                v-if="chatStore.activeSession.status === 'selesai'"
                class="p-2.5 sm:p-4 mx-auto max-w-lg rounded-xl sm:rounded-2xl text-center text-xs sm:text-sm space-y-1 bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 shadow-2xs my-1 sm:my-2"
              >
                <div class="flex items-center justify-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm">
                  <i class="fa-solid fa-circle-check text-xs sm:text-sm"></i>
                  <span>Sesi Konsultasi Telah Selesai</span>
                </div>
                <p class="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-300/80 leading-relaxed">
                  Sesi bimbingan konseling ini telah ditandai selesai.
                </p>
              </div>
              <div
                v-for="msg in chatStore.messages"
                :key="msg.id"
                class="flex flex-col group select-none"
                :class="msg.sender_role === 'guru' ? 'items-end' : 'items-start'"
                @touchstart="handleTouchStart(msg, 'message')"
                @touchend="handleTouchEnd"
                @touchmove="handleTouchMove"
                @contextmenu.prevent="openMessageMenu(msg)"
              >
                <!-- Bubble Chat -->
                <div
                  class="max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl leading-relaxed text-sm sm:text-[15px] lg:text-base whitespace-pre-wrap break-words relative shadow-2xs"
                  :class="[
                    msg.is_deleted_for_everyone
                      ? 'bg-slate-100 text-slate-400 italic dark:bg-slate-800 dark:text-slate-500 rounded-lg border border-dashed border-slate-300 dark:border-slate-700'
                      : msg.sender_role === 'guru'
                        ? 'bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white rounded-tr-sm shadow-sm shadow-sky-200/50 dark:shadow-sky-900/50'
                        : 'bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-tl-sm border border-slate-200 dark:border-slate-700 shadow-sm'
                  ]"
                >
                  <p>{{ msg.message }}</p>
                  
                  <div class="flex items-center justify-between gap-3 text-xs mt-1.5 select-none">
                    <!-- Tombol Titik Tiga Pesan (Desktop Hover) -->
                    <button
                      v-if="!msg.is_deleted_for_everyone"
                      type="button"
                      @click="openMessageMenu(msg)"
                      class="opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer hover:underline"
                      :class="msg.sender_role === 'guru' ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-slate-700'"
                      title="Opsi Pesan"
                    >
                      <i class="fa-solid fa-ellipsis text-xs"></i>
                    </button>
                    <span v-else></span>

                    <div
                      class="flex items-center gap-1.5 font-medium ml-auto"
                      :class="msg.sender_role === 'guru' ? 'text-white/70' : 'text-slate-400'"
                    >
                      <span>{{ formatBubbleTime(msg.created_at) }}</span>
                      <i v-if="msg.sender_role === 'guru' && !msg.is_deleted_for_everyone" class="fa-solid fa-check-double text-[10px] text-white/80"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- BOTTOM INPUT BAR -->
            <div class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <!-- Jika Sesi Selesai: Banner Penutupan & Tombol Buka Kembali -->
              <div
                v-if="chatStore.activeSession.status === 'selesai'"
                class="p-4 mx-4 sm:mx-6 my-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <i class="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400 text-base shrink-0"></i>
                  <span class="truncate font-medium">Sesi bimbingan konseling ini telah selesai ditutup.</span>
                </div>
                <button
                  type="button"
                  @click="handleStatusChange('ditindaklanjuti')"
                  class="shrink-0 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 text-xs sm:text-sm transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <i class="fa-solid fa-arrow-rotate-left text-xs"></i>
                  <span>Buka Kembali Sesi</span>
                </button>
              </div>

              <!-- Jika Sesi Masih Aktif: Quick Replies + Input Form -->
              <template v-else>
                <!-- Quick Replies -->
                <div class="flex items-center gap-2 overflow-x-auto px-4 sm:px-6 pt-3 pb-1.5 text-xs no-scrollbar">
                  <span class="text-slate-400 shrink-0 text-xs font-semibold">Cepat:</span>
                  <button
                    type="button"
                    @click="applyQuickTemplate('Halo ananda, terima kasih sudah berkonsultasi. Kapan ada waktu luang untuk kita bahas bersama?')"
                    class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 whitespace-nowrap transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800 text-xs sm:text-sm"
                  >&ldquo;Tanya waktu luang&rdquo;</button>
                  <button
                    type="button"
                    @click="applyQuickTemplate('Silakan ananda datang ke Ruang BK pada saat jam istirahat untuk kita diskusikan langsung ya.')"
                    class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 whitespace-nowrap transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800 text-xs sm:text-sm"
                  >&ldquo;Ajak ke Ruang BK&rdquo;</button>
                  <button
                    type="button"
                    @click="applyQuickTemplate('Halo ananda, untuk perihal tersebut berada di luar ranah layanan BK dan dapat langsung dikonsultasikan ke bagian terkait (Tata Usaha / Wali Kelas) ya. Sesi konsultasi ini Ibu/Bapak tandai selesai. Tetap semangat!')"
                    class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/50 dark:hover:text-amber-300 whitespace-nowrap transition-colors cursor-pointer border border-transparent hover:border-amber-200 dark:hover:border-amber-800 text-xs sm:text-sm"
                  >&ldquo;Di luar ranah BK&rdquo;</button>
                  <button
                    type="button"
                    @click="applyQuickTemplate('Alhamdulillah, senang mendengar perkembangan baik ananda. Sesi bimbingan konseling ini kita tandai selesai ya.')"
                    class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 whitespace-nowrap transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800 text-xs sm:text-sm"
                  >&ldquo;Tandai selesai&rdquo;</button>
                </div>

                <!-- Input -->
                <form @submit.prevent="handleSendReply" class="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-6 py-2 sm:py-3">
                  <input
                    v-model="replyText"
                    type="text"
                    placeholder="Ketik balasan bimbingan..."
                    class="flex-1 bg-slate-100 dark:bg-slate-800 text-sm sm:text-base text-slate-800 dark:text-slate-100 rounded-full px-4 sm:px-5 py-2.5 sm:py-3 outline-none focus:ring-2 focus:ring-[#0284C7] placeholder:text-slate-400 transition-all border border-slate-200 dark:border-slate-700 focus:bg-white focus:border-[#0284C7] dark:focus:bg-slate-900"
                  />
                  <button
                    type="submit"
                    :disabled="!replyText.trim() || chatStore.isSending"
                    class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#0284C7] to-[#0369A1] hover:from-[#0369A1] hover:to-[#024E7C] text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-md shadow-sky-200/50 dark:shadow-sky-900/50 cursor-pointer"
                    title="Kirim Balasan"
                  >
                    <i v-if="chatStore.isSending" class="fa-solid fa-spinner fa-spin text-sm"></i>
                    <i v-else class="fa-solid fa-paper-plane text-sm"></i>
                  </button>
                </form>
              </template>
            </div>
          </div>
        </section>

      </div>
    </main>

    <!-- ============================================================== -->
    <!-- ACTION SHEET: MENU OPSI SESI (DESKTOP MODAL / MOBILE BOTTOM)   -->
    <!-- ============================================================== -->
    <div
      v-if="actionMenuSession"
      class="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs transition-all"
      @click.self="actionMenuSession = null"
    >
      <div class="w-full sm:max-w-xs bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <!-- Handle bar di mobile -->
        <div class="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden mb-1"></div>

        <div class="px-1 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h4 class="font-bold text-sm text-slate-900 dark:text-white truncate">
            {{ actionMenuSession.student_name }}
          </h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {{ actionMenuSession.title }}
          </p>
        </div>

        <div class="space-y-1">
          <!-- Tombol Aksi Status dari Menu (Tandai Selesai / Buka Kembali) -->
          <button
            v-if="actionMenuSession.status === 'selesai'"
            type="button"
            @click="handleReopenFromMenu"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold text-blue-700 dark:text-blue-300 transition-colors cursor-pointer"
          >
            <div class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center text-sm shrink-0">
              <i class="fa-solid fa-arrow-rotate-left"></i>
            </div>
            <div class="text-left flex-1">
              <span class="block">Buka Kembali Percakapan</span>
              <span class="block text-[10px] text-slate-400 font-normal">
                Ubah status kembali ke Diproses
              </span>
            </div>
          </button>

          <button
            v-else
            type="button"
            @click="handleCompleteFromMenu"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
          >
            <div class="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center text-sm shrink-0">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div class="text-left flex-1">
              <span class="block">Tandai Selesai</span>
              <span class="block text-[10px] text-slate-400 font-normal">
                Tutup sesi bimbingan konseling ini
              </span>
            </div>
          </button>

          <!-- Tombol Sematkan / Lepas Sematan -->
          <button
            type="button"
            @click="handlePinFromMenu"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <div class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center text-sm shrink-0">
              <i class="fa-solid fa-thumbtack rotate-45"></i>
            </div>
            <div class="text-left flex-1">
              <span class="block">
                {{ isSessionPinnedForCounselor(actionMenuSession, selectedCounselorFilter) ? 'Lepas Sematan' : 'Sematkan Percakapan' }}
              </span>
              <span class="block text-[10px] text-slate-400 font-normal">
                {{ isSessionPinnedForCounselor(actionMenuSession, selectedCounselorFilter) ? 'Kembalikan ke urutan waktu normal' : 'Posisikan selalu di urutan paling atas' }}
              </span>
            </div>
          </button>

          <!-- Tombol Hapus Percakapan -->
          <button
            type="button"
            @click="handleDeleteFromMenu"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
          >
            <div class="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center text-sm shrink-0">
              <i class="fa-regular fa-trash-can"></i>
            </div>
            <div class="text-left flex-1">
              <span class="block">Hapus Percakapan</span>
              <span class="block text-[10px] text-slate-400 font-normal">
                Hapus untuk saya atau semua orang
              </span>
            </div>
          </button>
        </div>

        <button
          type="button"
          @click="actionMenuSession = null"
          class="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
        >
          Batal
        </button>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- ACTION SHEET: MENU OPSI PESAN BUBBLE                           -->
    <!-- ============================================================== -->
    <div
      v-if="actionMenuMessage"
      class="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs transition-all"
      @click.self="actionMenuMessage = null"
    >
      <div class="w-full sm:max-w-xs bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div class="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden mb-1"></div>

        <div class="px-1 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h4 class="font-bold text-xs text-slate-500 uppercase tracking-wider">Opsi Pesan</h4>
          <p class="text-xs text-slate-800 dark:text-slate-200 truncate mt-1 italic">
            &ldquo;{{ actionMenuMessage.message }}&rdquo;
          </p>
        </div>

        <div class="space-y-1">
          <!-- Salin Teks -->
          <button
            type="button"
            @click="handleCopyMessageText"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <div class="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center text-sm shrink-0">
              <i class="fa-regular fa-copy"></i>
            </div>
            <span>Salin Teks Pesan</span>
          </button>

          <!-- Hapus Pesan -->
          <button
            type="button"
            @click="handleDeleteMessageFromMenu"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
          >
            <div class="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center text-sm shrink-0">
              <i class="fa-regular fa-trash-can"></i>
            </div>
            <span>Hapus Pesan</span>
          </button>
        </div>

        <button
          type="button"
          @click="actionMenuMessage = null"
          class="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
        >
          Batal
        </button>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- MODAL: HAPUS RIWAYAT KONSULTASI (PRIBADI VS SEMUA ORANG)        -->
    <!-- ============================================================== -->
    <div
      v-if="isDeleteModalOpen && sessionToDelete"
      class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      @click.self="isDeleteModalOpen = false"
    >
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <!-- Header Modal -->
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center text-lg shrink-0">
            <i class="fa-solid fa-trash-can"></i>
          </div>
          <div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white">Hapus Riwayat Konsultasi</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
              {{ sessionToDelete.title }}
            </p>
          </div>
        </div>

        <!-- Pilihan Metode Hapus -->
        <div class="space-y-2.5 pt-1">
          <!-- Opsi 1: Hapus untuk Pribadi (Saya) -->
          <label
            class="block p-3.5 rounded-2xl border transition-all cursor-pointer"
            :class="selectedDeleteType === 'for_me'
              ? 'border-[#0284C7] bg-sky-50/60 dark:bg-sky-950/40 ring-2 ring-sky-400/30'
              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'"
          >
            <div class="flex items-start gap-3">
              <input
                type="radio"
                name="deleteTypeAdmin"
                value="for_me"
                v-model="selectedDeleteType"
                class="mt-1 text-[#0284C7] focus:ring-sky-500"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    Hapus untuk Saya (Pribadi)
                  </span>
                  <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    Pribadi
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Hanya menghapus riwayat konsultasi dari akun Anda. Siswa tetap memiliki dan dapat membaca riwayat konsultasi ini.
                </p>
              </div>
            </div>
          </label>

          <!-- Opsi 2: Hapus untuk Semua Orang (Dua Pihak < 15 Menit) -->
          <label
            class="block p-3.5 rounded-2xl border transition-all"
            :class="[
              !check15MinEligibility(sessionToDelete.created_at).allowed
                ? 'opacity-60 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 cursor-not-allowed'
                : selectedDeleteType === 'for_everyone'
                  ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 ring-2 ring-rose-400/30 cursor-pointer'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'
            ]"
          >
            <div class="flex items-start gap-3">
              <input
                type="radio"
                name="deleteTypeAdmin"
                value="for_everyone"
                v-model="selectedDeleteType"
                :disabled="!check15MinEligibility(sessionToDelete.created_at).allowed"
                class="mt-1 text-rose-600 focus:ring-rose-500"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    Hapus untuk Semua Orang (Dua Pihak)
                  </span>
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    :class="check15MinEligibility(sessionToDelete.created_at).allowed
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
                  >
                    {{ check15MinEligibility(sessionToDelete.created_at).allowed ? check15MinEligibility(sessionToDelete.created_at).remainingText : 'Lewat 15 menit' }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  <span v-if="check15MinEligibility(sessionToDelete.created_at).allowed">
                    Menghapus riwayat konsultasi ini secara permanen untuk Anda dan Siswa.
                  </span>
                  <span v-else class="text-rose-600 dark:text-rose-400 font-medium">
                    Konsultasi telah dibuat lebih dari 15 menit yang lalu. Fitur hapus dua pihak sudah tidak tersedia.
                  </span>
                </p>
              </div>
            </div>
          </label>
        </div>

        <!-- Tombol Aksi Modal Hapus -->
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            @click="isDeleteModalOpen = false"
            class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            @click="confirmDeleteSession"
            :disabled="isDeleting"
            class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer transition-all disabled:opacity-50"
          >
            <i v-if="isDeleting" class="fa-solid fa-spinner fa-spin mr-1"></i>
            <span>{{ isDeleting ? 'Menghapus...' : 'Hapus Percakapan' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- MODAL: HAPUS PESAN BUBBLE (PRIBADI VS SEMUA ORANG)             -->
    <!-- ============================================================== -->
    <div
      v-if="isDeleteMessageModalOpen && messageToDelete"
      class="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      @click.self="isDeleteMessageModalOpen = false"
    >
      <div class="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
        <h3 class="font-bold text-sm text-slate-900 dark:text-white">
          Hapus Pesan Ini?
        </h3>
        
        <div class="space-y-2 text-xs">
          <label class="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
            <input type="radio" value="for_me" v-model="selectedDeleteMessageType" class="mt-0.5 text-[#0284C7]" />
            <div>
              <strong class="block text-slate-800 dark:text-slate-200">Hapus untuk Saya</strong>
              <span class="text-[11px] text-slate-400">Pesan ini hanya disembunyikan dari tampilan Anda.</span>
            </div>
          </label>

          <label
            class="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
            :class="check15MinEligibility(messageToDelete.created_at).allowed ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : 'opacity-50 cursor-not-allowed'"
          >
            <input
              type="radio"
              value="for_everyone"
              v-model="selectedDeleteMessageType"
              :disabled="!check15MinEligibility(messageToDelete.created_at).allowed"
              class="mt-0.5 text-rose-600"
            />
            <div>
              <div class="flex items-center gap-1.5">
                <strong class="text-slate-800 dark:text-slate-200">Hapus untuk Semua Orang</strong>
                <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {{ check15MinEligibility(messageToDelete.created_at).remainingText }}
                </span>
              </div>
              <span class="text-[11px] text-slate-400">Tarik pesan untuk kedua pihak (maks 15 menit).</span>
            </div>
          </label>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            @click="isDeleteMessageModalOpen = false"
            class="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            @click="confirmDeleteMessage"
            :disabled="isDeletingMessage"
            class="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer disabled:opacity-50"
          >
            {{ isDeletingMessage ? 'Menghapus...' : 'Hapus' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- SLIDE-OVER DRAWER: BUKU CATATAN SISWA (DOSSIER BK)             -->
    <!-- Menampilkan timeline seluruh riwayat catatan siswa aktif       -->
    <!-- ============================================================== -->
    <div
      v-if="isNotesDrawerOpen"
      class="fixed inset-0 z-50 overflow-hidden"
    >
      <!-- Backdrop Gelap -->
      <div
        class="absolute inset-0 bg-slate-950/40 backdrop-blur-2xs transition-opacity"
        @click="closeNotesDrawer"
      ></div>

      <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside
          class="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 transition-transform"
        >
          <!-- 1. Header Drawer -->
          <div class="p-4 sm:p-5 bg-gradient-to-r from-purple-700 to-indigo-600 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-lg">
                <i class="fa-solid fa-book-bookmark"></i>
              </div>
              <div>
                <h3 class="font-display font-bold text-base leading-tight">
                  Buku Catatan Siswa
                </h3>
                <p class="text-[11px] text-purple-100 flex items-center gap-1 mt-0.5 font-medium">
                  <i class="fa-solid fa-lock text-[10px]"></i>
                  <span>Dossier BK • Privat Guru BK</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              @click="closeNotesDrawer"
              class="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Tutup Panel Catatan"
            >
              <i class="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          <!-- 2. Snapshot Identitas Siswa -->
          <div v-if="chatStore.activeSession" class="px-4 py-3 bg-purple-50/60 dark:bg-slate-800/60 border-b border-purple-100 dark:border-slate-800 shrink-0 text-xs space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <i class="fa-solid fa-user-graduate text-purple-600"></i>
                {{ chatStore.activeSession.student_name }}
              </span>
              <span class="text-[11px] text-purple-700 dark:text-purple-300 font-semibold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80">
                {{ chatStore.activeSession.student_class || 'Siswa SMADA' }}
              </span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{{ activeStudentNotes.length }} Catatan Tersimpan</span>
              <button
                type="button"
                @click="navigateToFullStudentDossier"
                class="text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                title="Buka halaman dossier lengkap siswa ini"
              >
                <span>Halaman Dossier Penuh</span>
                <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              </button>
            </div>
          </div>

          <!-- 3. Form Input Mode (Jika sedang Tambah Catatan Baru) -->
          <div v-if="isAddingNoteInDrawer" class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span class="font-bold text-slate-800 dark:text-slate-200">Tambah Catatan Baru</span>
              <button
                type="button"
                @click="isAddingNoteInDrawer = false"
                class="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Kembali ke Daftar
              </button>
            </div>

            <!-- Kategori -->
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-[11px]">
                Kategori Asesmen:
              </label>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  v-for="cat in NOTE_CATEGORIES"
                  :key="cat.id"
                  type="button"
                  @click="drawerNoteForm.category = cat.id"
                  class="px-2 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 text-left transition-all cursor-pointer"
                  :class="drawerNoteForm.category === cat.id
                    ? 'border-purple-600 bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'"
                >
                  <i :class="cat.icon" class="text-[10px]"></i>
                  <span class="truncate">{{ cat.label }}</span>
                </button>
              </div>
            </div>

            <!-- Judul Ringkas -->
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1 text-[11px]">
                Judul Catatan:
              </label>
              <input
                v-model="drawerNoteForm.title"
                type="text"
                placeholder="Misal: Hasil Bimbingan Chat Topik Karir..."
                class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <!-- Isi Catatan -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                  Isi Asesmen &amp; Tindak Lanjut:
                </label>
                <button
                  type="button"
                  @click="insertDrawerAssessmentTemplate"
                  class="px-2 py-0.5 rounded text-[10px] font-semibold text-purple-700 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 cursor-pointer"
                >
                  + Format BK
                </button>
              </div>
              <textarea
                v-model="drawerNoteForm.content"
                rows="8"
                placeholder="Tuliskan dinamika kasus atau rencana tindak lanjut..."
                class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none leading-relaxed"
              ></textarea>
            </div>
          </div>

          <!-- 3. List Mode (Timeline Catatan Siswa) -->
          <div v-else class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
            <!-- Feedback Toast -->
            <div v-if="notesSaveFeedback" class="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 text-[11px] font-bold flex items-center gap-1.5 animate-fade-in">
              <i class="fa-solid fa-circle-check text-emerald-500"></i>
              <span>{{ notesSaveFeedback }}</span>
            </div>

            <!-- Tombol Tambah Catatan Baru -->
            <button
              type="button"
              @click="startAddNoteInDrawer"
              class="w-full py-2.5 px-3.5 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-800/80 bg-purple-50/60 hover:bg-purple-100/80 dark:bg-purple-950/30 dark:hover:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <i class="fa-solid fa-plus text-xs"></i>
              <span>Tambah Catatan untuk {{ chatStore.activeSession?.student_name }}</span>
            </button>

            <!-- State Kosong: Belum Ada Catatan -->
            <div
              v-if="activeStudentNotes.length === 0"
              class="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2 text-slate-400"
            >
              <i class="fa-solid fa-book-open text-2xl text-slate-300 dark:text-slate-600"></i>
              <p class="text-xs">Belum ada catatan di dossier siswa ini.</p>
            </div>

            <!-- Feed Timeline Catatan -->
            <div v-else class="space-y-3">
              <div
                v-for="note in activeStudentNotes"
                :key="note.id"
                class="p-3.5 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-2 text-xs"
              >
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0"
                    :class="NOTE_CATEGORIES.find(c => c.id === note.category)?.badge || 'bg-slate-100 text-slate-700 border-slate-200'"
                  >
                    {{ NOTE_CATEGORIES.find(c => c.id === note.category)?.label || note.category }}
                  </span>
                  <span class="text-[10px] text-slate-400 font-semibold">
                    {{ new Date(note.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                  </span>
                </div>
                <h5 class="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                  {{ note.title }}
                </h5>
                <p class="text-[11.5px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  {{ note.content }}
                </p>
                <div class="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
                  <i class="fa-solid fa-user-tie text-[9px] text-purple-600"></i>
                  <span>{{ note.counselor_name || 'Guru BK SMADA' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Footer Drawer -->
          <div class="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <template v-if="isAddingNoteInDrawer">
              <button
                type="button"
                @click="isAddingNoteInDrawer = false"
                class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                @click="handleSaveDrawerNote"
                :disabled="isSavingNotes"
                class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <i v-if="isSavingNotes" class="fa-solid fa-spinner fa-spin text-xs"></i>
                <i v-else class="fa-solid fa-floppy-disk text-xs"></i>
                <span>{{ isSavingNotes ? 'Menyimpan...' : 'Simpan Catatan' }}</span>
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                @click="navigateToFullStudentDossier"
                class="px-3.5 py-2 rounded-xl border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold text-xs hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer flex items-center gap-1.5"
              >
                <i class="fa-solid fa-folder-open text-xs"></i>
                <span>Buka Buku Catatan Lengkap</span>
              </button>
              <button
                type="button"
                @click="closeNotesDrawer"
                class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
            </template>
          </div>
        </aside>
      </div>
    </div>

  </div>
</template>
