import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const excelPath = 'D:/Gabut/projek/HaloBK/_drafts/SMADA Angkatan 61.xlsx'
const wb = XLSX.readFile(excelPath)
const sheet = wb.Sheets[wb.SheetNames[0]]
const rawData = XLSX.utils.sheet_to_json(sheet, { range: 0 })

// Karakter aman & tidak ambigu (menghindari 0, O, 1, l, I)
const charset = '23456789abcdefghjkmnpqrstuvwxyz'

function generateRandomPassword(len = 6) {
  let result = ''
  const bytes = crypto.randomBytes(len)
  for (let i = 0; i < len; i++) {
    result += charset[bytes[i] % charset.length]
  }
  return result
}

const accounts = []
const usedPasswords = new Set()
const missingNotes = []

rawData.forEach((row, idx) => {
  const no = row['NO'] || (idx + 1)
  const nama = String(row['NAMA SISWA'] || '').trim()
  let rawNisn = row['NISN'] ? String(row['NISN']).trim() : ''
  let rawNis = row['NIS'] ? String(row['NIS']).trim() : ''
  const kelas = String(row['KLS BARU'] || '').trim()

  // Jika NISN / NIS kosong di file Excel (ada 2 siswa di baris 277 & 319)
  let isNisnPlaceholder = false
  if (!rawNisn) {
    rawNisn = '61' + String(no).padStart(4, '0') // Contoh: 610277
    isNisnPlaceholder = true
    missingNotes.push({ no, nama, reason: 'NISN kosong di Excel, menggunakan placeholder ' + rawNisn })
  }
  if (!rawNis) {
    rawNis = rawNisn
  }

  // Password unik per anak
  let password = generateRandomPassword(6)
  while (usedPasswords.has(password)) {
    password = generateRandomPassword(6)
  }
  usedPasswords.add(password)

  accounts.push({
    no,
    nama,
    nisn: rawNisn,
    nis: rawNis,
    kelas,
    password,
    role: 'siswa',
    angkatan: 61,
    tahun_lulus: 2026,
    is_placeholder_nisn: isNisnPlaceholder
  })
})

console.log(`Berhasil memproses ${accounts.length} siswa Angkatan 61.`)
if (missingNotes.length > 0) {
  console.log('Catatan data tanpa NISN:', missingNotes)
}

// 1. Ekspor file Excel Master Akun Siswa Angkatan 61
const masterDataForExcel = accounts.map((acc) => ({
  'NO': acc.no,
  'NAMA SISWA': acc.nama,
  'NISN (ID LOGIN)': acc.nisn,
  'NIS': acc.nis,
  'KELAS BARU': acc.kelas,
  'PASSWORD': acc.password,
  'PERAN': 'Siswa',
  'ANGKATAN': '61',
  'STATUS_NISN': acc.is_placeholder_nisn ? 'PERLU_UPDATE_NISN' : 'VALID'
}))

const newWb = XLSX.utils.book_new()
const newWs = XLSX.utils.json_to_sheet(masterDataForExcel)

// Set column widths
newWs['!cols'] = [
  { wch: 6 },  // NO
  { wch: 42 }, // NAMA SISWA
  { wch: 18 }, // NISN
  { wch: 12 }, // NIS
  { wch: 12 }, // KELAS
  { wch: 14 }, // PASSWORD
  { wch: 10 }, // PERAN
  { wch: 10 }, // ANGKATAN
  { wch: 20 }  // STATUS
]

XLSX.utils.book_append_sheet(newWb, newWs, 'Akun Siswa Angkatan 61')
const outputExcelPath = 'D:/Gabut/projek/HaloBK/_drafts/Master_Akun_Siswa_Angkatan_61.xlsx'
XLSX.writeFile(newWb, outputExcelPath)
console.log(`File Excel master akun tersimpan di: ${outputExcelPath}`)

// 2. Ekspor file JSON
const outputJsonPath = 'D:/Gabut/projek/HaloBK/_drafts/akun_siswa_angkatan_61.json'
fs.writeFileSync(outputJsonPath, JSON.stringify(accounts, null, 2), 'utf-8')
console.log(`File JSON akun tersimpan di: ${outputJsonPath}`)

// 3. Ekspor file SQL Supabase
const escapeSql = (str) => String(str || '').replace(/'/g, "''")

let sql = `-- ========================================================
-- MIGRATION & SEED DATA: AKUN SISWA ANGKATAN 61 (397 SISWA)
-- SMA NEGERI 2 NGAWI
-- Jalankan skrip ini di menu SQL Editor pada Dashboard Supabase
-- ========================================================

-- 1. Tambahkan kolom NISN & Biodata Profil pada tabel public.users jika belum ada
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nisn text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS angkatan integer DEFAULT 61;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ttl text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alamat_lengkap text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS jenis_tinggal text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alat_transportasi text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS no_wa text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nama_ortu text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pekerjaan_ortu text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS no_wa_ortu text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS asal_smp text;

-- 2. Buat index pencarian cepat berbasis NISN
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nisn ON public.users(nisn);

-- 3. Masukkan 397 Data Akun Siswa Angkatan 61
INSERT INTO public.users (nama, nisn, nis, kelas, password, role, tahun_lulus, angkatan)
VALUES
`

const values = accounts.map((acc) => {
  return `  ('${escapeSql(acc.nama)}', '${escapeSql(acc.nisn)}', '${escapeSql(acc.nis)}', '${escapeSql(acc.kelas)}', '${escapeSql(acc.password)}', '${acc.role}', ${acc.tahun_lulus}, ${acc.angkatan})`
})

sql += values.join(',\n')
sql += `\nON CONFLICT (nis) DO UPDATE SET
  nisn = EXCLUDED.nisn,
  kelas = EXCLUDED.kelas,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  angkatan = EXCLUDED.angkatan;
`

const outputSqlPath = 'D:/Gabut/projek/HaloBK/supabase_angkatan_61.sql'
fs.writeFileSync(outputSqlPath, sql, 'utf-8')
console.log(`File SQL migrasi & seed tersimpan di: ${outputSqlPath}`)
