<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNewsStore } from '@/stores/news'
import { useAuthStore } from '@/stores/auth'
import { NEWS_CATEGORIES, NEWS_CATEGORY_STYLES, NEWS_TABLE_SQL } from '@/lib/starterNews'
import AdminOnlyGuard from '@/components/AdminOnlyGuard.vue'
import NewsFormModal from '@/components/NewsFormModal.vue'
import NewsReaderModal from '@/components/NewsReaderModal.vue'

const newsStore = useNewsStore()
const authStore = useAuthStore()

// Filter & Pencarian Admin
const searchQuery = ref('')
const categoryFilter = ref('ALL')
const statusFilter = ref('ALL')

// Modal Form (Tambah / Edit)
const isFormModalOpen = ref(false)
const editingArticle = ref(null)

// Modal Pratinjau Baca Berita
const isReaderModalOpen = ref(false)
const previewArticle = ref(null)

// Dialog Konfirmasi Hapus
const articleToDelete = ref(null)
const isDeleting = ref(false)

// Status Feedback & Utilitas
const feedbackBanner = ref(null) // { type: 'success' | 'error' | 'info', message: string }
const isSeeding = ref(false)
const isSqlExpanded = ref(false)
const sqlCopied = ref(false)
const busyItemId = ref(null)

let feedbackTimer = null

function showFeedback(type, message) {
  feedbackBanner.value = { type, message }
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    feedbackBanner.value = null
  }, 6000)
}

function dismissFeedback() {
  feedbackBanner.value = null
  if (feedbackTimer) clearTimeout(feedbackTimer)
}

const filteredNewsList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return newsStore.newsList.filter(item => {
    const matchCategory = categoryFilter.value === 'ALL' || item.category === categoryFilter.value
    const matchStatus =
      statusFilter.value === 'ALL' ||
      (statusFilter.value === 'published' && item.isPublished) ||
      (statusFilter.value === 'draft' && !item.isPublished) ||
      (statusFilter.value === 'featured' && item.isFeatured)
    const matchQuery =
      !q ||
      (item.title || '').toLowerCase().includes(q) ||
      (item.summary || '').toLowerCase().includes(q) ||
      (item.author || '').toLowerCase().includes(q)
    return matchCategory && matchStatus && matchQuery
  })
})

const hasActiveFilter = computed(() => {
  return Boolean(searchQuery.value.trim()) || categoryFilter.value !== 'ALL' || statusFilter.value !== 'ALL'
})

function resetFilters() {
  searchQuery.value = ''
  categoryFilter.value = 'ALL'
  statusFilter.value = 'ALL'
}

function getCategoryStyle(category) {
  return NEWS_CATEGORY_STYLES[category] || NEWS_CATEGORY_STYLES['Pengumuman BK']
}

function openCreateModal() {
  editingArticle.value = null
  isFormModalOpen.value = true
}

function openEditModal(item) {
  editingArticle.value = { ...item }
  isFormModalOpen.value = true
}

function closeFormModal() {
  isFormModalOpen.value = false
  editingArticle.value = null
}

function handleSaved(message) {
  showFeedback('success', message || 'Perubahan berita berhasil disimpan.')
}

function openPreviewModal(item) {
  previewArticle.value = item
  isReaderModalOpen.value = true
}

function closePreviewModal() {
  isReaderModalOpen.value = false
  previewArticle.value = null
}

function requestDelete(item) {
  articleToDelete.value = item
}

function cancelDelete() {
  if (isDeleting.value) return
  articleToDelete.value = null
}

async function confirmDelete() {
  if (!articleToDelete.value) return
  isDeleting.value = true
  const targetTitle = articleToDelete.value.title
  const res = await newsStore.deleteNews(articleToDelete.value.id)
  isDeleting.value = false
  articleToDelete.value = null

  if (res.success) {
    showFeedback('success', `Berita "${targetTitle}" berhasil dihapus.`)
  } else {
    showFeedback('error', res.message || 'Gagal menghapus berita.')
  }
}

async function handleTogglePublish(item) {
  busyItemId.value = item.id
  const nextStatus = !item.isPublished
  const res = await newsStore.togglePublish(item)
  busyItemId.value = null

  if (res.success) {
    showFeedback(
      'success',
      nextStatus
        ? `Berita "${item.title}" sekarang ditayangkan di Portal Publik.`
        : `Berita "${item.title}" diubah ke mode Draft (disembunyikan).`
    )
  } else {
    showFeedback('error', res.message || 'Gagal mengubah status tayang.')
  }
}

async function handleToggleFeatured(item) {
  busyItemId.value = item.id
  const nextFeatured = !item.isFeatured
  const res = await newsStore.toggleFeatured(item)
  busyItemId.value = null

  if (res.success) {
    showFeedback(
      'success',
      nextFeatured
        ? `Berita "${item.title}" dipin sebagai Berita Utama.`
        : `Berita "${item.title}" dilepas dari Berita Utama.`
    )
  } else {
    showFeedback('error', res.message || 'Gagal mengubah status Berita Utama.')
  }
}

async function handleSeedStarter() {
  isSeeding.value = true
  const res = await newsStore.seedStarterNews()
  isSeeding.value = false

  if (res.success) {
    showFeedback('success', `${res.count || 5} berita contoh BK berhasil dimuat ke portal.`)
  } else {
    showFeedback('error', res.message || 'Gagal memuat berita contoh.')
  }
}

async function copyTableSql() {
  try {
    await navigator.clipboard.writeText(NEWS_TABLE_SQL)
    sqlCopied.value = true
    setTimeout(() => {
      sqlCopied.value = false
    }, 2500)
  } catch {
    showFeedback('error', 'Clipboard diblokir browser. Silakan salin SQL secara manual dari kotak di bawah.')
    isSqlExpanded.value = true
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape' && articleToDelete.value && !isDeleting.value) {
    cancelDelete()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (newsStore.newsList.length === 0) {
    newsStore.fetchNews()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (feedbackTimer) clearTimeout(feedbackTimer)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Penjaga Akses Sementara (Jika sedang di Mode Alumni) -->
    <AdminOnlyGuard
      v-if="authStore.userRole !== 'admin'"
      description="Anda sedang menggunakan mode pratinjau Alumni. Untuk menambah, mengubah, memublikasikan, atau menghapus artikel di Portal Berita SMA Negeri 2 Ngawi, silakan beralih ke mode Guru BK."
      back-to="/"
      back-label="Kembali ke Portal Berita"
      back-icon="fa-solid fa-newspaper"
    />

    <!-- Area Manajemen Berita (Khusus Guru BK / Admin) -->
    <template v-else>
      <!-- Header Halaman & Aksi Utama -->
      <header class="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#FFE4E6]/65 via-white to-[#FEF3C7]/70 dark:from-rose-950/25 dark:via-slate-900 dark:to-amber-950/20 border border-rose-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE4E6] text-[#BE123C] border border-rose-200 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800 text-xs font-bold uppercase tracking-wider mb-2">
            <i class="fa-solid fa-newspaper text-[11px]" aria-hidden="true"></i>
            <span>Studio Berita BK SMADA</span>
          </div>
          <h1 class="font-display font-bold text-2xl sm:text-3xl text-[#0F172A] dark:text-white tracking-tight">
            Kelola Cerita &amp; Berita Portal
          </h1>
          <p class="text-sm sm:text-base text-[#334155] dark:text-slate-400 mt-1">
            Publikasikan kabar kampus, info beasiswa, agenda BK, dan prestasi alumni yang tampil di halaman depan.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <router-link
            to="/"
            class="min-h-[42px] px-3.5 py-2 rounded-xl border border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 text-[#0369A1] dark:text-sky-300 text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <i class="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden="true"></i>
            <span>Lihat Portal Publik</span>
          </router-link>

          <button
            type="button"
            @click="newsStore.fetchNews()"
            :disabled="newsStore.isLoading"
            class="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-[#334155] dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 transition-colors"
          >
            <i class="fa-solid fa-rotate-right" :class="{ 'fa-spin': newsStore.isLoading }" aria-hidden="true"></i>
            <span>Muat Ulang</span>
          </button>

          <button
            type="button"
            @click="openCreateModal"
            class="min-h-[42px] px-4 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm sm:text-base font-semibold inline-flex items-center gap-2 shadow-sm transition-colors"
          >
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
            <span>Tulis Berita Baru</span>
          </button>
        </div>
      </header>

      <!-- Banner Feedback Operasi CRUD -->
      <div
        v-if="feedbackBanner"
        role="status"
        class="rounded-xl border px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium"
        :class="feedbackBanner.type === 'error'
          ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'"
      >
        <div class="flex items-center gap-2.5">
          <i
            class="fa-solid"
            :class="feedbackBanner.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'"
            aria-hidden="true"
          ></i>
          <span>{{ feedbackBanner.message }}</span>
        </div>
        <button
          type="button"
          @click="dismissFeedback"
          class="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
          aria-label="Tutup notifikasi"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Banner Panduan Setup Tabel Supabase (jika tabel public.berita belum dibuat) -->
      <div
        v-if="newsStore.isTableMissing"
        class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 space-y-3"
      >
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0 mt-0.5">
              <i class="fa-solid fa-database" aria-hidden="true"></i>
            </div>
            <div>
              <h2 class="font-display font-bold text-base text-amber-950 dark:text-amber-100">
                Mode Penyimpanan Browser Aktif (Tabel Supabase `public.berita` Belum Terpasang)
              </h2>
              <p class="text-sm text-amber-900/85 dark:text-amber-200/80 mt-1 leading-relaxed">
                Anda tetap bisa menambah, mengedit, dan menghapus berita sekarang di browser ini. Agar artikel tersinkronisasi online untuk seluruh siswa & alumni, jalankan query pembuatan tabel `public.berita` di Supabase SQL Editor.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              @click="copyTableSql"
              class="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <i class="fa-solid" :class="sqlCopied ? 'fa-check' : 'fa-copy'" aria-hidden="true"></i>
              <span>{{ sqlCopied ? 'SQL Tersalin!' : 'Salin SQL Tabel' }}</span>
            </button>
            <button
              type="button"
              @click="isSqlExpanded = !isSqlExpanded"
              class="min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <span>{{ isSqlExpanded ? 'Sembunyikan SQL' : 'Lihat SQL' }}</span>
            </button>
          </div>
        </div>

        <pre
          v-if="isSqlExpanded"
          class="bg-slate-950 text-slate-100 text-xs leading-relaxed p-3.5 rounded-xl overflow-x-auto border border-slate-800"
        ><code>{{ NEWS_TABLE_SQL }}</code></pre>
      </div>

      <!-- Banner Error Umum -->
      <div
        v-else-if="newsStore.errorMessage"
        class="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="flex items-start gap-3 text-rose-800 dark:text-rose-200 text-sm sm:text-base">
          <i class="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true"></i>
          <div>
            <p class="font-semibold">Gagal memuat berita dari server</p>
            <p class="text-sm opacity-90">{{ newsStore.errorMessage }}</p>
          </div>
        </div>
        <button
          type="button"
          @click="newsStore.fetchNews()"
          class="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold self-start sm:self-center"
        >
          Coba Lagi
        </button>
      </div>

      <!-- 4 Kartu Ringkasan KPI (Empat Pilar Warna) -->
      <section aria-label="Statistik Artikel Berita" class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div class="bg-gradient-to-br from-sky-50/90 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30 rounded-2xl border border-sky-200/80 dark:border-slate-800 p-4 shadow-[var(--shadow-sm)]">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-sm font-semibold text-[#0369A1] dark:text-sky-300">Total Artikel</span>
            <span class="w-9 h-9 rounded-xl bg-[#0284C7] text-white flex items-center justify-center shadow-xs">
              <i class="fa-solid fa-layer-group text-sm" aria-hidden="true"></i>
            </span>
          </div>
          <p class="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white tabular-nums">
            {{ newsStore.newsStats.total }}
          </p>
        </div>

        <div class="bg-gradient-to-br from-emerald-50/90 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-slate-800 p-4 shadow-[var(--shadow-sm)]">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-sm font-semibold text-[#047857] dark:text-emerald-300">Sedang Tayang</span>
            <span class="w-9 h-9 rounded-xl bg-[#10B981] text-white flex items-center justify-center shadow-xs">
              <i class="fa-solid fa-globe text-sm" aria-hidden="true"></i>
            </span>
          </div>
          <p class="font-display font-bold text-2xl sm:text-3xl text-[#047857] dark:text-emerald-400 tabular-nums">
            {{ newsStore.newsStats.published }}
          </p>
        </div>

        <div class="bg-gradient-to-br from-amber-50/90 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-slate-800 p-4 shadow-[var(--shadow-sm)]">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-sm font-semibold text-[#92400E] dark:text-amber-300">Headline Utama</span>
            <span class="w-9 h-9 rounded-xl bg-[#F59E0B] text-slate-950 flex items-center justify-center shadow-xs">
              <i class="fa-solid fa-thumbtack text-sm" aria-hidden="true"></i>
            </span>
          </div>
          <p class="font-display font-bold text-2xl sm:text-3xl text-[#92400E] dark:text-amber-400 tabular-nums">
            {{ newsStore.newsStats.featured }}
          </p>
        </div>

        <div class="bg-gradient-to-br from-rose-50/90 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-rose-950/30 rounded-2xl border border-rose-200/80 dark:border-slate-800 p-4 shadow-[var(--shadow-sm)]">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-sm font-semibold text-[#BE123C] dark:text-rose-300">Draft Tersimpan</span>
            <span class="w-9 h-9 rounded-xl bg-[#E11D48] text-white flex items-center justify-center shadow-xs">
              <i class="fa-solid fa-file-pen text-sm" aria-hidden="true"></i>
            </span>
          </div>
          <p class="font-display font-bold text-2xl sm:text-3xl text-[#BE123C] dark:text-rose-400 tabular-nums">
            {{ newsStore.newsStats.draft }}
          </p>
        </div>
      </section>

      <!-- Bilah Filter & Pencarian -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-[var(--shadow-sm)]">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div class="md:col-span-5 relative">
            <label for="admin-news-search" class="sr-only">Cari berita</label>
            <i class="fa-solid fa-magnifying-glass text-sm text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true"></i>
            <input
              id="admin-news-search"
              v-model="searchQuery"
              type="search"
              placeholder="Cari judul, ringkasan, atau penulis..."
              class="w-full min-h-[42px] pl-10 pr-3 py-2 text-sm sm:text-base bg-slate-50 dark:bg-slate-800/80 border border-[#CBD5E1] dark:border-slate-700 rounded-[10px] text-[#0F172A] dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20"
            />
          </div>

          <div class="md:col-span-3">
            <label for="admin-news-category" class="sr-only">Filter kategori</label>
            <select
              id="admin-news-category"
              v-model="categoryFilter"
              class="w-full min-h-[42px] px-3 py-2 text-sm sm:text-base bg-slate-50 dark:bg-slate-800/80 border border-[#CBD5E1] dark:border-slate-700 rounded-[10px] text-[#0F172A] dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20"
            >
              <option value="ALL">Semua Kategori</option>
              <option v-for="cat in NEWS_CATEGORIES" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </div>

          <div class="md:col-span-2">
            <label for="admin-news-status" class="sr-only">Filter status</label>
            <select
              id="admin-news-status"
              v-model="statusFilter"
              class="w-full min-h-[42px] px-3 py-2 text-sm sm:text-base bg-slate-50 dark:bg-slate-800/80 border border-[#CBD5E1] dark:border-slate-700 rounded-[10px] text-[#0F172A] dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20"
            >
              <option value="ALL">Semua Status</option>
              <option value="published">Tayang Publik</option>
              <option value="draft">Draft</option>
              <option value="featured">Headline Utama</option>
            </select>
          </div>

          <div class="md:col-span-2 flex items-center justify-end gap-2">
            <button
              v-if="hasActiveFilter"
              type="button"
              @click="resetFilters"
              class="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F1F5F9] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-sm font-semibold text-[#334155] dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
            >
              Reset Filter
            </button>
            <span
              v-else
              class="text-sm font-medium text-[#64748B] dark:text-slate-400 tabular-nums"
            >
              {{ filteredNewsList.length }} artikel
            </span>
          </div>
        </div>
      </section>

      <!-- State Memuat Awal -->
      <div
        v-if="newsStore.isLoading && newsStore.newsList.length === 0"
        class="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-6 space-y-4"
      >
        <div v-for="n in 3" :key="n" class="flex items-center gap-4 animate-pulse">
          <div class="w-16 h-12 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
            <div class="h-3 bg-slate-100 dark:bg-slate-800/60 rounded w-1/3"></div>
          </div>
        </div>
      </div>

      <!-- State Kosong -->
      <section
        v-else-if="filteredNewsList.length === 0"
        class="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-8 sm:p-12 text-center shadow-[var(--shadow-sm)]"
      >
        <div class="w-14 h-14 mx-auto rounded-2xl bg-[#E0F2FE] dark:bg-slate-800 text-[#0369A1] dark:text-sky-400 flex items-center justify-center mb-4">
          <i class="fa-regular fa-newspaper text-2xl" aria-hidden="true"></i>
        </div>

        <template v-if="newsStore.newsList.length === 0">
          <h2 class="font-display font-bold text-lg text-[#0F172A] dark:text-white mb-1.5">
            Belum Ada Artikel di Portal Berita
          </h2>
          <p class="text-sm text-[#334155] dark:text-slate-400 max-w-md mx-auto mb-6">
            Tambahkan pengumuman pertama dari Guru BK, atau muat 5 artikel awal seputar Tracer Study, SNBP/SNBT, dan beasiswa agar portal langsung siap dilihat.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              @click="openCreateModal"
              class="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
              <span>Tulis Berita Pertama</span>
            </button>
            <button
              type="button"
              @click="handleSeedStarter"
              :disabled="isSeeding"
              class="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-[#F1F5F9] dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-[#334155] dark:text-slate-100 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
            >
              <i class="fa-solid" :class="isSeeding ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'" aria-hidden="true"></i>
              <span>{{ isSeeding ? 'Memuat Contoh...' : 'Muat 5 Berita Contoh BK' }}</span>
            </button>
          </div>
        </template>

        <template v-else>
          <h2 class="font-display font-bold text-lg text-slate-900 dark:text-white mb-1.5">
            Tidak Ada Berita yang Cocok
          </h2>
          <p class="text-sm text-slate-600 dark:text-slate-400 mb-5">
            Ubah kata kunci pencarian atau pilih filter kategori dan status lain.
          </p>
          <button
            type="button"
            @click="resetFilters"
            class="min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold transition-colors"
          >
            Reset Semua Filter
          </button>
        </template>
      </section>

      <!-- Daftar Berita: Tabel Desktop & Kartu Mobile -->
      <section v-else class="space-y-4">
        <!-- Tabel Desktop (md ke atas) -->
        <div class="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th class="py-3.5 px-4">Artikel & Gambar</th>
                  <th class="py-3.5 px-3 w-40">Kategori</th>
                  <th class="py-3.5 px-3 w-36">Status Tayang</th>
                  <th class="py-3.5 px-3 w-36">Headline</th>
                  <th class="py-3.5 px-4 text-right w-40">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-sm sm:text-base">
                <tr
                  v-for="item in filteredNewsList"
                  :key="item.id"
                  class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <!-- Kolom Judul + Thumbnail -->
                  <td class="py-3.5 px-4">
                    <div class="flex items-start gap-3.5">
                      <div class="w-20 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                        <img
                          v-if="item.imageUrl"
                          :src="item.imageUrl"
                          :alt="item.title"
                          class="w-full h-full object-cover"
                        />
                        <div
                          v-else
                          class="w-full h-full bg-gradient-to-br flex items-center justify-center"
                          :class="[getCategoryStyle(item.category).surface, getCategoryStyle(item.category).accentText]"
                        >
                          <i :class="getCategoryStyle(item.category).icon" aria-hidden="true"></i>
                        </div>
                      </div>

                      <div class="min-w-0 flex-1">
                        <button
                          type="button"
                          @click="openPreviewModal(item)"
                          class="text-left font-display font-bold text-base text-[#0F172A] dark:text-white hover:text-[#0369A1] dark:hover:text-sky-400 line-clamp-1 transition-colors"
                        >
                          {{ item.title }}
                        </button>
                        <p class="text-sm text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {{ item.summary }}
                        </p>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          <span>{{ item.author || 'Tim BK SMADA Ngawi' }}</span>
                          <span aria-hidden="true">&bull;</span>
                          <span>{{ newsStore.formatNewsDate(item.createdAt) }}</span>
                          <span aria-hidden="true">&bull;</span>
                          <span class="tabular-nums">{{ item.views || 0 }} pembaca</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- Kolom Kategori -->
                  <td class="py-3.5 px-3 align-middle">
                    <span
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border whitespace-nowrap"
                      :class="getCategoryStyle(item.category).badge"
                    >
                      <i :class="getCategoryStyle(item.category).icon" class="text-xs" aria-hidden="true"></i>
                      <span>{{ item.category }}</span>
                    </span>
                  </td>

                  <!-- Kolom Toggle Tayang / Draft -->
                  <td class="py-3.5 px-3 align-middle">
                    <button
                      type="button"
                      @click="handleTogglePublish(item)"
                      :disabled="busyItemId === item.id"
                      class="min-h-[34px] px-2.5 py-1 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 border transition-colors disabled:opacity-60"
                      :class="item.isPublished
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'"
                      :title="item.isPublished ? 'Klik untuk ubah jadi Draft' : 'Klik untuk Tayangkan'"
                    >
                      <span
                        class="w-2 h-2 rounded-full"
                        :class="item.isPublished ? 'bg-emerald-500' : 'bg-slate-400'"
                      ></span>
                      <span>{{ item.isPublished ? 'Tayang' : 'Draft' }}</span>
                    </button>
                  </td>

                  <!-- Kolom Toggle Headline -->
                  <td class="py-3.5 px-3 align-middle">
                    <button
                      type="button"
                      @click="handleToggleFeatured(item)"
                      :disabled="busyItemId === item.id"
                      class="min-h-[34px] px-2.5 py-1 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 border transition-colors disabled:opacity-60"
                      :class="item.isFeatured
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-800 dark:hover:text-slate-200'"
                      :title="item.isFeatured ? 'Lepas dari Berita Utama' : 'Pin sebagai Berita Utama'"
                    >
                      <i class="fa-solid fa-thumbtack text-xs" aria-hidden="true"></i>
                      <span>{{ item.isFeatured ? 'Headline' : 'Reguler' }}</span>
                    </button>
                  </td>

                  <!-- Kolom Aksi -->
                  <td class="py-3.5 px-4 align-middle">
                    <div class="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        @click="openPreviewModal(item)"
                        class="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#0369A1] flex items-center justify-center transition-colors"
                        aria-label="Pratinjau berita"
                        title="Pratinjau Baca"
                      >
                        <i class="fa-solid fa-eye text-sm" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        @click="openEditModal(item)"
                        class="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-[#E0F2FE] dark:hover:bg-sky-950/60 hover:text-[#0369A1] hover:border-sky-200 flex items-center justify-center transition-colors"
                        aria-label="Edit berita"
                        title="Edit Berita"
                      >
                        <i class="fa-solid fa-pen-to-square text-sm" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        @click="requestDelete(item)"
                        class="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-[#FFE4E6] dark:hover:bg-rose-950/60 hover:text-[#BE123C] hover:border-rose-200 flex items-center justify-center transition-colors"
                        aria-label="Hapus berita"
                        title="Hapus Berita"
                      >
                        <i class="fa-solid fa-trash-can text-sm" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Kartu Mobile (di bawah md) -->
        <div class="grid grid-cols-1 gap-3.5 md:hidden">
          <article
            v-for="item in filteredNewsList"
            :key="item.id"
            class="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 p-4 shadow-[var(--shadow-sm)] space-y-3"
          >
            <div class="flex items-start gap-3">
              <div class="w-20 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                <img
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  :alt="item.title"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full bg-gradient-to-br flex items-center justify-center"
                  :class="[getCategoryStyle(item.category).surface, getCategoryStyle(item.category).accentText]"
                >
                  <i :class="getCategoryStyle(item.category).icon" aria-hidden="true"></i>
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5 mb-1">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border"
                    :class="getCategoryStyle(item.category).badge"
                  >
                    {{ item.category }}
                  </span>
                  <span
                    v-if="item.isFeatured"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  >
                    Headline
                  </span>
                </div>
                <h3 class="font-display font-bold text-base text-slate-900 dark:text-white line-clamp-2">
                  {{ item.title }}
                </h3>
                <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {{ newsStore.formatNewsDate(item.createdAt) }} &bull; {{ item.views || 0 }} pembaca
                </p>
              </div>
            </div>

            <p class="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {{ item.summary }}
            </p>

            <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                @click="handleTogglePublish(item)"
                :disabled="busyItemId === item.id"
                class="min-h-[44px] px-3 py-2 rounded-xl text-sm font-semibold border inline-flex items-center gap-1.5"
                :class="item.isPublished
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'"
              >
                <span class="w-2 h-2 rounded-full" :class="item.isPublished ? 'bg-emerald-500' : 'bg-slate-400'"></span>
                <span>{{ item.isPublished ? 'Tayang' : 'Draft' }}</span>
              </button>

              <button
                type="button"
                @click="handleToggleFeatured(item)"
                :disabled="busyItemId === item.id"
                class="min-h-[44px] px-3 py-2 rounded-xl text-sm font-semibold border inline-flex items-center gap-1.5"
                :class="item.isFeatured
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'"
              >
                <i class="fa-solid fa-thumbtack text-xs" aria-hidden="true"></i>
                <span>{{ item.isFeatured ? 'Headline' : 'Pin' }}</span>
              </button>

              <div class="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  @click="openPreviewModal(item)"
                  class="min-w-[44px] min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center"
                  aria-label="Pratinjau berita"
                >
                  <i class="fa-solid fa-eye text-sm" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  @click="openEditModal(item)"
                  class="min-w-[44px] min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-[#0369A1] dark:text-sky-400 flex items-center justify-center"
                  aria-label="Edit berita"
                >
                  <i class="fa-solid fa-pen-to-square text-sm" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  @click="requestDelete(item)"
                  class="min-w-[44px] min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 flex items-center justify-center"
                  aria-label="Hapus berita"
                >
                  <i class="fa-solid fa-trash-can text-sm" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>

    <!-- Modal Form Tambah / Edit Berita -->
    <NewsFormModal
      :is-open="isFormModalOpen"
      :article="editingArticle"
      @close="closeFormModal"
      @saved="handleSaved"
    />

    <!-- Modal Pratinjau Baca Berita -->
    <NewsReaderModal
      :is-open="isReaderModalOpen"
      :article="previewArticle"
      @close="closePreviewModal"
    />

    <!-- Dialog Konfirmasi Hapus Berita -->
    <div
      v-if="articleToDelete"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-news-dialog-title"
      class="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="cancelDelete"
    >
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
            <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
          </div>
          <div>
            <h2 id="delete-news-dialog-title" class="font-display font-bold text-lg text-slate-900 dark:text-white">
              Hapus Artikel Berita?
            </h2>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Artikel <span class="font-semibold text-slate-900 dark:text-white">"{{ articleToDelete.title }}"</span> akan dihapus permanen dari Portal Berita. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            @click="cancelDelete"
            :disabled="isDeleting"
            class="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            @click="confirmDelete"
            :disabled="isDeleting"
            class="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            <i v-if="isDeleting" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            <span>{{ isDeleting ? 'Menghapus...' : 'Ya, Hapus Berita' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

