import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from './auth'

export const COUNSELORS = [
  'Rangga Adi Pradana',
  'Riswanda Ardan Setiawan',
  'Yudhi Purwa Nugraha',
  'Andrian Prihudiyanti',
  'Anissa Binti Sholihah'
]

export const CATEGORIES = [
  {
    id: 'pribadi',
    name: 'Pribadi',
    icon: 'fa-solid fa-heart',
    color: 'from-rose-500 to-pink-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    desc: 'Kendala emosional, kepercayaan diri, keluarga, atau masalah pribadi lainnya'
  },
  {
    id: 'sosial',
    name: 'Sosial',
    icon: 'fa-solid fa-users',
    color: 'from-amber-500 to-orange-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    desc: 'Relasi pertemanan, adaptasi lingkungan sekolah, atau konflik sosial'
  },
  {
    id: 'belajar',
    name: 'Belajar',
    icon: 'fa-solid fa-book-open-reader',
    color: 'from-blue-500 to-cyan-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    desc: 'Motivasi belajar, kesulitan mata pelajaran, manajemen waktu & fokus belajar'
  },
  {
    id: 'karir',
    name: 'Karir',
    icon: 'fa-solid fa-compass',
    color: 'from-emerald-500 to-teal-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    desc: 'Rencana kuliah, SNBP/SNBT, kedinasan, minat bakat, dan cita-cita masa depan'
  }
]

export const STATUS_CONFIG = {
  menunggu: {
    label: 'Menunggu',
    icon: 'fa-regular fa-clock',
    badge: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500'
  },
  ditindaklanjuti: {
    label: 'Ditindaklanjuti',
    icon: 'fa-solid fa-comments',
    badge: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800',
    dot: 'bg-sky-500'
  },
  selesai: {
    label: 'Selesai',
    icon: 'fa-solid fa-circle-check',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  }
}

export const NOTE_CATEGORIES = [
  { id: 'umum', label: 'Umum', icon: 'fa-solid fa-clipboard-list', badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  { id: 'pribadi', label: 'Pribadi', icon: 'fa-solid fa-heart', badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' },
  { id: 'sosial', label: 'Sosial', icon: 'fa-solid fa-users', badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' },
  { id: 'belajar', label: 'Belajar', icon: 'fa-solid fa-book-open-reader', badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' },
  { id: 'karir', label: 'Karir', icon: 'fa-solid fa-compass', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' },
  { id: 'tatap_muka', label: 'Tatap Muka BK', icon: 'fa-solid fa-school', badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800' },
  { id: 'home_visit', label: 'Home Visit', icon: 'fa-solid fa-house-user', badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800' }
]

// Helper: Cek kelayakan Hapus Dua Pihak (< 15 menit)
export function check15MinEligibility(createdAt) {
  if (!createdAt) return { allowed: false, diffMinutes: 999, remainingMinutes: 0, remainingText: 'Batas waktu lewat' }
  const createdTime = new Date(createdAt).getTime()
  const now = Date.now()
  const diffMs = now - createdTime
  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  const remainingMinutes = Math.max(0, 15 - diffMinutes)
  return {
    allowed: diffMinutes < 15,
    diffMinutes,
    remainingMinutes,
    remainingText: remainingMinutes > 0 ? `${remainingMinutes} menit lagi` : 'Batas 15 menit lewat'
  }
}

// Helper: Cek apakah sesi disematkan oleh/untuk Guru BK tertentu
export function isSessionPinnedForCounselor(session, counselorFilter) {
  if (!session) return false
  const list = session.pinned_by_counselors || []
  if (!counselorFilter || counselorFilter === 'ALL') {
    return list.length > 0 || Boolean(session.is_pinned_by_counselor)
  }
  return list.includes(counselorFilter) || (session.counselor_name === counselorFilter && Boolean(session.is_pinned_by_counselor))
}

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore()

  // State
  const sessions = ref([])
  const activeSession = ref(null)
  const messages = ref([])
  const isLoadingSessions = ref(false)
  const isLoadingMessages = ref(false)
  const isSending = ref(false)
  const canCreateToday = ref(true)
  const todaySessionCount = ref(0)

  // UI state untuk widget HaloBK
  const isWidgetOpen = ref(false)
  const viewMode = ref('list') // 'list' | 'chat' | 'new'

  let realtimeChannel = null

  // Getters
  const unreadCount = computed(() => {
    if (authStore.userRole === 'admin') {
      return sessions.value.filter(s => s.status === 'menunggu').length
    }
    return 0
  })

  // Urutan Sesi untuk Siswa (Pinned Siswa di atas, lalu timestamp desc)
  const sortedSessionsForStudent = computed(() => {
    return [...sessions.value]
      .filter(s => !s.deleted_by_student && !s.is_deleted_for_everyone)
      .sort((a, b) => {
        const pinA = Boolean(a.is_pinned_by_student)
        const pinB = Boolean(b.is_pinned_by_student)
        if (pinA !== pinB) return pinB ? 1 : -1
        const dateA = new Date(a.last_message_at || a.created_at)
        const dateB = new Date(b.last_message_at || b.created_at)
        return dateB - dateA
      })
  })

  // Sesi sorted standar
  const sortedSessions = computed(() => {
    return [...sessions.value]
      .filter(s => (authStore.userRole === 'admin' ? !s.deleted_by_admin : !s.deleted_by_student) && !s.is_deleted_for_everyone)
      .sort((a, b) => {
        const dateA = new Date(a.last_message_at || a.created_at)
        const dateB = new Date(b.last_message_at || b.created_at)
        return dateB - dateA
      })
  })

  // Buka widget dari mana saja
  function openWidget(mode = null) {
    isWidgetOpen.value = true
    if (mode) {
      viewMode.value = mode
    } else if (sessions.value.length === 0) {
      viewMode.value = 'new'
    } else {
      viewMode.value = 'list'
    }
  }

  function closeWidget() {
    isWidgetOpen.value = false
  }

  // Cek token harian siswa (di-pause untuk testing)
  async function checkDailyToken() {
    canCreateToday.value = true
    todaySessionCount.value = 0
    return true
  }

  // Ambil daftar sesi milik siswa yang sedang login
  async function fetchMySessions() {
    if (!isSupabaseConfigured || !supabase || !authStore.currentUser?.id) return

    isLoadingSessions.value = true
    try {
      const { data, error } = await supabase
        .from('counseling_sessions')
        .select('*')
        .eq('student_id', authStore.currentUser.id)
        .order('last_message_at', { ascending: false })

      if (error) throw error
      // Filter out yang dihapus untuk siswa
      sessions.value = (data || []).filter(s => !s.deleted_by_student && !s.is_deleted_for_everyone)
      await checkDailyToken()
    } catch (e) {
      console.error('Error fetchMySessions:', e)
    } finally {
      isLoadingSessions.value = false
    }
  }

  // Ambil seluruh sesi untuk Admin / Guru BK
  async function fetchAllSessionsAdmin() {
    if (!isSupabaseConfigured || !supabase) return

    isLoadingSessions.value = true
    try {
      const { data, error } = await supabase
        .from('counseling_sessions')
        .select('*')
        .order('last_message_at', { ascending: false })

      if (error) throw error
      // Filter out yang dihapus untuk admin
      sessions.value = (data || []).filter(s => !s.deleted_by_admin && !s.is_deleted_for_everyone)
    } catch (e) {
      console.error('Error fetchAllSessionsAdmin:', e)
    } finally {
      isLoadingSessions.value = false
    }
  }

  // Ambil pesan dalam satu sesi
  async function fetchMessages(sessionId) {
    if (!isSupabaseConfigured || !supabase || !sessionId) return

    isLoadingMessages.value = true
    try {
      const { data, error } = await supabase
        .from('counseling_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      const isGuru = authStore.userRole === 'admin'
      messages.value = (data || []).filter(m => {
        if (isGuru && m.deleted_for_guru) return false
        if (!isGuru && m.deleted_for_siswa) return false
        return true
      })
    } catch (e) {
      console.error('Error fetchMessages:', e)
    } finally {
      isLoadingMessages.value = false
    }
  }

  // Pilih sesi aktif dan muat pesannya
  async function selectSession(session) {
    activeSession.value = session
    viewMode.value = 'chat'
    await fetchMessages(session.id)
    setupRealtimeSubscription(session.id)
  }

  // Buat sesi konsultasi baru (Siswa)
  async function createSession({ counselor_name, category, title, initial_message, needs_offline_followup }) {
    if (!isSupabaseConfigured || !supabase || !authStore.currentUser?.id) {
      throw new Error('Anda harus login terlebih dahulu untuk memulai konsultasi.')
    }

    // Validasi Anti-Spam: Batas maksimal 2 sesi aktif untuk siswa
    const activeSessions = sessions.value.filter(
      s => (s.status === 'menunggu' || s.status === 'ditindaklanjuti') && !s.deleted_by_student && !s.is_deleted_for_everyone
    )
    if (activeSessions.length >= 2) {
      throw new Error('Batas maksimal 2 sesi aktif tercapai. Harap tunggu hingga salah satu sesi diselesaikan oleh Guru BK.')
    }

    // Validasi Anti-Spam: Kunci guru yang sedang memiliki sesi aktif
    if (activeSessions.some(s => s.counselor_name === counselor_name)) {
      throw new Error(`Masih ada sesi aktif dengan ${counselor_name}. Silakan pilih Guru BK lainnya atau selesaikan sesi tersebut terlebih dahulu.`)
    }

    // Validasi Anti-Spam: Kunci kategori yang sedang aktif di sesi lain
    if (activeSessions.some(s => s.category === category)) {
      throw new Error(`Anda masih memiliki sesi aktif untuk kategori ${category}. Silakan pilih kategori lain.`)
    }

    isSending.value = true
    try {
      const studentId = authStore.currentUser.id
      const studentName = authStore.currentUser.nama || authStore.userName || 'Siswa SMADA'
      const studentNis = authStore.currentUser.nis || authStore.currentUser.nisn || ''
      const studentClass = authStore.currentUser.kelas || ''

      // 1. Buat record di counseling_sessions
      const { data: sessionData, error: sessionErr } = await supabase
        .from('counseling_sessions')
        .insert({
          student_id: studentId,
          student_name: studentName,
          student_nis: studentNis,
          student_class: studentClass,
          counselor_name,
          category,
          title,
          needs_offline_followup: Boolean(needs_offline_followup),
          status: 'menunggu',
          last_message_preview: initial_message.slice(0, 120),
          last_message_at: new Date().toISOString()
        })
        .select()
        .single()

      if (sessionErr) throw sessionErr

      // 2. Buat pesan awal di counseling_messages
      const { data: msgData, error: msgErr } = await supabase
        .from('counseling_messages')
        .insert({
          session_id: sessionData.id,
          sender_id: studentId,
          sender_role: 'siswa',
          sender_name: studentName,
          message: initial_message,
          is_read: false
        })
        .select()
        .single()

      if (msgErr) throw msgErr

      sessions.value.unshift(sessionData)
      activeSession.value = sessionData
      messages.value = [msgData]
      viewMode.value = 'chat'
      canCreateToday.value = false
      todaySessionCount.value = 1

      setupRealtimeSubscription(sessionData.id)
      return sessionData
    } finally {
      isSending.value = false
    }
  }

  // Kirim balasan pesan (Siswa atau Guru BK)
  async function sendMessage(sessionId, text) {
    if (!isSupabaseConfigured || !supabase || !text.trim() || !authStore.currentUser?.id) return

    isSending.value = true
    try {
      const senderRole = authStore.userRole === 'admin' ? 'guru' : 'siswa'
      let senderName = authStore.userName || 'Pengguna'
      
      if (senderRole === 'guru' && activeSession.value?.counselor_name) {
        senderName = activeSession.value.counselor_name
      }

      const { data, error } = await supabase
        .from('counseling_messages')
        .insert({
          session_id: sessionId,
          sender_id: authStore.currentUser.id,
          sender_role: senderRole,
          sender_name: senderName,
          message: text.trim(),
          is_read: false
        })
        .select()
        .single()

      if (error) throw error

      if (senderRole === 'guru' && activeSession.value && activeSession.value.status === 'menunggu') {
        await updateSessionStatus(sessionId, 'ditindaklanjuti')
      }

      if (!messages.value.some(m => m.id === data.id)) {
        messages.value.push(data)
      }

      const targetSession = sessions.value.find(s => s.id === sessionId)
      if (targetSession) {
        targetSession.last_message_preview = text.trim().slice(0, 120)
        targetSession.last_message_at = data.created_at
      }

      return data
    } finally {
      isSending.value = false
    }
  }

  // Update status sesi (Admin / Guru BK)
  async function updateSessionStatus(sessionId, newStatus) {
    if (!isSupabaseConfigured || !supabase) return

    try {
      const updatePayload = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('counseling_sessions')
        .update(updatePayload)
        .eq('id', sessionId)
        .select()
        .single()

      if (error) throw error

      const idx = sessions.value.findIndex(s => s.id === sessionId)
      if (idx !== -1) {
        sessions.value[idx] = { ...sessions.value[idx], ...data }
      }
      if (activeSession.value && activeSession.value.id === sessionId) {
        activeSession.value = { ...activeSession.value, ...data }
      }

      return data
    } catch (e) {
      console.error('Error updateSessionStatus:', e)
      throw e
    }
  }

  // Update Catatan Rahasia Konselor (Khusus Guru BK)
  async function updateCounselorNotes(sessionId, notes) {
    if (!isSupabaseConfigured || !supabase || !sessionId) return

    try {
      const updatePayload = {
        counselor_notes: notes,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('counseling_sessions')
        .update(updatePayload)
        .eq('id', sessionId)
        .select()
        .single()

      if (error) {
        console.warn('Update counselor_notes via Supabase warning/fallback:', error.message)
        const s = sessions.value.find(item => item.id === sessionId)
        if (s) s.counselor_notes = notes
        if (activeSession.value && activeSession.value.id === sessionId) {
          activeSession.value.counselor_notes = notes
        }
        return { counselor_notes: notes }
      }

      const idx = sessions.value.findIndex(s => s.id === sessionId)
      if (idx !== -1) {
        sessions.value[idx] = { ...sessions.value[idx], ...data }
      }
      if (activeSession.value && activeSession.value.id === sessionId) {
        activeSession.value = { ...activeSession.value, ...data }
      }

      return data
    } catch (e) {
      console.error('Error updateCounselorNotes:', e)
      const s = sessions.value.find(item => item.id === sessionId)
      if (s) s.counselor_notes = notes
      if (activeSession.value && activeSession.value.id === sessionId) {
        activeSession.value.counselor_notes = notes
      }
      return { counselor_notes: notes }
    }
  }

  // ============================================================================
  // FITUR BARU: SEMATKAN (PIN) SESI KONSULTASI
  // ============================================================================
  async function togglePinSession(sessionId, counselorFilter = null) {
    if (!isSupabaseConfigured || !supabase) return

    const s = sessions.value.find(item => item.id === sessionId)
    if (!s) return

    const isAdmin = authStore.userRole === 'admin'

    try {
      if (isAdmin) {
        // Mode Guru BK: terkoneksi dengan filter per guru
        const targetCounselor = (counselorFilter && counselorFilter !== 'ALL')
          ? counselorFilter
          : s.counselor_name

        const currentPinnedList = Array.isArray(s.pinned_by_counselors) ? [...s.pinned_by_counselors] : []
        let newPinnedList
        let newIsPinned

        if (currentPinnedList.includes(targetCounselor)) {
          newPinnedList = currentPinnedList.filter(c => c !== targetCounselor)
          newIsPinned = newPinnedList.length > 0
        } else {
          newPinnedList = [...currentPinnedList, targetCounselor]
          newIsPinned = true
        }

        const updatePayload = {
          pinned_by_counselors: newPinnedList,
          is_pinned_by_counselor: newIsPinned,
          updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('counseling_sessions')
          .update(updatePayload)
          .eq('id', sessionId)
          .select()
          .single()

        if (error) {
          // Fallback lokal jika kolom belum dimigrasikan di DB
          s.pinned_by_counselors = newPinnedList
          s.is_pinned_by_counselor = newIsPinned
        } else if (data) {
          Object.assign(s, data)
        }
      } else {
        // Mode Siswa: sematkan sesi untuk siswa
        const nextVal = !Boolean(s.is_pinned_by_student)
        const updatePayload = {
          is_pinned_by_student: nextVal,
          updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('counseling_sessions')
          .update(updatePayload)
          .eq('id', sessionId)
          .select()
          .single()

        if (error) {
          s.is_pinned_by_student = nextVal
        } else if (data) {
          Object.assign(s, data)
        }
      }

      if (activeSession.value && activeSession.value.id === sessionId) {
        activeSession.value = { ...activeSession.value, ...s }
      }
    } catch (e) {
      console.error('Error togglePinSession:', e)
    }
  }

  // ============================================================================
  // FITUR BARU: HAPUS RIWAYAT KONSULTASI (PRIBADI VS SEMUA ORANG < 15 MENIT)
  // ============================================================================
  async function deleteSession(sessionId, deleteType = 'for_me') {
    if (!isSupabaseConfigured || !supabase) return

    const s = sessions.value.find(item => item.id === sessionId)
    if (!s) return

    const isAdmin = authStore.userRole === 'admin'

    if (deleteType === 'for_everyone') {
      // Validasi batas 15 menit (Kecuali jika status masih 'menunggu', pembatalan pengajuan oleh siswa selalu diperbolehkan)
      const eligibility = check15MinEligibility(s.created_at)
      if (!eligibility.allowed && s.status !== 'menunggu') {
        throw new Error('Penghapusan dua pihak (semua orang) hanya dapat dilakukan dalam waktu 15 menit setelah konsultasi dibuat.')
      }

      try {
        // Hapus juga pesan-pesan terkait di counseling_messages
        await supabase
          .from('counseling_messages')
          .delete()
          .eq('session_id', sessionId)

        // Coba hard delete sesi via Supabase
        const { error: delErr } = await supabase
          .from('counseling_sessions')
          .delete()
          .eq('id', sessionId)

        if (delErr) {
          // Jika RLS delete belum diatur, lakukan soft delete dua pihak
          await supabase
            .from('counseling_sessions')
            .update({
              deleted_by_student: true,
              deleted_by_admin: true,
              is_deleted_for_everyone: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId)
        }
      } catch (e) {
        console.error('Error deleteSession for_everyone:', e)
      }
    } else {
      // Hapus untuk pribadi (hanya akun saat ini)
      const updatePayload = isAdmin
        ? { deleted_by_admin: true, updated_at: new Date().toISOString() }
        : { deleted_by_student: true, updated_at: new Date().toISOString() }

      try {
        await supabase
          .from('counseling_sessions')
          .update(updatePayload)
          .eq('id', sessionId)
      } catch (e) {
        console.error('Error deleteSession for_me:', e)
      }
    }

    // Bersihkan dari state lokal
    sessions.value = sessions.value.filter(item => item.id !== sessionId)
    if (activeSession.value && activeSession.value.id === sessionId) {
      activeSession.value = null
      messages.value = []
    }
  }

  // ============================================================================
  // FITUR BARU: HAPUS PESAN PER BUBBLE (PRIBADI VS SEMUA ORANG < 15 MENIT)
  // ============================================================================
  async function deleteMessage(messageId, deleteType = 'for_me') {
    if (!isSupabaseConfigured || !supabase) return

    const m = messages.value.find(item => item.id === messageId)
    if (!m) return

    const isAdmin = authStore.userRole === 'admin'

    if (deleteType === 'for_everyone') {
      const eligibility = check15MinEligibility(m.created_at)
      if (!eligibility.allowed) {
        throw new Error('Pesan hanya dapat dihapus untuk semua orang dalam 15 menit setelah dikirim.')
      }

      try {
        await supabase
          .from('counseling_messages')
          .update({ is_deleted_for_everyone: true })
          .eq('id', messageId)

        m.is_deleted_for_everyone = true
        m.message = '🚫 Pesan ini telah dihapus'
      } catch (e) {
        console.error('Error deleteMessage for_everyone:', e)
      }
    } else {
      // Hapus untuk pribadi
      const updatePayload = isAdmin
        ? { deleted_for_guru: true }
        : { deleted_for_siswa: true }

      try {
        await supabase
          .from('counseling_messages')
          .update(updatePayload)
          .eq('id', messageId)

        // Hapus dari tampilan lokal pengguna ini
        messages.value = messages.value.filter(item => item.id !== messageId)
      } catch (e) {
        console.error('Error deleteMessage for_me:', e)
      }
    }
  }

  // Setup Supabase Realtime Subscription
  function setupRealtimeSubscription(sessionId) {
    if (!isSupabaseConfigured || !supabase) return

    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }

    realtimeChannel = supabase
      .channel(`counseling_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'counseling_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          const newMsg = payload.new
          if (newMsg && !messages.value.some(m => m.id === newMsg.id)) {
            const isGuru = authStore.userRole === 'admin'
            if (isGuru && newMsg.deleted_for_guru) return
            if (!isGuru && newMsg.deleted_for_siswa) return
            messages.value.push(newMsg)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'counseling_messages',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          const updated = payload.new
          if (updated) {
            const mIdx = messages.value.findIndex(m => m.id === updated.id)
            if (mIdx !== -1) {
              const isGuru = authStore.userRole === 'admin'
              if ((isGuru && updated.deleted_for_guru) || (!isGuru && updated.deleted_for_siswa)) {
                messages.value.splice(mIdx, 1)
              } else if (updated.is_deleted_for_everyone) {
                messages.value[mIdx].is_deleted_for_everyone = true
                messages.value[mIdx].message = '🚫 Pesan ini telah dihapus'
              } else {
                messages.value[mIdx] = { ...messages.value[mIdx], ...updated }
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'counseling_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          const updated = payload.new
          if (updated) {
            const isAdmin = authStore.userRole === 'admin'
            if ((isAdmin && updated.deleted_by_admin) || (!isAdmin && updated.deleted_by_student) || updated.is_deleted_for_everyone) {
              sessions.value = sessions.value.filter(s => s.id !== updated.id)
              if (activeSession.value && activeSession.value.id === updated.id) {
                activeSession.value = null
                messages.value = []
              }
              return
            }

            if (activeSession.value && activeSession.value.id === updated.id) {
              activeSession.value = { ...activeSession.value, ...updated }
            }
            const sIdx = sessions.value.findIndex(s => s.id === updated.id)
            if (sIdx !== -1) {
              sessions.value[sIdx] = { ...sessions.value[sIdx], ...updated }
            }
          }
        }
      )
      .subscribe()
  }

  function cleanupRealtime() {
    if (realtimeChannel && supabase) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  }

  // ============================================================================
  // FITUR BARU: BUKU CATATAN SISWA & DOSSIER KONSELING TERPADU (STUDENT-CENTRIC)
  // ============================================================================
  const allStudentNotes = ref([])
  const isLoadingNotes = ref(false)

  async function fetchAllStudentNotes() {
    if (!isSupabaseConfigured || !supabase) return allStudentNotes.value
    isLoadingNotes.value = true
    try {
      const { data, error } = await supabase
        .from('student_counseling_notes')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) {
        allStudentNotes.value = data
      }
      return allStudentNotes.value
    } catch (err) {
      console.warn('fetchAllStudentNotes warning:', err.message)
      return allStudentNotes.value
    } finally {
      isLoadingNotes.value = false
    }
  }

  async function fetchStudentNotes(studentId) {
    if (!studentId) return []
    if (!isSupabaseConfigured || !supabase) {
      return allStudentNotes.value.filter(n => n.student_id === studentId)
    }
    isLoadingNotes.value = true
    try {
      const { data, error } = await supabase
        .from('student_counseling_notes')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
      if (!error && data) {
        // Sinkronisasi ke allStudentNotes
        data.forEach(item => {
          const idx = allStudentNotes.value.findIndex(n => n.id === item.id)
          if (idx !== -1) allStudentNotes.value[idx] = item
          else allStudentNotes.value.unshift(item)
        })
        return data
      }
      return allStudentNotes.value.filter(n => n.student_id === studentId)
    } catch (err) {
      console.warn('fetchStudentNotes warning:', err.message)
      return allStudentNotes.value.filter(n => n.student_id === studentId)
    } finally {
      isLoadingNotes.value = false
    }
  }

  async function createStudentNote(payload) {
    const newNote = {
      id: crypto.randomUUID(),
      student_id: payload.student_id,
      student_name: payload.student_name,
      student_class: payload.student_class || '',
      counselor_name: payload.counselor_name || authStore.userName || 'Guru BK SMADA',
      category: payload.category || 'umum',
      title: payload.title || 'Catatan Bimbingan Siswa',
      content: payload.content || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (!isSupabaseConfigured || !supabase) {
      allStudentNotes.value.unshift(newNote)
      return newNote
    }

    try {
      const { data, error } = await supabase
        .from('student_counseling_notes')
        .insert({
          student_id: newNote.student_id,
          student_name: newNote.student_name,
          student_class: newNote.student_class,
          counselor_name: newNote.counselor_name,
          category: newNote.category,
          title: newNote.title,
          content: newNote.content
        })
        .select()
        .single()

      if (!error && data) {
        allStudentNotes.value.unshift(data)
        return data
      }
      allStudentNotes.value.unshift(newNote)
      return newNote
    } catch (err) {
      console.warn('createStudentNote warning, using optimistic fallback:', err.message)
      allStudentNotes.value.unshift(newNote)
      return newNote
    }
  }

  async function updateStudentNote(noteId, payload) {
    const updateData = {
      category: payload.category,
      title: payload.title,
      content: payload.content,
      updated_at: new Date().toISOString()
    }
    if (payload.counselor_name) {
      updateData.counselor_name = payload.counselor_name
    }

    const idx = allStudentNotes.value.findIndex(n => n.id === noteId)
    if (idx !== -1) {
      allStudentNotes.value[idx] = { ...allStudentNotes.value[idx], ...updateData }
    }

    if (!isSupabaseConfigured || !supabase) return allStudentNotes.value[idx]

    try {
      const { data, error } = await supabase
        .from('student_counseling_notes')
        .update(updateData)
        .eq('id', noteId)
        .select()
        .single()

      if (!error && data && idx !== -1) {
        allStudentNotes.value[idx] = data
        return data
      }
      return allStudentNotes.value[idx]
    } catch (err) {
      console.warn('updateStudentNote warning:', err.message)
      return allStudentNotes.value[idx]
    }
  }

  async function deleteStudentNote(noteId) {
    const idx = allStudentNotes.value.findIndex(n => n.id === noteId)
    if (idx !== -1) {
      allStudentNotes.value.splice(idx, 1)
    }

    if (!isSupabaseConfigured || !supabase) return true

    try {
      const { error } = await supabase
        .from('student_counseling_notes')
        .delete()
        .eq('id', noteId)

      return !error
    } catch (err) {
      console.warn('deleteStudentNote warning:', err.message)
      return true
    }
  }

  return {
    sessions,
    activeSession,
    messages,
    isLoadingSessions,
    isLoadingMessages,
    isSending,
    canCreateToday,
    todaySessionCount,
    isWidgetOpen,
    viewMode,
    unreadCount,
    sortedSessions,
    sortedSessionsForStudent,
    allStudentNotes,
    isLoadingNotes,
    openWidget,
    closeWidget,
    checkDailyToken,
    fetchMySessions,
    fetchAllSessionsAdmin,
    fetchMessages,
    selectSession,
    createSession,
    sendMessage,
    updateSessionStatus,
    updateCounselorNotes,
    togglePinSession,
    deleteSession,
    deleteMessage,
    setupRealtimeSubscription,
    cleanupRealtime,
    fetchAllStudentNotes,
    fetchStudentNotes,
    createStudentNote,
    updateStudentNote,
    deleteStudentNote
  }
})
