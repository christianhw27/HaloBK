import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from './auth'
import { processAndUploadPhoto, isCloudinaryConfigured } from '@/lib/cloudinary'

export const useEligibleStore = defineStore('eligible', () => {
  const currentAcademicYear = ref('2025/2026')
  const isLoading = ref(false)

  // State Siswa
  const myEligibleData = ref(null)
  const myChoices = ref([])
  const myGrades = ref([])
  const myCertificates = ref([])
  const isCheckingEligible = ref(true)

  // Master Data
  const masterSubjects = ref([])
  const universitiesList = ref([])

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
   * Cek status eligible siswa yang sedang login
   */
  async function checkMyEligibleStatus() {
    isCheckingEligible.value = true
    const authStore = useAuthStore()

    if (!authStore.isLoggedIn || !authStore.currentUser?.id || !isSupabaseConfigured || !supabase) {
      myEligibleData.value = null
      isCheckingEligible.value = false
      return null
    }

    try {
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

      if (error) {
        console.warn('Error checking eligible status:', error.message)
        myEligibleData.value = null
      } else {
        myEligibleData.value = data
        if (data) {
          await Promise.all([
            fetchMyChoices(data.id),
            fetchMyGrades(data.id),
            fetchMyCertificates(authStore.currentUser.id)
          ])
        }
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
        await supabase
          .from('eligible_choices')
          .upsert(
            {
              eligible_student_id: eligibleId,
              priority: 1,
              university_id: p1.university_id,
              major_id: p1.major_id,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'eligible_student_id, priority' }
          )
      }

      // 2. Simpan Pilihan 2 jika diisi
      if (p2?.university_id && p2?.major_id) {
        await supabase
          .from('eligible_choices')
          .upsert(
            {
              eligible_student_id: eligibleId,
              priority: 2,
              university_id: p2.university_id,
              major_id: p2.major_id,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'eligible_student_id, priority' }
          )
      } else if (p2?.remove) {
        // Hapus pilihan 2 jika dikosongkan
        await supabase
          .from('eligible_choices')
          .delete()
          .eq('eligible_student_id', eligibleId)
          .eq('priority', 2)
      }

      await fetchMyChoices(eligibleId)
      return { success: true, message: 'Pilihan jurusan berhasil disimpan!' }
    } catch (e) {
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

      // Upsert semua baris nilai
      for (const row of gradesPayload) {
        if (!row.subject_id) continue
        await supabase
          .from('eligible_grades')
          .upsert(
            {
              eligible_student_id: eligibleId,
              subject_id: row.subject_id,
              sem_1: Number(row.sem_1) || 0,
              sem_2: Number(row.sem_2) || 0,
              sem_3: Number(row.sem_3) || 0,
              sem_4: Number(row.sem_4) || 0,
              sem_5: Number(row.sem_5) || 0
            },
            { onConflict: 'eligible_student_id, subject_id' }
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
          student_id: authStore.currentUser.id,
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
        .order('category', { ascending: false })
        .order('name', { ascending: true })

      masterSubjects.value = data || []
      return masterSubjects.value
    } catch (e) {
      console.warn('Error fetching subjects:', e)
      return []
    }
  }

  async function fetchUniversities() {
    if (!isSupabaseConfigured || !supabase) return []
    try {
      const { data } = await supabase
        .from('universities')
        .select('id, code, name, region, category')
        .order('name', { ascending: true })

      universitiesList.value = data || []
      return universitiesList.value
    } catch (e) {
      console.warn('Error fetching universities:', e)
      return []
    }
  }

  async function fetchMajorsByUniversity(uniId) {
    if (!isSupabaseConfigured || !supabase || !uniId) return []
    try {
      const { data } = await supabase
        .from('majors')
        .select('id, university_id, code, name, degree, quota, portofolio')
        .eq('university_id', uniId)
        .order('name', { ascending: true })

      return data || []
    } catch (e) {
      console.warn('Error fetching majors:', e)
      return []
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
      allEligibleStudents.value = data || []
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

      return { success: true, message: `Status pilihan berhasil diperbarui ke: ${newStatus}!` }
    } catch (e) {
      return { success: false, message: 'Gagal memperbarui status pilihan: ' + e.message }
    }
  }

  /**
   * Validasi / ACC Nilai Rapor oleh Guru BK (Kunci Nilai)
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

      return { success: true, message: `Status nilai berhasil diperbarui ke: ${newStatus}!` }
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
    allEligibleStudents,
    isEligible,
    canEditGrades,
    canEditChoices,
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
    fetchUniversities,
    fetchMajorsByUniversity,
    fetchAdminEligibleList,
    addEligibleStudent,
    removeEligibleStudent,
    updateChoiceStatus,
    updateGradeStatus,
    saveSubject,
    deleteSubject
  }
})
