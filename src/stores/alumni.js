import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from './auth'
import { getOptimizedImageUrl } from '@/lib/imageOptimizer'
import { normalizeMajorName } from '@/lib/snpmbService'
import * as XLSX from 'xlsx'

export const useAlumniStore = defineStore('alumni', () => {
  const STORAGE_KEY = 'hallo_alumni_verified_v3'
  const PENDING_STORAGE_KEY = 'hallo_alumni_pending_v3'
  const PENDING_STUDENTS_STORAGE_KEY = 'hallo_student_updates_pending_v1'

  // Data awal kosong murni (tanpa dummy)
  const alumniList = ref([])
  const pendingList = ref([])
  const pendingStudentUpdates = ref([])
  const isLoading = ref(false)

  // Total seluruh antrean yang membutuhkan persetujuan Guru BK (Alumni + Biodata Siswa)
  const totalPendingCount = computed(() => pendingList.value.length + pendingStudentUpdates.value.length)

  // Filters
  const selectedCohort = ref('ALL')
  const selectedCategory = ref('ALL')
  const searchQuery = ref('')

  // Mapping data dari format database Supabase ke format frontend
  function mapDbToAlumni(item) {
    const authStore = useAuthStore()
    const isAdmin = authStore.userRole === 'admin'
    const rawInst = item.instansi || item.institution || ''
    const rawMajor = item.jurusan_posisi || item.major || '-'
    const finalMajor = normalizeMajorName(rawInst, rawMajor)

    const finalCategory = item.kategori || item.category || 'PTN'
    const finalPathway = (finalCategory === 'Masa Tunggu' || finalCategory === 'Belum Lapor Diri')
      ? '-'
      : (item.jalur_masuk || item.pathway || '-')

    return {
      id: item.id,
      name: item.nama_lengkap || item.name || '',
      nis: item.nis || '-',
      // Proteksi Privasi: NISN alumni HANYA terbuka untuk Admin Guru BK
      nisn: isAdmin ? (item.nisn || '-') : '-',
      classRoom: item.kelas_terakhir || item.classRoom || '-',
      cohort: String(item.tahun_lulus || item.cohort || ''),
      // Proteksi Privasi: Nomor WhatsApp alumni HANYA terbuka untuk Admin Guru BK
      phone: isAdmin ? (item.no_wa || item.phone || '-') : '-',
      // Proteksi Privasi: Alamat Tempat Tinggal alumni HANYA terbuka untuk Admin Guru BK
      alamat_lengkap: isAdmin ? (item.alamat_lengkap || item.alamat || item.address || '-') : '-',
      category: finalCategory,
      pathway: finalPathway,
      institution: rawInst,
      major: finalMajor,
      message: item.pesan || item.message || '',
      photo: getOptimizedImageUrl(item.foto_url || item.photo || null),
      timestamp: item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) : 'Baru saja'
    }
  }

  // Mapping data siswa aktif Angkatan 61 ke format direktori alumni & manajemen
  function mapSiswaToAlumni(item) {
    const authStore = useAuthStore()
    const isAdmin = authStore.userRole === 'admin'

    return {
      id: item.id,
      name: item.nama || '',
      nis: item.nis || '-',
      nisn: isAdmin ? (item.nisn || '-') : '-',
      classRoom: item.kelas || '-',
      cohort: String(item.tahun_lulus || 2027),
      angkatan: item.angkatan || 61,
      // Proteksi Privasi: Nomor telepon siswa HANYA terbuka untuk Admin Guru BK
      phone: isAdmin ? (item.no_wa || '-') : '-',
      category: 'Siswa Aktif',
      pathway: 'Siswa',
      institution: 'SMA Negeri 2 Ngawi',
      major: `Siswa Aktif Kelas ${item.kelas || '-'}`,
      message: 'Siswa Aktif Angkatan 61 SMA Negeri 2 Ngawi.',
      photo: getOptimizedImageUrl(item.foto_url || null),
      timestamp: item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) : 'Baru saja',
      // Metadata siswa lengkap (HANYA tersedia untuk Guru BK, disembunyikan total dari publik)
      isSiswa: true,
      email: isAdmin ? (item.email || '-') : '-',
      ttl: isAdmin ? (item.ttl || '-') : '-',
      alamat_lengkap: isAdmin ? (item.alamat_lengkap || '-') : '-',
      jenis_tinggal: isAdmin ? (item.jenis_tinggal || '-') : '-',
      alat_transportasi: isAdmin ? (item.alat_transportasi || '-') : '-',
      nama_ortu: isAdmin ? (item.nama_ortu || '-') : '-',
      pekerjaan_ortu: isAdmin ? (item.pekerjaan_ortu || '-') : '-',
      no_wa_ortu: isAdmin ? (item.no_wa_ortu || '-') : '-',
      asal_smp: isAdmin ? (item.asal_smp || '-') : '-'
    }
  }

  // Mapping antrean pengajuan perubahan biodata siswa aktif
  function mapDbToStudentUpdate(item) {
    let parsed = {}
    try {
      parsed = typeof item.pesan === 'string' ? JSON.parse(item.pesan) : (item.pesan || {})
    } catch (e) {
      parsed = {}
    }

    return {
      id: item.id,
      nama: item.nama_lengkap || '',
      nis: item.nis || '-',
      kelas: item.kelas_terakhir || '-',
      tahun_lulus: item.tahun_lulus || 2027,
      no_wa: item.no_wa || '-',
      foto_url: item.foto_url || null,
      submittedAt: item.created_at ? new Date(item.created_at).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Baru saja',
      proposedData: {
        nama: item.nama_lengkap || '',
        nis: item.nis || '-',
        kelas: item.kelas_terakhir || '-',
        no_wa: item.no_wa || '',
        foto_url: item.foto_url || null,
        ...parsed
      }
    }
  }

  // Ambil Data dari Supabase (atau Local Storage jika belum connect)
  async function fetchData() {
    isLoading.value = true

    if (isSupabaseConfigured && supabase) {
      try {
        const authStore = useAuthStore()
        const isAdmin = authStore.userRole === 'admin'

        const queryColumns = 'id, nama_lengkap, nis, kelas_terakhir, tahun_lulus, kategori, jalur_masuk, instansi, jurusan_posisi, pesan, foto_url, created_at, is_verified'

        // 1. Ambil data alumni terverifikasi (746 alumni terdahulu)
        let verifiedData = null

        // Coba RPC get_public_alumni_directory terlebih dahulu (Bekerja untuk semua role & auto-evaluasi hak akses admin)
        try {
          const { data: rpcAlumni, error: errRpc } = await supabase.rpc('get_public_alumni_directory')
          if (!errRpc && rpcAlumni && rpcAlumni.length > 0) {
            verifiedData = rpcAlumni
          }
        } catch (e) {
          console.warn('RPC get_public_alumni_directory fallback:', e)
        }

        // Fallback jika RPC tidak tersedia / mengembalikan kosong
        if (!verifiedData || verifiedData.length === 0) {
          const { data: fallbackAlumni, error: errFallback } = await supabase
            .from('alumni')
            .select(queryColumns)
            .eq('is_verified', true)
            .order('created_at', { ascending: false })

          if (!errFallback && fallbackAlumni) {
            verifiedData = fallbackAlumni
          }
        }

        let listAlumni = (verifiedData || []).map(mapDbToAlumni)

        // Deduplikasi internal tabel alumni (mencegah double entry di tabel alumni itu sendiri)
        const normalizePersonName = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
        const seenAlumniKeys = new Set()
        listAlumni = listAlumni.filter(a => {
          const aNis = a.nis && a.nis !== '-' ? a.nis.trim() : ''
          const aName = normalizePersonName(a.name)
          const aClass = a.classRoom || ''
          const aCohort = a.cohort || ''
          // Jika punya NIS valid, gunakan NIS. Jika tidak punya, gunakan nama + angkatan + kelas
          const key = aNis ? `nis:${aNis}` : `name:${aName}:${aCohort}:${aClass}`
          if (seenAlumniKeys.has(key)) {
            return false
          }
          seenAlumniKeys.add(key)
          return true
        })

        // 2. Ambil data siswa angkatan 61 (397 siswa)
        let listSiswa = []
        try {
          let siswaData = null

          // Coba RPC get_public_students_directory
          try {
            const { data: rpcStudents, error: errRpcStudents } = await supabase.rpc('get_public_students_directory')
            if (!errRpcStudents && rpcStudents && rpcStudents.length > 0) {
              siswaData = rpcStudents
            }
          } catch (e) {
            console.warn('RPC get_public_students_directory fallback:', e)
          }

          // Fallback jika RPC siswa tidak tersedia
          if (!siswaData || siswaData.length === 0) {
            const studentCols = isAdmin
              ? 'id, nama, email, role, nis, nisn, kelas, angkatan, tahun_lulus, no_wa, ttl, alamat_lengkap, jenis_tinggal, alat_transportasi, nama_ortu, pekerjaan_ortu, no_wa_ortu, asal_smp, created_at, foto_url'
              : 'id, nama, role, nis, kelas, angkatan, tahun_lulus, created_at, foto_url'
            const { data: fallbackData } = await supabase
              .from('users')
              .select(studentCols)
              .eq('role', 'siswa')
              .order('nama', { ascending: true })
            if (fallbackData && fallbackData.length > 0) {
              siswaData = fallbackData
            }
          }

          if (siswaData) {
            // Deduplikasi komprehensif: jangan masukkan siswa jika sudah tercatat / dilaporkan di alumni
            const existingNisSet = new Set(listAlumni.map(a => a.nis && a.nis !== '-' ? a.nis.trim() : null).filter(Boolean))
            const existingNisnSet = new Set(listAlumni.map(a => a.nisn && a.nisn !== '-' ? a.nisn.trim() : null).filter(Boolean))
            const existingNameSet = new Set(listAlumni.map(a => normalizePersonName(a.name)).filter(Boolean))
            const existingIdSet = new Set(listAlumni.map(a => String(a.id)).filter(Boolean))

            listSiswa = siswaData
              .filter(s => {
                const sId = String(s.id)
                const sNis = s.nis && s.nis !== '-' ? s.nis.trim() : ''
                const sNisn = s.nisn && s.nisn !== '-' ? s.nisn.trim() : ''
                const sName = normalizePersonName(s.nama)

                const isAlreadyInAlumni =
                  existingIdSet.has(sId) ||
                  (sNis && existingNisSet.has(sNis)) ||
                  (sNisn && existingNisnSet.has(sNisn)) ||
                  (sName && existingNameSet.has(sName))

                return !isAlreadyInAlumni
              })
              .map(mapSiswaToAlumni)
          }
        } catch (errSiswa) {
          console.warn('Gagal memuat siswa ke direktori:', errSiswa)
        }

        // Gabungkan: Alumni terdahulu + Siswa Aktif Angkatan 61 (Bersih dari duplikat)
        alumniList.value = [...listAlumni, ...listSiswa]

        // 3. Antrean pending: HANYA diambil jika pengguna terbukti Admin Guru BK!
        if (isAdmin) {
          const { data: pendingData, error: errPending } = await supabase
            .from('alumni')
            .select(queryColumns)
            .eq('is_verified', false)
            .order('created_at', { ascending: false })

          if (!errPending && pendingData) {
            const alumniPending = pendingData.filter((p) => p.kategori !== 'Update Biodata Siswa')
            const studentPending = pendingData.filter((p) => p.kategori === 'Update Biodata Siswa')

            pendingList.value = alumniPending.map(mapDbToAlumni)
            pendingStudentUpdates.value = studentPending.map(mapDbToStudentUpdate)
          }
        } else {
          pendingList.value = []
          pendingStudentUpdates.value = []
        }

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

        const storedStudentPending = localStorage.getItem(PENDING_STUDENTS_STORAGE_KEY)
        pendingStudentUpdates.value = storedStudentPending ? JSON.parse(storedStudentPending) : []
      } catch (e) {
        alumniList.value = []
        pendingList.value = []
        pendingStudentUpdates.value = []
      }
    }

    isLoading.value = false
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alumniList.value))
      localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pendingList.value))
      localStorage.setItem(PENDING_STUDENTS_STORAGE_KEY, JSON.stringify(pendingStudentUpdates.value))
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
      if (selectedCategory.value === 'Belum Lapor Diri' || selectedCategory.value === 'Masa Tunggu') {
        result = result.filter(item => item.category === 'Belum Lapor Diri' || item.category === 'Masa Tunggu')
      } else {
        result = result.filter(item => item.category === selectedCategory.value)
      }
    }

    if (searchQuery.value.trim() !== '') {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter(item => 
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.nis && item.nis.toLowerCase().includes(q)) ||
        (item.institution && item.institution.toLowerCase().includes(q)) ||
        (item.major && item.major !== '-' && item.major.toLowerCase().includes(q)) ||
        (item.classRoom && item.classRoom.toLowerCase().includes(q)) ||
        (item.category !== 'Masa Tunggu' && item.category !== 'Belum Lapor Diri' && item.pathway && item.pathway !== '-' && item.pathway.toLowerCase().includes(q))
      )
    }

    return result
  })

  // Statistics (Khusus Data Alumni Lulusan - Siswa Aktif Tidak Masuk ke Statistik Tracer Study)
  const statistics = computed(() => {
    // Saring hanya alumni yang sudah lulus (keluarkan siswa aktif angkatan 61 / 2027)
    const onlyAlumni = alumniList.value.filter((a) => {
      if (a.category === 'Siswa Aktif' || a.isSiswa) return false
      if (String(a.cohort) === '2027') return false
      const inst = String(a.institution || '').toLowerCase()
      if (inst.includes('sma negeri 2 ngawi') || inst.includes('sman 2 ngawi')) return false
      return true
    })

    const total = onlyAlumni.length
    const ptnCount = onlyAlumni.filter(a => a.category === 'PTN').length
    const ptsCount = onlyAlumni.filter(a => a.category === 'PTS').length
    const kedinasanCount = onlyAlumni.filter(a => a.category === 'Kedinasan').length
    const tniPolriCount = onlyAlumni.filter(a => a.category === 'TNI/Polri').length
    const kerjaCount = onlyAlumni.filter(a => a.category === 'Bekerja').length
    const wirausahaCount = onlyAlumni.filter(a => a.category === 'Wirausaha').length
    const pelatihanCount = onlyAlumni.filter(a => a.category === 'Pelatihan / LPK').length
    const masaTungguCount = onlyAlumni.filter(a => a.category === 'Masa Tunggu' || a.category === 'Belum Lapor Diri').length

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
      belumLaporCount: masaTungguCount,
      pendingCount: pendingList.value.length
    }
  })

  // Submit Alumni Self-Report (Alumni Form) -> goes into pending queue
  async function submitLaporDiri(form) {
    const authStore = useAuthStore()

    const cleanName = (form.name || '').trim().slice(0, 150)
    const cleanInst = (form.institution || '').trim().slice(0, 150)
    const cleanMajor = (form.major || '').trim().slice(0, 150)
    const cleanMessage = (form.message || '').trim().slice(0, 1000)
    const cleanPhone = (form.phone || '').trim().replace(/[^0-9+]/g, '').slice(0, 20)

    if (!cleanName || !cleanInst) {
      return { success: false, message: 'Nama lengkap dan institusi/kampus wajib diisi.' }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          nama_lengkap: cleanName,
          nis: (form.nis && form.nis !== '-') ? String(form.nis).trim().slice(0, 30) : null,
          kelas_terakhir: form.classRoom || 'XII',
          tahun_lulus: parseInt(form.cohort) || 2026,
          no_wa: cleanPhone || null,
          kategori: form.category || 'PTN',
          jalur_masuk: form.pathway || 'SNBP',
          instansi: cleanInst,
          jurusan_posisi: cleanMajor || '-',
          pesan: cleanMessage || null,
          foto_url: form.photo || null,
          is_verified: false
        }

        // 1. Prioritaskan Server-Side RPC (Input validation & server-enforced is_verified = false)
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('submit_lapor_diri', { p_data: payload })
          if (!rpcErr && rpcRes && rpcRes.success) {
            payload.id = rpcRes.id
            pendingList.value.unshift(mapDbToAlumni(payload))
            return { success: true, message: rpcRes.message }
          }
        } catch (e) {
          console.warn('RPC submit_lapor_diri fallback:', e)
        }

        // 2. Direct insert fallback
        let { data, error } = await supabase
          .from('alumni')
          .insert(payload)
          .select()
          .single()

        // Fallback jika kolom foto_url atau nis belum dibuat di database Supabase
        if (error && (error.message.includes('foto_url') || error.message.includes('nis'))) {
          if (error.message.includes('foto_url')) delete payload.foto_url
          if (error.message.includes('nis')) delete payload.nis
          const retry = await supabase.from('alumni').insert(payload).select().single()
          data = retry.data
          error = retry.error
        }

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
        nis: form.nis || '-',
        classRoom: form.classRoom,
        cohort: form.cohort,
        phone: form.phone,
        category: form.category,
        pathway: form.pathway,
        institution: form.institution,
        major: form.major,
        message: form.message,
        photo: form.photo || null,
        timestamp: 'Baru saja diajukan'
      }

      pendingList.value.unshift(newPending)
      saveToLocalStorage()
      return { success: true }
    }
  }

  // Admin Actions: Approve (ACC)
  async function approvePending(id) {
    const authStore = useAuthStore()
    if (authStore.userRole !== 'admin') {
      console.error('[SECURITY VIOLATION] Akses ditolak: Hanya Guru BK (Admin) yang dapat menyetujui laporan.')
      return false
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Coba Server-Side RPC
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_approve_alumni', { p_id: id })
          if (!rpcErr && rpcRes && rpcRes.success) {
            await fetchData()
            return true
          }
        } catch (e) {
          console.warn('RPC admin_approve_alumni fallback:', e)
        }

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
    const authStore = useAuthStore()
    if (authStore.userRole !== 'admin') {
      console.error('[SECURITY VIOLATION] Akses ditolak: Hanya Guru BK (Admin) yang dapat menolak laporan.')
      return false
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Coba Server-Side RPC
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_reject_alumni', { p_id: id })
          if (!rpcErr && rpcRes && rpcRes.success) {
            await fetchData()
            return true
          }
        } catch (e) {
          console.warn('RPC admin_reject_alumni fallback:', e)
        }

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

  // Helper: Cek apakah siswa tertentu memiliki pengajuan biodata yang menunggu ACC
  function checkStudentPendingStatus(nis) {
    if (!nis || nis === '-') return null
    return pendingStudentUpdates.value.find((p) => String(p.nis) === String(nis)) || null
  }

  // Aksi Siswa: Simpan / Perbarui Pengajuan Biodata (Tidak langsung tersimpan ke users, menunggu ACC Guru BK)
  // Menjaga agar tidak terjadi data ganda (update baris yang ada jika siswa edit berkali-kali)
  async function submitStudentUpdate(fields) {
    const authStore = useAuthStore()
    const currentNis = String(fields.nis || authStore.currentUser?.nis || authStore.userNis || '')
    const currentNama = fields.nama || authStore.currentUser?.nama || authStore.userName || 'Siswa'
    const currentKelas = fields.kelas || authStore.currentUser?.kelas || 'XI-1'
    const currentCohort = parseInt(authStore.currentUser?.tahun_lulus || 2027)

    const extraFields = {
      ttl: fields.ttl || null,
      alamat_lengkap: fields.alamat_lengkap || null,
      jenis_tinggal: fields.jenis_tinggal || null,
      alat_transportasi: fields.alat_transportasi || null,
      no_wa: fields.no_wa || null,
      email: fields.email || null,
      nama_ortu: fields.nama_ortu || null,
      pekerjaan_ortu: fields.pekerjaan_ortu || null,
      no_wa_ortu: fields.no_wa_ortu || null,
      asal_smp: fields.asal_smp || null,
      userId: authStore.currentUser?.id || null
    }

    const payload = {
      nama_lengkap: currentNama,
      nis: currentNis,
      kelas_terakhir: currentKelas,
      tahun_lulus: currentCohort,
      no_wa: fields.no_wa || null,
      kategori: 'Update Biodata Siswa',
      jalur_masuk: 'Siswa Aktif',
      instansi: 'SMA Negeri 2 Ngawi',
      jurusan_posisi: 'Pengajuan Biodata Siswa',
      pesan: JSON.stringify(extraFields),
      foto_url: fields.foto_url || null,
      is_verified: false,
      updated_at: new Date().toISOString()
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Cek apakah siswa ini sudah memiliki pengajuan pending sebelumnya (agar tidak duplikat!)
        const { data: existing } = await supabase
          .from('alumni')
          .select('id')
          .eq('nis', currentNis)
          .eq('kategori', 'Update Biodata Siswa')
          .eq('is_verified', false)
          .maybeSingle()

        let resData = null
        if (existing && existing.id) {
          // Update baris pengajuan yang sudah ada dengan data terbaru
          const { data, error } = await supabase
            .from('alumni')
            .update(payload)
            .eq('id', existing.id)
            .select()
            .single()
          if (error) throw error
          resData = data
        } else {
          // Buat pengajuan baru
          const { data, error } = await supabase
            .from('alumni')
            .insert(payload)
            .select()
            .single()
          if (error) throw error
          resData = data
        }

        await fetchData()
        return {
          success: true,
          message: 'Pengajuan perubahan biodata berhasil dikirim dan menunggu verifikasi Guru BK.',
          data: mapDbToStudentUpdate(resData)
        }
      } catch (err) {
        console.error('Error simpan pengajuan biodata siswa:', err)
        return { success: false, message: 'Gagal mengirim pengajuan: ' + err.message }
      }
    } else {
      // Local storage fallback
      const idx = pendingStudentUpdates.value.findIndex((p) => String(p.nis) === String(currentNis))
      const mockItem = {
        id: idx !== -1 ? pendingStudentUpdates.value[idx].id : 'STU-' + Date.now(),
        nama: currentNama,
        nis: currentNis,
        kelas: currentKelas,
        tahun_lulus: currentCohort,
        no_wa: fields.no_wa || null,
        foto_url: fields.foto_url || null,
        submittedAt: 'Baru saja',
        proposedData: {
          nama: currentNama,
          nis: currentNis,
          kelas: currentKelas,
          ...extraFields,
          foto_url: fields.foto_url || null
        }
      }

      if (idx !== -1) {
        pendingStudentUpdates.value[idx] = mockItem
      } else {
        pendingStudentUpdates.value.unshift(mockItem)
      }

      saveToLocalStorage()
      return {
        success: true,
        message: 'Pengajuan perubahan biodata berhasil disimpan (mode offline).',
        data: mockItem
      }
    }
  }

  // Aksi Guru BK: Setujui (ACC) Pengajuan Biodata Siswa
  async function approveStudentUpdate(updateItem) {
    const authStore = useAuthStore()
    if (authStore.userRole !== 'admin') {
      return { success: false, message: 'Akses ditolak: Hanya Guru BK (Admin) yang dapat menyetujui pembaruan biodata siswa.' }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Coba Server-Side Atomic RPC (Validasi hak akses admin & update dalam 1 transaksi)
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_approve_student_update', { p_update_id: updateItem.id })
          if (!rpcErr && rpcRes && rpcRes.success) {
            await fetchData()
            return { success: true, message: rpcRes.message }
          }
        } catch (e) {
          console.warn('RPC admin_approve_student_update fallback:', e)
        }

        const p = updateItem.proposedData || {}
        const userPayload = {
          ttl: p.ttl || null,
          alamat_lengkap: p.alamat_lengkap || null,
          jenis_tinggal: p.jenis_tinggal || null,
          alat_transportasi: p.alat_transportasi || null,
          no_wa: p.no_wa || null,
          email: p.email || null,
          nama_ortu: p.nama_ortu || null,
          pekerjaan_ortu: p.pekerjaan_ortu || null,
          no_wa_ortu: p.no_wa_ortu || null,
          asal_smp: p.asal_smp || null,
          updated_at: new Date().toISOString()
        }
        if (p.foto_url) userPayload.foto_url = p.foto_url

        // Update data di tabel users
        let updateQuery = supabase.from('users').update(userPayload)
        if (p.userId) {
          updateQuery = updateQuery.eq('id', p.userId)
        } else if (updateItem.nis && updateItem.nis !== '-') {
          updateQuery = updateQuery.eq('nis', updateItem.nis)
        } else {
          updateQuery = updateQuery.eq('nama', updateItem.nama)
        }

        const { error: errUser } = await updateQuery
        if (errUser) {
          console.warn('Gagal update users via id, coba via NIS:', errUser)
          await supabase.from('users').update(userPayload).eq('nis', updateItem.nis)
        }

        // Hapus antrean verifikasi dari tabel alumni agar tidak menumpuk
        await supabase.from('alumni').delete().eq('id', updateItem.id)

        await fetchData()
        return { success: true, message: `Biodata ${updateItem.nama} berhasil disetujui (ACC)!` }
      } catch (err) {
        console.error('Gagal ACC biodata siswa:', err)
        return { success: false, message: 'Gagal menyetujui biodata: ' + err.message }
      }
    } else {
      // Local fallback
      const idx = pendingStudentUpdates.value.findIndex((p) => p.id === updateItem.id)
      if (idx !== -1) {
        pendingStudentUpdates.value.splice(idx, 1)
        saveToLocalStorage()
      }
      return { success: true, message: `Biodata ${updateItem.nama} berhasil disetujui!` }
    }
  }

  // Aksi Guru BK: Tolak Pengajuan Biodata Siswa
  async function rejectStudentUpdate(id, name = 'Siswa') {
    const authStore = useAuthStore()
    if (authStore.userRole !== 'admin') {
      return { success: false, message: 'Akses ditolak: Hanya Guru BK (Admin) yang dapat menolak pembaruan biodata siswa.' }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Coba Server-Side RPC
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_reject_alumni', { p_id: id })
          if (!rpcErr && rpcRes && rpcRes.success) {
            await fetchData()
            return { success: true, message: `Pengajuan perubahan biodata ${name} berhasil ditolak.` }
          }
        } catch (e) {
          console.warn('RPC admin_reject_alumni fallback:', e)
        }

        const { error } = await supabase.from('alumni').delete().eq('id', id)
        if (error) throw error
        await fetchData()
        return { success: true, message: `Pengajuan perubahan biodata ${name} berhasil ditolak.` }
      } catch (err) {
        console.error('Gagal menolak biodata siswa:', err)
        return { success: false, message: 'Gagal menolak pengajuan: ' + err.message }
      }
    } else {
      const idx = pendingStudentUpdates.value.findIndex((p) => p.id === id)
      if (idx !== -1) {
        pendingStudentUpdates.value.splice(idx, 1)
        saveToLocalStorage()
      }
      return { success: true, message: `Pengajuan perubahan biodata ${name} ditolak.` }
    }
  }

  // Excel Export (.xlsx) - KHUSUS GURU BK (PENGELOLA)
  async function exportExcel() {
    const authStore = useAuthStore()

    // 1. Cek hak akses role lokal
    if (authStore.userRole !== 'admin') {
      alert('Akses Ditolak: Fitur Ekspor Data Alumni hanya dapat diakses oleh Guru BK (Pengelola).')
      return
    }

    // 2. Validasi wewenang langsung ke server database via RPC is_admin()
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: isServerAdmin } = await supabase.rpc('is_admin')
        if (!isServerAdmin) {
          alert('Akses Ditolak: Sesi Anda bukan Admin Guru BK yang sah.')
          return
        }
      } catch (e) {
        alert('Akses Ditolak: Gagal memvalidasi wewenang keamanan di database.')
        return
      }
    }

    if (alumniList.value.length === 0) {
      alert('Belum ada data alumni untuk diekspor.')
      return
    }

    const exportData = alumniList.value.map((item, index) => ({
      'No': index + 1,
      'ID Alumni': item.id,
      'NIS': item.nis || '-',
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
    const authStore = useAuthStore()
    if (authStore.userRole !== 'admin') {
      console.error('[SECURITY VIOLATION] Akses ditolak: Hanya Guru BK (Admin) yang dapat melakukan import data.')
      return 0
    }

    if (!Array.isArray(rows) || rows.length === 0) return 0

    if (isSupabaseConfigured && supabase) {
      // 1. Coba Server-Side RPC untuk Bulk Import dengan validasi wewenang admin
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_bulk_import_alumni', { p_records: rows })
        if (!rpcErr && rpcRes && rpcRes.success) {
          await fetchData()
          return rpcRes.count || rows.length
        }
      } catch (e) {
        console.warn('RPC admin_bulk_import_alumni fallback:', e)
      }

      const records = rows.map(r => ({
        nama_lengkap: r.name,
        nis: r.nis || null,
        kelas_terakhir: r.classRoom || 'XII-1',
        tahun_lulus: parseInt(r.cohort) || 2026,
        no_wa: r.phone || null,
        kategori: r.category || 'PTN',
        jalur_masuk: (r.category === 'Masa Tunggu' || r.category === 'Belum Lapor Diri') ? '-' : (r.pathway || 'SNBP'),
        instansi: r.institution,
        jurusan_posisi: r.major || null,
        pesan: r.message || null,
        is_verified: true
      }))

      try {
        const CHUNK_SIZE = 100
        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
          const chunk = records.slice(i, i + CHUNK_SIZE)
          let { error } = await supabase.from('alumni').insert(chunk)
          if (error && error.message.includes('nis')) {
            const fallbackChunk = chunk.map(rec => {
              const copy = { ...rec }
              delete copy.nis
              return copy
            })
            const retry = await supabase.from('alumni').insert(fallbackChunk)
            error = retry.error
          }
          if (error) throw error
        }
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
            nis: r.nis || '-',
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

  // Admin Action: Tambah Alumni Manual (Langsung Terverifikasi)
  async function addAlumni(form) {
    const authStore = useAuthStore()
    if (authStore.userRole !== 'admin') {
      return { success: false, message: 'Akses ditolak: Hanya Guru BK (Admin) yang dapat menambahkan data alumni secara langsung.' }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = {
          nama_lengkap: form.name,
          nis: form.nis || null,
          kelas_terakhir: form.classRoom,
          tahun_lulus: parseInt(form.cohort) || 2026,
          no_wa: form.phone || null,
          kategori: form.category,
          jalur_masuk: form.pathway,
          instansi: form.institution,
          jurusan_posisi: form.major,
          pesan: form.message || null,
          foto_url: form.photo || null,
          is_verified: true
        }

        let { data, error } = await supabase
          .from('alumni')
          .insert(payload)
          .select()
          .single()

        if (error && (error.message.includes('foto_url') || error.message.includes('nis'))) {
          if (error.message.includes('foto_url')) delete payload.foto_url
          if (error.message.includes('nis')) delete payload.nis
          const retry = await supabase.from('alumni').insert(payload).select().single()
          data = retry.data
          error = retry.error
        }

        if (error) throw error

        alumniList.value.unshift(mapDbToAlumni(data))
        return { success: true }
      } catch (err) {
        console.error('Error insert alumni:', err)
        return { success: false, message: err.message }
      }
    } else {
      const newAlumni = {
        id: 'ALUMNI-' + Date.now().toString().slice(-4),
        name: form.name,
        nis: form.nis || '-',
        classRoom: form.classRoom,
        cohort: String(form.cohort),
        phone: form.phone || '-',
        category: form.category,
        pathway: form.pathway,
        institution: form.institution,
        major: form.major,
        message: form.message || '',
        photo: form.photo || null,
        timestamp: 'Baru saja ditambahkan'
      }
      alumniList.value.unshift(newAlumni)
      saveToLocalStorage()
      return { success: true }
    }
  }

  // Admin Action: Update Biodata Lengkap Siswa / Alumni
  async function adminUpdateStudentOrAlumni(id, form) {
    const authStore = useAuthStore()
    if (authStore.userRole !== 'admin') {
      return { success: false, message: 'Akses ditolak: Hanya Guru BK (Admin) yang dapat memperbarui biodata ini.' }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        let updatedInUsers = false
        let updatedInAlumni = false

        // 1. Siapkan payload pembaruan untuk tabel users (jika akun siswa)
        const userPayload = {
          nama: form.name,
          nis: form.nis && form.nis !== '-' ? form.nis.trim() : null,
          nisn: form.nisn && form.nisn !== '-' ? form.nisn.trim() : null,
          kelas: form.classRoom && form.classRoom !== '-' ? form.classRoom : null,
          tahun_lulus: form.cohort ? parseInt(form.cohort) : 2027,
          angkatan: form.angkatan ? parseInt(form.angkatan) : 61,
          no_wa: form.phone && form.phone !== '-' ? form.phone.trim() : null,
          email: form.email && form.email !== '-' ? form.email.trim() : null,
          ttl: form.ttl && form.ttl !== '-' ? form.ttl.trim() : null,
          alamat_lengkap: form.alamat_lengkap && form.alamat_lengkap !== '-' ? form.alamat_lengkap.trim() : null,
          jenis_tinggal: form.jenis_tinggal && form.jenis_tinggal !== '-' ? form.jenis_tinggal : null,
          alat_transportasi: form.alat_transportasi && form.alat_transportasi !== '-' ? form.alat_transportasi : null,
          nama_ortu: form.nama_ortu && form.nama_ortu !== '-' ? form.nama_ortu.trim() : null,
          pekerjaan_ortu: form.pekerjaan_ortu && form.pekerjaan_ortu !== '-' ? form.pekerjaan_ortu.trim() : null,
          no_wa_ortu: form.no_wa_ortu && form.no_wa_ortu !== '-' ? form.no_wa_ortu.trim() : null,
          asal_smp: form.asal_smp && form.asal_smp !== '-' ? form.asal_smp.trim() : null,
          foto_url: form.photo !== undefined ? (form.photo || null) : null,
          updated_at: new Date().toISOString()
        }

        // Jika admin memasukkan kata sandi baru untuk akun siswa, reset secara aman via server-side Bcrypt RPC
        if (form.newPassword && form.newPassword.trim()) {
          try {
            await supabase.rpc('admin_reset_user_password', {
              p_user_id: id,
              p_new_password: form.newPassword.trim()
            })
          } catch (e) {
            console.warn('RPC admin_reset_user_password fallback:', e)
          }
        }

        // Coba perbarui di tabel users berdasarkan ID
        let resUser = await supabase.from('users').update(userPayload).eq('id', id)
        if (resUser.error && (resUser.error.code === '42703' || resUser.error.message?.includes('foto_url'))) {
          delete userPayload.foto_url
          resUser = await supabase.from('users').update(userPayload).eq('id', id)
        }

        if (!resUser.error && resUser.status < 300) {
          updatedInUsers = true
        } else if (form.nis && form.nis !== '-') {
          // Fallback perbarui users berdasarkan NIS
          const resUserByNis = await supabase.from('users').update(userPayload).eq('nis', form.nis.trim())
          if (!resUserByNis.error && resUserByNis.status < 300) {
            updatedInUsers = true
          }
        }

        // 2. Siapkan payload pembaruan untuk tabel alumni
        const targetNis = form.nis && form.nis !== '-' ? form.nis.trim() : null
        const normFormName = (form.name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()

        const alumniPayload = {
          nama_lengkap: form.name.trim(),
          nis: targetNis,
          nisn: form.nisn && form.nisn !== '-' ? form.nisn.trim() : null,
          alamat_lengkap: form.alamat_lengkap && form.alamat_lengkap !== '-' ? form.alamat_lengkap.trim() : null,
          kelas_terakhir: form.classRoom && form.classRoom !== '-' ? form.classRoom : null,
          tahun_lulus: form.cohort ? parseInt(form.cohort) : 2027,
          no_wa: form.phone && form.phone !== '-' ? form.phone.trim() : null,
          kategori: form.category || 'PTN',
          jalur_masuk: (form.category === 'Masa Tunggu' || form.category === 'Belum Lapor Diri') ? '-' : (form.pathway && form.pathway !== '-' ? form.pathway : null),
          instansi: form.institution && form.institution !== '-' ? form.institution.trim() : null,
          jurusan_posisi: form.major && form.major !== '-' ? form.major.trim() : null,
          pesan: form.message || null,
          foto_url: form.photo !== undefined ? (form.photo || null) : null,
          updated_at: new Date().toISOString()
        }

        // Cari row alumni yang sudah ada (berdasarkan ID, NIS, atau Nama Lengkap)
        let existingAlumniId = null
        let foundAlumni = alumniList.value.find(a =>
          (!a.isSiswa && String(a.id) === String(id)) ||
          (targetNis && !a.isSiswa && a.nis && a.nis !== '-' && a.nis.trim() === targetNis) ||
          (!a.isSiswa && normFormName && (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim() === normFormName)
        )

        if (!foundAlumni) {
          try {
            const { data: dir } = await supabase.rpc('get_public_alumni_directory')
            if (dir && dir.length > 0) {
              foundAlumni = dir.find(a =>
                String(a.id) === String(id) ||
                (targetNis && a.nis && a.nis !== '-' && a.nis.trim() === targetNis) ||
                (normFormName && (a.nama_lengkap || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim() === normFormName)
              )
            }
          } catch (e) {
            console.warn('RPC check fallback in adminUpdateStudentOrAlumni:', e)
          }
        }

        if (foundAlumni) {
          existingAlumniId = foundAlumni.id
        }

        if (existingAlumniId) {
          // KASUS A: Record alumni SUDAH ADA
          if (form.category === 'Siswa Aktif') {
            // Jika kategori diubah kembali menjadi Siswa Aktif:
            // Hapus dari alumni agar tidak ada duplikasi data
            try {
              await supabase.rpc('admin_delete_alumni', { p_id: existingAlumniId })
            } catch (delErr) {
              console.warn('Gagal menghapus alumni saat dikembalikan ke Siswa Aktif:', delErr)
            }
            updatedInAlumni = true
          } else {
            // Update row alumni yang ada (TANPA .select() agar tidak memicu 42501 RLS error!)
            const resAlumni = await supabase.from('alumni').update(alumniPayload).eq('id', existingAlumniId)
            if (!resAlumni.error) {
              updatedInAlumni = true
            } else {
              console.warn('Gagal update alumni:', resAlumni.error)
            }
          }
        } else {
          // KASUS B: Record alumni BELUM ADA
          // Siswa baru pertama kali lapor kuliah/karir (kategori bukan 'Siswa Aktif' dan ada instansi)
          if (form.category && form.category !== 'Siswa Aktif' && form.institution) {
            try {
              const insertPayload = {
                nama_lengkap: form.name.trim(),
                nis: targetNis,
                kelas_terakhir: form.classRoom || 'XII',
                tahun_lulus: form.cohort ? parseInt(form.cohort) : 2027,
                no_wa: form.phone && form.phone !== '-' ? form.phone.trim() : null,
                kategori: form.category,
                jalur_masuk: (form.category === 'Masa Tunggu' || form.category === 'Belum Lapor Diri') ? '-' : (form.pathway || 'SNBP'),
                instansi: form.institution.trim(),
                jurusan_posisi: form.major || null,
                pesan: form.message || null,
                foto_url: form.photo || null,
                is_verified: true
              }
              await supabase.from('alumni').insert(insertPayload)
              updatedInAlumni = true
            } catch (e) {
              console.warn('Gagal insert ke alumni:', e)
            }
          }
        }

        // Ambil data terbaru
        await fetchData()
        return { success: true, message: `Biodata "${form.name}" berhasil disimpan!` }
      } catch (err) {
        console.error('Error saat update biodata siswa/alumni:', err)
        return { success: false, message: 'Gagal memperbarui data: ' + err.message }
      }
    } else {
      // LocalStorage mode
      const idx = alumniList.value.findIndex(a => a.id === id || (a.nis && a.nis === form.nis))
      if (idx !== -1) {
        alumniList.value[idx] = {
          ...alumniList.value[idx],
          name: form.name,
          nis: form.nis || '-',
          nisn: form.nisn || alumniList.value[idx].nisn || '-',
          classRoom: form.classRoom || '-',
          cohort: String(form.cohort || '2027'),
          angkatan: form.angkatan || alumniList.value[idx].angkatan || 61,
          phone: form.phone || '-',
          email: form.email || alumniList.value[idx].email || '-',
          ttl: form.ttl || alumniList.value[idx].ttl || '-',
          alamat_lengkap: form.alamat_lengkap || alumniList.value[idx].alamat_lengkap || '-',
          jenis_tinggal: form.jenis_tinggal || alumniList.value[idx].jenis_tinggal || '-',
          alat_transportasi: form.alat_transportasi || alumniList.value[idx].alat_transportasi || '-',
          nama_ortu: form.nama_ortu || alumniList.value[idx].nama_ortu || '-',
          pekerjaan_ortu: form.pekerjaan_ortu || alumniList.value[idx].pekerjaan_ortu || '-',
          no_wa_ortu: form.no_wa_ortu || alumniList.value[idx].no_wa_ortu || '-',
          asal_smp: form.asal_smp || alumniList.value[idx].asal_smp || '-',
          category: form.category || alumniList.value[idx].category || 'PTN',
          pathway: form.pathway || alumniList.value[idx].pathway || 'SNBP',
          institution: form.institution || alumniList.value[idx].institution || '-',
          major: form.major || alumniList.value[idx].major || '-',
          message: form.message || alumniList.value[idx].message || '',
          photo: form.photo !== undefined ? form.photo : alumniList.value[idx].photo
        }
        saveToLocalStorage()
        return { success: true, message: `Biodata "${form.name}" berhasil disimpan!` }
      }
      return { success: false, message: 'Data tidak ditemukan di memori lokal.' }
    }
  }

  // Admin Action: Update Alumni
  async function updateAlumni(id, form) {
    return await adminUpdateStudentOrAlumni(id, form)
  }

  // Admin Action: Hapus Alumni / Siswa
  async function deleteAlumni(id) {
    const authStore = useAuthStore()
    if (authStore.userRole !== 'admin') {
      return { success: false, message: 'Akses ditolak: Hanya Guru BK (Admin) yang dapat menghapus data.' }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Coba Server-Side RPC
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('admin_delete_alumni', { p_id: id })
          if (!rpcErr && rpcRes && rpcRes.success) {
            await fetchData()
            return { success: true }
          }
        } catch (e) {
          console.warn('RPC admin_delete_alumni fallback:', e)
        }

        const { error: errAlumni } = await supabase
          .from('alumni')
          .delete()
          .eq('id', id)

        const { error: errUsers } = await supabase
          .from('users')
          .delete()
          .eq('id', id)

        if (errAlumni && errUsers) {
          throw (errAlumni || errUsers)
        }

        await fetchData()
        return { success: true }
      } catch (err) {
        console.error('Error delete alumni/siswa:', err)
        return { success: false, message: err.message }
      }
    } else {
      const idx = alumniList.value.findIndex(a => a.id === id)
      if (idx !== -1) {
        alumniList.value.splice(idx, 1)
        saveToLocalStorage()
        return { success: true }
      }
      return { success: false, message: 'Data tidak ditemukan' }
    }
  }

  return {
    alumniList,
    pendingList,
    pendingStudentUpdates,
    totalPendingCount,
    isLoading,
    selectedCohort,
    selectedCategory,
    searchQuery,
    filteredAlumni,
    statistics,
    fetchData,
    submitLaporDiri,
    submitStudentUpdate,
    approveStudentUpdate,
    rejectStudentUpdate,
    checkStudentPendingStatus,
    addAlumni,
    updateAlumni,
    adminUpdateStudentOrAlumni,
    deleteAlumni,
    approvePending,
    rejectPending,
    exportExcel,
    importData
  }
})
