<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  useChatStore,
  COUNSELORS,
  CATEGORIES,
  STATUS_CONFIG,
  check15MinEligibility
} from '@/stores/chat'
import PublicNavbar from '@/components/PublicNavbar.vue'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

// State Navigasi & Filter Siswa
const activeFilter = ref('ALL') // 'ALL' | 'menunggu' | 'ditindaklanjuti' | 'selesai'
const searchQuery = ref('')
const mobileView = ref('list') // 'list' | 'detail'

// State Modal Tulis Konsultasi Baru
const isComposeModalOpen = ref(false)
const formCounselor = ref(COUNSELORS[0])
const formCategory = ref('pribadi')
const formTitle = ref('')
const formInitialMessage = ref('')
const formNeedsFollowup = ref(false)
const composeError = ref('')

// State Dropdown Kustom Pilih Guru BK
const isFormCounselorDropdownOpen = ref(false)
const formCounselorDropdownRef = ref(null)

function selectFormCounselor(counselor) {
  if (isCounselorLocked(counselor)) return
  formCounselor.value = counselor
  isFormCounselorDropdownOpen.value = false
}

function handleFormCounselorDropdownClickOutside(e) {
  if (formCounselorDropdownRef.value && !formCounselorDropdownRef.value.contains(e.target)) {
    isFormCounselorDropdownOpen.value = false
  }
}

// Validasi Anti-Spam & Pembatasan Sesi Aktif Siswa
const activeSessions = computed(() => {
  return (chatStore.sortedSessionsForStudent || []).filter(
    s => s.status === 'menunggu' || s.status === 'ditindaklanjuti'
  )
})
const activeSessionsCount = computed(() => activeSessions.value.length)
const isMaxActiveSessionsReached = computed(() => activeSessionsCount.value >= 2)

const activeCounselorNames = computed(() => {
  return activeSessions.value.map(s => s.counselor_name).filter(Boolean)
})

function isCounselorLocked(counselorName) {
  return activeCounselorNames.value.includes(counselorName)
}

const activeCategories = computed(() => {
  return activeSessions.value.map(s => s.category).filter(Boolean)
})

function isCategoryLocked(catId) {
  return activeCategories.value.includes(catId)
}

// Hitung pesan pembuka yang telah dikirim siswa saat status masih 'menunggu'
const studentOpeningMessagesCount = computed(() => {
  if (!chatStore.activeSession || chatStore.activeSession.status !== 'menunggu') return 0
  return chatStore.messages.filter(m => m.sender_role === 'siswa' && !m.is_deleted_for_everyone).length
})

// Kunci input jika status masih menunggu dan sudah mencapai batas 3 pesan pembuka
const isStudentInputWaitingLocked = computed(() => {
  return chatStore.activeSession?.status === 'menunggu' && studentOpeningMessagesCount.value >= 3
})

// State Modal Batalkan Pengajuan Konsultasi (Saat Status Masih Menunggu)
const isCancelModalOpen = ref(false)
const sessionToCancel = ref(null)
const isCancelling = ref(false)

// Placeholder Dinamis Kolom Pesan Mengikuti Kategori Konseling
const CATEGORY_MESSAGE_PLACEHOLDERS = {
  pribadi: 'Ceritakan hal yang sedang membebani pikiran atau perasaanmu akhir-akhir ini...',
  sosial: 'Ceritakan kendala yang kamu alami dalam pertemanan, kelas, atau lingkungan sekolah...',
  belajar: 'Ceritakan kesulitan belajar, manajemen waktu, atau kendala mata pelajaran yang kamu hadapi...',
  karir: 'Tuliskan rencana kuliah, pemilihan jurusan SNBP/SNBT, atau minat karirmu...'
}

const currentCategoryPlaceholder = computed(() => {
  return (
    CATEGORY_MESSAGE_PLACEHOLDERS[formCategory.value] ||
    'Tuliskan kendala atau pertanyaanmu untuk Guru BK...'
  )
})

// State Modal Notifikasi Cek Ulang Pesan
const isConfirmReviewModalOpen = ref(false)

// State Input Chat
const replyText = ref('')
const chatScrollArea = ref(null)

// State Action Sheet (Menu Titik Tiga Desktop & Tekan Tahan Mobile)
const actionMenuSession = ref(null)
const actionMenuMessage = ref(null)

// State Modal Hapus Sesi Siswa
const isDeleteModalOpen = ref(false)
const sessionToDelete = ref(null)
const selectedDeleteType = ref('for_me')
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
    if (chatScrollArea.value) {
      chatScrollArea.value.scrollTop = chatScrollArea.value.scrollHeight
    }
  })
}

watch(() => chatStore.messages.length, () => { scrollToBottom() })
watch(() => chatStore.activeSession?.id, () => { scrollToBottom() })

onMounted(async () => {
  if (!authStore.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: '/halobk' } })
    return
  }

  await chatStore.fetchMySessions()

  if (filteredSessions.value.length > 0 && window.innerWidth >= 1024 && !chatStore.activeSession) {
    await chatStore.selectSession(filteredSessions.value[0])
  }
  document.addEventListener('click', handleFormCounselorDropdownClickOutside)
})

onUnmounted(() => {
  chatStore.cleanupRealtime()
  document.removeEventListener('click', handleFormCounselorDropdownClickOutside)
})

// Filter Daftar Konsultasi Siswa (Pinned Siswa otomatis di atas)
const filteredSessions = computed(() => {
  let list = chatStore.sortedSessionsForStudent

  if (activeFilter.value !== 'ALL') {
    list = list.filter(s => s.status === activeFilter.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.counselor_name || '').toLowerCase().includes(q) ||
      (s.last_message_preview || '').toLowerCase().includes(q)
    )
  }

  return list
})

// Pilih Sesi Chat
async function handleSelectSession(session) {
  await chatStore.selectSession(session)
  mobileView.value = 'detail'
  scrollToBottom()
}

// Buka Modal Tulis Baru dengan Validasi Anti-Spam
function handleOpenCompose() {
  if (isMaxActiveSessionsReached.value) {
    alert('Anda sudah memiliki 2 sesi konsultasi aktif. Silakan selesaikan salah satu sesi terlebih dahulu sebelum memulai konsultasi baru.')
    return
  }
  composeError.value = ''

  // Otomatis pilih Guru BK pertama yang tidak memiliki sesi aktif
  const availableCounselor = COUNSELORS.find(c => !isCounselorLocked(c))
  if (availableCounselor) {
    formCounselor.value = availableCounselor
  }

  // Otomatis pilih Kategori pertama yang tidak memiliki sesi aktif
  const availableCategory = CATEGORIES.find(c => !isCategoryLocked(c.id))
  if (availableCategory) {
    formCategory.value = availableCategory.id
  }

  isComposeModalOpen.value = true
}

// Validasi Form & Buka Konfirmasi Review
function handleProceedToReview() {
  composeError.value = ''
  if (isMaxActiveSessionsReached.value) {
    composeError.value = 'Batas maksimal 2 sesi aktif tercapai. Harap tunggu salah satu sesi selesai terlebih dahulu.'
    return
  }
  if (isCounselorLocked(formCounselor.value)) {
    composeError.value = `Masih ada sesi aktif dengan ${formCounselor.value}. Silakan selesaikan sesi tersebut atau pilih Guru BK lainnya.`
    return
  }
  if (isCategoryLocked(formCategory.value)) {
    composeError.value = `Anda masih memiliki sesi aktif untuk kategori ${formCategory.value}. Pilih kategori lain.`
    return
  }
  if (!formTitle.value.trim()) {
    composeError.value = 'Subjek / Judul konsultasi wajib diisi.'
    return
  }
  if (!formInitialMessage.value.trim()) {
    composeError.value = 'Isi pesan konsultasi wajib dituliskan.'
    return
  }
  isConfirmReviewModalOpen.value = true
}

// Eksekusi Kirim Konsultasi
async function handleConfirmSend() {
  try {
    const session = await chatStore.createSession({
      counselor_name: formCounselor.value,
      category: formCategory.value,
      title: formTitle.value.trim(),
      initial_message: formInitialMessage.value.trim(),
      needs_offline_followup: formNeedsFollowup.value
    })

    isConfirmReviewModalOpen.value = false
    isComposeModalOpen.value = false
    formTitle.value = ''
    formInitialMessage.value = ''
    formNeedsFollowup.value = false

    mobileView.value = 'detail'
    await chatStore.selectSession(session)
    scrollToBottom()
  } catch (err) {
    alert(err.message || 'Gagal mengirim konsultasi.')
  }
}

// Kirim Balasan Chat Siswa
async function handleSendReply() {
  if (!replyText.value.trim() || !chatStore.activeSession) return
  if (isStudentInputWaitingLocked.value) {
    alert('Kamu sudah mengirim 3 pesan pembuka. Mohon tunggu balasan dari Bapak/Ibu Guru ya.')
    return
  }
  const text = replyText.value
  replyText.value = ''

  try {
    await chatStore.sendMessage(chatStore.activeSession.id, text)
    scrollToBottom()
  } catch (err) {
    console.error('Gagal mengirim pesan:', err)
  }
}

// Buka Menu Aksi Sesi Siswa
function openSessionMenu(session) {
  actionMenuSession.value = session
}

// Batalkan Pengajuan Konsultasi dari Menu (Khusus Saat Status Menunggu)
function handleCancelPendingFromMenu() {
  if (!actionMenuSession.value) return
  sessionToCancel.value = actionMenuSession.value
  actionMenuSession.value = null
  isCancelModalOpen.value = true
}

async function confirmCancelSession() {
  if (!sessionToCancel.value) return
  isCancelling.value = true
  try {
    await chatStore.deleteSession(sessionToCancel.value.id, 'for_everyone')
    isCancelModalOpen.value = false
    sessionToCancel.value = null
    if (mobileView.value === 'detail') {
      mobileView.value = 'list'
    }
  } catch (err) {
    alert(err.message || 'Gagal membatalkan pengajuan konsultasi.')
  } finally {
    isCancelling.value = false
  }
}

// Sematkan (Pin) Sesi oleh Siswa dari Menu
async function handlePinFromMenu() {
  if (!actionMenuSession.value) return
  const s = actionMenuSession.value
  actionMenuSession.value = null
  await chatStore.togglePinSession(s.id)
}

// Hapus Sesi dari Menu Aksi
function handleDeleteFromMenu() {
  if (!actionMenuSession.value) return
  const s = actionMenuSession.value
  actionMenuSession.value = null
  openDeleteModal(s)
}

// Modal Hapus Sesi Siswa
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
    if (mobileView.value === 'detail') {
      mobileView.value = 'list'
    }
  } catch (err) {
    alert(err.message || 'Gagal menghapus percakapan.')
  } finally {
    isDeleting.value = false
  }
}

// Aksi Pesan Bubble Siswa
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

function formatBubbleTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatListTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Kemarin'
  }
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function getCategoryData(catId) {
  return CATEGORIES.find(c => c.id === catId) || CATEGORIES[0]
}
</script>

<template>
  <div class="h-screen h-[100dvh] bg-[#F0F2F5] dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200 overflow-hidden">
    
    <!-- Navbar: Ditampilkan di desktop atau saat mobile sedang di list inbox -->
    <header :class="mobileView === 'detail' ? 'hidden lg:block' : 'block'" class="shrink-0 z-30">
      <PublicNavbar />
    </header>

    <!-- MAIN CONTAINER -->
    <main class="flex-1 w-full p-0 m-0 flex flex-col min-h-0 overflow-hidden">
      
      <!-- WRAPPER APLIKASI CHAT FULL SCREEN (BORDERLESS & ROUNDED-NONE UNTUK TAMPILAN MAKSIMAL) -->
      <div class="flex-1 w-full bg-white dark:bg-slate-900 border-0 rounded-none shadow-none flex flex-col lg:grid lg:grid-cols-12 overflow-hidden min-h-0">
        
        <!-- ============================================================== -->
        <!-- PANEL KIRI: DAFTAR CHAT ALA SHOPEE INBOX                       -->
        <!-- Tampil di HP jika mobileView === 'list'                        -->
        <!-- ============================================================== -->
        <aside
          class="flex-1 lg:flex-initial lg:col-span-4 xl:col-span-3 2xl:col-span-3 border-r border-slate-200/80 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 h-full min-h-0"
          :class="mobileView === 'detail' ? 'hidden lg:flex' : 'flex'"
        >
          <!-- HEADER CHAT -->
          <div class="h-16 px-4 sm:px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <h1 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2.5">
              <i class="fa-solid fa-comments text-[#0284C7] text-lg"></i>
              <span>Chat BK SMADA</span>
            </h1>
            <!-- Tombol Tulis Konsultasi Baru (Batas Maksimal 2 Sesi Aktif) -->
            <button
              type="button"
              @click="handleOpenCompose"
              :disabled="isMaxActiveSessionsReached"
              class="px-3.5 sm:px-4 py-2 rounded-full font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-all"
              :class="[
                isMaxActiveSessionsReached
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                  : 'bg-[#0284C7] hover:bg-[#0369A1] text-white cursor-pointer active:scale-95'
              ]"
              :title="isMaxActiveSessionsReached
                ? 'Batas maksimal 2 sesi aktif tercapai. Selesaikan salah satu sesi terlebih dahulu.'
                : 'Mulai Konsultasi Baru'"
            >
              <i class="fa-solid fa-plus text-xs"></i>
              <span>Konsultasi Baru</span>
              <span
                v-if="activeSessionsCount > 0"
                class="ml-0.5 text-xs px-2 py-0.5 rounded-full font-bold"
                :class="isMaxActiveSessionsReached
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-white/25 text-white'"
              >
                {{ activeSessionsCount }}/2
              </span>
            </button>
          </div>

          <!-- SEARCH BAR & FILTER STATUS -->
          <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <div class="relative">
              <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"></i>
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Cari guru atau topik konsultasi..."
                class="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
              />
            </div>

            <!-- Filter Status Chips Ringkas -->
            <div class="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold mt-2.5 pb-0.5 no-scrollbar">
              <button
                type="button"
                @click="activeFilter = 'ALL'"
                class="px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
                :class="activeFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'"
              >
                Semua
              </button>
              <button
                type="button"
                @click="activeFilter = 'menunggu'"
                class="px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
                :class="activeFilter === 'menunggu'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-100 text-amber-700 dark:bg-slate-800 dark:text-amber-400'"
              >
                Menunggu
              </button>
              <button
                type="button"
                @click="activeFilter = 'ditindaklanjuti'"
                class="px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
                :class="activeFilter === 'ditindaklanjuti'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-slate-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300'"
              >
                Diproses
              </button>
              <button
                type="button"
                @click="activeFilter = 'selesai'"
                class="px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
                :class="activeFilter === 'selesai'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-100 text-emerald-700 dark:bg-slate-800 dark:text-emerald-400'"
              >
                Selesai
              </button>
            </div>
          </div>

          <!-- DAFTAR CHAT ITEM (BERSIH: TITIK TIGA DESKTOP & LONG PRESS MOBILE) -->
          <div class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 min-h-0">
            <div v-if="chatStore.isLoadingSessions" class="p-8 text-center text-slate-400">
              <i class="fa-solid fa-spinner fa-spin text-xl text-[#0284C7] mb-2"></i>
              <p class="text-sm">Memuat pesan...</p>
            </div>

            <div
              v-else-if="filteredSessions.length === 0"
              class="p-8 text-center space-y-3"
            >
              <div class="w-14 h-14 rounded-full bg-sky-50 dark:bg-slate-800 text-[#0284C7] flex items-center justify-center mx-auto text-2xl">
                <i class="fa-regular fa-comment-dots"></i>
              </div>
              <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Belum ada percakapan dengan Guru BK.
              </p>
            </div>

            <!-- Chat Row Siswa -->
            <button
              v-for="s in filteredSessions"
              :key="s.id"
              type="button"
              @click="handleClickSession(s)"
              @touchstart="handleTouchStart(s, 'session')"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
              @contextmenu.prevent="openSessionMenu(s)"
              class="w-full text-left px-4 py-3.5 transition-colors flex items-center gap-3.5 cursor-pointer group relative select-none"
              :class="[
                chatStore.activeSession?.id === s.id
                  ? 'bg-sky-50/70 dark:bg-slate-800'
                  : s.is_pinned_by_student
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              ]"
            >
              <!-- Avatar Bulat Bersih -->
              <div class="relative shrink-0 mt-0.5">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#0284C7] to-sky-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  <i class="fa-solid fa-user-tie"></i>
                </div>
                <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
              </div>

              <!-- Konten Chat Row: Format 3 Baris Rapi (Pengirim -> Topik & Snippet -> Badges) -->
              <div class="flex-1 min-w-0">
                <!-- Baris 1: Nama Guru BK + Pin + Waktu + Titik Tiga -->
                <div class="flex items-center justify-between gap-1.5">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span v-if="s.is_pinned_by_student" class="text-amber-500 text-sm shrink-0" title="Disematkan">
                      <i class="fa-solid fa-thumbtack rotate-45"></i>
                    </span>
                    <h3 class="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">
                      {{ s.counselor_name }}
                    </h3>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <span class="text-xs text-slate-400 font-semibold tabular-nums">
                      {{ formatListTime(s.last_message_at || s.created_at) }}
                    </span>
                    <!-- Tombol Titik Tiga (Desktop Hover) -->
                    <button
                      type="button"
                      @click.stop="openSessionMenu(s)"
                      class="w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Opsi Percakapan (Sematkan / Hapus)"
                    >
                      <i class="fa-solid fa-ellipsis-vertical text-xs"></i>
                    </button>
                  </div>
                </div>

                <!-- Baris 2: Judul Topik (Bold) — Snippet Pesan Terakhir -->
                <div class="flex items-center gap-1.5 mt-1 min-w-0">
                  <p class="truncate text-xs sm:text-sm flex-1 min-w-0">
                    <span class="font-semibold text-slate-800 dark:text-slate-100">{{ s.title }}</span>
                    <span v-if="s.last_message_preview" class="text-slate-400 dark:text-slate-500 font-normal"> &mdash; {{ s.last_message_preview }}</span>
                  </p>
                </div>

                <!-- Baris 3: Badges Kategori + Status + Ruang BK -->
                <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span class="text-[11px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border" :class="getCategoryData(s.category)?.badge">
                    {{ s.category }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold border"
                    :class="STATUS_CONFIG[s.status]?.badge"
                  >
                    {{ STATUS_CONFIG[s.status]?.label }}
                  </span>
                  <span
                    v-if="s.needs_offline_followup"
                    class="text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1"
                  >
                    <i class="fa-solid fa-school text-[10px]"></i> Ruang BK
                  </span>
                </div>
              </div>
            </button>
          </div>
        </aside>

        <!-- ============================================================== -->
        <!-- PANEL KANAN: ROOM CHAT PERSIS SHOPEE (FULL DOCKED DI HP)       -->
        <!-- Tampil di HP sebagai fullscreen fixed inset-0                  -->
        <!-- ============================================================== -->
        <section
          class="flex-1 lg:col-span-8 xl:col-span-9 2xl:col-span-9 flex flex-col bg-[#F0F2F5] dark:bg-slate-950 h-full min-h-0"
          :class="mobileView === 'list' ? 'hidden lg:flex' : 'fixed inset-0 z-50 lg:static lg:z-auto flex'"
        >
          <!-- EMPTY STATE JIKA BELUM PILIH CHAT (DESKTOP) -->
          <div
            v-if="!chatStore.activeSession"
            class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white dark:bg-slate-900"
          >
            <div class="w-20 h-20 rounded-full bg-sky-50 dark:bg-slate-800 text-[#0284C7] dark:text-sky-400 flex items-center justify-center text-3xl shadow-xs">
              <i class="fa-solid fa-headset"></i>
            </div>
            <div class="space-y-1.5 max-w-sm">
              <h3 class="font-display font-bold text-lg text-slate-800 dark:text-white">
                Pilih Percakapan
              </h3>
              <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Pilih salah satu obrolan untuk mulai berkomunikasi dengan Guru BK SMADA, atau buat konsultasi baru.
              </p>
            </div>
          </div>

          <!-- ROOM CHAT AKTIF (SHOPEE STYLE) -->
          <div v-else class="flex-1 flex flex-col h-full min-h-0">
            
            <!-- 1. TOP HEADER ROOM CHAT -->
            <div class="h-14 sm:h-18 px-3 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0 shadow-2xs">
              <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <!-- Tombol Kembali Ala Shopee (Arrow) -->
                <button
                  type="button"
                  @click="mobileView = 'list'"
                  class="w-8 h-8 sm:w-9 sm:h-9 rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center lg:hidden shrink-0 cursor-pointer text-base"
                  title="Kembali ke Daftar"
                >
                  <i class="fa-solid fa-arrow-left"></i>
                </button>

                <!-- Avatar Guru -->
                <div class="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-[#0284C7] text-white flex items-center justify-center font-bold text-xs sm:text-base shrink-0 shadow-xs">
                  <i class="fa-solid fa-user-tie"></i>
                </div>

                <!-- Info Guru & Status Online -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span v-if="chatStore.activeSession.is_pinned_by_student" class="text-amber-500 text-xs sm:text-sm shrink-0" title="Disematkan">
                      <i class="fa-solid fa-thumbtack rotate-45"></i>
                    </span>
                    <h2 class="font-bold text-sm sm:text-lg lg:text-xl text-slate-900 dark:text-white truncate leading-tight">
                      {{ chatStore.activeSession.counselor_name }}
                    </h2>
                  </div>
                  <div class="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    <span
                      class="sm:hidden font-semibold flex items-center gap-1 shrink-0"
                      :class="chatStore.activeSession.status === 'selesai' ? 'text-emerald-600 dark:text-emerald-400' : chatStore.activeSession.status === 'ditindaklanjuti' ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'"
                    >
                      <i :class="STATUS_CONFIG[chatStore.activeSession.status]?.icon" class="text-[10px]"></i>
                      <span>{{ STATUS_CONFIG[chatStore.activeSession.status]?.label }}</span>
                    </span>
                    <span class="sm:hidden text-slate-300 dark:text-slate-600 shrink-0">•</span>
                    <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span class="truncate">Guru Bimbingan Konseling</span>
                  </div>
                </div>
              </div>

              <!-- Header Action (Status Badge & Menu Titik Tiga) -->
              <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <span
                  class="hidden sm:inline-flex px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold border"
                  :class="STATUS_CONFIG[chatStore.activeSession.status]?.badge"
                >
                  {{ STATUS_CONFIG[chatStore.activeSession.status]?.label }}
                </span>

                <!-- Tombol Menu Titik Tiga Header -->
                <button
                  type="button"
                  @click="openSessionMenu(chatStore.activeSession)"
                  class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="Menu Opsi (Sematkan / Hapus)"
                >
                  <i class="fa-solid fa-ellipsis-vertical text-sm sm:text-base"></i>
                </button>
              </div>
            </div>

            <!-- 2. KARTU KONTEKS TOPIK PINNED DI ATAS -->
            <div class="px-3 sm:px-6 py-2 sm:py-3 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/70 dark:border-slate-800 shrink-0">
              <div class="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-[11px] sm:text-sm">
                <div class="min-w-0 flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-sky-100 text-[#0284C7] dark:bg-sky-950 dark:text-sky-300 shrink-0">
                    {{ chatStore.activeSession.category }}
                  </span>
                  <span class="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    Topik: {{ chatStore.activeSession.title }}
                  </span>
                </div>

                <span
                  v-if="chatStore.activeSession.needs_offline_followup"
                  class="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0 flex items-center gap-1 whitespace-nowrap"
                  title="Siswa meminta tatap muka di Ruang BK"
                >
                  <i class="fa-solid fa-school text-[10px] sm:text-xs"></i>
                  <span>Ruang BK</span>
                </span>
              </div>
            </div>

            <!-- 3. AREA BUBBLE CHAT -->
            <div
              ref="chatScrollArea"
              class="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-3.5 sm:space-y-4 min-h-0"
            >
              <div
                v-for="msg in chatStore.messages"
                :key="msg.id"
                class="flex flex-col group select-none"
                :class="msg.sender_role === 'siswa' ? 'items-end' : 'items-start'"
                @touchstart="handleTouchStart(msg, 'message')"
                @touchend="handleTouchEnd"
                @touchmove="handleTouchMove"
                @contextmenu.prevent="openMessageMenu(msg)"
              >
                <!-- Bubble Chat Shopee -->
                <div
                  class="max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl leading-relaxed text-sm sm:text-[15px] lg:text-base whitespace-pre-wrap break-words relative shadow-2xs"
                  :class="[
                    msg.is_deleted_for_everyone
                      ? 'bg-slate-100 text-slate-400 italic dark:bg-slate-800 dark:text-slate-500 rounded-lg border border-dashed border-slate-300 dark:border-slate-700'
                      : msg.sender_role === 'siswa'
                        ? 'bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white rounded-tr-xs shadow-sm shadow-sky-200/50 dark:shadow-sky-950/60'
                        : 'bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-slate-700 shadow-2xs'
                  ]"
                >
                  <p>{{ msg.message }}</p>

                  <div class="flex items-center justify-between gap-3 text-xs mt-1.5 select-none">
                    <!-- Tombol Titik Tiga Pesan (Desktop Hover) -->
                    <button
                      v-if="!msg.is_deleted_for_everyone"
                      type="button"
                      @click="openMessageMenu(msg)"
                      class="opacity-0 group-hover:opacity-100 transition-opacity text-xs cursor-pointer"
                      :class="msg.sender_role === 'siswa' ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-slate-700'"
                      title="Opsi Pesan"
                    >
                      <i class="fa-solid fa-ellipsis text-xs"></i>
                    </button>
                    <span v-else></span>

                    <div
                      class="flex items-center gap-1.5 font-medium ml-auto"
                      :class="msg.sender_role === 'siswa' ? 'text-white/80' : 'text-slate-400'"
                    >
                      <span>{{ formatBubbleTime(msg.created_at) }}</span>
                      <i
                        v-if="msg.sender_role === 'siswa' && !msg.is_deleted_for_everyone"
                        class="fa-solid fa-check-double text-[10px] text-white/90"
                      ></i>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Banner jika Selesai -->
              <div
                v-if="chatStore.activeSession.status === 'selesai'"
                class="p-4 rounded-2xl text-center text-xs sm:text-sm space-y-1 mx-auto max-w-lg border bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-2xs"
              >
                <p class="font-bold text-sm sm:text-base">
                  Konsultasi Selesai
                </p>
                <p class="text-xs sm:text-sm opacity-90 leading-relaxed">
                  Sesi bimbingan konseling ini telah selesai. Terima kasih!
                </p>
              </div>

              <!-- Banner Penenang Otomatis (Saat Status Menunggu) -->
              <div
                v-if="chatStore.activeSession.status === 'menunggu'"
                class="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl bg-amber-50/95 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 max-w-lg mx-auto shadow-2xs space-y-1.5 sm:space-y-2.5 my-1 sm:my-2 select-none"
              >
                <div class="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                  <i class="fa-solid fa-clock-rotate-left text-amber-500 text-xs sm:text-base"></i>
                  <span>Dalam Antrean Bimbingan Konseling</span>
                </div>
                <p class="text-[11px] sm:text-sm leading-relaxed text-amber-800/90 dark:text-amber-200/90">
                  Pesanmu sudah diterima dan masuk ke daftar antrean <strong class="font-bold">{{ chatStore.activeSession.counselor_name }}</strong>. Bapak/Ibu Guru mungkin sedang mengajar di kelas dan akan membalas pada jam istirahat atau jam kerja.
                </p>
                <div class="flex items-center justify-between text-[11px] sm:text-xs text-amber-700 dark:text-amber-400 font-medium pt-1.5 border-t border-amber-200/60 dark:border-amber-800/60">
                  <span v-if="studentOpeningMessagesCount < 3" class="flex items-center gap-1.5">
                    <i class="fa-solid fa-circle-info text-[11px]"></i>
                    <span>Tersisa {{ 3 - studentOpeningMessagesCount }} pesan tambahan sebelum dibalas</span>
                  </span>
                  <span v-else class="text-amber-600 dark:text-amber-400 font-bold">
                    Batas 3 pesan pembuka telah terkirim
                  </span>
                  <span class="font-bold tabular-nums">{{ studentOpeningMessagesCount }}/3 Pesan</span>
                </div>
              </div>
            </div>

            <!-- 4. BOTTOM INPUT BAR -->
            <div class="p-2.5 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <!-- Kasus 1: Sesi telah selesai -->
              <div
                v-if="chatStore.activeSession.status === 'selesai'"
                class="p-2.5 sm:p-3 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full font-medium"
              >
                Percakapan telah ditutup.
              </div>

              <!-- Kasus 2: Menunggu balasan dan sudah mencapai batas 3 pesan pembuka -->
              <div
                v-else-if="isStudentInputWaitingLocked"
                class="p-2.5 sm:p-3.5 text-center text-xs sm:text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-xl sm:rounded-2xl font-medium border border-amber-200 dark:border-amber-800/80 flex items-center justify-center gap-2 max-w-4xl mx-auto shadow-2xs"
              >
                <i class="fa-solid fa-hourglass-half text-amber-500 animate-pulse text-sm sm:text-base"></i>
                <span>Kamu sudah mengirim 3 pesan pembuka. Mohon tunggu balasan dari Bapak/Ibu Guru ya.</span>
              </div>

              <!-- Kasus 3: Input aktif -->
              <form
                v-else
                @submit.prevent="handleSendReply"
                class="flex items-center gap-2 sm:gap-2.5 max-w-5xl mx-auto"
              >
                <input
                  v-model="replyText"
                  type="text"
                  :placeholder="chatStore.activeSession.status === 'menunggu'
                    ? `Tulis pesan tambahan... (${studentOpeningMessagesCount + 1}/3)`
                    : 'Tulis pesan ke Guru BK...'"
                  class="flex-1 bg-slate-100 dark:bg-slate-800 text-sm sm:text-base text-slate-800 dark:text-slate-100 rounded-full px-4 sm:px-5 py-2.5 sm:py-3 outline-none focus:ring-2 focus:ring-[#0284C7] placeholder:text-slate-400 transition-all font-medium border border-transparent focus:bg-white dark:focus:bg-slate-900"
                />
                <button
                  type="submit"
                  :disabled="!replyText.trim() || chatStore.isSending"
                  class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#0284C7] hover:bg-[#0369A1] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs cursor-pointer"
                  title="Kirim Pesan"
                >
                  <i v-if="chatStore.isSending" class="fa-solid fa-spinner fa-spin text-sm sm:text-base"></i>
                  <i v-else class="fa-solid fa-paper-plane text-xs sm:text-sm"></i>
                </button>
              </form>
            </div>

          </div>

        </section>

      </div>
    </main>

    <!-- ============================================================== -->
    <!-- ACTION SHEET: MENU OPSI SESI SISWA (DESKTOP & MOBILE BOTTOM)   -->
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
            {{ actionMenuSession.counselor_name }}
          </h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {{ actionMenuSession.title }}
          </p>
        </div>

        <div class="space-y-1">
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
                {{ actionMenuSession.is_pinned_by_student ? 'Lepas Sematan' : 'Sematkan Percakapan' }}
              </span>
              <span class="block text-[10px] text-slate-400 font-normal">
                {{ actionMenuSession.is_pinned_by_student ? 'Kembalikan ke urutan waktu normal' : 'Posisikan selalu di urutan paling atas' }}
              </span>
            </div>
          </button>

          <!-- Tombol Batalkan Pengajuan (Hanya tampil saat status masih 'menunggu' sebelum guru membalas) -->
          <button
            v-if="actionMenuSession.status === 'menunggu'"
            type="button"
            @click="handleCancelPendingFromMenu"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
          >
            <div class="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center text-sm shrink-0">
              <i class="fa-solid fa-ban"></i>
            </div>
            <div class="text-left flex-1">
              <span class="block">Batalkan Pengajuan</span>
              <span class="block text-[10px] text-slate-400 font-normal">
                Batalkan dan tarik dari antrean guru sebelum dibalas
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
    <!-- ACTION SHEET: MENU OPSI PESAN BUBBLE SISWA                     -->
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
    <!-- MODAL: FORM TULIS KONSULTASI BARU                              -->
    <!-- ============================================================== -->
    <div
      v-if="isComposeModalOpen && !isConfirmReviewModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
      @click.self="isComposeModalOpen = false"
    >
      <div class="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        
        <header class="bg-gradient-to-r from-[#0369A1] to-sky-600 text-white p-4 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2.5">
            <i class="fa-solid fa-pen-nib text-sm"></i>
            <div>
              <h3 class="font-display font-bold text-base leading-tight">
                Konsultasi Baru HaloBK
              </h3>
              <p class="text-[11px] text-sky-100 font-normal">
                Sesi aktif saat ini: <span class="font-bold text-white">{{ activeSessionsCount }} / 2</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            @click="isComposeModalOpen = false"
            class="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
          <!-- Pilih Guru BK (Anti-Spam: Kunci Guru dengan Sesi Aktif) -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block font-bold text-slate-700 dark:text-slate-300">
                Pilih Guru BK:
              </label>
              <span v-if="activeCounselorNames.length > 0" class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                {{ activeCounselorNames.length }} guru sedang aktif
              </span>
            </div>

            <!-- Custom Dropdown Guru BK -->
            <div class="relative" ref="formCounselorDropdownRef">
              <button
                type="button"
                @click="isFormCounselorDropdownOpen = !isFormCounselorDropdownOpen"
                class="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between transition-all shadow-2xs cursor-pointer group"
                title="Pilih Guru BK"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0284C7] to-sky-600 text-white flex items-center justify-center text-xs shrink-0 font-bold shadow-2xs">
                    <i class="fa-solid fa-user-tie"></i>
                  </div>
                  <div class="text-left min-w-0">
                    <span class="block truncate font-bold text-slate-800 dark:text-slate-100">
                      {{ formCounselor }}
                    </span>
                    <span class="block text-[10px] text-slate-400 font-normal">
                      Guru Bimbingan Konseling
                    </span>
                  </div>
                </div>
                <i
                  class="fa-solid fa-chevron-down text-xs text-slate-400 group-hover:text-[#0284C7] transition-transform duration-200 shrink-0 ml-2"
                  :class="{ 'rotate-180 text-[#0284C7]': isFormCounselorDropdownOpen }"
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
                  v-if="isFormCounselorDropdownOpen"
                  class="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-300/50 dark:shadow-slate-950/80 border border-slate-200/90 dark:border-slate-800 overflow-hidden py-1.5 max-h-60 overflow-y-auto backdrop-blur-md"
                >
                  <button
                    v-for="c in COUNSELORS"
                    :key="c"
                    type="button"
                    :disabled="isCounselorLocked(c)"
                    @click="selectFormCounselor(c)"
                    class="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors"
                    :class="[
                      isCounselorLocked(c)
                        ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500'
                        : formCounselor === c
                          ? 'bg-sky-50 dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-300 font-bold cursor-pointer'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer'
                    ]"
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div
                        class="w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold shadow-2xs"
                        :class="isCounselorLocked(c)
                          ? 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                          : 'bg-gradient-to-br from-[#0284C7] to-sky-600 text-white'"
                      >
                        {{ c.split(' ')[0].slice(0, 2).toUpperCase() }}
                      </div>
                      <div class="min-w-0">
                        <span class="block truncate" :class="{ 'line-through': isCounselorLocked(c) }">{{ c }}</span>
                        <span v-if="isCounselorLocked(c)" class="block text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          <i class="fa-solid fa-lock text-[9px]"></i> Masih ada sesi aktif
                        </span>
                        <span v-else class="block text-[10px] text-slate-400 font-normal">
                          Siap melayani bimbingan
                        </span>
                      </div>
                    </div>
                    <div class="shrink-0 ml-2">
                      <span v-if="isCounselorLocked(c)" class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                        Terkunci
                      </span>
                      <i v-else-if="formCounselor === c" class="fa-solid fa-check text-xs text-[#0284C7]"></i>
                    </div>
                  </button>
                </div>
              </Transition>
            </div>

            <p v-if="isCounselorLocked(formCounselor)" class="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1 font-medium">
              <i class="fa-solid fa-triangle-exclamation text-[10px]"></i>
              <span>Masih ada sesi aktif dengan guru ini. Harap pilih Guru BK lainnya.</span>
            </p>
          </div>

          <!-- Kategori (Kategori Berbeda untuk Sesi Aktif) -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Kategori Konseling:
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                v-for="cat in CATEGORIES"
                :key="cat.id"
                type="button"
                :disabled="isCategoryLocked(cat.id)"
                @click="formCategory = cat.id"
                class="p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5"
                :class="[
                  isCategoryLocked(cat.id)
                    ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500'
                    : formCategory === cat.id
                      ? 'border-[#0284C7] bg-sky-50 dark:bg-sky-950/60 ring-2 ring-sky-400/30 font-bold text-[#0284C7] cursor-pointer'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-300 cursor-pointer'
                ]"
                :title="isCategoryLocked(cat.id) ? `Kategori ${cat.name} sedang aktif di sesi lain.` : cat.desc"
              >
                <i :class="[cat.icon, 'text-sm', formCategory === cat.id ? 'text-[#0284C7]' : 'text-slate-400']"></i>
                <span class="text-[11px] leading-tight">{{ cat.name }}</span>
                <span v-if="isCategoryLocked(cat.id)" class="text-[9px] text-amber-600 dark:text-amber-400 font-bold scale-90">
                  (Aktif)
                </span>
              </button>
            </div>
            <p v-if="activeCategories.length > 0" class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              * Kategori yang sedang berjalan di sesi aktif lain tidak dapat dipilih bersamaan.
            </p>
          </div>

          <!-- Judul Topik -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Judul Masalah / Topik:
            </label>
            <input
              v-model="formTitle"
              type="text"
              placeholder="Contoh: Bingung memilih jurusan kuliah, kendala belajar..."
              class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            />
          </div>

          <!-- Pesan Pertama (Placeholder Dinamis Mengikuti Kategori) -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Pesan Konsultasi:
            </label>
            <textarea
              v-model="formInitialMessage"
              rows="4"
              :placeholder="currentCategoryPlaceholder"
              class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0284C7] resize-none transition-all placeholder:text-slate-400"
            ></textarea>
          </div>

          <!-- Checkbox Tatap Muka -->
          <label class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              v-model="formNeedsFollowup"
              type="checkbox"
              class="w-4 h-4 rounded text-[#0284C7] focus:ring-sky-500 border-slate-300 mt-0.5"
            />
            <div>
              <span class="font-bold text-slate-800 dark:text-slate-200 block">
                Minta Konseling Tatap Muka di Ruang BK
              </span>
              <span class="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                Centang jika ingin dijadwalkan tatap muka di sekolah saat jam istirahat.
              </span>
            </div>
          </label>

          <p v-if="composeError" class="text-xs text-rose-600 font-bold">
            {{ composeError }}
          </p>
        </div>

        <footer class="p-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            @click="isComposeModalOpen = false"
            class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            @click="handleProceedToReview"
            class="px-5 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm shadow-xs cursor-pointer"
          >
            Lanjut Periksa Pesan &rarr;
          </button>
        </footer>

      </div>
    </div>

    <!-- ============================================================== -->
    <!-- MODAL: NOTIFIKASI CEK KEMBALI PESAN SEBELUM KIRIM              -->
    <!-- ============================================================== -->
    <div
      v-if="isConfirmReviewModalOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs"
    >
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3.5 my-auto">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center text-lg shrink-0">
            <i class="fa-solid fa-clipboard-check"></i>
          </div>
          <div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white leading-tight">
              Cek Kembali Pesan Anda
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Pastikan maksud pesan sudah sopan dan jelas.
            </p>
          </div>
        </div>

        <div class="bg-slate-50 dark:bg-slate-800/70 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700 text-xs space-y-2">
          <div class="flex justify-between">
            <span class="text-slate-400">Guru Tujuan:</span>
            <strong class="text-slate-800 dark:text-slate-100">{{ formCounselor }}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Kategori:</span>
            <span class="font-bold text-[#0284C7] capitalize">{{ formCategory }}</span>
          </div>
          <div>
            <span class="text-slate-400 block mb-0.5">Topik:</span>
            <strong class="text-slate-800 dark:text-slate-100 block">{{ formTitle }}</strong>
          </div>
          <div>
            <span class="text-slate-400 block mb-0.5">Pesan:</span>
            <p class="text-slate-700 dark:text-slate-300 italic line-clamp-3 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              &ldquo;{{ formInitialMessage }}&rdquo;
            </p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            @click="isConfirmReviewModalOpen = false"
            class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            &larr; Edit Lagi
          </button>
          <button
            type="button"
            @click="handleConfirmSend"
            :disabled="chatStore.isSending"
            class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs cursor-pointer disabled:opacity-50"
          >
            <i v-if="chatStore.isSending" class="fa-solid fa-spinner fa-spin mr-1"></i>
            <span>{{ chatStore.isSending ? 'Mengirim...' : 'Ya, Kirim Sekarang' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- MODAL: KONFIRMASI BATALKAN PENGAJUAN KONSULTASI                -->
    <!-- ============================================================== -->
    <div
      v-if="isCancelModalOpen && sessionToCancel"
      class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      @click.self="isCancelModalOpen = false"
    >
      <div class="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5 my-auto">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center text-lg shrink-0">
            <i class="fa-solid fa-ban"></i>
          </div>
          <div>
            <h3 class="font-bold text-base text-slate-900 dark:text-white leading-tight">Batalkan Pengajuan?</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Tarik percakapan dari antrean Guru BK.</p>
          </div>
        </div>

        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700">
          Apakah kamu yakin ingin membatalkan pengajuan konsultasi topik <strong>&ldquo;{{ sessionToCancel.title }}&rdquo;</strong> dengan <strong>{{ sessionToCancel.counselor_name }}</strong>?
        </p>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            @click="isCancelModalOpen = false"
            class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Kembali
          </button>
          <button
            type="button"
            @click="confirmCancelSession"
            :disabled="isCancelling"
            class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
          >
            {{ isCancelling ? 'Membatalkan...' : 'Ya, Batalkan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- MODAL: HAPUS RIWAYAT KONSULTASI SISWA                          -->
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
                name="deleteTypeStudent"
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
                  Hanya menghapus riwayat konsultasi dari akun Anda. Guru BK tetap memiliki dan dapat membaca riwayat konsultasi ini.
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
                name="deleteTypeStudent"
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
                    Menghapus riwayat konsultasi ini secara permanen untuk Anda dan Guru BK.
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
    <!-- MODAL: HAPUS PESAN BUBBLE SISWA                                -->
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

  </div>
</template>
