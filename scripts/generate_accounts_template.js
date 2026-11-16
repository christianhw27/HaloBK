/**
 * ============================================================================
 * TEMPLATE GENERATOR AKUN MASSAL SISWA / ANGKATAN BARU
 * ============================================================================
 * 
 * Gunakan skrip ini ketika sekolah ingin membuat akun login massal untuk angkatan baru.
 * 
 * CARA PAKAI:
 * 1. Letakkan file Excel Dapodik di folder proyek (misal: data_siswa_angkatan_62.xlsx)
 * 2. Jalankan skrip ini dengan parameter path file Excel dan angkatan:
 *      node scripts/generate_accounts_template.js --file ./data_siswa.xlsx --angkatan 62 --lulus 2028
 *    Atau jalankan tanpa argumen untuk melihat mode simulasi dengan DATA DUMMY.
 * ============================================================================
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// Karakter aman untuk password (mudah dibaca, hindari karakter ambigu seperti 0, O, 1, l, I)
const charLower = 'abcdefghjkmnpqrstuvwxyz'
const charUpper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const charDigits = '23456789'
const charAll = charLower + charUpper + charDigits

/**
 * Menghasilkan kata sandi acak yang aman (minimal 1 huruf besar dan 1 angka)
 */
function generateRandomPassword(len = 8) {
  const mandatory = [
    charUpper[crypto.randomBytes(1)[0] % charUpper.length],
    charDigits[crypto.randomBytes(1)[0] % charDigits.length]
  ]
  const remaining = len - mandatory.length
  const bytes = crypto.randomBytes(remaining)
  for (let i = 0; i < remaining; i++) {
    mandatory.push(charAll[bytes[i] % charAll.length])
  }
  // Acak urutan karakter
  for (let i = mandatory.length - 1; i > 0; i--) {
    const j = crypto.randomBytes(1)[0] % (i + 1)
    ;[mandatory[i], mandatory[j]] = [mandatory[j], mandatory[i]]
  }
  return mandatory.join('')
}

// Parse argumen CLI
const args = process.argv.slice(2)
function getArg(flag, defaultValue) {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue
}

const inputFilePath = getArg('--file', null)
const targetAngkatan = parseInt(getArg('--angkatan', '62'), 10)
const targetTahunLulus = parseInt(getArg('--lulus', '2028'), 10)

let rawData = []

if (inputFilePath && fs.existsSync(inputFilePath)) {
  console.log(`[INFO] Membaca file data siswa dari: ${inputFilePath}`)
  const wb = XLSX.readFile(inputFilePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  rawData = XLSX.utils.sheet_to_json(sheet, { range: 0 })
} else {
  console.log('[INFO] Tidak ada file input. Menggunakan 3 baris CONTOH DUMMY untuk demonstrasi.')
  rawData = [
    { 'NO': 1, 'NAMA SISWA': 'Siswa Contoh Satu', 'NISN': '0012345671', 'NIS': '19001', 'KELAS': 'X-1' },
    { 'NO': 2, 'NAMA SISWA': 'Siswa Contoh Dua', 'NISN': '0012345672', 'NIS': '19002', 'KELAS': 'X-1' },
    { 'NO': 3, 'NAMA SISWA': 'Siswa Contoh Tiga', 'NISN': '0012345673', 'NIS': '19003', 'KELAS': 'X-2' }
  ]
}

const accounts = []
const usedPasswords = new Set()

rawData.forEach((row, idx) => {
  const no = row['NO'] || row['No'] || (idx + 1)
  const nama = String(row['NAMA SISWA'] || row['Nama'] || row['NAMA'] || `Siswa ${no}`).trim()
  let nisn = String(row['NISN'] || row['nisn'] || '').trim()
  let nis = String(row['NIS'] || row['nis'] || '').trim()
  const kelas = String(row['KELAS'] || row['Kelas'] || row['KLS BARU'] || 'X-1').trim()

  if (!nisn) {
    nisn = `${targetAngkatan}${String(no).padStart(4, '0')}`
  }
  if (!nis) {
    nis = nisn
  }

  let password = generateRandomPassword(8)
  while (usedPasswords.has(password)) {
    password = generateRandomPassword(8)
  }
  usedPasswords.add(password)

  accounts.push({
    no,
    nama,
    nisn,
    nis,
    kelas,
    password,
    role: 'siswa',
    angkatan: targetAngkatan,
    tahun_lulus: targetTahunLulus
  })
})

console.log(`[INFO] Berhasil memproses ${accounts.length} akun siswa (Angkatan ${targetAngkatan}).`)

const outputDir = path.resolve('scripts/output_template')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// 1. Ekspor Master Excel
const masterData = accounts.map((acc) => ({
  'NO': acc.no,
  'NAMA SISWA': acc.nama,
  'NISN (ID LOGIN)': acc.nisn,
  'NIS': acc.nis,
  'KELAS': acc.kelas,
  'KATA SANDI': acc.password,
  'PERAN': 'Siswa',
  'ANGKATAN': acc.angkatan,
  'TAHUN LULUS': acc.tahun_lulus
}))

const newWb = XLSX.utils.book_new()
const newWs = XLSX.utils.json_to_sheet(masterData)
XLSX.utils.book_append_sheet(newWb, newWs, `Akun Angkatan ${targetAngkatan}`)
const excelOut = path.join(outputDir, `Master_Akun_Siswa_Angkatan_${targetAngkatan}.xlsx`)
XLSX.writeFile(newWb, excelOut)
console.log(`[HASIL] Excel Master: ${excelOut}`)

// 2. Ekspor JSON
const jsonOut = path.join(outputDir, `akun_siswa_angkatan_${targetAngkatan}.json`)
fs.writeFileSync(jsonOut, JSON.stringify(accounts, null, 2), 'utf-8')
console.log(`[HASIL] JSON Data: ${jsonOut}`)

// 3. Ekspor SQL aman (Bcrypt)
const escapeSql = (str) => String(str || '').replace(/'/g, "''")
let sql = `-- ========================================================
-- SEED DATA AKUN ANGKATAN ${targetAngkatan} (Bcrypt Hashed)
-- Jalankan di SQL Editor Supabase
-- ========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.users (nama, nisn, nis, kelas, password, role, tahun_lulus, angkatan)
VALUES
`
sql += accounts
  .map(acc => `  ('${escapeSql(acc.nama)}', '${escapeSql(acc.nisn)}', '${escapeSql(acc.nis)}', '${escapeSql(acc.kelas)}', crypt('${escapeSql(acc.password)}', gen_salt('bf', 10)), '${acc.role}', ${acc.tahun_lulus}, ${acc.angkatan})`)
  .join(',\n')

sql += `\nON CONFLICT (nis) DO UPDATE SET
  nisn = EXCLUDED.nisn,
  kelas = EXCLUDED.kelas,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  angkatan = EXCLUDED.angkatan;
`
const sqlOut = path.join(outputDir, `seed_angkatan_${targetAngkatan}.sql`)
fs.writeFileSync(sqlOut, sql, 'utf-8')
console.log(`[HASIL] SQL Migration: ${sqlOut}`)
console.log('\n[SELESAI] File template generator berhasil dijalankan.')
