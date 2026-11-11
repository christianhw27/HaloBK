import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // Simpan status autentikasi di localStorage
  const savedLoggedIn = localStorage.getItem('hallo_auth_logged_in')
  const savedRole = localStorage.getItem('hallo_auth_role') || 'guest'
  const savedName = localStorage.getItem('hallo_auth_name')

  // Status login awal (default true jika sudah ada sesi tersimpan)
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
   * Masuk sebagai Pengunjung / Tamu (Dummy)
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
   * Set peran langsung
   */
  function setRole(role) {
    if (role === 'admin') {
      loginAsAdmin()
    } else {
      loginAsGuest()
    }
  }

  /**
   * Beralih antara Admin & Pengunjung secara instan
   */
  function toggleRole() {
    if (userRole.value === 'admin') {
      loginAsGuest()
    } else {
      loginAsAdmin()
    }
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
    setRole,
    toggleRole,
    logout
  }
})
