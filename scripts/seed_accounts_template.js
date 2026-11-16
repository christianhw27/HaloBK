/**
 * ============================================================================
 * TEMPLATE IMPORT AKUN SISWA KE SUPABASE AUTH (SECURE ADMIN API)
 * ============================================================================
 * 
 * Skrip ini mendaftarkan user ke Supabase Auth via Admin API.
 * Password otomatis di-hash Bcrypt oleh server Supabase.
 *
 * CARA PAKAI:
 *   SUPABASE_URL="https://xxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *   node scripts/seed_accounts_template.js --file ./scripts/template_akun_siswa_contoh.json
 * ============================================================================
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('FATAL: Variabel lingkungan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.')
  console.error('Contoh:')
  console.error('  SUPABASE_URL="https://xxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/seed_accounts_template.js')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Parse parameter file
const args = process.argv.slice(2)
const fileArgIdx = args.indexOf('--file')
const targetPath = fileArgIdx !== -1 && args[fileArgIdx + 1]
  ? path.resolve(args[fileArgIdx + 1])
  : path.resolve('scripts/template_akun_siswa_contoh.json')

if (!fs.existsSync(targetPath)) {
  console.error(`File tidak ditemukan: ${targetPath}`)
  process.exit(1)
}

const rawData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'))

async function seedAccounts() {
  console.log(`[INFO] Mempersiapkan import ${rawData.length} akun siswa ke Supabase Auth...`)

  let successCount = 0
  let errorCount = 0

  for (const item of rawData) {
    const email = item.email || `${item.nisn}@siswa.smada.sch.id`

    try {
      // 1. Daftarkan akun ke auth.users (password di-hash otomatis oleh Supabase)
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: item.password,
        email_confirm: true,
        user_metadata: {
          nama: item.nama,
          role: 'siswa',
          nisn: item.nisn,
          nis: item.nis
        }
      })

      if (authErr) {
        if (authErr.message?.includes('already been registered')) {
          console.log(`[SKIP] ${item.nama} (${item.nisn}) — akun sudah terdaftar`)
          successCount++
          continue
        }
        throw authErr
      }

      // 2. Simpan data profil ke public.users (tanpa kolom password!)
      const { error: profileErr } = await supabase.from('users').upsert({
        id: authUser.user.id,
        nama: item.nama,
        nisn: item.nisn,
        nis: item.nis,
        kelas: item.kelas,
        role: item.role || 'siswa',
        tahun_lulus: item.tahun_lulus || 2028,
        angkatan: item.angkatan || 62
      }, { onConflict: 'nis' })

      if (profileErr) {
        console.warn(`[WARN] Profil ${item.nama}: ${profileErr.message}`)
      }

      successCount++
      console.log(`[OK] ${item.nama} (${item.nisn}) berhasil didaftarkan.`)
    } catch (err) {
      console.error(`[ERROR] ${item.nama} (${item.nisn}): ${err.message}`)
      errorCount++
    }
  }

  console.log(`\n[SELESAI] Berhasil: ${successCount}, Gagal: ${errorCount}`)
}

seedAccounts().catch(console.error)
