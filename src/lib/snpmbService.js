// Service untuk integrasi data resmi SNPMB (Seleksi Nasional Penerimaan Mahasiswa Baru)
// Sumber: snpmb.id/utbk-snbt/daya-tampung-snbt
import snpmbData from '@/data/snpmbData.min.json'

// Mapping singkatan kampus populer ke nama resmi di SNPMB
const POPULAR_ALIASES = {
  'unesa': 'Universitas Negeri Surabaya',
  'um': 'Universitas Negeri Malang',
  'ub': 'Universitas Brawijaya',
  'unair': 'Universitas Airlangga',
  'its': 'Institut Teknologi Sepuluh Nopember',
  'ugm': 'Universitas Gadjah Mada',
  'itb': 'Institut Teknologi Bandung',
  'ui': 'Universitas Indonesia',
  'uns': 'Universitas Sebelas Maret',
  'undip': 'Universitas Diponegoro',
  'uny': 'Universitas Negeri Yogyakarta',
  'unej': 'Universitas Jember',
  'ipb': 'Institut Pertanian Bogor',
  'unpad': 'Universitas Padjadjaran',
  'upi': 'Universitas Pendidikan Indonesia',
  'unj': 'Universitas Negeri Jakarta',
  'unand': 'Universitas Andalas',
  'usu': 'Universitas Sumatera Utara',
  'unhas': 'Universitas Hasanuddin',
  'unsoed': 'Universitas Jenderal Soedirman',
  'untirta': 'Universitas Sultan Ageng Tirtayasa',
  'pnm': 'Politeknik Negeri Madiun',
  'polinema': 'Politeknik Negeri Malang',
  'pens': 'Politeknik Elektronika Negeri Surabaya (pens)',
  'ppns': 'Politeknik Perkapalan Negeri Surabaya',
  'polije': 'Politeknik Negeri Jember',
  'polinwangi': 'Politeknik Negeri Banyuwangi',
  'polines': 'Politeknik Negeri Semarang',
  'polban': 'Politeknik Negeri Bandung',
  'pnj': 'Politeknik Negeri Jakarta',
  'upn jatim': 'Upn "veteran" Jawa Timur',
  'upn surabaya': 'Upn "veteran" Jawa Timur',
  'upn jogja': 'Upn "veteran" Yogyakarta',
  'upn yogyakarta': 'Upn "veteran" Yogyakarta',
  'upn jakarta': 'Upn "veteran" Jakarta',
  'uin malang': 'UIN Malang',
  'uin surabaya': 'UIN Sunan Ampel Surabaya',
  'uin jogja': 'UIN Sunan Kalijaga',
  'uin jakarta': 'UIN Jakarta',
  'uin bandung': 'UIN Sunan Gunung Djati',
  'uin semarang': 'UIN Walisongo',
  'uin solo': 'UIN Raden Mas Said Surakarta',
  'uin surakarta': 'UIN Raden Mas Said Surakarta'
}

function normalizeKey(str) {
  if (!str) return ''
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Cari kampus PTN dari database SNPMB berdasarkan nama, singkatan, atau alias
 * @param {string} campusName
 * @returns {object|null}
 */
export function findSnpmbPtn(campusName) {
  if (!campusName || typeof campusName !== 'string') return null
  const clean = campusName.trim()
  if (!clean) return null

  const lower = clean.toLowerCase()
  const norm = normalizeKey(clean)

  // 1. Cek alias populer
  if (POPULAR_ALIASES[lower]) {
    const aliasMatch = snpmbData.find(p => p.name.toLowerCase() === POPULAR_ALIASES[lower].toLowerCase())
    if (aliasMatch) return aliasMatch
  }

  // 2. Cek kecocokan tepat (nama atau rawName)
  for (const ptn of snpmbData) {
    if (normalizeKey(ptn.name) === norm || normalizeKey(ptn.rawName) === norm) {
      return ptn
    }
  }

  // 3. Cek kecocokan substring
  // Misal: user ketik "Negeri Surabaya", cocok ke "Universitas Negeri Surabaya"
  for (const ptn of snpmbData) {
    const ptnNorm = normalizeKey(ptn.name)
    if (ptnNorm.includes(norm) || (norm.length >= 6 && norm.includes(ptnNorm))) {
      return ptn
    }
  }

  return null
}

/**
 * Dapatkan daftar seluruh program studi resmi SNPMB untuk kampus tertentu
 * @param {string} campusName
 * @returns {Array} array of prodi objects
 */
export function getProdiListForCampus(campusName) {
  const ptn = findSnpmbPtn(campusName)
  if (!ptn || !Array.isArray(ptn.prodi)) return []
  return ptn.prodi
}

/**
 * Cek apakah kampus tertentu terdaftar sebagai PTN resmi di SNPMB
 * @param {string} campusName
 * @returns {boolean}
 */
export function isSnpmbPtn(campusName) {
  return findSnpmbPtn(campusName) !== null
}

/**
 * Ambil seluruh daftar 145 PTN SNPMB
 * @returns {Array}
 */
export function getAllSnpmbPtn() {
  return snpmbData
}

/**
 * Menormalkan nama jurusan lama/bebas ke format resmi SNPMB jika cocok
 * @param {string} campusName
 * @param {string} currentMajor
 * @returns {string}
 */
export function normalizeMajorName(campusName, currentMajor) {
  if (!currentMajor || !campusName) return currentMajor || ''
  const prodis = getProdiListForCampus(campusName)
  if (!prodis.length) return currentMajor

  const normMajor = normalizeKey(currentMajor)

  // 1. Cek exact match ke fullName (contoh: "S1 Teknik Informatika")
  const exact = prodis.find(p => normalizeKey(p.fullName) === normMajor)
  if (exact) return exact.fullName

  // 2. Cek match ke nama prodi tanpa jenjang (contoh: "Teknik Informatika" -> "S1 Teknik Informatika")
  const matchNama = prodis.find(p => normalizeKey(p.nama) === normMajor)
  if (matchNama) return matchNama.fullName

  // 3. Cek contains (contoh: "Pendidikan Bahasa Inggris" cocok ke "S1 Pendidikan Bahasa Inggris")
  const partial = prodis.find(p => {
    const pNorm = normalizeKey(p.nama)
    return pNorm === normMajor || pNorm.includes(normMajor) || normMajor.includes(pNorm)
  })
  if (partial) return partial.fullName

  return currentMajor
}
