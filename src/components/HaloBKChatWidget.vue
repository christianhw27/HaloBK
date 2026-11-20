<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

// Jangan tampilkan tombol melayang jika sedang berada di halaman konsultasi itu sendiri
const isHiddenRoute = computed(() => {
  const p = route.path || ''
  return p === '/halobk' || p === '/konsultasi' || p === '/admin/chat'
})

function handleClick() {
  if (!authStore.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: '/halobk' } })
    return
  }

  if (authStore.userRole === 'admin') {
    router.push('/admin/chat')
  } else {
    router.push('/halobk')
  }
}
</script>

<template>
  <!-- TOMBOL MELAYANG ELEGAN HALOBK (NAVIGASI KE CHAT KONSULTASI PORTAL) -->
  <aside
    v-if="authStore.isLoggedIn && !isHiddenRoute"
    class="fixed bottom-5 right-4 sm:right-6 z-40 font-sans print:hidden"
    aria-label="Pintasan Konsultasi HaloBK"
  >
    <button
      @click="handleClick"
      type="button"
      class="group relative flex items-center gap-2.5 px-4 py-3 sm:px-5 sm:py-3.5 rounded-full bg-gradient-to-r from-[#0369A1] via-[#0284C7] to-sky-600 text-white font-display font-bold shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/40 dark:border-slate-800 cursor-pointer"
      title="Buka Chat HaloBK SMADA"
      aria-label="Buka Chat HaloBK SMADA"
    >
      <!-- Indikator Online Hijau Pulsing -->
      <span class="relative flex h-2.5 w-2.5">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
      </span>

      <!-- Icon Chat / Bimbingan -->
      <i class="fa-solid fa-comments text-base sm:text-lg" aria-hidden="true"></i>

      <!-- Label Teks -->
      <span class="text-sm tracking-wide">
        HaloBK
      </span>

      <!-- Badge jika ada unread / sesi aktif -->
      <span
        v-if="chatStore.unreadCount > 0"
        class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md"
      >
        {{ chatStore.unreadCount }}
      </span>
    </button>
  </aside>
</template>
