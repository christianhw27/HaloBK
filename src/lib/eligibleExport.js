import * as XLSX from 'xlsx'

// Daftar resmi 23 mata pelajaran standar SMA Negeri 2 Ngawi
export const SMADA_MASTER_SUBJECTS = [
  'Matematika',
  'PAI (Pendidikan Agama Islam)',
  'PKn / Pancasila',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Fisika',
  'Biologi',
  'PKWU (Prakarya dan Kewirausahaan)',
  'Kimia',
  'Bahasa Prancis',
  'Sejarah',
  'Geografi',
  'Ekonomi',
  'Seni Budaya',
  'Penjasorkes (Pendidikan Jasmani, Olahraga, dan Kesehatan)',
  'Sosiologi',
  'TIK / KKA',
  'Bahasa Jepang',
  'Bahasa Jawa',
  'Pendidikan Agama Katholik',
  'Pendidikan Agama Kristen',
  'BP/BK (Bimbingan dan Konseling)',
  'PRODISTIK'
]

/**
 * Helper untuk menghitung rata-rata nilai per mata pelajaran
 */
function computeSubjectAvg(g) {
  if (!g) return null
  const filled = [g.sem_1, g.sem_2, g.sem_3, g.sem_4, g.sem_5]
    .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)))
    .map(Number)
  if (filled.length === 0) return null
  return Number((filled.reduce((a, b) => a + b, 0) / filled.length).toFixed(2))
}

/**
 * Helper untuk menghitung rata-rata nilai kumulatif rapor siswa
 */
function getStudentOverallAvg(item) {
  const grades = item?.eligible_grades || []
  if (grades.length > 0) {
    const validSubjectAverages = grades
      .map(computeSubjectAvg)
      .filter(avg => avg !== null)
    if (validSubjectAverages.length > 0) {
      const sum = validSubjectAverages.reduce((acc, avg) => acc + avg, 0)
      return Number((sum / validSubjectAverages.length).toFixed(2))
    }
  }
  const ov = Number(item?.overall_average)
  return isNaN(ov) ? 0 : Number(ov.toFixed(2))
}

/**
 * Label status pilihan jurusan SNBP
 */
function getChoiceStatusLabel(status, choicesCount) {
  if (!choicesCount || choicesCount === 0) return 'Belum Memilih'
  if (status === 'approved') return 'Disetujui (ACC)'
  if (status === 'rejected') return 'Ditolak'
  return 'Menunggu ACC'
}

/**
 * Label status verifikasi nilai rapor
 */
function getGradeStatusLabel(status, gradesCount) {
  if (!gradesCount || gradesCount === 0) return 'Belum Ada Nilai'
  if (status === 'approved') return 'Terkunci (ACC)'
  if (status === 'rejected') return 'Perlu Revisi'
  return 'Belum ACC'
}

/**
 * Format tanggal Indonesia ramah Excel
 */
function formatDateTime(isoString) {
  if (!isoString) return '-'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return String(isoString)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return String(isoString)
  }
}

/**
 * Mengekspor seluruh data Siswa Eligible SNBP ke file Microsoft Excel (.xlsx)
 * Terdiri dari 4 Sheet Terstruktur:
 * 1. Rekap Siswa & Pilihan PTN (Identitas, Peringkat, Nilai Rata-rata, Pilihan 1 & 2, Kuota, Status)
 * 2. Matriks Nilai Rapor (Komparasi nilai rata-rata 23 Mata Pelajaran Standar SMADA per Siswa)
 * 3. Transkrip Nilai (Sem 1-5) (Rincian nilai semester 1 sampai 5 per mata pelajaran)
 * 4. Sertifikat Prestasi (Daftar seluruh prestasi & tautan berkas foto/sertifikat yang diunggah)
 *
 * @param {Object} options
 * @param {Array} options.students - Daftar siswa eligible dari store (allEligibleStudents)
 * @param {Array} options.certificates - Daftar sertifikat prestasi dari tabel student_certificates
 * @param {Array} options.masterSubjects - Master mata pelajaran (opsional)
 * @param {string} options.academicYear - Tahun ajaran (default '2025/2026')
 * @returns {string} Nama berkas yang berhasil diunduh
 */
export function exportEligibleToExcel({
  students = [],
  certificates = [],
  masterSubjects = [],
  academicYear = '2025/2026'
} = {}) {
  if (!Array.isArray(students) || students.length === 0) {
    throw new Error('Tidak ada data siswa eligible untuk diekspor.')
  }

  // Peta sertifikat per student_id
  const certificatesByStudent = new Map()
  ;(certificates || []).forEach(c => {
    if (!c.student_id) return
    if (!certificatesByStudent.has(c.student_id)) {
      certificatesByStudent.set(c.student_id, [])
    }
    certificatesByStudent.get(c.student_id).push(c)
  })

  // Urutkan siswa berdasarkan Rata-rata Kumulatif Descending (Peringkat 1 s.d N)
  const sortedStudents = [...students].sort((a, b) => {
    const avgA = getStudentOverallAvg(a)
    const avgB = getStudentOverallAvg(b)
    if (avgB !== avgA) return avgB - avgA
    return (a.users?.nama || '').localeCompare(b.users?.nama || '', 'id')
  })

  // ----------------------------------------------------
  // SHEET 1: REKAP SISWA & PILIHAN SNBP
  // ----------------------------------------------------
  const sheet1Headers = [
    'No',
    'Peringkat (Rank)',
    'Nama Lengkap Siswa',
    'NISN',
    'NIS',
    'Kelas',
    'Angkatan',
    'Rata-rata Rapor Kumulatif',
    'Status Nilai Rapor',
    'Status Pilihan PTN',
    'Pilihan 1 - Perguruan Tinggi',
    'Pilihan 1 - Program Studi',
    'Pilihan 1 - Jenjang',
    'Pilihan 1 - Kuota / Daya Tampung',
    'Pilihan 1 - Portofolio',
    'Pilihan 2 - Perguruan Tinggi',
    'Pilihan 2 - Program Studi',
    'Pilihan 2 - Jenjang',
    'Pilihan 2 - Kuota / Daya Tampung',
    'Pilihan 2 - Portofolio',
    'Jumlah Prestasi',
    'Daftar Prestasi (Sertifikat)'
  ]

  const sheet1Rows = [sheet1Headers]

  sortedStudents.forEach((s, idx) => {
    const rank = idx + 1
    const nama = s.users?.nama || '-'
    // Gunakan objek cell { t: 's', v: ... } agar angka NISN & NIS tidak dipotong nol depannya oleh Excel
    const nisn = s.users?.nisn ? { t: 's', v: String(s.users.nisn) } : '-'
    const nis = s.users?.nis ? { t: 's', v: String(s.users.nis) } : '-'
    const kelas = s.users?.kelas || '-'
    const angkatan = s.users?.angkatan || '-'
    const overallAvg = getStudentOverallAvg(s)

    const choices = s.eligible_choices || []
    const p1 = choices.find(c => c.priority === 1) || choices[0] || null
    const p2 = choices.find(c => c.priority === 2) || (choices.length > 1 ? choices[1] : null)

    const grades = s.eligible_grades || []
    const certs = certificatesByStudent.get(s.student_id) || []
    const certsSummary = certs.map(c => c.title).join('; ') || '-'

    sheet1Rows.push([
      idx + 1,
      rank,
      nama,
      nisn,
      nis,
      kelas,
      angkatan,
      overallAvg > 0 ? overallAvg : 0,
      getGradeStatusLabel(s.grade_status, grades.length),
      getChoiceStatusLabel(s.choice_status, choices.length),
      p1?.universities?.name || '-',
      p1?.majors?.name || '-',
      p1?.majors?.degree || '-',
      p1?.majors?.quota != null ? p1.majors.quota : '-',
      p1?.majors?.portofolio || '-',
      p2?.universities?.name || '-',
      p2?.majors?.name || '-',
      p2?.majors?.degree || '-',
      p2?.majors?.quota != null ? p2.majors.quota : '-',
      p2?.majors?.portofolio || '-',
      certs.length,
      certsSummary
    ])
  })

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows)
  ws1['!cols'] = [
    { wch: 6 },   // No
    { wch: 16 },  // Peringkat
    { wch: 32 },  // Nama
    { wch: 16 },  // NISN
    { wch: 12 },  // NIS
    { wch: 10 },  // Kelas
    { wch: 10 },  // Angkatan
    { wch: 22 },  // Rata-rata Rapor Kumulatif
    { wch: 20 },  // Status Nilai
    { wch: 20 },  // Status Pilihan
    { wch: 36 },  // Pilihan 1 PTN
    { wch: 34 },  // Pilihan 1 Prodi
    { wch: 12 },  // Pilihan 1 Jenjang
    { wch: 16 },  // Pilihan 1 Kuota
    { wch: 20 },  // Pilihan 1 Portofolio
    { wch: 36 },  // Pilihan 2 PTN
    { wch: 34 },  // Pilihan 2 Prodi
    { wch: 12 },  // Pilihan 2 Jenjang
    { wch: 16 },  // Pilihan 2 Kuota
    { wch: 20 },  // Pilihan 2 Portofolio
    { wch: 16 },  // Jumlah Prestasi
    { wch: 50 }   // Daftar Prestasi
  ]

  // ----------------------------------------------------
  // SHEET 2: MATRIKS NILAI RAPOR (23 MAPEL SMADA)
  // ----------------------------------------------------
  const subjectColumns = [...SMADA_MASTER_SUBJECTS]

  const sheet2Headers = [
    'No',
    'Peringkat',
    'Nama Lengkap Siswa',
    'NISN',
    'Kelas',
    'Rata-rata Kumulatif',
    ...subjectColumns
  ]

  const sheet2Rows = [sheet2Headers]

  sortedStudents.forEach((s, idx) => {
    const rank = idx + 1
    const nama = s.users?.nama || '-'
    const nisn = s.users?.nisn ? { t: 's', v: String(s.users.nisn) } : '-'
    const kelas = s.users?.kelas || '-'
    const overallAvg = getStudentOverallAvg(s)

    const gradesMap = new Map()
    ;(s.eligible_grades || []).forEach(g => {
      const subName = (g.subjects?.name || '').trim().toLowerCase()
      if (subName) {
        const avg = computeSubjectAvg(g)
        gradesMap.set(subName, avg)
      }
    })

    const subjectScores = subjectColumns.map(subName => {
      const avg = gradesMap.get(subName.trim().toLowerCase())
      return (avg != null && !isNaN(avg)) ? avg : '-'
    })

    sheet2Rows.push([
      idx + 1,
      rank,
      nama,
      nisn,
      kelas,
      overallAvg > 0 ? overallAvg : 0,
      ...subjectScores
    ])
  })

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows)
  ws2['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 32 },
    { wch: 16 },
    { wch: 10 },
    { wch: 20 },
    ...subjectColumns.map(() => ({ wch: 18 }))
  ]

  // ----------------------------------------------------
  // SHEET 3: TRANSKRIP NILAI DETAIL (SEMESTER 1 - 5)
  // ----------------------------------------------------
  const sheet3Headers = [
    'No',
    'Nama Lengkap Siswa',
    'NISN',
    'Kelas',
    'Mata Pelajaran',
    'Kategori / Kelompok',
    'Semester 1',
    'Semester 2',
    'Semester 3',
    'Semester 4',
    'Semester 5',
    'Rata-rata Mapel'
  ]

  const sheet3Rows = [sheet3Headers]
  let gradeRowNo = 1

  sortedStudents.forEach(s => {
    const nama = s.users?.nama || '-'
    const nisn = s.users?.nisn ? { t: 's', v: String(s.users.nisn) } : '-'
    const kelas = s.users?.kelas || '-'

    const grades = [...(s.eligible_grades || [])].sort((a, b) => {
      const nameA = a.subjects?.name || ''
      const nameB = b.subjects?.name || ''
      const idxA = SMADA_MASTER_SUBJECTS.findIndex(m => m.toLowerCase() === nameA.toLowerCase())
      const idxB = SMADA_MASTER_SUBJECTS.findIndex(m => m.toLowerCase() === nameB.toLowerCase())
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return nameA.localeCompare(nameB, 'id')
    })

    if (grades.length === 0) {
      sheet3Rows.push([
        gradeRowNo++,
        nama,
        nisn,
        kelas,
        '(Belum ada nilai terisi)',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-'
      ])
    } else {
      grades.forEach(g => {
        const subName = g.subjects?.name || '-'
        const category = g.subjects?.category || 'Wajib'
        const s1 = g.sem_1 != null && g.sem_1 !== '' ? Number(g.sem_1) : '-'
        const s2 = g.sem_2 != null && g.sem_2 !== '' ? Number(g.sem_2) : '-'
        const s3 = g.sem_3 != null && g.sem_3 !== '' ? Number(g.sem_3) : '-'
        const s4 = g.sem_4 != null && g.sem_4 !== '' ? Number(g.sem_4) : '-'
        const s5 = g.sem_5 != null && g.sem_5 !== '' ? Number(g.sem_5) : '-'
        const subAvg = computeSubjectAvg(g)

        sheet3Rows.push([
          gradeRowNo++,
          nama,
          nisn,
          kelas,
          subName,
          category,
          s1,
          s2,
          s3,
          s4,
          s5,
          subAvg != null ? subAvg : '-'
        ])
      })
    }
  })

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows)
  ws3['!cols'] = [
    { wch: 6 },   // No
    { wch: 32 },  // Nama
    { wch: 16 },  // NISN
    { wch: 10 },  // Kelas
    { wch: 32 },  // Mata Pelajaran
    { wch: 16 },  // Kategori
    { wch: 12 },  // Sem 1
    { wch: 12 },  // Sem 2
    { wch: 12 },  // Sem 3
    { wch: 12 },  // Sem 4
    { wch: 12 },  // Sem 5
    { wch: 16 }   // Rata-rata
  ]

  // ----------------------------------------------------
  // SHEET 4: SERTIFIKAT PRESTASI SISWA
  // ----------------------------------------------------
  const sheet4Headers = [
    'No',
    'Nama Lengkap Siswa',
    'NISN',
    'Kelas',
    'Judul Prestasi / Nama Sertifikat',
    'Tautan Bukti / Foto Sertifikat',
    'Tanggal Unggah'
  ]

  const sheet4Rows = [sheet4Headers]
  let certNo = 1
  let hasAnyCert = false

  sortedStudents.forEach(s => {
    const nama = s.users?.nama || '-'
    const nisn = s.users?.nisn ? { t: 's', v: String(s.users.nisn) } : '-'
    const kelas = s.users?.kelas || '-'
    const certs = certificatesByStudent.get(s.student_id) || []

    certs.forEach(c => {
      hasAnyCert = true
      const linkCell = c.image_url
        ? { t: 's', v: c.image_url, l: { Target: c.image_url, Tooltip: 'Buka Foto / Berkas Sertifikat' } }
        : '-'

      sheet4Rows.push([
        certNo++,
        nama,
        nisn,
        kelas,
        c.title || '-',
        linkCell,
        formatDateTime(c.created_at)
      ])
    })
  })

  if (!hasAnyCert) {
    sheet4Rows.push([
      1,
      '-',
      '-',
      '-',
      'Belum ada sertifikat prestasi yang diunggah oleh siswa eligible',
      '-',
      '-'
    ])
  }

  const ws4 = XLSX.utils.aoa_to_sheet(sheet4Rows)
  ws4['!cols'] = [
    { wch: 6 },   // No
    { wch: 32 },  // Nama
    { wch: 16 },  // NISN
    { wch: 10 },  // Kelas
    { wch: 40 },  // Judul Prestasi
    { wch: 55 },  // Tautan Foto
    { wch: 20 }   // Tanggal Unggah
  ]

  // ----------------------------------------------------
  // GABUNGKAN WORKBOOK & UNDUH FILE
  // ----------------------------------------------------
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Rekap Siswa & Pilihan PTN')
  XLSX.utils.book_append_sheet(wb, ws2, 'Matriks Nilai Rapor')
  XLSX.utils.book_append_sheet(wb, ws3, 'Transkrip Nilai (Sem 1-5)')
  XLSX.utils.book_append_sheet(wb, ws4, 'Sertifikat Prestasi')

  const safeYear = String(academicYear || '2025/2026').replace(/[^a-zA-Z0-9]/g, '_')
  const dateStr = new Date().toISOString().slice(0, 10)
  const fileName = `Rekap_Eligible_SNBP_SMADA_${safeYear}_${dateStr}.xlsx`

  XLSX.writeFile(wb, fileName)
  return fileName
}
