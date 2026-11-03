import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from './auth'
import * as XLSX from 'xlsx'

export const useAlumniStore = defineStore('alumni', () => {
  const STORAGE_KEY = 'hallo_alumni_verified_v3'
  const PENDING_STORAGE_KEY = 'hallo_alumni_pending_v3'

  // Data awal kosong murni (tanpa dummy)
  const alumniList = ref([])
  const pendingList = ref([])
  const isLoading = ref(false)

  // Filters
  const selectedCohort = ref('ALL')
  const selectedCategory = ref('ALL')
  const searchQuery = ref('')

  // Mapping data dari format database Supabase ke format frontend
  function mapDbToAlumni(item) {
    return {
      id: item.id,
      name: item.nama_lengkap || item.name || '',
      classRoom: item.kelas_terakhir || item.classRoom || '-',
      cohort: String(item.tahun_lulus || item.cohort || ''),
      phone: item.no_wa || item.phone || '-',
      category: item.kategori || item.category || 'PTN',
      pathway: item.jalur_masuk || item.pathway || 'SNBP',
      institution: item.instansi || item.institution || '',
      major: item.jurusan_posisi || item.major || '-',
      message: item.pesan || item.message || '',
      timestamp: item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) : 'Baru saja'
    }
  }

  // Ambil Data dari Supabase (atau Local Storage jika belum connect)
  async function fetchData() {
    isLoading.value = true

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Ambil data alumni terverifikasi
        const { data: verifiedData, error: errVerified } = await supabase
          .from('alumni')
          .select('*')
          .eq('is_verified', true)
          .order('created_at', { ascending: false })

        if (errVerified) throw errVerified
        alumniList.value = (verifiedData || []).map(mapDbToAlumni)

        // 2. Ambil data antrean pending (untuk Admin Guru BK)
        const { data: pendingData, error: errPending } = await supabase
          .from('alumni')
          .select('*')
          .eq('is_verified', false)
          .order('created_at', { ascending: false })

        if (errPending) throw errPending
        pendingList.value = (pendingData || []).map(mapDbToAlumni)

      } catch (err) {
        console.warn('Gagal mengambil data dari Supabase:', err)
      }
    } else {
      // Baca dari localStorage jika ada data inputan pengguna sendiri
      try {
        const storedVerified = localStorage.getItem(STORAGE_KEY)
        alumniList.value = storedVerified ? JSON.parse(storedVerified) : []

        const storedPending = localStorage.getItem(PENDING_STORAGE_KEY)
        pendingList.value = storedPending ? JSON.parse(storedPending) : []
      } catch (e) {
        alumniList.value = []
        pendingList.value = []
      }
    }

    isLoading.value = false
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alumniList.value))
      localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pendingList.value))
    } catch (e) {
      console.warn('LocalStorage error:', e)
    }
  }

  // Filtered List
  const filteredAlumni = computed(() => {
    let result = alumniList.value

    if (selectedCohort.value !== 'ALL') {
      result = result.filter(item => String(item.cohort) === String(selectedCohort.value))
    }

    if (selectedCategory.value !== 'ALL') {
      result = result.filter(item => item.category === selectedCategory.value)
    }

    if (searchQuery.value.trim() !== '') {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter(item => 
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.institution && item.institution.toLowerCase().includes(q)) ||
        (item.major && item.major.toLowerCase().includes(q)) ||
        (item.classRoom && item.classRoom.toLowerCase().includes(q)) ||
        (item.pathway && item.pathway.toLowerCase().includes(q))
      )
    }

    return result
  })

  // Statistics
  const statistics = computed(() => {
    const total = alumniList.value.length
    const ptnCount = alumniList.value.filter(a => a.category === 'PTN').length
    const ptsCount = alumniList.value.filter(a => a.category === 'PTS').length
    const kedinasanCount = alumniList.value.filter(a => a.category === 'Kedinasan').length
    const tniPolriCount = alumniList.value.filter(a => a.category === 'TNI/Polri').length
    const kerjaCount = alumniList.value.filter(a => a.category === 'Bekerja').length
    const wirausahaCount = alumniList.value.filter(a => a.category === 'Wirausaha').length
    const pelatihanCount = alumniList.value.filter(a => a.category === 'Pelatihan / LPK').length
    const masaTungguCount = alumniList.value.filter(a => a.category === 'Masa Tunggu').length

    return {
      total,
      ptnCount,
      ptsCount,
      kedinasanCount,
      tniPolriCount,
      kerjaCount,
      wirausahaCount,
      pelatihanCount,
      masaTungguCount,
      pendingCount: pendingList.value.length
    }
  })

  // Submit Alumni Self-Report (Alumni Form) -> goes into pending queue
  async function submitLaporDiri(form) {
    const authStore = useAuthStore()

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          nama_lengkap: form.name,
          kelas_terakhir: form.classRoom,
          tahun_lulus: parseInt(form.cohort) || 2026,
          no_wa: form.phone || null,
          kategori: form.category,
          jalur_masuk: form.pathway,
          instansi: form.institution,
          jurusan_posisi: form.major,
          pesan: form.message || null,
          is_verified: false,
          user_id: authStore.authUser?.id || null
        }

        const { data, error } = await supabase
          .from('alumni')
          .insert(payload)
          .select()
          .single()

        if (error) throw error

        pendingList.value.unshift(mapDbToAlumni(data))
        return { success: true }
      } catch (err) {
        console.error('Error insert alumni to Supabase:', err)
        return { success: false, message: err.message }
      }
    } else {
      // Local mode fallback
      const newPending = {
        id: 'PENDING-' + Date.now().toString().slice(-4),
        name: form.name,
        classRoom: form.classRoom,
        cohort: form.cohort,
        phone: form.phone,
        category: form.category,
        pathway: form.pathway,
        institution: form.institution,
        major: form.major,
        message: form.message,
        timestamp: 'Baru saja diajukan'
      }

      pendingList.value.unshift(newPending)
      saveToLocalStorage()
      return { success: true }
    }
  }

  // Admin Actions: Approve (ACC)
  async function approvePending(id) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('alumni')
          .update({ is_verified: true, updated_at: new Date().toISOString() })
          .eq('id', id)

        if (error) throw error
        await fetchData()
        return true
      } catch (err) {
        console.error('Gagal ACC alumni:', err)
        return false
      }
    } else {
      const idx = pendingList.value.findIndex(p => p.id === id)
      if (idx !== -1) {
        const [approved] = pendingList.value.splice(idx, 1)
        approved.timestamp = 'Baru saja diverifikasi'
        alumniList.value.unshift(approved)
        saveToLocalStorage()
        return true
      }
      return false
    }
  }

  // Admin Actions: Reject
  async function rejectPending(id) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('alumni')
          .delete()
          .eq('id', id)

        if (error) throw error
        await fetchData()
        return true
      } catch (err) {
        console.error('Gagal tolak alumni:', err)
        return false
      }
    } else {
      const idx = pendingList.value.findIndex(p => p.id === id)
      if (idx !== -1) {
        pendingList.value.splice(idx, 1)
        saveToLocalStorage()
        return true
      }
      return false
    }
  }

  // Excel Export (.xlsx)
  function exportExcel() {
    if (alumniList.value.length === 0) {
      alert('Belum ada data alumni untuk diekspor.')
      return
    }

    const exportData = alumniList.value.map((item, index) => ({
      'No': index + 1,
      'ID Alumni': item.id,
      'Nama Lengkap': item.name,
      'Kelas XII': item.classRoom,
      'Angkatan': item.cohort,
      'No. WhatsApp': item.phone,
      'Kategori': item.category,
      'Jalur Masuk': item.pathway,
      'Kampus / Instansi / Perusahaan': item.institution,
      'Jurusan / Posisi Pekerjaan': item.major,
      'Pesan & Tips Alumni': item.message,
      'Tanggal Input': item.timestamp
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Alumni SMADA')

    XLSX.writeFile(workbook, `Data_Alumni_SMADA_Ngawi_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Bulk Import
  async function importData(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return 0

    if (isSupabaseConfigured && supabase) {
      const records = rows.map(r => ({
        nama_lengkap: r.name,
        kelas_terakhir: r.classRoom || 'XII-1',
        tahun_lulus: parseInt(r.cohort) || 2026,
        no_wa: r.phone || null,
        kategori: r.category || 'PTN',
        jalur_masuk: r.pathway || 'SNBP',
        instansi: r.institution,
        jurusan_posisi: r.major || null,
        pesan: r.message || null,
        is_verified: true
      }))

      try {
        const { error } = await supabase.from('alumni').insert(records)
        if (error) throw error
        await fetchData()
        return records.length
      } catch (err) {
        console.error('Error bulk import to Supabase:', err)
        return 0
      }
    } else {
      let count = 0
      rows.forEach((r, i) => {
        if (r.name && r.institution) {
          alumniList.value.unshift({
            id: 'IMPORT-' + (Date.now() + i).toString().slice(-4),
            name: r.name,
            classRoom: r.classRoom || 'XII-1',
            cohort: String(r.cohort || '2026'),
            phone: r.phone || '-',
            category: r.category || 'PTN',
            pathway: r.pathway || 'SNBP',
            institution: r.institution,
            major: r.major || '-',
            message: r.message || '',
            timestamp: 'Baru saja diimport'
          })
          count++
        }
      })
      saveToLocalStorage()
      return count
    }
  }

  return {
    alumniList,
    pendingList,
    isLoading,
    selectedCohort,
    selectedCategory,
    searchQuery,
    filteredAlumni,
    statistics,
    fetchData,
    submitLaporDiri,
    approvePending,
    rejectPending,
    exportExcel,
    importData
  }
})
