<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')
const isLoading = ref(false)

async function handleLogin() {
  errorMessage.value = ''
  if (!email.value.trim() || !password.value.trim()) {
    errorMessage.value = 'Silakan masukkan email dan kata sandi.'
    return
  }

  isLoading.value = true
  const res = await authStore.loginWithCredentials(email.value, password.value)
  isLoading.value = false

  if (res.success) {
    const target = router.currentRoute.value.query.redirect || '/dashboard'
    router.push(target)
  } else {
    errorMessage.value = res.message || 'Gagal masuk. Periksa kembali email dan kata sandi Anda.'
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-[#EFF6FF] via-[#F8FAFC] to-[#FEF3C7]/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
    
    <!-- Tautan Kembali ke Portal Berita Publik -->
    <div class="max-w-md w-full mx-auto mb-4">
      <router-link
        to="/"
        class="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-[#0369A1] dark:hover:text-sky-300 transition-colors"
      >
        <i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i>
        <span>Kembali ke Portal Berita</span>
      </router-link>
    </div>

    <div class="max-w-md w-full mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-sky-200/80 dark:border-slate-800 shadow-[var(--shadow-card)] overflow-hidden">
      
      <!-- Header Kartu Login Berwarna Khas SMADA -->
      <div class="relative p-6 sm:p-7 text-center bg-gradient-to-br from-[#0284C7] via-[#0369A1] to-[#075985] text-white">
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-[#F59E0B]/20 rounded-full blur-xl pointer-events-none"></div>

        <div class="relative flex items-center justify-center gap-3 mb-3">
          <img
            src="/logo.svg"
            alt="Logo SMA Negeri 2 Ngawi"
            class="w-12 h-12 rounded-xl bg-white p-1.5 shadow-md object-contain shrink-0"
            onerror="this.onerror=null; this.src='/logo.png'"
          />
        </div>

        <h1 class="font-display font-bold text-2xl text-white tracking-tight leading-tight">
          Ruang BK Smada
        </h1>
        <p class="text-xs sm:text-sm text-sky-100 mt-1 font-medium">
          Portal Tracer Study &amp; Bimbingan Konseling SMA Negeri 2 Ngawi
        </p>
      </div>

      <div class="p-6 sm:p-8 space-y-5">
        
        <!-- Pesan Error Validasi -->
        <div
          v-if="errorMessage"
          class="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-200 text-sm flex items-center justify-between gap-2"
          role="alert"
        >
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-circle-exclamation text-rose-500 text-sm" aria-hidden="true"></i>
            <span>{{ errorMessage }}</span>
          </div>
          <button @click="errorMessage = ''" class="text-rose-500 hover:text-rose-700" aria-label="Tutup pesan">
            <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Formulir Login Tunggal (Admin / Akun Terdaftar) -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label for="login-email" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Email atau NIS Siswa
            </label>
            <div class="relative">
              <i class="fa-regular fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
              <input
                id="login-email"
                v-model="email"
                type="text"
                required
                autocomplete="username"
                placeholder="Email Guru BK atau NIS Siswa"
                class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-colors"
              />
            </div>
          </div>

          <div>
            <label for="login-password" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Kata Sandi
            </label>
            <div class="relative">
              <i class="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
              <input
                id="login-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                placeholder="Masukkan kata sandi"
                class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-colors"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                :aria-label="showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'"
              >
                <i :class="showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-3 px-4 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-sm sm:text-base shadow-sm transition-all flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-60"
          >
            <i v-if="isLoading" class="fa-solid fa-circle-notch fa-spin text-sm" aria-hidden="true"></i>
            <i v-else class="fa-solid fa-arrow-right-to-bracket text-sm" aria-hidden="true"></i>
            <span>Masuk ke Sistem</span>
          </button>
        </form>

        <div class="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          Gunakan akun resmi Guru BK atau akun Pengunjung untuk masuk ke sistem.
        </div>

      </div>

    </div>
  </div>
</template>
