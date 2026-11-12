<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import DetailModal from '@/components/DetailModal.vue'
import EditModal from '@/components/EditModal.vue'
import { CATEGORY_COLORS } from '@/lib/initialData'
import { getInstitutionLogo } from '@/lib/campusList'

const authStore = useAuthStore()
const alumniStore = useAlumniStore()

onMounted(() => {
  alumniStore.fetchData()
})

const selectedAlumni = ref(null)
const isModalOpen = ref(false)

const selectedEditAlumni = ref(null)
const isEditModalOpen = ref(false)

const currentPage = ref(1)
const itemsPerPage = 12
const viewMode = ref('grid') // 'grid' | 'table'

const cohorts = ['ALL', '2027', '2026', '2025', '2024', '2023', '2022', '2021', '2020']
const categories = ['ALL', 'Siswa Aktif', 'PTN', 'PTS', 'Kedinasan', 'TNI/Polri', 'Bekerja', 'Wirausaha', 'Pelatihan / LPK', 'Belum Lapor Diri']

const hasActiveFilters = computed(() => {
  return (
    alumniStore.selectedCohort !== 'ALL' ||
    alumniStore.selectedCategory !== 'ALL' ||
    Boolean(alumniStore.searchQuery && alumniStore.searchQuery.trim())
  )
})

const categoryCounts = computed(() => {
  const baseList = alumniStore.selectedCohort === 'ALL'
    ? alumniStore.alumniList
    : alumniStore.alumniList.filter(a => String(a.cohort) === String(alumniStore.selectedCohort))

  const counts = { ALL: baseList.length }
  for (const a of baseList) {
    const cat = (a.category === 'Masa Tunggu') ? 'Belum Lapor Diri' : a.category
    counts[cat] = (counts[cat] || 0) + 1
  }
  return counts
})

const totalPages = computed(() => {
  return Math.ceil(alumniStore.filteredAlumni.length / itemsPerPage) || 1
})

const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return alumniStore.filteredAlumni.slice(start, start + itemsPerPage)
})

function setCohort(c) {
  alumniStore.selectedCohort = c
  currentPage.value = 1
}

function setCategory(cat) {
  alumniStore.selectedCategory = cat
  currentPage.value = 1
}

function clearFilters() {
  alumniStore.selectedCohort = 'ALL'
  alumniStore.selectedCategory = 'ALL'
  alumniStore.searchQuery = ''
  currentPage.value = 1
}

function openDetail(item) {
  selectedAlumni.value = item
  isModalOpen.value = true
}

function openEdit(item) {
  selectedEditAlumni.value = item
  isEditModalOpen.value = true
}

async function handleDelete(alumni) {
  if (confirm(`Hapus data alumni "${alumni.name}" secara permanen dari database?`)) {
    const res = await alumniStore.deleteAlumni(alumni.id)
    if (!res.success) {
      alert('Gagal menghapus data: ' + res.message)
    }
  }
}

function openWhatsApp(phone, name, inst) {
  if (!phone || phone === '-') return
  let cleanNumber = phone.replace(/[^0-9]/g, '')
  if (cleanNumber.startsWith('0')) cleanNumber = '62' + cleanNumber.slice(1)
  const text = encodeURIComponent(`Halo Kak ${name}, salam dari siswa SMADA Ngawi. Ingin bertanya mengenai pengalaman di ${inst}...`)
  window.open(`https://wa.me/${cleanNumber}?text=${text}`, '_blank')
}
</script>

<template>
  <div class="space-y-6 w-full">
    
    <!-- Header Halaman & Filter Pengendali Direktori (Desain Ringkas & Terpadu) -->
    <section class="rounded-3xl bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] overflow-hidden" aria-labelledby="directory-heading">
      <div class="h-1.5 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981]" aria-hidden="true"></div>

      <!-- Baris 1: Header Judul & Tombol Aksi -->
      <div class="p-5 sm:p-6 bg-gradient-to-r from-[#E0F2FE]/65 via-white to-[#D1FAE5]/45 dark:from-sky-950/35 dark:via-slate-900 dark:to-emerald-950/25 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-sky-100/80 dark:border-slate-800">
        <div>
          <h1 id="directory-heading" class="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
            Kenalan &amp; Jejak Alumni SMADA
          </h1>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Jelajahi tempat kuliah, kampus tujuan, serta kisah karir lulusan SMA Negeri 2 Ngawi
          </p>
        </div>

        <div class="flex items-center gap-2 self-start md:self-auto shrink-0">
          <!-- Toggle Tampilan: Kartu vs Tabel -->
          <div class="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
            <button
              @click="viewMode = 'grid'"
              type="button"
              class="px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5"
              :class="viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
              aria-label="Tampilan Kartu"
            >
              <i class="fa-solid fa-grip" aria-hidden="true"></i>
              <span class="hidden sm:inline">Kartu</span>
            </button>
            <button
              @click="viewMode = 'table'"
              type="button"
              class="px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5"
              :class="viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'"
              aria-label="Tampilan Tabel"
            >
              <i class="fa-solid fa-table-list" aria-hidden="true"></i>
              <span class="hidden sm:inline">Tabel</span>
            </button>
          </div>

          <!-- Tombol Export Excel -->
          <button
            @click="alumniStore.exportExcel"
            type="button"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-xs transition-colors"
          >
            <i class="fa-solid fa-file-excel text-sm" aria-hidden="true"></i>
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      <!-- Baris 2: Toolbar Pencarian & Dropdown Angkatan -->
      <div class="p-3.5 sm:px-6 sm:py-3.5 bg-sky-50/35 dark:bg-slate-900/60 border-b border-sky-100/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 w-full max-w-2xl">
          
          <!-- Search Bar (Lebar Penuh di Mobile & Ramping di Desktop) -->
          <div class="relative w-full sm:flex-1">
            <label for="alumni-search" class="sr-only">Pencarian Alumni</label>
            <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true"></i>
            <input
              id="alumni-search"
              v-model="alumniStore.searchQuery"
              @input="currentPage = 1"
              type="text"
              placeholder="Cari nama alumni, kampus, posisi, prodi..."
              class="w-full pl-9 pr-8 py-2.5 sm:py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm text-[#0F172A] dark:text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-all"
            />
            <button
              v-if="alumniStore.searchQuery"
              @click="alumniStore.searchQuery = ''; currentPage = 1"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1"
              aria-label="Bersihkan pencarian"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Dropdown Filter Angkatan -->
          <div class="relative w-full sm:w-52 shrink-0">
            <i class="fa-regular fa-calendar text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" aria-hidden="true"></i>
            <select
              v-model="alumniStore.selectedCohort"
              @change="currentPage = 1"
              class="w-full appearance-none pl-9 pr-8 py-2.5 sm:py-2 rounded-xl bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm font-medium text-[#334155] dark:text-slate-200 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 cursor-pointer"
            >
              <option value="ALL">Semua Angkatan</option>
              <option v-for="c in cohorts.filter(x => x !== 'ALL')" :key="c" :value="c">
                Angkatan {{ c }}
              </option>
            </select>
            <i class="fa-solid fa-chevron-down text-xs text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true"></i>
          </div>
        </div>

        <!-- Ringkasan Hasil & Reset -->
        <div class="flex items-center gap-2 self-start sm:self-auto text-sm text-slate-500 dark:text-slate-400 shrink-0">
          <span>Menemukan <strong class="text-slate-800 dark:text-slate-200 font-semibold">{{ alumniStore.filteredAlumni.length }}</strong> alumni</span>
          <button
            v-if="hasActiveFilters"
            @click="clearFilters"
            type="button"
            class="px-2.5 py-1 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium transition-colors flex items-center gap-1"
          >
            <i class="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
            <span>Reset</span>
          </button>
        </div>
      </div>

      <!-- Baris 3: Segmented Tab Bar Kategori Jalur & Karir -->
      <div class="px-3 sm:px-6 py-3 overflow-x-auto flex items-center gap-2 scrollbar-none">
        <button
          v-for="cat in categories"
          :key="cat"
          @click="setCategory(cat)"
          type="button"
          class="px-3.5 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 shrink-0 border"
          :class="alumniStore.selectedCategory === cat
            ? 'bg-[#0369A1] text-white border-[#0369A1] font-semibold shadow-xs'
            : 'bg-white dark:bg-slate-900 text-[#334155] dark:text-slate-400 border-slate-200/80 dark:border-slate-800 hover:bg-sky-50/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'"
        >
          <span
            v-if="cat !== 'ALL'"
            class="w-2 h-2 rounded-full shrink-0"
            :class="alumniStore.selectedCategory === cat ? 'bg-white/90' : (CATEGORY_COLORS[cat]?.dot || 'bg-slate-400')"
            aria-hidden="true"
          ></span>
          <span>{{ cat === 'ALL' ? 'Semua Kategori' : cat }}</span>
          <span
            class="px-2 py-0.5 rounded-full text-xs font-semibold"
            :class="alumniStore.selectedCategory === cat
              ? 'bg-[#075985] text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'"
          >
            {{ categoryCounts[cat] || 0 }}
          </span>
        </button>
      </div>

    </section>

    <!-- KONTEN: Tampilan Grid Kartu (Lebar Optimal 3–4 Kolom di Layar Lebar) -->
    <div
      v-if="paginatedList.length > 0 && viewMode === 'grid'"
      class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5"
    >
      <div
        v-for="alumni in paginatedList"
        :key="alumni.id"
        class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 shadow-[var(--shadow-sm)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between"
        :class="CATEGORY_COLORS[alumni.category]?.cardAccent"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-3">
              <div v-if="alumni.photo" class="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <img :src="alumni.photo" :alt="'Foto ' + alumni.name" class="w-full h-full object-cover" />
              </div>
              <div
                v-else
                class="w-11 h-11 rounded-xl font-bold flex items-center justify-center text-base border shrink-0 shadow-2xs"
                :class="CATEGORY_COLORS[alumni.category]?.avatar || 'bg-sky-100 text-[#0369A1] border-sky-200'"
              >
                {{ alumni.name ? alumni.name.charAt(0) : 'A' }}
              </div>
              <div>
                <h2 class="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                  {{ alumni.name }}
                </h2>
                <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Angkatan {{ alumni.cohort }} &bull; Kelas {{ alumni.classRoom }}<template v-if="alumni.nis && alumni.nis !== '-'"> &bull; NIS: {{ alumni.nis }}</template>
                </p>
              </div>
            </div>

            <span
              class="px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0"
              :class="CATEGORY_COLORS[alumni.category]?.badge || 'bg-slate-100 text-slate-700 border-slate-200'"
            >
              {{ alumni.category }}
            </span>
          </div>

          <!-- Kotak Rincian Instansi & Program -->
          <div class="p-3.5 rounded-xl bg-sky-50/45 dark:bg-slate-800/60 border border-sky-100/80 dark:border-slate-800 space-y-1.5">
            <div class="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <img
                v-if="getInstitutionLogo(alumni.institution)"
                :src="getInstitutionLogo(alumni.institution)"
                :alt="`Logo ${alumni.institution}`"
                class="w-5 h-5 rounded-md object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                loading="lazy"
                @error="(e) => e.target.style.display = 'none'"
              />
              <i v-else class="fa-solid fa-building-columns text-[#0284C7] dark:text-sky-400 text-sm shrink-0" aria-hidden="true"></i>
              <span class="truncate">{{ alumni.institution }}</span>
            </div>
            <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <i class="fa-solid fa-graduation-cap text-amber-500 text-xs shrink-0" aria-hidden="true"></i>
              <span class="truncate">{{ alumni.major }} (Jalur {{ alumni.pathway }})</span>
            </div>
          </div>

          <!-- Pesan Alumni -->
          <p v-if="alumni.message" class="text-sm text-slate-600 dark:text-slate-400 italic line-clamp-2">
            "{{ alumni.message }}"
          </p>
        </div>

        <!-- Tombol Aksi -->
        <div class="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
          <button
            @click="openDetail(alumni)"
            type="button"
            class="flex-1 py-2 px-3 rounded-xl bg-sky-50 hover:bg-[#0369A1] hover:text-white dark:bg-sky-950/40 dark:hover:bg-[#0369A1] text-[#0369A1] dark:text-sky-200 border border-sky-200/80 dark:border-sky-800 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <i class="fa-regular fa-eye text-sm" aria-hidden="true"></i>
            <span>Detail</span>
          </button>

          <button
            v-if="alumni.phone && alumni.phone !== '-'"
            @click="openWhatsApp(alumni.phone, alumni.name, alumni.institution)"
            type="button"
            class="py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
            :title="'Hubungi ' + alumni.name + ' via WhatsApp'"
          >
            <i class="fa-brands fa-whatsapp text-emerald-600" aria-hidden="true"></i>
            <span>Chat</span>
          </button>

          <!-- Aksi Khusus Guru BK (Edit & Hapus) -->
          <button
            v-if="authStore.userRole === 'admin'"
            @click="openEdit(alumni)"
            type="button"
            class="p-2 rounded-lg bg-slate-100 hover:bg-[#E0F2FE] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0369A1] dark:text-sky-400 text-sm transition-colors"
            title="Edit data alumni"
          >
            <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
          </button>

          <button
            v-if="authStore.userRole === 'admin'"
            @click="handleDelete(alumni)"
            type="button"
            class="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 text-sm transition-colors"
            title="Hapus data alumni"
          >
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- KONTEN: Tampilan Tabel Data Institusional (Full Width) -->
    <div v-else-if="paginatedList.length > 0 && viewMode === 'table'" class="overflow-x-auto rounded-2xl border border-sky-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[var(--shadow-card)] w-full">
      <table class="w-full text-left text-sm">
        <thead class="bg-sky-50/70 dark:bg-slate-800/80 text-[#0369A1] dark:text-sky-200 font-semibold text-xs sm:text-sm border-b border-sky-100 dark:border-slate-700">
          <tr>
            <th class="p-3.5">Nama Alumni</th>
            <th class="p-3.5">Kelas / Angkatan</th>
            <th class="p-3.5">Kategori</th>
            <th class="p-3.5">Instansi / Kampus</th>
            <th class="p-3.5">Jurusan / Posisi</th>
            <th class="p-3.5">Jalur</th>
            <th class="p-3.5 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr
            v-for="alumni in paginatedList"
            :key="alumni.id"
            class="hover:bg-sky-50/40 dark:hover:bg-slate-800/40 transition-colors"
          >
            <td class="p-3.5 font-semibold text-slate-900 dark:text-white">
              <div class="flex items-center gap-2.5">
                <div v-if="alumni.photo" class="w-8 h-8 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                  <img :src="alumni.photo" :alt="alumni.name" class="w-full h-full object-cover" />
                </div>
                <div
                  v-else
                  class="w-8 h-8 rounded-xl font-bold flex items-center justify-center text-sm shrink-0 border"
                  :class="CATEGORY_COLORS[alumni.category]?.avatar || 'bg-sky-100 text-[#0369A1] border-sky-200'"
                >
                  {{ alumni.name.charAt(0) }}
                </div>
                <span>{{ alumni.name }}</span>
              </div>
            </td>
            <td class="p-3.5 text-slate-600 dark:text-slate-300">
              <div>{{ alumni.classRoom }} ({{ alumni.cohort }})</div>
              <div v-if="alumni.nis && alumni.nis !== '-'" class="text-xs text-slate-400">
                NIS: {{ alumni.nis }}
              </div>
            </td>
            <td class="p-3.5">
              <span
                class="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                :class="CATEGORY_COLORS[alumni.category]?.badge || 'bg-slate-100 text-slate-700'"
              >
                {{ alumni.category }}
              </span>
            </td>
            <td class="p-3.5 text-slate-800 dark:text-slate-200 font-medium">
              <div class="flex items-center gap-2">
                <img
                  v-if="getInstitutionLogo(alumni.institution)"
                  :src="getInstitutionLogo(alumni.institution)"
                  :alt="`Logo ${alumni.institution}`"
                  class="w-4 h-4 rounded object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
                  loading="lazy"
                  @error="(e) => e.target.style.display = 'none'"
                />
                <i v-else class="fa-solid fa-building-columns text-slate-400 text-sm shrink-0" aria-hidden="true"></i>
                <span class="truncate">{{ alumni.institution }}</span>
              </div>
            </td>
            <td class="p-3.5 text-slate-600 dark:text-slate-300">
              {{ alumni.major }}
            </td>
            <td class="p-3.5 text-slate-500 dark:text-slate-400">
              {{ alumni.pathway }}
            </td>
            <td class="p-3.5 text-right whitespace-nowrap">
              <button
                @click="openDetail(alumni)"
                type="button"
                class="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 hover:bg-[#0369A1] hover:text-white dark:hover:bg-[#0369A1] text-[#0369A1] dark:text-sky-200 border border-sky-200/80 dark:border-sky-800 text-xs sm:text-sm font-semibold transition-colors mr-1"
              >
                Detail
              </button>
              <button
                v-if="alumni.phone && alumni.phone !== '-'"
                @click="openWhatsApp(alumni.phone, alumni.name, alumni.institution)"
                type="button"
                class="px-2.5 py-1.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-semibold hover:bg-emerald-100 transition-colors mr-1"
                title="Hubungi via WhatsApp"
              >
                <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
              </button>
              <button
                v-if="authStore.userRole === 'admin'"
                @click="openEdit(alumni)"
                type="button"
                class="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-[#E0F2FE] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0369A1] dark:text-sky-400 text-xs sm:text-sm font-semibold transition-colors mr-1"
                title="Edit data alumni"
              >
                <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
              </button>
              <button
                v-if="authStore.userRole === 'admin'"
                @click="handleDelete(alumni)"
                type="button"
                class="px-2.5 py-1.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm font-semibold transition-colors"
                title="Hapus data alumni"
              >
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tampilan Kosong (Empty State) -->
    <div
      v-else
      class="p-12 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
    >
      <div class="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-lg">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      </div>
      <h3 class="font-semibold text-base sm:text-lg text-slate-900 dark:text-slate-100">
        Tidak ada data alumni yang cocok
      </h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        Kriteria filter atau kata kunci pencarian Anda tidak menghasilkan data yang sesuai.
      </p>
      <button
        @click="clearFilters"
        type="button"
        class="mt-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold transition-colors"
      >
        Hapus Semua Filter
      </button>
    </div>

    <!-- Kontrol Navigasi Halaman (Pagination) -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-2" aria-label="Navigasi Halaman Direktori">
      <button
        :disabled="currentPage === 1"
        @click="currentPage--"
        type="button"
        class="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        Sebelumnya
      </button>

      <span class="text-sm font-medium text-slate-600 dark:text-slate-400 px-2">
        Halaman {{ currentPage }} dari {{ totalPages }}
      </span>

      <button
        :disabled="currentPage === totalPages"
        @click="currentPage++"
        type="button"
        class="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        Selanjutnya
      </button>
    </div>

    <!-- Modal Detail Alumni -->
    <DetailModal
      :is-open="isModalOpen"
      :alumni="selectedAlumni"
      @close="isModalOpen = false"
    />

    <!-- Modal Edit Alumni (Khusus Guru BK) -->
    <EditModal
      :is-open="isEditModalOpen"
      :alumni="selectedEditAlumni"
      @close="isEditModalOpen = false"
    />

  </div>
</template>
