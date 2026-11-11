import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const savedLoggedIn = localStorage.getItem('hallo_auth_logged_in')
  const savedRole = localStorage.getItem('hallo_auth_role') || 'user'
  const savedName = localStorage.getItem('hallo_auth_name') || ''
  const savedEmail = localStorage.getItem('hallo_auth_email') || ''
  const savedNis = localStorage.getItem('hallo_auth_nis') || ''

  // Status autentikasi: default false jika belum login
  const isLoggedIn = ref(savedLoggedIn === 'true')
  const userRole = ref(savedRole) // 'admin' atau 'user'
  const userName = ref(savedName || 'Pengguna SMADA')
  const userEmail = ref(savedEmail)
  const userNis = ref(savedNis)

  /**
   * Autentikasi langsung ke Database Supabase
   * Mendukung login menggunakan Email maupun NIS siswa
   */
  async function loginWithCredentials(inputIdentifier, inputPassword) {
    const cleanId = (inputIdentifier || '').trim().toLowerCase()
    const cleanPass = (inputPassword || '').trim()

    if (!cleanId || !cleanPass) {
      return { success: false, message: 'Email/NIS dan kata sandi wajib diisi.' }
    }

    if (!isSupabaseConfigured || !supabase) {
      return { 
        success: false, 
        message: 'Koneksi database Supabase belum terkonfigurasi. Pastikan variabel lingkungan Supabase telah aktif.' 
      }
    }

    try {
      // Cari akun di tabel users database Supabase berdasarkan email ATAU nis
      const { data: user, error } = await supabase
        .from('users')
        .select('id, nama, email, nis, password, role, kelas, tahun_lulus')
        .or(`email.ilike.${cleanId},nis.eq.${cleanId}`)
        .maybeSingle()

      if (error) {
        console.error('Error saat login ke database:', error)
        return { success: false, message: 'Gagal terhubung ke database. Silakan coba beberapa saat lagi.' }
      }

      if (!user) {
        return { success: false, message: 'Akun dengan Email atau NIS tersebut tidak terdaftar di sistem.' }
      }

      // Validasi kata sandi dari database
      if (user.password !== cleanPass) {
        return { success: false, message: 'Kata sandi salah. Silakan periksa kembali sandi Anda.' }
      }

      // Set status autentikasi dari data resmi database
      const role = user.role === 'admin' ? 'admin' : 'user'
      const name = user.nama || (role === 'admin' ? 'Guru BK SMADA' : 'Pengunjung SMADA')

      isLoggedIn.value = true
      userRole.value = role
      userName.value = name
      userEmail.value = user.email || ''
      userNis.value = user.nis || ''

      localStorage.setItem('hallo_auth_logged_in', 'true')
      localStorage.setItem('hallo_auth_role', role)
      localStorage.setItem('hallo_auth_name', name)
      localStorage.setItem('hallo_auth_email', user.email || '')
      localStorage.setItem('hallo_auth_nis', user.nis || '')

      return { success: true, role, user }
    } catch (err) {
      console.error('Pengecualian saat login:', err)
      return { success: false, message: 'Terjadi kesalahan sistem saat memproses login.' }
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
    localStorage.removeItem('hallo_auth_logged_in')
    localStorage.removeItem('hallo_auth_role')
    localStorage.removeItem('hallo_auth_name')
    localStorage.removeItem('hallo_auth_email')
    localStorage.removeItem('hallo_auth_nis')
    localStorage.removeItem('hallo_temp_role')
  }

  return {
    isLoggedIn,
    userRole,
    userName,
    userEmail,
    userNis,
    loginWithCredentials,
    logout
  }
})
