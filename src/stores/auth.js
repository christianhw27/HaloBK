import { defineStore } from 'pinia'
import { ref } from 'vue'

// Akun Resmi Peran Admin (Guru BK)
const ADMIN_ACCOUNTS = [
  'admin@smadangawi.sch.id',
  'gurubk@smadangawi.sch.id',
  'admin@smada.sch.id',
  'admin@gmail.com'
]
const ADMIN_PASSWORDS = [
  'smadahebat',
  'admin123',
  'guru123',
  'admin'
]

// Akun Resmi Peran Pengunjung (Tamu / Dummy)
const GUEST_ACCOUNTS = [
  'pengunjung@smadangawi.sch.id',
  'pengunjung@smada.id',
  'tamu@smadangawi.sch.id',
  'tamu@smada.id',
  'pengunjung@gmail.com'
]
const GUEST_PASSWORDS = [
  'pengunjung123',
  'smada123',
  'tamu123',
  'pengunjung'
]

export const useAuthStore = defineStore('auth', () => {
  const savedLoggedIn = localStorage.getItem('hallo_auth_logged_in')
  const savedRole = localStorage.getItem('hallo_auth_role') || 'guest'
  const savedName = localStorage.getItem('hallo_auth_name')

  // Status autentikasi
  const isLoggedIn = ref(savedLoggedIn === 'true')
  const userRole = ref(savedRole) // 'admin' (Guru BK) atau 'guest' (Pengunjung)
  const userName = ref(savedName || (savedRole === 'admin' ? 'Guru BK SMADA' : 'Pengunjung SMADA'))

  /**
   * Masuk sebagai Admin / Guru BK
   */
  function loginAsAdmin(customName = 'Guru BK SMADA') {
    isLoggedIn.value = true
    userRole.value = 'admin'
    userName.value = customName
    localStorage.setItem('hallo_auth_logged_in', 'true')
    localStorage.setItem('hallo_auth_role', 'admin')
    localStorage.setItem('hallo_auth_name', customName)
    localStorage.setItem('hallo_temp_role', 'admin')
  }

  /**
   * Masuk sebagai Pengunjung / Tamu
   */
  function loginAsGuest(customName = 'Pengunjung SMADA') {
    isLoggedIn.value = true
    userRole.value = 'guest'
    userName.value = customName
    localStorage.setItem('hallo_auth_logged_in', 'true')
    localStorage.setItem('hallo_auth_role', 'guest')
    localStorage.setItem('hallo_auth_name', customName)
    localStorage.setItem('hallo_temp_role', 'guest')
  }

  /**
   * Autentikasi dengan email & password
   */
  async function loginWithCredentials(inputEmail, inputPassword) {
    const cleanEmail = (inputEmail || '').trim().toLowerCase()
    const cleanPass = (inputPassword || '').trim()

    if (!cleanEmail || !cleanPass) {
      return { success: false, message: 'Email dan kata sandi wajib diisi.' }
    }

    // 1. Cek kredensial Guru BK (Admin)
    const isAdminEmail = ADMIN_ACCOUNTS.includes(cleanEmail) || cleanEmail.startsWith('admin') || cleanEmail.startsWith('guru')
    if (isAdminEmail) {
      if (ADMIN_PASSWORDS.includes(cleanPass)) {
        loginAsAdmin('Guru BK SMADA')
        return { success: true, role: 'admin' }
      } else {
        return { success: false, message: 'Kata sandi akun Guru BK salah. Silakan coba lagi.' }
      }
    }

    // 2. Cek kredensial Pengunjung (Dummy / Tamu)
    const isGuestEmail = GUEST_ACCOUNTS.includes(cleanEmail) || cleanEmail.startsWith('pengunjung') || cleanEmail.startsWith('tamu')
    if (isGuestEmail) {
      if (GUEST_PASSWORDS.includes(cleanPass) || cleanPass.length >= 4) {
        loginAsGuest('Pengunjung SMADA')
        return { success: true, role: 'guest' }
      } else {
        return { success: false, message: 'Kata sandi akun Pengunjung salah. Silakan coba lagi.' }
      }
    }

    // 3. Jika pengguna memasukkan email umum lainnya
    if (cleanPass.length < 4) {
      return { success: false, message: 'Kata sandi minimal 4 karakter.' }
    }

    const guestDisplayName = cleanEmail.split('@')[0]
    loginAsGuest(guestDisplayName)
    return { success: true, role: 'guest' }
  }

  /**
   * Keluar / Logout sesi
   */
  function logout() {
    isLoggedIn.value = false
    userRole.value = 'guest'
    userName.value = 'Pengunjung SMADA'
    localStorage.removeItem('hallo_auth_logged_in')
    localStorage.setItem('hallo_auth_role', 'guest')
    localStorage.setItem('hallo_auth_name', 'Pengunjung SMADA')
    localStorage.setItem('hallo_temp_role', 'guest')
  }

  return {
    isLoggedIn,
    userRole,
    userName,
    loginAsAdmin,
    loginAsGuest,
    loginWithCredentials,
    logout
  }
})
