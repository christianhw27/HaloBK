import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // Mode langsung masuk tanpa login gate
  const isLoggedIn = ref(true)
  const userRole = ref(localStorage.getItem('hallo_temp_role') || 'admin') // default 'admin' agar seluruh fitur bisa dicoba
  const userName = ref(userRole.value === 'admin' ? 'Guru BK SMADA' : 'Alumni SMADA')

  function setRole(role) {
    userRole.value = role
    userName.value = role === 'admin' ? 'Guru BK SMADA' : 'Alumni SMADA'
    localStorage.setItem('hallo_temp_role', role)
  }

  function toggleRole() {
    if (userRole.value === 'admin') {
      setRole('alumni')
    } else {
      setRole('admin')
    }
  }

  return {
    isLoggedIn,
    userRole,
    userName,
    setRole,
    toggleRole
  }
})
