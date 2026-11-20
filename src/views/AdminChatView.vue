<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  useChatStore,
  COUNSELORS,
  CATEGORIES,
  STATUS_CONFIG,
  check15MinEligibility,
  isSessionPinnedForCounselor
} from '@/stores/chat'
import PublicNavbar from '@/components/PublicNavbar.vue'

const authStore = useAuthStore()
const chatStore = useChatStore()

// State Filter & Pencarian
const selectedCounselorFilter = ref('ALL')
const selectedStatusFilter = ref('ALL')
const searchQuery = ref('')
const mobileView = ref('list')

// State Balasan Guru
const replyText = ref('')
const chatMessagesContainer = ref(null)

// State Modal Tolak Sesi
const isRejectModalOpen = ref(false)
const rejectionReasonInput = ref('')
const isSubmittingReject = ref(false)

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
  await chatStore.fetchAllSessionsAdmin()
  if (filteredSessions.value.length > 0 && window.innerWidth >= 1024 && !chatStore.activeSession) {
    await chatStore.selectSession(filteredSessions.value[0])
  }
})

onUnmounted(() => { chatStore.cleanupRealtime() })

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

async function handleStatusChange(newStatus) {
  if (!chatStore.activeSession) return
  if (newStatus === 'ditolak') {
    rejectionReasonInput.value = ''
    isRejectModalOpen.value = true
    return
  }
  try {
    await chatStore.updateSessionStatus(chatStore.activeSession.id, newStatus)
  } catch (err) {
    alert('Gagal memperbarui status: ' + (err.message || 'Error'))
  }
}

async function confirmRejectSession() {
  if (!chatStore.activeSession) return
  isSubmittingReject.value = true
  try {
    await chatStore.updateSessionStatus(chatStore.activeSession.id, 'ditolak',
      rejectionReasonInput.value.trim() || 'Topik atau pesan belum memenuhi kriteria layanan bimbingan konseling.')
    isRejectModalOpen.value = false
  } catch (err) {
    alert('Gagal menolak sesi: ' + (err.message || 'Error'))
  } finally {
    isSubmittingReject.value = false
  }
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

    <main class="flex-1 w-full max-w-[1440px] mx-auto p-0 lg:px-5 lg:py-4 flex flex-col min-h-0">
      <div class="flex-1 bg-white dark:bg-slate-900 lg:rounded-2xl border-0 lg:border border-slate-200 dark:border-slate-800 lg:shadow-lg lg:shadow-slate-200/50 dark:lg:shadow-slate-950/50 flex flex-col lg:grid lg:grid-cols-12 overflow-hidden min-h-0">
        
        <!-- ============================================================ -->
        <!-- PANEL KIRI: INBOX (5 col / 4 col xl)                        -->
        <!-- ============================================================ -->
        <aside
          class="flex-1 lg:flex-initial lg:col-span-5 xl:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 h-full min-h-0"
          :class="mobileView === 'detail' ? 'hidden lg:flex' : 'flex'"
        >
          <!-- HEADER BRANDED -->
          <div class="bg-gradient-to-r from-[#0369A1] to-[#0284C7] px-4 py-3 shrink-0">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <i class="fa-solid fa-inbox text-white text-sm"></i>
                </div>
                <div>
                  <h1 class="font-display font-bold text-sm text-white leading-tight">Kotak Masuk Konseling</h1>
                  <p class="text-[10px] text-sky-200/80">{{ filteredSessions.length }} pesan ditampilkan</p>
                </div>
              </div>
              <span class="text-[9px] font-bold px-2 py-1 rounded-lg bg-white/20 text-white/90 backdrop-blur-sm uppercase tracking-wider">
                Guru BK
              </span>
            </div>
          </div>

          <!-- TOOLBAR: Filter + Search -->
          <div class="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-2 shrink-0">
            <div class="flex items-center gap-1.5">
              <select
                v-model="selectedCounselorFilter"
                class="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0284C7] cursor-pointer"
              >
                <option value="ALL">&bull; Semua Guru BK &bull;</option>
                <option v-for="c in COUNSELORS" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <div class="relative">
              <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-[11px]"></i>
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Cari nama, kelas, topik..."
                class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
              />
            </div>

            <!-- Status Chips dengan counter -->
            <div class="flex items-center gap-1 overflow-x-auto text-[11px] font-semibold no-scrollbar">
              <button
                type="button" @click="selectedStatusFilter = 'ALL'"
                class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer"
                :class="selectedStatusFilter === 'ALL'
                  ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'"
              >Semua</button>
              <button
                type="button" @click="selectedStatusFilter = 'menunggu'"
                class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
                :class="selectedStatusFilter === 'menunggu'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                  : 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40'"
              >
                🕐 Menunggu
                <span v-if="statusCounts.menunggu" class="text-[9px] px-1 py-0 rounded-full" :class="selectedStatusFilter === 'menunggu' ? 'bg-white/30' : 'bg-amber-100 dark:bg-amber-900/60'">{{ statusCounts.menunggu }}</span>
              </button>
              <button
                type="button" @click="selectedStatusFilter = 'ditindaklanjuti'"
                class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
                :class="selectedStatusFilter === 'ditindaklanjuti'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'"
              >
                💬 Diproses
                <span v-if="statusCounts.ditindaklanjuti" class="text-[9px] px-1 py-0 rounded-full" :class="selectedStatusFilter === 'ditindaklanjuti' ? 'bg-white/30' : 'bg-blue-100 dark:bg-blue-900/60'">{{ statusCounts.ditindaklanjuti }}</span>
              </button>
              <button
                type="button" @click="selectedStatusFilter = 'selesai'"
                class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
                :class="selectedStatusFilter === 'selesai'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                  : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'"
              >
                ✅ Selesai
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

              <div class="flex items-start gap-3 px-3.5 sm:px-4 py-3">
                <!-- Avatar Siswa -->
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 shadow-sm mt-0.5"
                  :class="s.status === 'menunggu'
                    ? 'bg-gradient-to-br from-[#0369A1] to-[#0284C7] text-white'
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
                        class="text-amber-500 text-xs shrink-0"
                        title="Percakapan Disematkan"
                      >
                        <i class="fa-solid fa-thumbtack rotate-45"></i>
                      </span>

                      <span
                        class="text-[13px] truncate"
                        :class="s.status === 'menunggu' ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'"
                      >{{ s.student_name }}</span>
                      <span v-if="s.student_class" class="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{{ s.student_class }}</span>
                    </div>

                    <!-- Waktu & Tombol Titik Tiga (Desktop Hover) -->
                    <div class="flex items-center gap-1 shrink-0">
                      <span class="text-[11px] tabular-nums" :class="s.status === 'menunggu' ? 'text-[#0284C7] font-semibold' : 'text-slate-400'">
                        {{ formatListTime(s.last_message_at || s.created_at) }}
                      </span>

                      <!-- Tombol Titik Tiga (Muncul di Desktop saat hover/focus) -->
                      <button
                        type="button"
                        @click.stop="openSessionMenu(s)"
                        class="w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Opsi Percakapan (Sematkan / Hapus)"
                      >
                        <i class="fa-solid fa-ellipsis-vertical text-xs"></i>
                      </button>
                    </div>
                  </div>

                  <!-- Baris 2: Judul Topik (Bold) — Preview Isi Pesan -->
                  <div class="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <p class="truncate text-[12.5px] flex-1 min-w-0">
                      <span :class="s.status === 'menunggu' ? 'font-semibold text-slate-800 dark:text-slate-100' : 'font-normal text-slate-600 dark:text-slate-400'">{{ s.title }}</span>
                      <span v-if="s.last_message_preview" class="text-slate-400 dark:text-slate-500"> &mdash; {{ s.last_message_preview }}</span>
                    </p>
                  </div>

                  <!-- Baris 3: Badges Kategori + Status + Guru Tujuan -->
                  <div class="flex items-center gap-1.5 mt-1.5">
                    <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border" :class="getCategoryData(s.category)?.badge">
                      {{ s.category }}
                    </span>
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-md border" :class="STATUS_CONFIG[s.status]?.badge">
                      {{ STATUS_CONFIG[s.status]?.label }}
                    </span>
                    <span
                      v-if="s.needs_offline_followup"
                      class="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 flex items-center gap-0.5"
                    >
                      <i class="fa-solid fa-school text-[8px]"></i> Ruang BK
                    </span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 truncate ml-auto">
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
          class="flex-1 lg:col-span-7 xl:col-span-8 flex flex-col h-full min-h-0"
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
            <div class="px-4 sm:px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <!-- Row 1: Back + Subject + Actions (Status & Menu Titik Tiga) -->
              <div class="flex items-center gap-2 min-w-0">
                <button
                  type="button" @click="handleBackToListMobile"
                  class="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 flex items-center justify-center lg:hidden shrink-0 cursor-pointer transition-colors"
                >
                  <i class="fa-solid fa-arrow-left text-sm"></i>
                </button>

                <div class="flex-1 min-w-0 flex items-center gap-2">
                  <span
                    v-if="isSessionPinnedForCounselor(chatStore.activeSession, selectedCounselorFilter)"
                    class="text-amber-500 text-xs shrink-0"
                    title="Disematkan"
                  >
                    <i class="fa-solid fa-thumbtack rotate-45"></i>
                  </span>
                  <h2 class="font-bold text-base text-slate-900 dark:text-white truncate leading-tight">
                    {{ chatStore.activeSession.title }}
                  </h2>
                </div>

                <!-- Status Selector (Styled) -->
                <div class="shrink-0">
                  <select
                    :value="chatStore.activeSession.status"
                    @change="handleStatusChange($event.target.value)"
                    class="pl-2.5 pr-7 py-1.5 rounded-lg border text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-[#0284C7] cursor-pointer appearance-auto"
                    :class="[
                      chatStore.activeSession.status === 'menunggu' ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300' : '',
                      chatStore.activeSession.status === 'ditindaklanjuti' ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300' : '',
                      chatStore.activeSession.status === 'selesai' ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300' : '',
                      chatStore.activeSession.status === 'ditolak' ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300' : '',
                    ]"
                  >
                    <option value="menunggu">⏳ Menunggu</option>
                    <option value="ditindaklanjuti">💬 Diproses</option>
                    <option value="selesai">✅ Selesai</option>
                    <option value="ditolak">❌ Tolak</option>
                  </select>
                </div>

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

              <!-- Row 2: Metadata (Dari · Ke · Kategori · RuangBK) -->
              <div class="flex items-center gap-x-2.5 gap-y-1 flex-wrap mt-2 text-[11px]">
                <div class="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <i class="fa-solid fa-user text-[9px] text-slate-400"></i>
                  <strong class="text-slate-700 dark:text-slate-200">{{ chatStore.activeSession.student_name }}</strong>
                  <span v-if="chatStore.activeSession.student_class" class="text-slate-400">({{ chatStore.activeSession.student_class }})</span>
                </div>
                <i class="fa-solid fa-arrow-right text-[8px] text-slate-300 dark:text-slate-600"></i>
                <div class="flex items-center gap-1">
                  <i class="fa-solid fa-user-tie text-[9px] text-[#0284C7]"></i>
                  <strong class="text-[#0284C7] dark:text-sky-400">{{ chatStore.activeSession.counselor_name }}</strong>
                </div>
                <span class="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border" :class="getCategoryData(chatStore.activeSession.category)?.badge">
                  {{ chatStore.activeSession.category }}
                </span>
                <span
                  v-if="chatStore.activeSession.needs_offline_followup"
                  class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                >
                  <i class="fa-solid fa-school text-[8px]"></i> Tatap Muka
                </span>
              </div>
            </div>

            <!-- AREA BUBBLE CHAT -->
            <div
              ref="chatMessagesContainer"
              class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 min-h-0 bg-[#F8F9FB] dark:bg-slate-950/50"
            >
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
                  class="max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 rounded-2xl leading-relaxed text-[13px] whitespace-pre-wrap break-words relative"
                  :class="[
                    msg.is_deleted_for_everyone
                      ? 'bg-slate-100 text-slate-400 italic dark:bg-slate-800 dark:text-slate-500 rounded-lg border border-dashed border-slate-300 dark:border-slate-700'
                      : msg.sender_role === 'guru'
                        ? 'bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white rounded-tr-sm shadow-sm shadow-sky-200/50 dark:shadow-sky-900/50'
                        : 'bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-tl-sm border border-slate-200 dark:border-slate-700 shadow-sm'
                  ]"
                >
                  <p>{{ msg.message }}</p>
                  
                  <div class="flex items-center justify-between gap-3 text-[10px] mt-1 select-none">
                    <!-- Tombol Titik Tiga Pesan (Desktop Hover) -->
                    <button
                      v-if="!msg.is_deleted_for_everyone"
                      type="button"
                      @click="openMessageMenu(msg)"
                      class="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] cursor-pointer hover:underline"
                      :class="msg.sender_role === 'guru' ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-slate-700'"
                      title="Opsi Pesan"
                    >
                      <i class="fa-solid fa-ellipsis text-xs"></i>
                    </button>
                    <span v-else></span>

                    <div
                      class="flex items-center gap-1 font-medium ml-auto"
                      :class="msg.sender_role === 'guru' ? 'text-white/60' : 'text-slate-400'"
                    >
                      <span>{{ formatBubbleTime(msg.created_at) }}</span>
                      <i v-if="msg.sender_role === 'guru' && !msg.is_deleted_for_everyone" class="fa-solid fa-check-double text-[9px] text-white/70"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- BOTTOM INPUT BAR -->
            <div class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <!-- Quick Replies -->
              <div class="flex items-center gap-1.5 overflow-x-auto px-4 pt-2 pb-1 text-[11px] no-scrollbar">
                <span class="text-slate-400 shrink-0 text-[10px] font-medium">Cepat:</span>
                <button
                  type="button"
                  @click="applyQuickTemplate('Halo ananda, terima kasih sudah berkonsultasi. Kapan ada waktu luang untuk kita bahas bersama?')"
                  class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 whitespace-nowrap transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                >&ldquo;Tanya waktu luang&rdquo;</button>
                <button
                  type="button"
                  @click="applyQuickTemplate('Silakan ananda datang ke Ruang BK pada saat jam istirahat untuk kita diskusikan langsung ya.')"
                  class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 whitespace-nowrap transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                >&ldquo;Ajak ke Ruang BK&rdquo;</button>
                <button
                  type="button"
                  @click="applyQuickTemplate('Alhamdulillah, senang mendengar perkembangan baik ananda. Sesi bimbingan ini kita tandai selesai ya.')"
                  class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 whitespace-nowrap transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                >&ldquo;Tandai selesai&rdquo;</button>
              </div>

              <!-- Input -->
              <form @submit.prevent="handleSendReply" class="flex items-center gap-2 px-4 pb-2.5">
                <input
                  v-model="replyText"
                  type="text"
                  placeholder="Ketik balasan bimbingan..."
                  class="flex-1 bg-slate-100 dark:bg-slate-800 text-[13px] text-slate-800 dark:text-slate-100 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#0284C7] placeholder:text-slate-400 transition-all border border-slate-200 dark:border-slate-700 focus:bg-white focus:border-[#0284C7] dark:focus:bg-slate-900"
                />
                <button
                  type="submit"
                  :disabled="!replyText.trim() || chatStore.isSending"
                  class="w-10 h-10 rounded-full bg-gradient-to-br from-[#0284C7] to-[#0369A1] hover:from-[#0369A1] hover:to-[#024E7C] text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-md shadow-sky-200/50 dark:shadow-sky-900/50 cursor-pointer"
                  title="Kirim Balasan"
                >
                  <i v-if="chatStore.isSending" class="fa-solid fa-spinner fa-spin text-xs"></i>
                  <i v-else class="fa-solid fa-paper-plane text-[11px]"></i>
                </button>
              </form>
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
    <!-- MODAL: TOLAK KONSULTASI                                        -->
    <!-- ============================================================== -->
    <div v-if="isRejectModalOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
            <i class="fa-solid fa-ban text-lg"></i>
          </div>
          <div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-white">Tolak Konsultasi?</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Berikan alasan penolakan untuk siswa.</p>
          </div>
        </div>
        <textarea
          v-model="rejectionReasonInput"
          rows="3"
          placeholder="Tuliskan alasan penolakan..."
          class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
        ></textarea>
        <div class="flex items-center justify-end gap-2 pt-1">
          <button type="button" @click="isRejectModalOpen = false" class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Batal
          </button>
          <button type="button" @click="confirmRejectSession" :disabled="isSubmittingReject" class="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer shadow-sm transition-colors">
            {{ isSubmittingReject ? 'Menyimpan...' : 'Tolak Konsultasi' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
