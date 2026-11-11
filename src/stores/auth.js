import { defineStore } from 'pinia'
import { ref } from 'vue'

// Akun Resmi Peran Admin (Guru BK)
const ADMIN_ACCOUNTS = [
  'halobksmada@gmail.com',
  'admin@smadangawi.sch.id',
  'gurubk@smadangawi.sch.id',
  'admin@smada.sch.id'
]
const ADMIN_PASSWORDS = [
  'smadahebat',
  'admin123',
  'guru123',
  'admin'
]

// Akun Resmi Peran Pengunjung (User / Tamu)
const USER_ACCOUNTS = [
  'pengunjung@smadangawi.sch.id',
  'pengunjung@smada.id',
  'tamu@smadangawi.sch.id',
  'tamu@smada.id',
  'user@smada.id',
  'user@smadangawi.sch.id',
  'pengunjung@gmail.com'
]
const USER_PASSWORDS = [
  'pengunjung123',
  'smada123',
  'tamu123',
  'user123',
  'pengunjung'
]

export const useAuthStore = defineStore('auth', () => {
  const savedLoggedIn = localStorage.getItem('hallo_auth_logged_in')
  const savedRole = localStorage.getItem('hallo_auth_role') || 'user'
  const savedName = localStorage.getItem('hallo_auth_name')

  // Status autentikasi ketat: default false jika belum login
  const isLoggedIn = ref(savedLoggedIn === 'true')
  const userRole = ref(savedRole) // 'admin' (Guru BK) atau 'user' (Pengunjung)
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
   * Masuk sebagai Pengunjung / User (Tamu)
   */
  function loginAsUser(customName = 'Pengunjung SMADA') {
    isLoggedIn.value = true
    userRole.value = 'user'
    userName.value = customName
    localStorage.setItem('hallo_auth_logged_in', 'true')
    localStorage.setItem('hallo_auth_role', 'user')
    localStorage.setItem('hallo_auth_name', customName)
    localStorage.setItem('hallo_temp_role', 'user')
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

    // 2. Cek kredensial Pengunjung (User)
    const isUserEmail = USER_ACCOUNTS.includes(cleanEmail) || cleanEmail.startsWith('pengunjung') || cleanEmail.startsWith('tamu') || cleanEmail.startsWith('user')
    if (isUserEmail) {
      if (USER_PASSWORDS.includes(cleanPass) || cleanPass.length >= 4) {
        loginAsUser('Pengunjung SMADA')
        return { success: true, role: 'user' }
      } else {
        return { success: false, message: 'Kata sandi akun Pengunjung salah. Silakan coba lagi.' }
      }
    }

    // 3. Email umum lainnya otomatis masuk sebagai Pengunjung (User) jika password valid
    if (cleanPass.length < 4) {
      return { success: false, message: 'Kata sandi minimal 4 karakter.' }
    }

    const displayName = cleanEmail.split('@')[0]
    loginAsUser(displayName)
    return { success: true, role: 'user' }
  }

  /**
   * Keluar / Logout sesi
   */
  function logout() {
    isLoggedIn.value = false
    userRole.value = 'user'
    userName.value = 'Pengunjung SMADA'
    localStorage.removeItem('hallo_auth_logged_in')
    localStorage.setItem('hallo_auth_role', 'user')
    localStorage.setItem('hallo_auth_name', 'Pengunjung SMADA')
    localStorage.setItem('hallo_temp_role', 'user')
  }

  return {
    isLoggedIn,
    userRole,
    userName,
    loginAsAdmin,
    loginAsUser,
    loginWithCredentials,
    logout
  }
})
