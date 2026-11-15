import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  // State reaktif otentikasi
  const isLoggedIn = ref(false)
  const userRole = ref('user') // 'admin', 'siswa', atau 'user'
  const userName = ref('Pengguna SMADA')
  const userEmail = ref('')
  const userNis = ref('')
  const userNisn = ref('')
  const currentUser = ref(null)

  // Inisialisasi awal sinkron dari Supabase Auth / Local Cache yang aman (tanpa password)
  try {
    const rawUserData = localStorage.getItem('hallo_auth_user_data')
    if (rawUserData) {
      const parsed = JSON.parse(rawUserData)
      if (parsed) {
        delete parsed.password
        currentUser.value = parsed
        userName.value = parsed.nama || userName.value
        userEmail.value = parsed.email || ''
        userNis.value = parsed.nis || ''
        userNisn.value = parsed.nisn || ''
        userRole.value = parsed.role || 'user'
        isLoggedIn.value = localStorage.getItem('hallo_auth_logged_in') === 'true'
      }
    }
  } catch (e) {
    currentUser.value = null
  }

  /**
   * Inisialisasi & Verifikasi Sesi Kredensial Resmi via Supabase Auth (JWT Token)
   */
  async function initAuth() {
    if (!isSupabaseConfigured || !supabase) return

    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session?.user) {
        // Jika sesi invalid atau expired, bersihkan state
        if (localStorage.getItem('hallo_auth_logged_in') === 'true') {
          // Hanya bersihkan jika tidak ada sesi Supabase aktif
          // Biarkan session handler mengatur pembaruan
        }
        return
      }

      isLoggedIn.value = true
      const authUser = session.user

      // Ambil data profil dari public.users (Hanya kolom publik, tanpa password)
      const { data: profile } = await supabase
        .from('users')
        .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, foto_url')
        .eq('id', authUser.id)
        .maybeSingle()

      if (profile) {
        userRole.value = profile.role || 'user'
        userName.value = profile.nama || userName.value
        userEmail.value = profile.email || authUser.email || ''
        userNis.value = profile.nis || ''
        userNisn.value = profile.nisn || ''
        currentUser.value = profile
      } else {
        const roleFromMeta = authUser.app_metadata?.role || authUser.user_metadata?.role || 'user'
        userRole.value = roleFromMeta
        userName.value = authUser.user_metadata?.nama || userName.value
        userEmail.value = authUser.email || ''
        currentUser.value = {
          id: authUser.id,
          nama: userName.value,
          role: roleFromMeta,
          email: userEmail.value
        }
      }

      localStorage.setItem('hallo_auth_logged_in', 'true')
      localStorage.setItem('hallo_auth_role', userRole.value)
      localStorage.setItem('hallo_auth_name', userName.value)
      localStorage.setItem('hallo_auth_user_data', JSON.stringify(currentUser.value))
    } catch (e) {
      console.warn('Gagal inisialisasi sesi Supabase Auth:', e)
    }
  }

  // Pasang listener perubahan status autentikasi Supabase
  if (isSupabaseConfigured && supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        isLoggedIn.value = true
        await initAuth()
      } else if (event === 'SIGNED_OUT') {
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
      }
    })

    // Jalankan pengecekan sesi otomatis saat start
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

    if (!isSupabaseConfigured || !supabase) {
      return { 
        success: false, 
        message: 'Koneksi database Supabase belum terkonfigurasi. Pastikan variabel lingkungan Supabase telah aktif.' 
      }
    }

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
          // Cari email / format nisn di tabel users tanpa mengekspos password
          const { data: userLookup } = await supabase
            .from('users')
            .select('email, nisn, nis')
            .or(`nisn.eq.${cleanId},nis.eq.${cleanId},email.ilike.${cleanId}`)
            .maybeSingle()

          if (userLookup) {
            targetEmail = userLookup.email || (userLookup.nisn ? `${userLookup.nisn}@siswa.smada.sch.id` : `${userLookup.nis}@siswa.smada.sch.id`)
          }
        }
      }

      if (!targetEmail) {
        return { success: false, message: 'Akun dengan NISN, NIS, atau Email tersebut tidak ditemukan.' }
      }

      // 2. Autentikasi SERVER-SIDE via Supabase Auth (Bcrypt Hashed)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail.toLowerCase().trim(),
        password: cleanPass
      })

      if (authError) {
        return { 
          success: false, 
          message: 'Kata sandi atau identitas login salah. Silakan periksa kembali kata sandi Anda.' 
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
        // Fallback jika id profile dicari via identifier
        const { data: fallbackProfile } = await supabase
          .from('users')
          .select('id, nama, email, nis, nisn, role, kelas, angkatan, tahun_lulus, no_wa, foto_url')
          .or(`email.ilike.${targetEmail},nisn.eq.${cleanId},nis.eq.${cleanId}`)
          .maybeSingle()
        profile = fallbackProfile
      }

      const role = profile?.role || authData.user.app_metadata?.role || authData.user.user_metadata?.role || 'user'
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
      localStorage.setItem('hallo_auth_user_data', JSON.stringify(currentUser.value))

      return { success: true, role, user: currentUser.value }
    } catch (err) {
      console.error('Pengecualian saat login:', err)
      return { success: false, message: 'Terjadi kesalahan sistem saat memproses login.' }
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
        localStorage.setItem('hallo_auth_user_data', JSON.stringify(data))
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
      localStorage.setItem('hallo_auth_user_data', JSON.stringify(mergedUser))
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
    if (cleanNewPass.length < 6) {
      return { success: false, message: 'Kata sandi baru minimal 6 karakter.' }
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

  async function adminResetPassword(userId, newPassword = 'smadahebat') {
    if (!supabase) return { success: false, message: 'Database belum terhubung' }
    try {
      // Panggil RPC aman di sisi server database (Bcrypt hashing)
      const { data, error } = await supabase.rpc('admin_reset_user_password', {
        p_user_id: userId,
        p_new_password: newPassword
      })

      if (error) {
        return { success: false, message: error.message }
      }

      return data || { success: true, message: 'Kata sandi berhasil direset dan dienkripsi.' }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  return {
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

