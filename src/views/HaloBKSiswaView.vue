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
})

onUnmounted(() => {
  chatStore.cleanupRealtime()
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

// Buka Modal Tulis Baru
function handleOpenCompose() {
  composeError.value = ''
  isComposeModalOpen.value = true
}

// Validasi Form & Buka Konfirmasi Review
function handleProceedToReview() {
  composeError.value = ''
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
    <main class="flex-1 w-full max-w-7xl mx-auto p-0 lg:p-4 flex flex-col min-h-0">
      
      <!-- WRAPPER APLIKASI CHAT ALA SHOPEE (BORDERLESS DI MOBILE, KARTU ELEGAN DI DESKTOP) -->
      <div class="flex-1 bg-white dark:bg-slate-900 lg:rounded-3xl border-0 lg:border border-slate-200/80 dark:border-slate-800 lg:shadow-sm flex flex-col lg:grid lg:grid-cols-12 overflow-hidden min-h-0">
        
        <!-- ============================================================== -->
        <!-- PANEL KIRI: DAFTAR CHAT ALA SHOPEE INBOX                       -->
        <!-- Tampil di HP jika mobileView === 'list'                        -->
        <!-- ============================================================== -->
        <aside
          class="flex-1 lg:flex-initial lg:col-span-5 xl:col-span-4 border-r border-slate-200/80 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 h-full min-h-0"
          :class="mobileView === 'detail' ? 'hidden lg:flex' : 'flex'"
        >
          <!-- HEADER CHAT -->
          <div class="h-14 sm:h-16 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <h1 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <i class="fa-solid fa-comments text-[#0284C7]"></i>
              <span>Chat BK SMADA</span>
            </h1>
            <!-- Tombol Tulis Konsultasi Baru -->
            <button
              type="button"
              @click="handleOpenCompose"
              class="px-3.5 py-1.5 rounded-full bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <i class="fa-solid fa-plus text-[11px]"></i>
              <span>Konsultasi Baru</span>
            </button>
          </div>

          <!-- SEARCH BAR & FILTER STATUS -->
          <div class="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <div class="relative">
              <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-xs"></i>
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Cari guru atau topik konsultasi..."
                class="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
              />
            </div>

            <!-- Filter Status Chips Ringkas -->
            <div class="flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold mt-2 pb-0.5 no-scrollbar">
              <button
                type="button"
                @click="activeFilter = 'ALL'"
                class="px-2.5 py-1 rounded-full transition-colors whitespace-nowrap cursor-pointer"
                :class="activeFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'"
              >
                Semua
              </button>
              <button
                type="button"
                @click="activeFilter = 'menunggu'"
                class="px-2.5 py-1 rounded-full transition-colors whitespace-nowrap cursor-pointer"
                :class="activeFilter === 'menunggu'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-100 text-amber-700 dark:bg-slate-800 dark:text-amber-400'"
              >
                Menunggu
              </button>
              <button
                type="button"
                @click="activeFilter = 'ditindaklanjuti'"
                class="px-2.5 py-1 rounded-full transition-colors whitespace-nowrap cursor-pointer"
                :class="activeFilter === 'ditindaklanjuti'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-slate-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300'"
              >
                Diproses
              </button>
              <button
                type="button"
                @click="activeFilter = 'selesai'"
                class="px-2.5 py-1 rounded-full transition-colors whitespace-nowrap cursor-pointer"
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
              <p class="text-xs">Memuat pesan...</p>
            </div>

            <div
              v-else-if="filteredSessions.length === 0"
              class="p-8 text-center space-y-3"
            >
              <div class="w-12 h-12 rounded-full bg-sky-50 dark:bg-slate-800 text-[#0284C7] flex items-center justify-center mx-auto text-xl">
                <i class="fa-regular fa-comment-dots"></i>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
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
              class="w-full text-left px-3.5 py-3 transition-colors flex items-center gap-3 cursor-pointer group relative select-none"
              :class="[
                chatStore.activeSession?.id === s.id
                  ? 'bg-sky-50/70 dark:bg-slate-800'
                  : s.is_pinned_by_student
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              ]"
            >
              <!-- Avatar Bulat Bersih -->
              <div class="relative shrink-0">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#0284C7] to-sky-600 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                  <i class="fa-solid fa-user-tie"></i>
                </div>
                <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
              </div>

              <!-- Konten Chat Row: Title, Snippet, Waktu -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span v-if="s.is_pinned_by_student" class="text-amber-500 text-xs shrink-0" title="Disematkan">
                      <i class="fa-solid fa-thumbtack rotate-45"></i>
                    </span>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {{ s.counselor_name }}
                    </h3>
                  </div>
                  <span class="text-[11px] text-slate-400 shrink-0">
                    {{ formatListTime(s.last_message_at || s.created_at) }}
                  </span>
                </div>

                <p class="text-xs font-semibold text-[#0284C7] dark:text-sky-400 truncate mt-0.5">
                  {{ s.title }}
                </p>

                <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {{ s.last_message_preview || 'Klik untuk membuka chat...' }}
                </p>
              </div>

              <!-- Status Badge & Titik Tiga Desktop -->
              <div class="flex flex-col items-end gap-1.5 shrink-0">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                  :class="STATUS_CONFIG[s.status]?.badge"
                >
                  {{ STATUS_CONFIG[s.status]?.label }}
                </span>

                <!-- Tombol Titik Tiga (Desktop Hover) -->
                <button
                  type="button"
                  @click.stop="openSessionMenu(s)"
                  class="w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Opsi Percakapan (Sematkan / Hapus)"
                >
                  <i class="fa-solid fa-ellipsis-vertical text-xs"></i>
                </button>
              </div>
            </button>
          </div>
        </aside>

        <!-- ============================================================== -->
        <!-- PANEL KANAN: ROOM CHAT PERSIS SHOPEE (FULL DOCKED DI HP)       -->
        <!-- Tampil di HP sebagai fullscreen fixed inset-0                  -->
        <!-- ============================================================== -->
        <section
          class="flex-1 lg:col-span-7 xl:col-span-8 flex flex-col bg-[#F0F2F5] dark:bg-slate-950 h-full min-h-0"
          :class="mobileView === 'list' ? 'hidden lg:flex' : 'fixed inset-0 z-50 lg:static lg:z-auto flex'"
        >
          <!-- EMPTY STATE JIKA BELUM PILIH CHAT (DESKTOP) -->
          <div
            v-if="!chatStore.activeSession"
            class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white dark:bg-slate-900"
          >
            <div class="w-16 h-16 rounded-full bg-sky-50 dark:bg-slate-800 text-[#0284C7] dark:text-sky-400 flex items-center justify-center text-2xl shadow-xs">
              <i class="fa-solid fa-headset"></i>
            </div>
            <div class="space-y-1 max-w-sm">
              <h3 class="font-display font-bold text-base text-slate-800 dark:text-white">
                Pilih Percakapan
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Pilih salah satu obrolan untuk mulai berkomunikasi dengan Guru BK SMADA, atau buat konsultasi baru.
              </p>
            </div>
          </div>

          <!-- ROOM CHAT AKTIF (SHOPEE STYLE) -->
          <div v-else class="flex-1 flex flex-col h-full min-h-0">
            
            <!-- 1. TOP HEADER ROOM CHAT -->
            <div class="h-14 sm:h-16 px-3 sm:px-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 shadow-2xs">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <!-- Tombol Kembali Ala Shopee (Arrow) -->
                <button
                  type="button"
                  @click="mobileView = 'list'"
                  class="w-8 h-8 rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center lg:hidden shrink-0 cursor-pointer text-base"
                  title="Kembali ke Daftar"
                >
                  <i class="fa-solid fa-arrow-left"></i>
                </button>

                <!-- Avatar Guru -->
                <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0284C7] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                  <i class="fa-solid fa-user-tie"></i>
                </div>

                <!-- Info Guru & Status Online -->
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span v-if="chatStore.activeSession.is_pinned_by_student" class="text-amber-500 text-xs shrink-0" title="Disematkan">
                      <i class="fa-solid fa-thumbtack rotate-45"></i>
                    </span>
                    <h2 class="font-bold text-sm text-slate-900 dark:text-white truncate leading-tight">
                      {{ chatStore.activeSession.counselor_name }}
                    </h2>
                  </div>
                  <div class="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Guru Bimbingan Konseling</span>
                  </div>
                </div>
              </div>

              <!-- Header Action (Status Badge & Menu Titik Tiga) -->
              <div class="flex items-center gap-2 shrink-0">
                <span
                  class="px-2.5 py-1 rounded-full text-[10px] font-bold border"
                  :class="STATUS_CONFIG[chatStore.activeSession.status]?.badge"
                >
                  {{ STATUS_CONFIG[chatStore.activeSession.status]?.label }}
                </span>

                <!-- Tombol Menu Titik Tiga Header -->
                <button
                  type="button"
                  @click="openSessionMenu(chatStore.activeSession)"
                  class="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="Menu Opsi (Sematkan / Hapus)"
                >
                  <i class="fa-solid fa-ellipsis-vertical text-sm"></i>
                </button>
              </div>
            </div>

            <!-- 2. KARTU KONTEKS TOPIK PINNED DI ATAS -->
            <div class="px-3.5 py-2 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/70 dark:border-slate-800 shrink-0">
              <div class="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs max-w-4xl mx-auto">
                <div class="min-w-0 flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-[#0284C7] dark:bg-sky-950 dark:text-sky-300 shrink-0">
                    {{ chatStore.activeSession.category }}
                  </span>
                  <span class="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    Topik: {{ chatStore.activeSession.title }}
                  </span>
                </div>

                <span
                  v-if="chatStore.activeSession.needs_offline_followup"
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0 flex items-center gap-1 whitespace-nowrap"
                  title="Siswa meminta tatap muka di Ruang BK"
                >
                  <i class="fa-solid fa-school text-[9px]"></i>
                  <span>Ruang BK</span>
                </span>
              </div>
            </div>

            <!-- 3. AREA BUBBLE CHAT -->
            <div
              ref="chatScrollArea"
              class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-0"
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
                  class="max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl shadow-2xs leading-relaxed text-xs sm:text-sm whitespace-pre-wrap break-words relative"
                  :class="[
                    msg.is_deleted_for_everyone
                      ? 'bg-slate-100 text-slate-400 italic dark:bg-slate-800 dark:text-slate-500 rounded-lg border border-dashed border-slate-300 dark:border-slate-700'
                      : msg.sender_role === 'siswa'
                        ? 'bg-[#E0F2FE] text-slate-900 dark:bg-sky-900/80 dark:text-sky-50 rounded-tr-xs'
                        : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/60 dark:border-slate-700/60'
                  ]"
                >
                  <p>{{ msg.message }}</p>

                  <div class="flex items-center justify-between gap-3 text-[10px] mt-1 select-none">
                    <!-- Tombol Titik Tiga Pesan (Desktop Hover) -->
                    <button
                      v-if="!msg.is_deleted_for_everyone"
                      type="button"
                      @click="openMessageMenu(msg)"
                      class="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] cursor-pointer hover:underline text-slate-400 hover:text-slate-700"
                      title="Opsi Pesan"
                    >
                      <i class="fa-solid fa-ellipsis text-xs"></i>
                    </button>
                    <span v-else></span>

                    <div
                      class="flex items-center gap-1 font-medium ml-auto"
                      :class="msg.sender_role === 'siswa' ? 'text-sky-700 dark:text-sky-300' : 'text-slate-400'"
                    >
                      <span>{{ formatBubbleTime(msg.created_at) }}</span>
                      <i
                        v-if="msg.sender_role === 'siswa' && !msg.is_deleted_for_everyone"
                        class="fa-solid fa-check-double text-[9px]"
                        :class="msg.is_read ? 'text-[#0284C7]' : 'text-sky-500'"
                      ></i>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Banner jika Selesai atau Ditolak -->
              <div
                v-if="chatStore.activeSession.status === 'selesai' || chatStore.activeSession.status === 'ditolak'"
                class="p-3 rounded-2xl text-center text-xs space-y-1 mx-auto max-w-md border"
                :class="chatStore.activeSession.status === 'selesai'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'"
              >
                <p class="font-bold">
                  {{ chatStore.activeSession.status === 'selesai' ? 'Konsultasi Selesai' : 'Konsultasi Ditolak' }}
                </p>
                <p class="text-[11px] opacity-90 leading-relaxed">
                  {{ chatStore.activeSession.rejection_reason || (chatStore.activeSession.status === 'selesai' ? 'Sesi bimbingan konseling ini telah selesai. Terima kasih!' : 'Konsultasi ini belum dapat diproses oleh Guru BK.') }}
                </p>
              </div>
            </div>

            <!-- 4. BOTTOM INPUT BAR -->
            <div class="p-2 sm:p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
              <div
                v-if="chatStore.activeSession.status === 'selesai' || chatStore.activeSession.status === 'ditolak'"
                class="p-2.5 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full font-medium"
              >
                Percakapan telah ditutup.
              </div>

              <form
                v-else
                @submit.prevent="handleSendReply"
                class="flex items-center gap-2 max-w-4xl mx-auto"
              >
                <input
                  v-model="replyText"
                  type="text"
                  placeholder="Tulis pesan ke Guru BK..."
                  class="flex-1 bg-slate-100 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#0284C7] placeholder:text-slate-400 transition-all font-medium border border-transparent focus:bg-white dark:focus:bg-slate-900"
                />
                <button
                  type="submit"
                  :disabled="!replyText.trim() || chatStore.isSending"
                  class="w-10 h-10 rounded-full bg-[#0284C7] hover:bg-[#0369A1] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs cursor-pointer"
                  title="Kirim Pesan"
                >
                  <i v-if="chatStore.isSending" class="fa-solid fa-spinner fa-spin text-sm"></i>
                  <i v-else class="fa-solid fa-paper-plane text-xs"></i>
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
            <h3 class="font-display font-bold text-base leading-tight">
              Konsultasi Baru HaloBK
            </h3>
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
          <!-- Pilih Guru BK -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Pilih Guru BK:
            </label>
            <select
              v-model="formCounselor"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
            >
              <option v-for="c in COUNSELORS" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <!-- Kategori -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Kategori Konseling:
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                v-for="cat in CATEGORIES"
                :key="cat.id"
                type="button"
                @click="formCategory = cat.id"
                class="p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer"
                :class="formCategory === cat.id
                  ? 'border-[#0284C7] bg-sky-50 dark:bg-sky-950/60 ring-2 ring-sky-400/30 font-bold text-[#0284C7]'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'"
              >
                <i :class="[cat.icon, 'text-sm', formCategory === cat.id ? 'text-[#0284C7]' : 'text-slate-400']"></i>
                <span class="text-[11px]">{{ cat.name }}</span>
              </button>
            </div>
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

          <!-- Pesan Pertama -->
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Pesan Konsultasi:
            </label>
            <textarea
              v-model="formInitialMessage"
              rows="4"
              placeholder="Tuliskan kendala atau pertanyaanmu untuk Guru BK..."
              class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0284C7] resize-none"
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
