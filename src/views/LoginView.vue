<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { isSupabaseConfigured } from '@/lib/supabase'

const router = useRouter()
const authStore = useAuthStore()

const mode = ref('login')

const email = ref('')
const password = ref('')
const fullName = ref('')
const selectedRole = ref('alumni')
const showPassword = ref(false)

const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)

async function handleAuthSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true

  if (mode.value === 'login') {
    const res = await authStore.login(email.value, password.value)
    isLoading.value = false
    if (res.success) {
      router.push('/dashboard')
    } else {
      errorMessage.value = res.message
    }
  } else {
    if (!fullName.value.trim()) {
      errorMessage.value = 'Silakan isi nama lengkap Anda.'
      isLoading.value = false
      return
    }
    const res = await authStore.register(email.value, password.value, fullName.value, selectedRole.value)
    isLoading.value = false
    if (res.success) {
      successMessage.value = 'Pendaftaran berhasil. Silakan periksa email Anda atau masuk langsung.'
      mode.value = 'login'
    } else {
      errorMessage.value = res.message
    }
  }
}

function bypassAsGuest(role) {
  authStore.isLoggedIn = true
  authStore.userRole = role
  authStore.userName = role === 'admin' ? 'Guru BK SMADA' : 'Alumni SMADA'
  localStorage.setItem('hallo_auth_logged_in', 'true')
  localStorage.setItem('hallo_auth_role', role)
  localStorage.setItem('hallo_auth_name', authStore.userName)
  router.push('/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 transition-colors">
    <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      
      <!-- Header Kartu Login Resmi -->
      <div class="p-6 bg-slate-900 text-white text-center border-b border-slate-800">
        <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 mx-auto mb-3 flex items-center justify-center text-amber-400 text-xl">
          <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
        </div>

        <h1 class="font-display font-bold text-xl tracking-tight text-white">
          Halo Alumni SMADA
        </h1>
        <p class="text-xs text-slate-400 mt-1">
          SMA Negeri 2 Ngawi &bull; Sistem Tracer Study
        </p>
      </div>

      <div class="p-6 sm:p-7 space-y-4">
        
        <!-- Status Konfigurasi Supabase -->
        <div
          v-if="!isSupabaseConfigured"
          class="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2"
        >
          <div class="flex items-center gap-1.5 font-semibold">
            <i class="fa-solid fa-circle-info text-amber-600" aria-hidden="true"></i>
            <span>Mode Demo Lokal Aktif</span>
          </div>
          <p class="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            Database cloud Supabase belum dikonfigurasi di file <code class="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">.env</code>. Anda dapat langsung mencoba portal dengan akun demo di bawah:
          </p>
          <div class="pt-1 flex gap-2">
            <button
              @click="bypassAsGuest('alumni')"
              type="button"
              class="px-3 py-1 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold text-xs transition-colors"
            >
              Masuk Alumni
            </button>
            <button
              @click="bypassAsGuest('admin')"
              type="button"
              class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors"
            >
              Masuk Guru BK
            </button>
          </div>
        </div>

        <!-- Pemilih Mode Masuk vs Daftar -->
        <div class="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'login'"
            @click="mode = 'login'; errorMessage = ''"
            class="py-2 px-3 rounded-md font-semibold transition-colors"
            :class="mode === 'login'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'"
          >
            Masuk Akun
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'register'"
            @click="mode = 'register'; errorMessage = ''"
            class="py-2 px-3 rounded-md font-semibold transition-colors"
            :class="mode === 'register'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'"
          >
            Daftar Akun
          </button>
        </div>

        <!-- Peringatan Kesalahan / Sukses -->
        <div
          v-if="errorMessage"
          class="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center justify-between gap-2"
          role="alert"
        >
          <span>{{ errorMessage }}</span>
          <button @click="errorMessage = ''" class="text-rose-500 hover:text-rose-700" aria-label="Tutup pesan kesalahan">
            <i class="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
          </button>
        </div>

        <div
          v-if="successMessage"
          class="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-medium"
          role="status"
        >
          {{ successMessage }}
        </div>

        <!-- Formulir Autentikasi -->
        <form @submit.prevent="handleAuthSubmit" class="space-y-3.5">
          
          <!-- Nama Lengkap (Khusus Mode Registrasi) -->
          <div v-if="mode === 'register'">
            <label for="reg-name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
            <input
              id="reg-name"
              v-model="fullName"
              type="text"
              required
              placeholder="Masukkan nama lengkap"
              class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          <!-- Peran (Khusus Mode Registrasi) -->
          <div v-if="mode === 'register'">
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Daftar Sebagai</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                @click="selectedRole = 'alumni'"
                class="py-2 px-3 rounded-lg border text-xs font-semibold transition-colors"
                :class="selectedRole === 'alumni'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'"
              >
                Alumni Siswa
              </button>
              <button
                type="button"
                @click="selectedRole = 'admin'"
                class="py-2 px-3 rounded-lg border text-xs font-semibold transition-colors"
                :class="selectedRole === 'admin'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'"
              >
                Guru BK
              </button>
            </div>
          </div>

          <!-- Email -->
          <div>
            <label for="auth-email" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Alamat Email</label>
            <input
              id="auth-email"
              v-model="email"
              type="email"
              required
              placeholder="nama@email.com"
              class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          <!-- Kata Sandi -->
          <div>
            <label for="auth-password" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Kata Sandi</label>
            <div class="relative">
              <input
                id="auth-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                placeholder="Minimal 6 karakter"
                class="w-full px-3 pr-9 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
              >
                <i :class="showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            <i v-if="isLoading" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            <span>{{ mode === 'login' ? 'Masuk ke Portal' : 'Daftarkan Akun' }}</span>
          </button>
        </form>

        <div class="text-center pt-2">
          <p class="text-[11px] text-slate-400">
            SMA Negeri 2 Ngawi &bull; Terintegrasi Database Sekolah
          </p>
        </div>

      </div>

    </div>
  </div>
</template>
