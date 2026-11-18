import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from './auth'
import { processAndUploadPhoto, isCloudinaryConfigured } from '@/lib/cloudinary'
import { getAllSnpmbPtn } from '@/lib/snpmbService'

// Bangun katalog PTN & Prodi yang sama persis dengan Tracer Study (145 PTN, 5.140 Prodi SNPMB)
const LOCAL_SNPMB_PTN = getAllSnpmbPtn()
  .map(p => ({
    id: String(p.id),
    code: String(p.kode || p.id),
    name: p.name,
    rawName: p.rawName || p.name,
    region: 'Nasional',
    category: p.category || 'PTN',
    is_akademik: Boolean(p.isAkademik),
    is_vokasi: Boolean(p.isVokasi),
    is_ptkin: Boolean(p.isPtkin),
    prodiCount: Array.isArray(p.prodi) ? p.prodi.length : 0,
    prodi: (p.prodi || []).map(pr => ({
      id: String(pr.id_prodi),
      university_id: String(p.id),
      code: String(pr.id_prodi),
      name: pr.nama,
      fullName: pr.fullName || `${pr.jenjang || 'S1'} ${pr.nama}`,
      degree: pr.jenjang || 'S1',
      quota: Number(pr.dayaTampung) || 0,
      portofolio: pr.portofolio || null
    }))
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'id'))

const LOCAL_PTN_BY_ID = new Map(LOCAL_SNPMB_PTN.map(p => [p.id, p]))

export const useEligibleStore = defineStore('eligible', () => {
  const currentAcademicYear = ref('2025/2026')
  const isLoading = ref(false)

  // State Siswa
  const myEligibleData = ref(null)
  const myChoices = ref([])
  const myGrades = ref([])
  const myCertificates = ref([])
  const isCheckingEligible = ref(true)

  // Master Data (langsung terisi dari katalog resmi SNPMB yang sama dengan Tracer Study)
  const masterSubjects = ref([])
  const universitiesList = ref([...LOCAL_SNPMB_PTN])
  const snpmbDbStats = ref({ universitiesCount: 0, majorsCount: 0, localUniversitiesCount: LOCAL_SNPMB_PTN.length, localMajorsCount: LOCAL_SNPMB_PTN.reduce((s, u) => s + u.prodiCount, 0) })

  // State Guru BK (Admin)
  const allEligibleStudents = ref([])
  const adminMatrixData = ref([])

  // Computed
  const isEligible = computed(() => Boolean(myEligibleData.value))
  const canEditGrades = computed(() => {
    return myEligibleData.value && myEligibleData.value.grade_status !== 'approved'
  })
  const canEditChoices = computed(() => {
    return myEligibleData.value && myEligibleData.value.choice_status !== 'approved'
  })

  // ----------------------------------------------------
  // SISWA ACTIONS
  // ----------------------------------------------------

  /**
   * Reset state eligible siswa saat logout atau ganti akun
   */
  function resetMyEligibleState() {
    myEligibleData.value = null
    myChoices.value = []
    myGrades.value = []
    myCertificates.value = []
    isCheckingEligible.value = false
  }

  /**
   * Cek status eligible siswa yang sedang login
   */
  async function checkMyEligibleStatus() {
    isCheckingEligible.value = true
    const authStore = useAuthStore()

    if (!authStore.isLoggedIn || !authStore.currentUser?.id || !isSupabaseConfigured || !supabase) {
      resetMyEligibleState()
      return null
    }

    try {
      let eligibleRecord = null

      // 1. Query langsung berdasarkan currentUser.id
      const { data, error } = await supabase
        .from('eligible_students')
        .select(`
          id,
          student_id,
          academic_year,
          has_seen_popup,
          choice_status,
          grade_status,
          overall_average,
          created_at
        `)
        .eq('student_id', authStore.currentUser.id)
        .eq('academic_year', currentAcademicYear.value)
        .maybeSingle()

      if (!error && data) {
        eligibleRecord = data
      } else {
        // 2. Fallback via RPC secure server-side (mencocokkan auth.uid() ATAU email JWT ke public.users)
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('get_my_eligible_status', {
            p_academic_year: currentAcademicYear.value
          })
          if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
            eligibleRecord = rpcData[0]
          } else if (!rpcErr && rpcData && !Array.isArray(rpcData) && rpcData.id) {
            eligibleRecord = rpcData
          }
        } catch (rpcCatch) {
          console.warn('RPC get_my_eligible_status fallback:', rpcCatch)
        }
      }

      myEligibleData.value = eligibleRecord
      if (eligibleRecord) {
        await Promise.all([
          fetchMyChoices(eligibleRecord.id),
          fetchMyGrades(eligibleRecord.id),
          fetchMyCertificates(eligibleRecord.student_id || authStore.currentUser.id)
        ])
      } else {
        myChoices.value = []
        myGrades.value = []
        myCertificates.value = []
      }
    } catch (e) {
      console.warn('Fail check eligible:', e)
      myEligibleData.value = null
    } finally {
      isCheckingEligible.value = false
    }

    return myEligibleData.value
  }

  /**
   * Tandai bahwa siswa sudah melihat pop-up ucapan selamat
   */
  async function markPopupSeen() {
    if (!myEligibleData.value?.id || !isSupabaseConfigured || !supabase) return
    try {
      await supabase
        .from('eligible_students')
        .update({ has_seen_popup: true, updated_at: new Date().toISOString() })
        .eq('id', myEligibleData.value.id)

      myEligibleData.value.has_seen_popup = true
    } catch (e) {
      console.warn('Gagal update popup seen:', e)
    }
  }

  /**
   * Ambil data pilihan 1 & 2 siswa
   */
  async function fetchMyChoices(eligibleStudentId) {
    if (!isSupabaseConfigured || !supabase) return []
    try {
      const { data } = await supabase
        .from('eligible_choices')
        .select(`
          id,
          priority,
          university_id,
          major_id,
          universities:university_id (id, name, code, region),
          majors:major_id (id, name, degree, quota, portofolio)
        `)
        .eq('eligible_student_id', eligibleStudentId)
        .order('priority', { ascending: true })

      myChoices.value = data || []
      return myChoices.value
    } catch (e) {
      console.warn('Error fetching choices:', e)
      return []
    }
  }

  /**
   * Ambil data nilai semester 1-5 siswa
   */
  async function fetchMyGrades(eligibleStudentId) {
    if (!isSupabaseConfigured || !supabase) return []
    try {
      const { data } = await supabase
        .from('eligible_grades')
        .select(`
          id,
          subject_id,
          sem_1,
          sem_2,
          sem_3,
          sem_4,
          sem_5,
          subject_average,
          subjects:subject_id (id, name, category)
        `)
        .eq('eligible_student_id', eligibleStudentId)

      myGrades.value = data || []
      return myGrades.value
    } catch (e) {
      console.warn('Error fetching grades:', e)
      return []
    }
  }

  /**
   * Ambil sertifikat prestasi siswa
   */
  async function fetchMyCertificates(studentId) {
    if (!isSupabaseConfigured || !supabase) return []
    try {
      const { data } = await supabase
        .from('student_certificates')
        .select('id, student_id, title, image_url, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      myCertificates.value = data || []
      return myCertificates.value
    } catch (e) {
      console.warn('Error fetching certificates:', e)
      return []
    }
  }

  /**
   * Deteksi bentrok lintas pilihan real-time
   */
  async function checkChoiceClash(uniId, majorId, currentEligibleId) {
    if (!isSupabaseConfigured || !supabase || !uniId || !majorId) {
      return { total: 0, names: [] }
    }
    try {
      const { data, error } = await supabase.rpc('check_choice_clash', {
        p_academic_year: currentAcademicYear.value,
        p_university_id: uniId,
        p_major_id: majorId,
        p_current_eligible_id: currentEligibleId || null
      })

      if (error || !data || data.length === 0) {
        return { total: 0, names: [] }
      }

      return {
        total: Number(data[0].total_clashes || 0),
        names: data[0].student_names || []
      }
    } catch (e) {
      console.warn('Error checking clash:', e)
      return { total: 0, names: [] }
    }
  }

  /**
   * Simpan atau update pilihan 1 & 2
   */
  async function saveChoices(p1, p2) {
    if (!myEligibleData.value?.id || !isSupabaseConfigured || !supabase) {
      return { success: false, message: 'Data eligible tidak ditemukan.' }
    }

    if (myEligibleData.value.choice_status === 'approved') {
      return { success: false, message: 'Pilihan sudah disetujui (ACC) oleh Guru BK dan terkunci.' }
    }

    try {
      isLoading.value = true
      const eligibleId = myEligibleData.value.id

      // 1. Simpan Pilihan 1 jika diisi
      if (p1?.university_id && p1?.major_id) {
        const { error: err1 } = await supabase
          .from('eligible_choices')
          .upsert(
            {
              eligible_student_id: eligibleId,
              priority: 1,
              university_id: String(p1.university_id),
              major_id: String(p1.major_id),
              updated_at: new Date().toISOString()
            },
            { onConflict: 'eligible_student_id,priority' }
          )
        if (err1) throw err1
      }

      // 2. Simpan Pilihan 2 jika diisi
      if (p2?.university_id && p2?.major_id) {
        const { error: err2 } = await supabase
          .from('eligible_choices')
          .upsert(
            {
              eligible_student_id: eligibleId,
              priority: 2,
              university_id: String(p2.university_id),
              major_id: String(p2.major_id),
              updated_at: new Date().toISOString()
            },
            { onConflict: 'eligible_student_id,priority' }
          )
        if (err2) throw err2
      } else if (p2?.remove) {
        // Hapus pilihan 2 jika dikosongkan
        const { error: errDel } = await supabase
          .from('eligible_choices')
          .delete()
          .eq('eligible_student_id', eligibleId)
          .eq('priority', 2)
        if (errDel) throw errDel
      }

      await fetchMyChoices(eligibleId)
      return { success: true, message: 'Pilihan jurusan berhasil disimpan!' }
    } catch (e) {
      if (e?.code === '23503' || String(e?.message || '').includes('foreign key')) {
        return {
          success: false,
          message: 'Katalog PTN & Prodi SNPMB belum disinkronkan ke database. Mohon hubungi Guru BK untuk menekan tombol "Sinkronisasi Data SNPMB" terlebih dahulu.'
        }
      }
      return { success: false, message: 'Gagal menyimpan pilihan: ' + e.message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Simpan tabel nilai rapor semester 1-5
   */
  async function saveGrades(gradesPayload) {
    if (!myEligibleData.value?.id || !isSupabaseConfigured || !supabase) {
      return { success: false, message: 'Data eligible tidak ditemukan.' }
    }

    if (myEligibleData.value.grade_status === 'approved') {
      return { success: false, message: 'Nilai sudah disetujui (ACC) oleh Guru BK dan terkunci.' }
    }

    try {
      isLoading.value = true
      const eligibleId = myEligibleData.value.id

      const toSafeInt = (v) => {
        const n = Math.trunc(Number(v) || 0)
        return Math.min(100, Math.max(0, n))
      }

      // Upsert semua baris nilai (bilangan bulat 0-100, tanpa minus & tanpa koma)
      for (const row of gradesPayload) {
        if (!row.subject_id) continue
        await supabase
          .from('eligible_grades')
          .upsert(
            {
              eligible_student_id: eligibleId,
              subject_id: row.subject_id,
              sem_1: toSafeInt(row.sem_1),
              sem_2: toSafeInt(row.sem_2),
              sem_3: toSafeInt(row.sem_3),
              sem_4: toSafeInt(row.sem_4),
              sem_5: toSafeInt(row.sem_5)
            },
            { onConflict: 'eligible_student_id,subject_id' }
          )
      }

      // Hitung rata-rata keseluruhan
      const refreshedGrades = await fetchMyGrades(eligibleId)
      if (refreshedGrades.length > 0) {
        const totalAvg = refreshedGrades.reduce((sum, g) => sum + (Number(g.subject_average) || 0), 0)
        const overallAvg = Number((totalAvg / refreshedGrades.length).toFixed(2))

        await supabase
          .from('eligible_students')
          .update({
            overall_average: overallAvg,
            updated_at: new Date().toISOString()
          })
          .eq('id', eligibleId)

        myEligibleData.value.overall_average = overallAvg
      }

      return { success: true, message: 'Nilai rapor berhasil disimpan!' }
    } catch (e) {
      return { success: false, message: 'Gagal menyimpan nilai: ' + e.message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Upload sertifikat prestasi
   */
  async function uploadCertificate(file, title) {
    const authStore = useAuthStore()
    if (!authStore.currentUser?.id || !isSupabaseConfigured || !supabase) {
      return { success: false, message: 'Sesi pengguna tidak valid.' }
    }

    try {
      isLoading.value = true
      let imageUrl = ''

      if (isCloudinaryConfigured()) {
        imageUrl = await processAndUploadPhoto(file)
      } else {
        return { success: false, message: 'Penyimpanan cloud Cloudinary belum dikonfigurasi.' }
      }

      const { data, error } = await supabase
        .from('student_certificates')
        .insert({
          student_id: myEligibleData.value?.student_id || authStore.currentUser.id,
          title: title.trim(),
          image_url: imageUrl
        })
        .select()
        .single()

      if (error) throw error

      myCertificates.value.unshift(data)
      return { success: true, message: 'Sertifikat prestasi berhasil diunggah!' }
    } catch (e) {
      return { success: false, message: 'Gagal mengunggah sertifikat: ' + e.message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Hapus sertifikat prestasi
   */
  async function deleteCertificate(certId) {
    if (!isSupabaseConfigured || !supabase) return { success: false }
    try {
      const { error } = await supabase
        .from('student_certificates')
        .delete()
        .eq('id', certId)

      if (error) throw error
      myCertificates.value = myCertificates.value.filter(c => c.id !== certId)
      return { success: true, message: 'Sertifikat berhasil dihapus.' }
    } catch (e) {
      return { success: false, message: 'Gagal menghapus sertifikat: ' + e.message }
    }
  }

  // ----------------------------------------------------
  // MASTER DATA ACTIONS (SUBJECTS & UNIVERSITIES)
  // ----------------------------------------------------

  async function fetchMasterSubjects() {
    if (!isSupabaseConfigured || !supabase) return []
    try {
      const { data } = await supabase
        .from('subjects')
        .select('*')
        .order('name', { ascending: true })

      masterSubjects.value = data || []
      return masterSubjects.value
    } catch (e) {
      console.warn('Error fetching subjects:', e)
      return []
    }
  }

  async function fetchSnpmbDbStats() {
    if (!isSupabaseConfigured || !supabase) return snpmbDbStats.value
    try {
      const [uRes, mRes] = await Promise.all([
        supabase.from('universities').select('id', { count: 'exact', head: true }),
        supabase.from('majors').select('id', { count: 'exact', head: true })
      ])
      if (uRes.error) console.warn('Error count universities:', uRes.error)
      if (mRes.error) console.warn('Error count majors:', mRes.error)

      snpmbDbStats.value = {
        ...snpmbDbStats.value,
        universitiesCount: typeof uRes.count === 'number' ? uRes.count : 0,
        majorsCount: typeof mRes.count === 'number' ? mRes.count : 0
      }
    } catch (e) {
      console.warn('Error fetching SNPMB DB stats:', e)
    }
    return snpmbDbStats.value
  }

  async function fetchUniversities() {
    // Selalu gunakan katalog lengkap 145 PTN resmi SNPMB yang sama persis dengan Tracer Study
    universitiesList.value = [...LOCAL_SNPMB_PTN]
    if (isSupabaseConfigured && supabase) {
      await fetchSnpmbDbStats()
    }
    return universitiesList.value
  }

  async function fetchMajorsByUniversity(uniId) {
    if (!uniId) return []
    const localUni = LOCAL_PTN_BY_ID.get(String(uniId))
    if (localUni && Array.isArray(localUni.prodi) && localUni.prodi.length > 0) {
      return [...localUni.prodi].sort((a, b) => a.name.localeCompare(b.name, 'id'))
    }
    if (!isSupabaseConfigured || !supabase) return []
    try {
      const { data } = await supabase
        .from('majors')
        .select('id, university_id, code, name, degree, quota, portofolio')
        .eq('university_id', String(uniId))
        .order('name', { ascending: true })

      return data || []
    } catch (e) {
      console.warn('Error fetching majors:', e)
      return []
    }
  }

  /**
   * Sinkronisasi seluruh 145 PTN & 5.140 Program Studi resmi SNPMB (sumber yang sama dengan Tracer Study)
   * ke tabel public.universities dan public.majors di Supabase (Khusus Guru BK / Admin).
   */
  async function syncSnpmbToDatabase(onProgress = null) {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, message: 'Koneksi Supabase belum terkonfigurasi.' }
    }

    try {
      if (onProgress) onProgress('Memverifikasi hak akses Admin Guru BK...')
      const { data: isServerAdmin, error: adminErr } = await supabase.rpc('is_admin')
      if (adminErr || !isServerAdmin) {
        return {
          success: false,
          message: 'Sesi Anda belum terverifikasi sebagai Admin Guru BK. Silakan login ulang sebagai Admin.'
        }
      }

      if (onProgress) onProgress(`Menyinkronkan ${LOCAL_SNPMB_PTN.length} PTN resmi SNPMB ke Supabase...`)

      // 1. Upsert seluruh 145 PTN ke public.universities
      const uniRows = LOCAL_SNPMB_PTN.map(u => ({
        id: u.id,
        code: u.code,
        name: u.name,
        region: u.region,
        category: u.category,
        is_akademik: u.is_akademik,
        is_vokasi: u.is_vokasi,
        is_ptkin: u.is_ptkin
      }))

      const { error: uniErr } = await supabase
        .from('universities')
        .upsert(uniRows, { onConflict: 'id' })

      if (uniErr) throw uniErr

      // 2. Kumpulkan seluruh Program Studi (~5.140 prodi) lalu upsert dalam batch 400 baris
      const allMajorRows = []
      for (const u of LOCAL_SNPMB_PTN) {
        for (const m of u.prodi) {
          allMajorRows.push({
            id: m.id,
            university_id: u.id,
            code: m.code,
            name: m.name,
            degree: m.degree,
            quota: m.quota,
            portofolio: m.portofolio
          })
        }
      }

      const BATCH_SIZE = 400
      for (let i = 0; i < allMajorRows.length; i += BATCH_SIZE) {
        const chunk = allMajorRows.slice(i, i + BATCH_SIZE)
        const done = Math.min(i + chunk.length, allMajorRows.length)
        if (onProgress) {
          onProgress(`Menyinkronkan Program Studi (${done} / ${allMajorRows.length})...`)
        }
        const { error: majErr } = await supabase
          .from('majors')
          .upsert(chunk, { onConflict: 'id' })
        if (majErr) throw majErr
      }

      const stats = await fetchSnpmbDbStats()
      if (stats.universitiesCount === 0 || stats.majorsCount === 0) {
        return {
          success: false,
          message: 'Sinkronisasi selesai namun database masih menunjukkan 0 data. Pastikan kebijakan RLS Admin pada tabel universities & majors aktif.'
        }
      }

      return {
        success: true,
        message: `Berhasil menyinkronkan ${stats.universitiesCount} PTN dan ${stats.majorsCount} Program Studi resmi SNPMB ke database!`
      }
    } catch (e) {
      return {
        success: false,
        message: 'Gagal sinkronisasi SNPMB: ' + (e?.message || 'Error tidak diketahui')
      }
    }
  }

  // ----------------------------------------------------
  // GURU BK (ADMIN) ACTIONS
  // ----------------------------------------------------

  /**
   * Ambil daftar seluruh siswa eligible beserta pilihan & statusnya untuk Guru BK
   */
  async function fetchAdminEligibleList(academicYear = currentAcademicYear.value) {
    if (!isSupabaseConfigured || !supabase) return []
    try {
      isLoading.value = true
      const { data, error } = await supabase
        .from('eligible_students')
        .select(`
          id,
          student_id,
          academic_year,
          has_seen_popup,
          choice_status,
          grade_status,
          overall_average,
          created_at,
          users:student_id (id, nama, nis, nisn, kelas, angkatan, foto_url),
          eligible_choices (
            id,
            priority,
            university_id,
            major_id,
            universities:university_id (id, name),
            majors:major_id (id, name, degree, quota)
          ),
          eligible_grades (
            id,
            subject_id,
            sem_1,
            sem_2,
            sem_3,
            sem_4,
            sem_5,
            subject_average,
            subjects:subject_id (id, name, category)
          )
        `)
        .eq('academic_year', academicYear)
        .order('overall_average', { ascending: false })

      if (error) throw error
      allEligibleStudents.value = (data || []).map(item => ({
        ...item,
        eligible_choices: [...(item.eligible_choices || [])]
          .sort((a, b) => (a.priority || 0) - (b.priority || 0))
          .map(c => {
            const localUni = LOCAL_PTN_BY_ID.get(String(c.university_id))
            const localMaj = localUni?.prodi?.find(m => String(m.id) === String(c.major_id))
            return {
              ...c,
              universities: c.universities || (localUni ? { id: localUni.id, name: localUni.name } : null),
              majors: c.majors || (localMaj ? { id: localMaj.id, name: localMaj.name, degree: localMaj.degree, quota: localMaj.quota } : null)
            }
          })
      }))
      return allEligibleStudents.value
    } catch (e) {
      console.warn('Error fetching admin eligible list:', e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Tambahkan siswa ke daftar eligible
   */
  async function addEligibleStudent(studentId, academicYear = currentAcademicYear.value) {
    if (!isSupabaseConfigured || !supabase) return { success: false }
    try {
      const { data, error } = await supabase
        .from('eligible_students')
        .insert({
          student_id: studentId,
          academic_year: academicYear,
          has_seen_popup: false,
          choice_status: 'pending',
          grade_status: 'pending',
          overall_average: 0.00
        })
        .select()
        .single()

      if (error) throw error
      await fetchAdminEligibleList(academicYear)
      return { success: true, message: 'Siswa berhasil ditambahkan ke daftar Eligible!' }
    } catch (e) {
      return { success: false, message: 'Gagal menambahkan siswa: ' + e.message }
    }
  }

  /**
   * Hapus siswa dari daftar eligible
   */
  async function removeEligibleStudent(eligibleId) {
    if (!isSupabaseConfigured || !supabase) return { success: false }
    try {
      const { error } = await supabase
        .from('eligible_students')
        .delete()
        .eq('id', eligibleId)

      if (error) throw error
      allEligibleStudents.value = allEligibleStudents.value.filter(s => s.id !== eligibleId)
      return { success: true, message: 'Siswa berhasil dihapus dari daftar Eligible.' }
    } catch (e) {
      return { success: false, message: 'Gagal menghapus siswa: ' + e.message }
    }
  }

  /**
   * Validasi / ACC Pilihan Kampus & Jurusan oleh Guru BK
   */
  async function updateChoiceStatus(eligibleId, newStatus) {
    if (!isSupabaseConfigured || !supabase) return { success: false }
    try {
      const { error } = await supabase
        .from('eligible_students')
        .update({ choice_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', eligibleId)

      if (error) throw error

      const item = allEligibleStudents.value.find(s => s.id === eligibleId)
      if (item) item.choice_status = newStatus

      const messages = {
        approved: 'Pilihan jurusan siswa berhasil di-ACC.',
        rejected: 'Pilihan jurusan siswa ditolak untuk diperbaiki.',
        pending: 'Status ACC pilihan jurusan dibatalkan. Siswa dapat mengubah pilihan kembali.'
      }

      return { success: true, message: messages[newStatus] || 'Status pilihan berhasil diperbarui.' }
    } catch (e) {
      return { success: false, message: 'Gagal memperbarui status pilihan: ' + e.message }
    }
  }

  /**
   * Validasi / ACC Nilai Rapor oleh Guru BK (Kunci atau Buka Kunci Nilai)
   */
  async function updateGradeStatus(eligibleId, newStatus) {
    if (!isSupabaseConfigured || !supabase) return { success: false }
    try {
      const { error } = await supabase
        .from('eligible_students')
        .update({ grade_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', eligibleId)

      if (error) throw error

      const item = allEligibleStudents.value.find(s => s.id === eligibleId)
      if (item) item.grade_status = newStatus

      const messages = {
        approved: 'Nilai rapor siswa berhasil di-ACC dan dikunci.',
        rejected: 'Nilai rapor siswa ditolak untuk diperbaiki.',
        pending: 'Kunci nilai rapor berhasil dibatalkan. Siswa kini dapat mengedit nilai kembali.'
      }

      return { success: true, message: messages[newStatus] || 'Status nilai berhasil diperbarui.' }
    } catch (e) {
      return { success: false, message: 'Gagal memperbarui status nilai: ' + e.message }
    }
  }

  /**
   * Tambah / Edit Master Mata Pelajaran (Admin Only)
   */
  async function saveSubject(subject) {
    if (!isSupabaseConfigured || !supabase) return { success: false }
    try {
      if (subject.id) {
        await supabase
          .from('subjects')
          .update({ name: subject.name, category: subject.category })
          .eq('id', subject.id)
      } else {
        await supabase
          .from('subjects')
          .insert({ name: subject.name, category: subject.category })
      }
      await fetchMasterSubjects()
      return { success: true, message: 'Mata pelajaran berhasil disimpan!' }
    } catch (e) {
      return { success: false, message: 'Gagal menyimpan mapel: ' + e.message }
    }
  }

  /**
   * Hapus Master Mata Pelajaran
   */
  async function deleteSubject(subjectId) {
    if (!isSupabaseConfigured || !supabase) return { success: false }
    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)

      if (error) throw error
      masterSubjects.value = masterSubjects.value.filter(s => s.id !== subjectId)
      return { success: true, message: 'Mata pelajaran berhasil dihapus.' }
    } catch (e) {
      return { success: false, message: 'Gagal menghapus mapel: ' + e.message }
    }
  }

  return {
    currentAcademicYear,
    isLoading,
    isCheckingEligible,
    myEligibleData,
    myChoices,
    myGrades,
    myCertificates,
    masterSubjects,
    universitiesList,
    snpmbDbStats,
    allEligibleStudents,
    isEligible,
    canEditGrades,
    canEditChoices,
    resetMyEligibleState,
    checkMyEligibleStatus,
    markPopupSeen,
    fetchMyChoices,
    fetchMyGrades,
    fetchMyCertificates,
    checkChoiceClash,
    saveChoices,
    saveGrades,
    uploadCertificate,
    deleteCertificate,
    fetchMasterSubjects,
    fetchSnpmbDbStats,
    fetchUniversities,
    fetchMajorsByUniversity,
    syncSnpmbToDatabase,
    fetchAdminEligibleList,
    addEligibleStudent,
    removeEligibleStudent,
    updateChoiceStatus,
    updateGradeStatus,
    saveSubject,
    deleteSubject
  }
})
