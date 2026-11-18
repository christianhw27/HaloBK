import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  function sanitizeUserDataForStorage(u) {
    if (!u) return null
    return {
      id: u.id,
      nama: u.nama,
      email: u.email,
      role: u.role,
      nis: u.nis,
      nisn: u.nisn,
      kelas: u.kelas,
      angkatan: u.angkatan,
      tahun_lulus: u.tahun_lulus,
      foto_url: u.foto_url
    }
  }

  // State reaktif otentikasi (Default murni TAMU / GUEST - Jangan pernah percaya localStorage sebelum diverifikasi server!)
  const isLoggedIn = ref(false)
  const userRole = ref('user') // 'admin', 'siswa', atau 'user' (tamu)
  const userName = ref('Pengunjung')
  const userEmail = ref('')
  const userNis = ref('')
  const userNisn = ref('')
  const currentUser = ref(null)
  const isAuthReady = ref(false)

  /**
   * Inisialisasi & Verifikasi Sesi Kredensial Resmi via Supabase Auth (Kriptografis JWT)
   * Kebijakan Zero-Trust: Sesi HANYA diakui jika token JWT valid di server Supabase!
   */
  async function initAuth() {
    if (!isSupabaseConfigured || !supabase) {
      isLoggedIn.value = false
      userRole.value = 'user'
      userName.value = 'Pengunjung'
      currentUser.value = null
      isAuthReady.value = true
      return
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      // JIKA TIDAK ADA SESI RESMI (Atau token expired/palsu) -> RESET TOTAL KE PENGUNJUNG BIASA!
      if (error || !session?.user) {
        isLoggedIn.value = false
        userRole.value = 'user'
        userName.value = 'Pengunjung'
        userEmail.value = ''
        userNis.value = ''
        userNisn.value = ''
        currentUser.value = null

        // Musnahkan semua key localStorage manipulasi yang mungkin disuntikkan penyerang di console
        localStorage.removeItem('hallo_auth_logged_in')
        localStorage.removeItem('hallo_auth_role')
        localStorage.removeItem('hallo_auth_name')
        localStorage.removeItem('hallo_auth_email')
        localStorage.removeItem('hallo_auth_nis')
        localStorage.removeItem('hallo_auth_nisn')
        localStorage.removeItem('hallo_auth_user_data')
        localStorage.removeItem('hallo_temp_role')
        return
      }

      // SESI RESMI DARI SUPABASE AUTH TERBUKTI VALID
      const authUser = session.user
      isLoggedIn.value = true

      // Ambil data profil dari public.users (Hanya kolom profil)
      let { data: profile } = await supabase
        .from('users')
        .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, foto_url')
        .eq('id', authUser.id)
        .maybeSingle()

      // Fallback jika UUID di auth.users berbeda dengan UUID di public.users (cocokkan via email / NISN / NIS)
      if (!profile && authUser.email) {
        const safeEmail = authUser.email.replace(/[^a-zA-Z0-9@._-]/g, '')
        const emailPrefix = safeEmail.split('@')[0]
        const { data: fallbackProfile } = await supabase
          .from('users')
          .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, foto_url')
          .or(`email.ilike."${safeEmail}",nisn.eq."${emailPrefix}",nis.eq."${emailPrefix}"`)
          .maybeSingle()
        if (fallbackProfile) {
          profile = fallbackProfile
        }
      }

      let determinedRole = String(
        profile?.role || authUser.app_metadata?.role || authUser.user_metadata?.role || 'user'
      ).trim().toLowerCase()

      // VERIFIKASI KEAMANAN TINGKAT SERVER:
      // Jika mengaku 'admin', validasi langsung ke database PostgreSQL via fungsi RPC is_admin()!
      if (determinedRole === 'admin') {
        try {
          const { data: isServerAdmin } = await supabase.rpc('is_admin')
          if (!isServerAdmin) {
            console.error('[SECURITY VIOLATION] Upaya eskalasi hak akses terdeteksi! Database menolak peran admin.')
            determinedRole = 'user'
          }
        } catch (e) {
          console.warn('Gagal verifikasi RPC is_admin di database, reset ke role aman:', e)
          // FAIL-CLOSED: Jangan pernah berikan akses admin jika verifikasi database gagal
          determinedRole = 'user'
        }
      }

      userRole.value = determinedRole
      userName.value = profile?.nama || authUser.user_metadata?.nama || (determinedRole === 'admin' ? 'Guru BK SMADA' : 'Siswa SMADA')
      userEmail.value = profile?.email || authUser.email || ''
      userNis.value = profile?.nis || ''
      userNisn.value = profile?.nisn || ''
      currentUser.value = profile || {
        id: authUser.id,
        nama: userName.value,
        role: determinedRole,
        email: userEmail.value
      }
    } catch (e) {
      console.warn('Gagal inisialisasi sesi Supabase Auth:', e)
      isLoggedIn.value = false
      userRole.value = 'user'
      userName.value = 'Pengunjung'
      currentUser.value = null
    } finally {
      isAuthReady.value = true
    }
  }

  // Flag untuk menghindari double-fetch / Web Locks deadlock saat signInWithPassword berjalan
  let isManualLoginInProgress = false

  // Pasang listener perubahan status autentikasi Supabase
  if (isSupabaseConfigured && supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Gunakan setTimeout(0) sesuai pedoman resmi Supabase JS v2 agar tidak deadlock dengan Web Locks API browser
        setTimeout(() => {
          if (!isManualLoginInProgress) {
            initAuth()
          }
        }, 0)
      } else if (event === 'SIGNED_OUT') {
        isLoggedIn.value = false
        userRole.value = 'user'
        userName.value = 'Pengunjung'
        userEmail.value = ''
        userNis.value = ''
        userNisn.value = ''
        currentUser.value = null
        localStorage.removeItem('hallo_auth_logged_in')
        localStorage.removeItem('hallo_auth_role')
        localStorage.removeItem('hallo_auth_name')
        localStorage.removeItem('hallo_auth_email')
        localStorage.removeItem('hallo_auth_nis')
        localStorage.removeItem('hallo_auth_nisn')
        localStorage.removeItem('hallo_auth_user_data')
        localStorage.removeItem('hallo_temp_role')
      }
    })

    // Jalankan pengecekan sesi resmi saat start
    initAuth()
  }

  /**
   * Autentikasi Standar Industri via Supabase Auth & Server-side Bcrypt Hashing
   * Mendukung login menggunakan NISN, NIS, maupun Email siswa/admin
   */
  async function loginWithCredentials(inputIdentifier, inputPassword) {
    const cleanId = (inputIdentifier || '').trim().toLowerCase()
    const cleanPass = (inputPassword || '').trim()

    if (!cleanId || !cleanPass) {
      return { success: false, message: 'NISN / NIS / Email dan kata sandi wajib diisi.' }
    }

    // Sanitasi ketat identifier: hanya perbolehkan karakter alfanumerik, @, titik, dash, underscore
    // Mencegah PostgREST filter injection (operator seperti eq., or., dll.)
    const validIdentifierRegex = /^[a-zA-Z0-9@._-]+$/
    if (!validIdentifierRegex.test(cleanId) || cleanId.length > 100) {
      return { success: false, message: 'Format NISN, NIS, atau Email tidak valid.' }
    }

    if (!isSupabaseConfigured || !supabase) {
      return { 
        success: false, 
        message: 'Koneksi database Supabase belum terkonfigurasi. Pastikan variabel lingkungan Supabase telah aktif.' 
      }
    }

    isManualLoginInProgress = true
    try {
      // 1. Dapatkan email akun resmi via RPC secure resolver di sisi database
      let targetEmail = null
      try {
        const { data: resolvedEmail } = await supabase.rpc('resolve_login_email', { p_identifier: cleanId })
        if (resolvedEmail) {
          targetEmail = resolvedEmail
        }
      } catch (e) {
        console.warn('RPC resolve_login_email fallback:', e)
      }

      // Fallback resolver jika RPC SQL migrasi belum dijalankan
      if (!targetEmail) {
        if (cleanId.includes('@')) {
          targetEmail = cleanId
        } else {
          // Cari email / format nisn di tabel users dengan sanitasi string literal
          const safeId = cleanId.replace(/[^a-zA-Z0-9._-]/g, '')
          const { data: userLookup } = await supabase
            .from('users')
            .select('email, nisn, nis')
            .or(`nisn.eq."${safeId}",nis.eq."${safeId}",email.ilike."${safeId}"`)
            .maybeSingle()

          if (userLookup) {
            targetEmail = userLookup.email || (userLookup.nisn ? `${userLookup.nisn}@siswa.smada.sch.id` : `${userLookup.nis}@siswa.smada.sch.id`)
          }
        }
      }

      // Hindari user enumeration: tampilkan pesan kesalahan umum yang seragam
      const genericAuthErrorMessage = 'Kata sandi atau identitas login salah. Silakan periksa kembali.'

      if (!targetEmail) {
        return { success: false, message: genericAuthErrorMessage }
      }

      // 2. Autentikasi SERVER-SIDE via Supabase Auth (Bcrypt Hashed)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail.toLowerCase().trim(),
        password: cleanPass
      })

      if (authError) {
        return { 
          success: false, 
          message: genericAuthErrorMessage 
        }
      }

      const userId = authData.user.id

      // 3. Ambil data profil dari public.users (TANPA kolom password!)
      let { data: profile } = await supabase
        .from('users')
        .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, foto_url')
        .eq('id', userId)
        .maybeSingle()

      if (!profile) {
        // Fallback jika id profile dicari via identifier ter-sanitasi
        const safeTargetEmail = targetEmail.replace(/[^a-zA-Z0-9@._-]/g, '')
        const safeId = cleanId.replace(/[^a-zA-Z0-9._-]/g, '')
        const { data: fallbackProfile } = await supabase
          .from('users')
          .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, foto_url')
          .or(`email.ilike."${safeTargetEmail}",nisn.eq."${safeId}",nis.eq."${safeId}"`)
          .maybeSingle()
        profile = fallbackProfile
      }

      const role = String(
        profile?.role || authData.user.app_metadata?.role || authData.user.user_metadata?.role || 'user'
      ).trim().toLowerCase()
      const name = profile?.nama || authData.user.user_metadata?.nama || (role === 'admin' ? 'Guru BK SMADA' : 'Siswa SMADA')

      isLoggedIn.value = true
      userRole.value = role
      userName.value = name
      userEmail.value = profile?.email || authData.user.email || ''
      userNis.value = profile?.nis || ''
      userNisn.value = profile?.nisn || ''
      currentUser.value = profile || { id: userId, nama: name, role, email: userEmail.value }

      localStorage.setItem('hallo_auth_logged_in', 'true')
      localStorage.setItem('hallo_auth_role', role)
      localStorage.setItem('hallo_auth_name', name)
      localStorage.setItem('hallo_auth_user_data', JSON.stringify(sanitizeUserDataForStorage(currentUser.value)))

      return { success: true, role, user: currentUser.value }
    } catch (err) {
      console.error('Pengecualian saat login:', err)
      return { success: false, message: 'Terjadi kesalahan sistem saat memproses login.' }
    } finally {
      isManualLoginInProgress = false
    }
  }

  /**
   * Mengambil data profil terbaru dari Supabase
   */
  async function refreshUserProfile() {
    if (!currentUser.value?.id || !supabase) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, ttl, alamat_lengkap, jenis_tinggal, alat_transportasi, no_wa, nama_ortu, pekerjaan_ortu, no_wa_ortu, asal_smp, foto_url')
        .eq('id', currentUser.value.id)
        .maybeSingle()

      if (!error && data) {
        currentUser.value = data
        userName.value = data.nama || userName.value
        userEmail.value = data.email || ''
        userNis.value = data.nis || ''
        userNisn.value = data.nisn || ''
        localStorage.setItem('hallo_auth_user_data', JSON.stringify(sanitizeUserDataForStorage(data)))
      }
    } catch (err) {
      console.warn('Gagal me-refresh profil pengguna:', err)
    }
  }

  /**
   * Menyimpan pembaruan biodata siswa ke Supabase
   */
  async function updateProfile(fields) {
    if (!currentUser.value?.id) {
      return { success: false, message: 'Sesi login tidak valid. Silakan login kembali.' }
    }

    // Siswa tidak diizinkan mengubah database users secara langsung — wajib melalui antrean verifikasi BK
    if (userRole.value === 'siswa') {
      return { success: false, message: 'Akses ditolak: Siswa wajib mengajukan perubahan data melalui antrean verifikasi Guru BK.' }
    }

    if (!isSupabaseConfigured || !supabase) {
      return { success: false, message: 'Koneksi database belum aktif.' }
    }

    try {
      const updatePayload = {
        foto_url: fields.foto_url !== undefined ? (fields.foto_url || null) : (currentUser.value.foto_url || null),
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
        updated_at: new Date().toISOString()
      }

      if (fields.nama) updatePayload.nama = fields.nama
      if (fields.kelas) updatePayload.kelas = fields.kelas

      let { data, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', currentUser.value.id)
        .select()
        .maybeSingle()

      if (error && (error.code === '42703' || error.message?.includes('foto_url'))) {
        const fallbackPayload = { ...updatePayload }
        delete fallbackPayload.foto_url
        const retry = await supabase
          .from('users')
          .update(fallbackPayload)
          .eq('id', currentUser.value.id)
          .select()
          .maybeSingle()

        if (!retry.error) {
          data = retry.data
          error = null
        }
      }

      if (error) {
        console.error('Gagal memperbarui profil di Supabase:', error)
        return { success: false, message: 'Gagal menyimpan perubahan ke database: ' + error.message }
      }

      const mergedUser = { ...currentUser.value, ...(data || updatePayload) }
      currentUser.value = mergedUser
      userName.value = mergedUser.nama || userName.value
      userEmail.value = mergedUser.email || ''
      localStorage.setItem('hallo_auth_user_data', JSON.stringify(sanitizeUserDataForStorage(mergedUser)))
      localStorage.setItem('hallo_auth_name', userName.value)

      return { success: true, message: 'Biodata profil berhasil disimpan!' }
    } catch (err) {
      console.error('Error saat menyimpan profil:', err)
      return { success: false, message: 'Terjadi kesalahan sistem saat menyimpan profil.' }
    }
  }

  /**
   * Mengubah kata sandi akun secara aman (Server-side verification)
   */
  async function changePassword(oldPassword, newPassword) {
    if (!isLoggedIn.value || !supabase) {
      return { success: false, message: 'Sesi login tidak valid. Silakan login kembali.' }
    }

    const cleanNewPass = (newPassword || '').trim()
    if (cleanNewPass.length < 8) {
      return { success: false, message: 'Kata sandi baru minimal 8 karakter.' }
    }
    if (!/[A-Z]/.test(cleanNewPass) || !/[0-9]/.test(cleanNewPass)) {
      return { success: false, message: 'Kata sandi harus mengandung minimal 1 huruf besar dan 1 angka.' }
    }

    try {
      // 1. Coba lewat RPC server-side verification pgcrypto
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('user_change_password', {
        p_old_password: oldPassword,
        p_new_password: cleanNewPass
      })

      if (!rpcErr && rpcRes) {
        return rpcRes
      }

      // 2. Fallback via native Supabase Auth update
      const { error } = await supabase.auth.updateUser({
        password: cleanNewPass
      })

      if (error) {
        return { success: false, message: 'Gagal memperbarui kata sandi: ' + error.message }
      }

      return { success: true, message: 'Kata sandi berhasil diperbarui!' }
    } catch (err) {
      return { success: false, message: 'Terjadi kesalahan saat memperbarui kata sandi: ' + err.message }
    }
  }

  /**
   * Keluar / Logout sesi dari Supabase Auth & LocalStorage
   */
  async function logout() {
    isLoggedIn.value = false
    userRole.value = 'user'
    userName.value = 'Pengguna SMADA'
    userEmail.value = ''
    userNis.value = ''
    userNisn.value = ''
    currentUser.value = null

    localStorage.removeItem('hallo_auth_logged_in')
    localStorage.removeItem('hallo_auth_role')
    localStorage.removeItem('hallo_auth_name')
    localStorage.removeItem('hallo_auth_email')
    localStorage.removeItem('hallo_auth_nis')
    localStorage.removeItem('hallo_auth_nisn')
    localStorage.removeItem('hallo_auth_user_data')
    localStorage.removeItem('hallo_temp_role')

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut()
      } catch (err) {
        console.warn('Error saat sign out Supabase:', err)
      }
    }
  }

  // --- MANAJEMEN AKUN PENGGUNA (KHUSUS ADMIN GURU BK) ---
  const allUsers = ref([])
  const isLoadingUsers = ref(false)

  async function fetchAllUsers() {
    if (!supabase) return { success: false, message: 'Database belum terhubung' }
    if (userRole.value !== 'admin') {
      return { success: false, message: 'Akses ditolak: Hanya Guru BK (Admin) yang dapat mengakses daftar akun.' }
    }
    isLoadingUsers.value = true
    try {
      // Keamanan: HANYA ambil kolom profil publik, kolom password tidak pernah diambil!
      const { data, error } = await supabase
        .from('users')
        .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, created_at, updated_at')
        .order('nama', { ascending: true })

      if (error) {
        console.error('Gagal mengambil daftar pengguna:', error)
        return { success: false, message: error.message }
      }

      allUsers.value = data || []
      return { success: true, data: allUsers.value }
    } catch (err) {
      console.error('Error fetch all users:', err)
      return { success: false, message: err.message }
    } finally {
      isLoadingUsers.value = false
    }
  }

  async function adminUpdateUser(userId, updatedFields) {
    if (!supabase) return { success: false, message: 'Database belum terhubung' }
    if (userRole.value !== 'admin') {
      return { success: false, message: 'Akses ditolak: Hanya Guru BK (Admin) yang dapat memperbarui akun pengguna.' }
    }
    try {
      const payload = {
        nama: updatedFields.nama,
        email: updatedFields.email || null,
        nis: updatedFields.nis || null,
        nisn: updatedFields.nisn || null,
        kelas: updatedFields.kelas || null,
        role: updatedFields.role || 'siswa',
        angkatan: updatedFields.angkatan || 61,
        tahun_lulus: updatedFields.tahun_lulus || 2027,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', userId)
        .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, created_at, updated_at')
        .single()

      if (error) {
        return { success: false, message: error.message }
      }

      // Jika ada perubahan password baru, enkripsi via server-side RPC
      if (updatedFields.password && updatedFields.password.trim()) {
        await adminResetPassword(userId, updatedFields.password.trim())
      }

      // Perbarui di allUsers lokal
      const idx = allUsers.value.findIndex(u => u.id === userId)
      if (idx !== -1) {
        allUsers.value[idx] = { ...allUsers.value[idx], ...data }
      }

      return { success: true, user: data }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  async function adminResetPassword(userId, newPassword) {
    if (!supabase) return { success: false, message: 'Database belum terhubung.' }
    if (userRole.value !== 'admin') {
      return { success: false, message: 'Akses ditolak: Hanya Guru BK (Admin) yang dapat mereset kata sandi akun pengguna.' }
    }

    // Wajibkan password baru secara eksplisit — tidak boleh ada default
    if (!newPassword || !newPassword.trim()) {
      return { success: false, message: 'Kata sandi baru wajib diisi. Tidak ada kata sandi bawaan demi keamanan.' }
    }

    const cleanPass = newPassword.trim()

    // Validasi kekuatan password minimum
    if (cleanPass.length < 8) {
      return { success: false, message: 'Kata sandi baru minimal 8 karakter.' }
    }
    if (!/[A-Z]/.test(cleanPass) || !/[0-9]/.test(cleanPass)) {
      return { success: false, message: 'Kata sandi harus mengandung minimal 1 huruf besar dan 1 angka.' }
    }

    try {
      // Panggil RPC aman di sisi server database (Bcrypt hashing)
      const { data, error } = await supabase.rpc('admin_reset_user_password', {
        p_user_id: userId,
        p_new_password: cleanPass
      })

      if (error) {
        return { success: false, message: 'Gagal mereset kata sandi. Silakan coba lagi.' }
      }

      return data || { success: true, message: 'Kata sandi berhasil direset dan dienkripsi.' }
    } catch (err) {
      return { success: false, message: 'Terjadi kesalahan saat mereset kata sandi.' }
    }
  }

  return {
    isAuthReady,
    isLoggedIn,
    userRole,
    userName,
    userEmail,
    userNis,
    userNisn,
    currentUser,
    allUsers,
    isLoadingUsers,
    fetchAllUsers,
    adminUpdateUser,
    adminResetPassword,
    loginWithCredentials,
    refreshUserProfile,
    updateProfile,
    changePassword,
    logout,
    initAuth
  }
})

