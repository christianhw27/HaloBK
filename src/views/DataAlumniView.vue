<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAlumniStore } from '@/stores/alumni'
import DetailModal from '@/components/DetailModal.vue'
import { CATEGORY_COLORS } from '@/lib/initialData'

const alumniStore = useAlumniStore()

onMounted(() => {
  alumniStore.fetchData()
})

const selectedAlumni = ref(null)
const isModalOpen = ref(false)
const currentPage = ref(1)
const itemsPerPage = 12
const viewMode = ref('grid') // 'grid' | 'table'

const cohorts = ['ALL', '2026', '2025', '2024', '2023', '2022', '2021', '2020']
const categories = ['ALL', 'PTN', 'PTS', 'Kedinasan', 'TNI/Polri', 'Bekerja', 'Wirausaha', 'Pelatihan / LPK', 'Masa Tunggu']

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
    
    <!-- Header Halaman & Filter Pengendali Direktori (Full Width) -->
    <section class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5" aria-labelledby="directory-heading">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 id="directory-heading" class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
            Direktori Alumni Terverifikasi
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pangkalan data kelulusan, studi lanjut, dan karir alumni SMA Negeri 2 Ngawi
          </p>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-auto">
          <!-- Toggle Tampilan: Kartu vs Tabel -->
          <div class="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              @click="viewMode = 'grid'"
              type="button"
              class="px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5"
              :class="viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'"
              aria-label="Tampilan Kartu"
            >
              <i class="fa-solid fa-grip" aria-hidden="true"></i>
              <span class="hidden sm:inline">Kartu</span>
            </button>
            <button
              @click="viewMode = 'table'"
              type="button"
              class="px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5"
              :class="viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'"
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
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <i class="fa-solid fa-file-excel text-xs" aria-hidden="true"></i>
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      <!-- Bilah Pencarian -->
      <div class="relative">
        <label for="alumni-search" class="sr-only">Pencarian Alumni</label>
        <i class="fa-solid fa-magnifying-glass text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-xs" aria-hidden="true"></i>
        <input
          id="alumni-search"
          v-model="alumniStore.searchQuery"
          @input="currentPage = 1"
          type="text"
          placeholder="Cari berdasarkan nama alumni, kampus, perusahaan, jurusan, atau kelas..."
          class="w-full pl-9 pr-9 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 transition-colors"
        />
        <button
          v-if="alumniStore.searchQuery"
          @click="alumniStore.searchQuery = ''; currentPage = 1"
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
          aria-label="Bersihkan pencarian"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Filter Angkatan (Cohort) -->
      <div class="space-y-1.5">
        <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Tahun Angkatan Lulusan:
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="c in cohorts"
            :key="c"
            @click="setCohort(c)"
            type="button"
            class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
            :class="alumniStore.selectedCohort === c
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            {{ c === 'ALL' ? 'Semua Angkatan' : c }}
          </button>
        </div>
      </div>

      <!-- Filter Kategori Karir / Studi Lanjut -->
      <div class="space-y-1.5">
        <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Kategori Jalur & Karir:
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="cat in categories"
            :key="cat"
            @click="setCategory(cat)"
            type="button"
            class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
            :class="alumniStore.selectedCategory === cat
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
          >
            {{ cat === 'ALL' ? 'Semua Kategori' : cat }}
          </button>
        </div>
      </div>

      <!-- Ringkasan Hasil Filter -->
      <div class="text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span>Menemukan <strong>{{ alumniStore.filteredAlumni.length }}</strong> alumni terverifikasi</span>
          <button
            v-if="alumniStore.selectedCohort !== 'ALL' || alumniStore.selectedCategory !== 'ALL' || alumniStore.searchQuery"
            @click="clearFilters"
            type="button"
            class="text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-medium ml-2"
          >
            Reset Filter
          </button>
        </div>
        <span v-if="totalPages > 1">Halaman {{ currentPage }} dari {{ totalPages }}</span>
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
        class="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-sm border border-slate-200 dark:border-slate-700 shrink-0">
                {{ alumni.name ? alumni.name.charAt(0) : 'A' }}
              </div>
              <div>
                <h2 class="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                  {{ alumni.name }}
                </h2>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Angkatan {{ alumni.cohort }} &bull; Kelas {{ alumni.classRoom }}
                </p>
              </div>
            </div>

            <span
              class="px-2 py-0.5 rounded text-[11px] font-medium border shrink-0"
              :class="CATEGORY_COLORS[alumni.category]?.badge || 'bg-slate-100 text-slate-700 border-slate-200'"
            >
              {{ alumni.category }}
            </span>
          </div>

          <!-- Kotak Rincian Instansi & Program -->
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <div class="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <i class="fa-solid fa-building-columns text-slate-400 text-xs" aria-hidden="true"></i>
              <span class="truncate">{{ alumni.institution }}</span>
            </div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <i class="fa-solid fa-graduation-cap text-slate-400 text-xs" aria-hidden="true"></i>
              <span class="truncate">{{ alumni.major }} (Jalur {{ alumni.pathway }})</span>
            </div>
          </div>

          <!-- Pesan Alumni -->
          <p v-if="alumni.message" class="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-2">
            "{{ alumni.message }}"
          </p>
        </div>

        <!-- Tombol Aksi -->
        <div class="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <button
            @click="openDetail(alumni)"
            type="button"
            class="flex-1 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <i class="fa-regular fa-eye text-xs" aria-hidden="true"></i>
            <span>Lihat Detail</span>
          </button>

          <button
            v-if="alumni.phone && alumni.phone !== '-'"
            @click="openWhatsApp(alumni.phone, alumni.name, alumni.institution)"
            type="button"
            class="py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            :title="'Hubungi ' + alumni.name + ' via WhatsApp'"
          >
            <i class="fa-brands fa-whatsapp text-emerald-600" aria-hidden="true"></i>
            <span>Konsultasi</span>
          </button>
        </div>
      </div>
    </div>

    <!-- KONTEN: Tampilan Tabel Data Institusional (Full Width) -->
    <div v-else-if="paginatedList.length > 0 && viewMode === 'table'" class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm w-full">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th class="p-3">Nama Alumni</th>
            <th class="p-3">Kelas / Angkatan</th>
            <th class="p-3">Kategori</th>
            <th class="p-3">Instansi / Kampus</th>
            <th class="p-3">Jurusan / Posisi</th>
            <th class="p-3">Jalur</th>
            <th class="p-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr
            v-for="alumni in paginatedList"
            :key="alumni.id"
            class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
          >
            <td class="p-3 font-semibold text-slate-900 dark:text-white">
              {{ alumni.name }}
            </td>
            <td class="p-3 text-slate-600 dark:text-slate-300">
              {{ alumni.classRoom }} ({{ alumni.cohort }})
            </td>
            <td class="p-3">
              <span
                class="px-2 py-0.5 rounded text-[11px] font-medium border"
                :class="CATEGORY_COLORS[alumni.category]?.badge || 'bg-slate-100 text-slate-700'"
              >
                {{ alumni.category }}
              </span>
            </td>
            <td class="p-3 text-slate-800 dark:text-slate-200 font-medium">
              {{ alumni.institution }}
            </td>
            <td class="p-3 text-slate-600 dark:text-slate-300">
              {{ alumni.major }}
            </td>
            <td class="p-3 text-slate-500 dark:text-slate-400">
              {{ alumni.pathway }}
            </td>
            <td class="p-3 text-right whitespace-nowrap">
              <button
                @click="openDetail(alumni)"
                type="button"
                class="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors mr-1.5"
              >
                Detail
              </button>
              <button
                v-if="alumni.phone && alumni.phone !== '-'"
                @click="openWhatsApp(alumni.phone, alumni.name, alumni.institution)"
                type="button"
                class="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                title="Hubungi via WhatsApp"
              >
                <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
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
      <h3 class="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
        Tidak ada data alumni yang cocok
      </h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
        Kriteria filter atau kata kunci pencarian Anda tidak menghasilkan data yang sesuai.
      </p>
      <button
        @click="clearFilters"
        type="button"
        class="mt-2 px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold transition-colors"
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
        class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        Sebelumnya
      </button>

      <span class="text-xs font-medium text-slate-600 dark:text-slate-400 px-2">
        Halaman {{ currentPage }} dari {{ totalPages }}
      </span>

      <button
        :disabled="currentPage === totalPages"
        @click="currentPage++"
        type="button"
        class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

  </div>
</template>
