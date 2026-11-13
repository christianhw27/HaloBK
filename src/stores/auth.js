import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const savedLoggedIn = localStorage.getItem('hallo_auth_logged_in')
  const savedRole = localStorage.getItem('hallo_auth_role') || 'user'
  const savedName = localStorage.getItem('hallo_auth_name') || ''
  const savedEmail = localStorage.getItem('hallo_auth_email') || ''
  const savedNis = localStorage.getItem('hallo_auth_nis') || ''
  const savedNisn = localStorage.getItem('hallo_auth_nisn') || ''

  let initialUserData = null
  try {
    const rawUserData = localStorage.getItem('hallo_auth_user_data')
    if (rawUserData) {
      initialUserData = JSON.parse(rawUserData)
      if (initialUserData && initialUserData.password) {
        delete initialUserData.password
        localStorage.setItem('hallo_auth_user_data', JSON.stringify(initialUserData))
      }
    }
  } catch (e) {
    initialUserData = null
  }

  // Status autentikasi: default false jika belum login
  const isLoggedIn = ref(savedLoggedIn === 'true')
  const userRole = ref(savedRole) // 'admin', 'siswa', atau 'user'
  const userName = ref(savedName || 'Pengguna SMADA')
  const userEmail = ref(savedEmail)
  const userNis = ref(savedNis)
  const userNisn = ref(savedNisn)
  const currentUser = ref(initialUserData)

  /**
   * Autentikasi langsung ke Database Supabase
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
      let user = null
      let queryError = null

      // 1. Coba pencarian lengkap termasuk kolom nisn
      const tryWithNisn = await supabase
        .from('users')
        .select('*')
        .or(`email.ilike.${cleanId},nis.eq.${cleanId},nisn.eq.${cleanId}`)
        .maybeSingle()

      // Jika kolom nisn belum ada di tabel users Supabase (error code 42703)
      if (tryWithNisn.error && (tryWithNisn.error.code === '42703' || tryWithNisn.error.message?.includes('nisn'))) {
        const fallback = await supabase
          .from('users')
          .select('*')
          .or(`email.ilike.${cleanId},nis.eq.${cleanId}`)
          .maybeSingle()
        user = fallback.data
        queryError = fallback.error
      } else {
        user = tryWithNisn.data
        queryError = tryWithNisn.error
      }

      if (queryError) {
        console.error('Error saat login ke database:', queryError)
        return { success: false, message: 'Gagal terhubung ke database. Silakan periksa koneksi Anda.' }
      }

      if (!user) {
        return { success: false, message: 'Akun dengan NISN, NIS, atau Email tersebut tidak ditemukan.' }
      }

      // Validasi kata sandi dari database
      if (user.password !== cleanPass) {
        return { success: false, message: 'Kata sandi salah. Silakan periksa kembali kata sandi Anda.' }
      }

      // Tentukan peran pengguna
      const role = user.role === 'admin' ? 'admin' : (user.role === 'siswa' ? 'siswa' : 'user')
      const name = user.nama || (role === 'admin' ? 'Guru BK SMADA' : 'Siswa SMADA')

      // Keamanan: Hapus properti kata sandi sebelum disimpan ke state & LocalStorage
      const safeUser = { ...user }
      delete safeUser.password

      isLoggedIn.value = true
      userRole.value = role
      userName.value = name
      userEmail.value = safeUser.email || ''
      userNis.value = safeUser.nis || ''
      userNisn.value = safeUser.nisn || ''
      currentUser.value = safeUser

      localStorage.setItem('hallo_auth_logged_in', 'true')
      localStorage.setItem('hallo_auth_role', role)
      localStorage.setItem('hallo_auth_name', name)
      localStorage.setItem('hallo_auth_email', safeUser.email || '')
      localStorage.setItem('hallo_auth_nis', safeUser.nis || '')
      localStorage.setItem('hallo_auth_nisn', safeUser.nisn || '')
      localStorage.setItem('hallo_auth_user_data', JSON.stringify(safeUser))

      return { success: true, role, user: safeUser }
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
        .select('*')
        .eq('id', currentUser.value.id)
        .maybeSingle()

      if (!error && data) {
        const safeData = { ...data }
        delete safeData.password
        currentUser.value = safeData
        userName.value = safeData.nama || userName.value
        userEmail.value = safeData.email || ''
        userNis.value = safeData.nis || ''
        userNisn.value = safeData.nisn || ''
        localStorage.setItem('hallo_auth_user_data', JSON.stringify(safeData))
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

      // Jika ada perubahan nama / kelas (misalnya oleh admin)
      if (fields.nama) updatePayload.nama = fields.nama
      if (fields.kelas) updatePayload.kelas = fields.kelas

      let { data, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', currentUser.value.id)
        .select()
        .maybeSingle()

      // Jika kolom foto_url belum ditambahkan di Supabase, coba simpan tanpa foto_url
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

      // Perbarui state lokal & localStorage
      const mergedUser = { ...currentUser.value, ...(data || updatePayload) }
      delete mergedUser.password
      currentUser.value = mergedUser
      userName.value = mergedUser.nama || userName.value
      userEmail.value = mergedUser.email || ''
      localStorage.setItem('hallo_auth_user_data', JSON.stringify(mergedUser))
      localStorage.setItem('hallo_auth_name', userName.value)
      if (mergedUser.email) localStorage.setItem('hallo_auth_email', mergedUser.email)

      return { success: true, message: 'Biodata profil berhasil disimpan!' }
    } catch (err) {
      console.error('Error saat menyimpan profil:', err)
      return { success: false, message: 'Terjadi kesalahan sistem saat menyimpan profil.' }
    }
  }

  /**
   * Mengubah kata sandi akun
   */
  async function changePassword(oldPassword, newPassword) {
    if (!currentUser.value?.id) {
      return { success: false, message: 'Sesi login tidak valid. Silakan login kembali.' }
    }

    if (currentUser.value.password && currentUser.value.password !== oldPassword.trim()) {
      return { success: false, message: 'Kata sandi lama yang Anda masukkan tidak cocok.' }
    }

    const cleanNewPass = (newPassword || '').trim()
    if (cleanNewPass.length < 6) {
      return { success: false, message: 'Kata sandi baru minimal 6 karakter.' }
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({
          password: cleanNewPass,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.value.id)

      if (error) {
        return { success: false, message: 'Gagal memperbarui kata sandi: ' + error.message }
      }

      currentUser.value.password = cleanNewPass
      localStorage.setItem('hallo_auth_user_data', JSON.stringify(currentUser.value))

      return { success: true, message: 'Kata sandi berhasil diperbarui!' }
    } catch (err) {
      return { success: false, message: 'Terjadi kesalahan saat memperbarui kata sandi.' }
    }
  }

  /**
   * Keluar / Logout sesi
   */
  function logout() {
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
  }

  return {
    isLoggedIn,
    userRole,
    userName,
    userEmail,
    userNis,
    userNisn,
    currentUser,
    loginWithCredentials,
    refreshUserProfile,
    updateProfile,
    changePassword,
    logout
  }
})
