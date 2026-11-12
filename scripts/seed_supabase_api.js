import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://yhctwdgcxykzxfgeilgf.supabase.co'
const supabaseKey = 'sb_publishable_1ySPTUjtVRIoxsLyy79QAQ_OQT0h1PM'
const supabase = createClient(supabaseUrl, supabaseKey)

const jsonPath = 'D:/Gabut/projek/HaloBK/_drafts/akun_siswa_angkatan_61.json'
const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

async function seedViaApi() {
  console.log(`Mempersiapkan import ${rawData.length} siswa Angkatan 61 ke Supabase...`)

  // Siapkan payload batch
  const batchSize = 50
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < rawData.length; i += batchSize) {
    const chunk = rawData.slice(i, i + batchSize).map((item) => ({
      nama: item.nama,
      nisn: item.nisn,
      nis: item.nis,
      kelas: item.kelas,
      password: item.password,
      role: item.role || 'siswa',
      tahun_lulus: item.tahun_lulus || 2027,
      angkatan: item.angkatan || 61
    }))

    const { data, error } = await supabase
      .from('users')
      .upsert(chunk, { onConflict: 'nis' })

    if (error) {
      console.error(`Gagal batch ${i} - ${i + chunk.length}:`, error.message)
      errorCount += chunk.length
    } else {
      successCount += chunk.length
      console.log(`Berhasil mengunggah batch ${i + 1} s.d ${Math.min(i + batchSize, rawData.length)} (${successCount}/${rawData.length})`)
    }
  }

  console.log(`Selesai! Berhasil: ${successCount}, Gagal: ${errorCount}`)
}

seedViaApi().catch(console.error)

