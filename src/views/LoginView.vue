<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// Tab aktif: 'admin' (Guru BK) atau 'guest' (Pengunjung)
const activeRoleTab = ref('admin')

// Form Guru BK
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')
const isLoading = ref(false)

// Form Pengunjung (Opsional: nama custom)
const guestName = ref('')

function fillDemoAdmin() {
  email.value = 'gurubk@smadangawi.sch.id'
  password.value = 'smadahebat'
  errorMessage.value = ''
}

async function handleAdminLogin() {
  errorMessage.value = ''
  if (!email.value || !password.value) {
    errorMessage.value = 'Silakan masukkan email dan kata sandi Guru BK.'
    return
  }

  isLoading.value = true
  // Simulasi validasi / login
  setTimeout(() => {
    isLoading.value = false
    authStore.loginAsAdmin('Guru BK SMADA')
    router.push('/dashboard')
  }, 350)
}

function handleGuestLogin() {
  const name = guestName.value.trim() || 'Pengunjung SMADA'
  authStore.loginAsGuest(name)
  router.push('/dashboard')
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
          Halo Alumni SMADA
        </h1>
        <p class="text-xs sm:text-sm text-sky-100 mt-1 font-medium">
          Portal Bimbingan Konseling &amp; Tracer Study SMA Negeri 2 Ngawi
        </p>
      </div>

      <div class="p-6 sm:p-8 space-y-6">
        
        <!-- Pilihan 2 Peran (Role Selector) -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Pilih Peran Masuk
          </label>
          <div class="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-700" role="tablist">
            <button
              type="button"
              role="tab"
              :aria-selected="activeRoleTab === 'admin'"
              @click="activeRoleTab = 'admin'; errorMessage = ''"
              class="py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[44px]"
              :class="activeRoleTab === 'admin'
                ? 'bg-white dark:bg-slate-900 text-[#0284C7] dark:text-sky-300 shadow-sm border border-sky-100 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
            >
              <i class="fa-solid fa-user-shield text-emerald-600 dark:text-emerald-400 text-sm" aria-hidden="true"></i>
              <span>Guru BK</span>
            </button>
            
            <button
              type="button"
              role="tab"
              :aria-selected="activeRoleTab === 'guest'"
              @click="activeRoleTab = 'guest'; errorMessage = ''"
              class="py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[44px]"
              :class="activeRoleTab === 'guest'
                ? 'bg-white dark:bg-slate-900 text-[#0284C7] dark:text-sky-300 shadow-sm border border-sky-100 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
            >
              <i class="fa-solid fa-users text-[#0284C7] dark:text-sky-400 text-sm" aria-hidden="true"></i>
              <span>Pengunjung</span>
            </button>
          </div>
        </div>

        <!-- PERAN 1: GURU BK (ADMIN) -->
        <div v-if="activeRoleTab === 'admin'" class="space-y-4">
          <div class="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 text-xs sm:text-sm text-[#047857] dark:text-emerald-300 leading-relaxed flex items-start gap-2.5">
            <i class="fa-solid fa-shield-halved text-base text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" aria-hidden="true"></i>
            <div>
              <span class="font-bold">Akses Penuh Pengelola:</span> Masuk untuk verifikasi laporan alumni, kelola data Excel, publikasi berita, dan manajemen tracer study.
            </div>
          </div>

          <!-- Pesan Error -->
          <div
            v-if="errorMessage"
            class="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-200 text-sm flex items-center justify-between gap-2"
            role="alert"
          >
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-circle-exclamation text-rose-500" aria-hidden="true"></i>
              <span>{{ errorMessage }}</span>
            </div>
            <button @click="errorMessage = ''" class="text-rose-500 hover:text-rose-700" aria-label="Tutup pesan">
              <i class="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
            </button>
          </div>

          <form @submit.prevent="handleAdminLogin" class="space-y-3.5">
            <div>
              <label for="admin-email" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Guru BK
              </label>
              <div class="relative">
                <i class="fa-regular fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
                <input
                  id="admin-email"
                  v-model="email"
                  type="email"
                  required
                  placeholder="gurubk@smadangawi.sch.id"
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <label for="admin-password" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kata Sandi
              </label>
              <div class="relative">
                <i class="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
                <input
                  id="admin-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
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
              <span>Masuk sebagai Guru BK</span>
            </button>
          </form>

          <!-- Tombol Bantu Pengisian Demo -->
          <div class="pt-2 text-center">
            <button
              type="button"
              @click="fillDemoAdmin"
              class="text-xs font-semibold text-[#0369A1] dark:text-sky-300 hover:underline inline-flex items-center gap-1.5"
            >
              <i class="fa-solid fa-wand-magic-sparkles text-[11px]" aria-hidden="true"></i>
              <span>Klik untuk mengisi akun demo Guru BK otomatis</span>
            </button>
          </div>
        </div>

        <!-- PERAN 2: PENGUNJUNG (DUMMY / TAMU) -->
        <div v-else class="space-y-4">
          <div class="p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/60 text-xs sm:text-sm text-[#0369A1] dark:text-sky-300 leading-relaxed flex items-start gap-2.5">
            <i class="fa-solid fa-circle-info text-base text-[#0284C7] dark:text-sky-400 mt-0.5 shrink-0" aria-hidden="true"></i>
            <div>
              <span class="font-bold">Mode Penelusuran Publik:</span> Terbuka untuk siswa, alumni, orang tua siswa, dan masyarakat umum untuk melihat direktori lulusan, grafik statistik, dan lapor diri.
            </div>
          </div>

          <div class="space-y-3.5">
            <div>
              <label for="guest-name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Pengunjung <span class="font-normal text-slate-400">(Opsional)</span>
              </label>
              <div class="relative">
                <i class="fa-regular fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
                <input
                  id="guest-name"
                  v-model="guestName"
                  type="text"
                  placeholder="Contoh: Tamu SMADA / Siswa Kelas X"
                  class="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-colors"
                />
              </div>
            </div>

            <button
              type="button"
              @click="handleGuestLogin"
              class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#10B981] hover:from-[#0369A1] hover:to-[#059669] text-white font-semibold text-sm sm:text-base shadow-sm transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              <i class="fa-solid fa-compass text-sm" aria-hidden="true"></i>
              <span>Jelajahi Portal sebagai Pengunjung</span>
            </button>
          </div>

          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
            Tidak memerlukan kata sandi. Anda dapat langsung melihat grafik dan data alumni secara aman.
          </div>
        </div>

        <!-- Tombol Masuk Cepat / Instant Switcher -->
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-center text-slate-400 uppercase tracking-wider">
            Akses Cepat 1-Klik
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              @click="authStore.loginAsAdmin(); router.push('/dashboard')"
              class="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <i class="fa-solid fa-key text-[11px]" aria-hidden="true"></i>
              <span>Instan Guru BK</span>
            </button>
            <button
              type="button"
              @click="authStore.loginAsGuest(); router.push('/dashboard')"
              class="py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 text-[#0369A1] dark:text-sky-200 border border-sky-200 dark:border-sky-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <i class="fa-solid fa-eye text-[11px]" aria-hidden="true"></i>
              <span>Instan Pengunjung</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  </div>
</template>
