<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import DetailModal from '@/components/DetailModal.vue'
import { CATEGORY_COLORS } from '@/lib/initialData'
import Chart from 'chart.js/auto'

const router = useRouter()
const authStore = useAuthStore()
const alumniStore = useAlumniStore()

const selectedAlumni = ref(null)
const isModalOpen = ref(false)

const donutCanvas = ref(null)
const barCanvas = ref(null)
let donutChart = null
let barChart = null

const recentAlumni = computed(() => {
  return alumniStore.alumniList.slice(0, 8)
})

function openDetail(alumni) {
  selectedAlumni.value = alumni
  isModalOpen.value = true
}

function initCharts() {
  if (donutChart) donutChart.destroy()
  if (barChart) barChart.destroy()

  const stats = alumniStore.statistics
  if (stats.total === 0) return

  // Donut Chart: Komposisi Kategori dengan Palet Blue-Slate Resmi (Tanpa Warna Ungu)
  if (donutCanvas.value) {
    donutChart = new Chart(donutCanvas.value, {
      type: 'doughnut',
      data: {
        labels: ['PTN', 'PTS', 'Kedinasan', 'TNI/Polri', 'Bekerja', 'Wirausaha', 'Pelatihan', 'Masa Tunggu'],
        datasets: [{
          data: [
            stats.ptnCount,
            stats.ptsCount,
            stats.kedinasanCount,
            stats.tniPolriCount,
            stats.kerjaCount,
            stats.wirausahaCount,
            stats.pelatihanCount,
            stats.masaTungguCount
          ],
          backgroundColor: [
            '#1d4ed8', // PTN - Royal Blue
            '#0284c7', // PTS - Sky Blue
            '#0891b2', // Kedinasan - Deep Cyan
            '#059669', // TNI/Polri - Forest Emerald
            '#475569', // Bekerja - Slate Grey
            '#d97706', // Wirausaha - Warm Amber
            '#0d9488', // Pelatihan - Teal
            '#78716c'  // Masa Tunggu - Stone
          ],
          borderWidth: 2,
          borderColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              padding: 14,
              font: { size: 11, family: 'Inter', weight: 500 }
            }
          }
        },
        cutout: '68%'
      }
    })
  }

  // Bar Chart: Top 5 Instansi / Kampus Terbanyak
  if (barCanvas.value) {
    const counts = {}
    alumniStore.alumniList.forEach(a => {
      const inst = a.institution ? a.institution.split('(')[0].trim() : 'Lainnya'
      counts[inst] = (counts[inst] || 0) + 1
    })

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const labels = sorted.map(s => s[0].length > 25 ? s[0].slice(0, 25) + '...' : s[0])
    const dataValues = sorted.map(s => s[1])

    barChart = new Chart(barCanvas.value, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Jumlah Alumni',
          data: dataValues,
          backgroundColor: '#2563eb',
          borderRadius: 6,
          maxBarThickness: 42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { size: 11, family: 'Inter' } },
            grid: { color: 'rgba(148, 163, 184, 0.15)' }
          },
          x: {
            ticks: {
              font: { size: 11, family: 'Inter' },
              maxRotation: 0,
              autoSkip: true
            },
            grid: { display: false }
          }
        }
      }
    })
  }
}

onMounted(() => {
  alumniStore.fetchData()
  initCharts()
})

watch(() => alumniStore.alumniList.length, () => {
  initCharts()
})
</script>

<template>
  <div class="space-y-6 sm:space-y-8 w-full">
    
    <!-- Hero Banner Utama Luas (Full Width) -->
    <section class="rounded-xl bg-slate-900 text-white p-6 sm:p-8 lg:p-10 border border-slate-800 shadow-sm" aria-labelledby="banner-heading">
      <div class="max-w-4xl">
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
          <span>SMA Negeri 2 Ngawi</span>
          <span>&bull;</span>
          <span>Portal Bimbingan Konseling</span>
        </div>

        <h1 id="banner-heading" class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl tracking-tight text-white leading-tight">
          Sistem Penelusuran Karir & Lulusan Alumni
        </h1>
        <p class="text-xs sm:text-sm lg:text-base text-slate-300 mt-2.5 leading-relaxed max-w-3xl">
          Pusat pemetaan data kelulusan siswa, sebaran perguruan tinggi (PTN/PTS), kedinasan, TNI/Polri, serta capaian karir profesional alumni SMADA Ngawi.
        </p>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <router-link
            to="/lapor"
            class="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <i class="fa-solid fa-user-plus text-xs" aria-hidden="true"></i>
            <span>Formulir Lapor Diri</span>
          </router-link>

          <router-link
            to="/data"
            class="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm border border-slate-700 transition-colors flex items-center gap-2"
          >
            <i class="fa-solid fa-magnifying-glass text-xs" aria-hidden="true"></i>
            <span>Jelajahi Direktori Alumni</span>
          </router-link>

          <router-link
            v-if="authStore.userRole === 'admin' && alumniStore.pendingList.length > 0"
            to="/verifikasi"
            class="px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2"
          >
            <i class="fa-solid fa-bell text-xs text-amber-400" aria-hidden="true"></i>
            <span>{{ alumniStore.pendingList.length }} Laporan Perlu Verifikasi</span>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Ringkasan Statistik Utama (Responsive Grid) -->
    <section aria-labelledby="metrics-title">
      <h2 id="metrics-title" class="sr-only">Statistik Utama Alumni</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        
        <!-- Total Data Terverifikasi -->
        <div class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Terverifikasi</span>
            <span class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs">
              <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white">
            {{ alumniStore.statistics.total }}
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Lulusan terdata resmi</div>
        </div>

        <!-- Kuliah PTN & PTS -->
        <div class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Perguruan Tinggi</span>
            <span class="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center text-xs">
              <i class="fa-solid fa-building-columns" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white">
            {{ alumniStore.statistics.ptnCount + alumniStore.statistics.ptsCount }}
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {{ alumniStore.statistics.ptnCount }} PTN &bull; {{ alumniStore.statistics.ptsCount }} PTS
          </div>
        </div>

        <!-- Kedinasan & Militer -->
        <div class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Kedinasan & Militer</span>
            <span class="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 flex items-center justify-center text-xs">
              <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white">
            {{ alumniStore.statistics.kedinasanCount + alumniStore.statistics.tniPolriCount }}
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {{ alumniStore.statistics.kedinasanCount }} Dinas &bull; {{ alumniStore.statistics.tniPolriCount }} TNI/Polri
          </div>
        </div>

        <!-- Karir & Wirausaha -->
        <div class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Karir & Wirausaha</span>
            <span class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs">
              <i class="fa-solid fa-briefcase" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white">
            {{ alumniStore.statistics.kerjaCount + alumniStore.statistics.wirausahaCount }}
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {{ alumniStore.statistics.kerjaCount }} Kerja &bull; {{ alumniStore.statistics.wirausahaCount }} Bisnis
          </div>
        </div>

      </div>
    </section>

    <!-- Visualisasi Grafik Terstruktur Full Width -->
    <section class="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6" aria-labelledby="charts-heading">
      <h2 id="charts-heading" class="sr-only">Grafik Sebaran Alumni</h2>
      
      <!-- Donut Chart: Komposisi Kategori -->
      <div class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <div class="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <h3 class="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Sebaran Jalur Karir & Studi Lanjut
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Komposisi seluruh kategori alumni SMA Negeri 2 Ngawi yang terdaftar
          </p>
        </div>
        
        <div v-if="alumniStore.statistics.total > 0" class="relative h-72 sm:h-80 w-full mt-auto">
          <canvas ref="donutCanvas" aria-label="Grafik donat sebaran kategori"></canvas>
        </div>
        <div v-else class="h-72 sm:h-80 flex flex-col items-center justify-center text-center p-6 text-slate-400">
          <i class="fa-solid fa-chart-pie text-3xl text-slate-300 dark:text-slate-700 mb-2" aria-hidden="true"></i>
          <p class="text-xs">Belum ada data grafik. Isi formulir lapor diri untuk memulai pemetaan.</p>
        </div>
      </div>

      <!-- Bar Chart: 5 Kampus / Instansi Terbanyak -->
      <div class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <div class="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <h3 class="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            5 Instansi & Kampus Terfavorit
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Perguruan tinggi & perusahaan tujuan alumni terbanyak
          </p>
        </div>
        
        <div v-if="alumniStore.statistics.total > 0" class="relative h-72 sm:h-80 w-full mt-auto">
          <canvas ref="barCanvas" aria-label="Grafik batang instansi terbanyak"></canvas>
        </div>
        <div v-else class="h-72 sm:h-80 flex flex-col items-center justify-center text-center p-6 text-slate-400">
          <i class="fa-solid fa-chart-simple text-3xl text-slate-300 dark:text-slate-700 mb-2" aria-hidden="true"></i>
          <p class="text-xs">Data instansi belum tersedia.</p>
        </div>
      </div>

    </section>

    <!-- Tabel Data Alumni Terbaru (Lebar & Terstruktur) -->
    <section class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4" aria-labelledby="recent-heading">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 id="recent-heading" class="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
            Pembaruan Data Terkini
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar alumni yang baru saja diverifikasi oleh Tim Guru BK
          </p>
        </div>
        <router-link
          to="/data"
          class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Buka Direktori Lengkap ({{ alumniStore.alumniList.length }})
        </router-link>
      </div>

      <div v-if="recentAlumni.length > 0" class="divide-y divide-slate-100 dark:divide-slate-800">
        <div
          v-for="alumni in recentAlumni"
          :key="alumni.id"
          @click="openDetail(alumni)"
          class="py-3 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex items-center justify-between gap-4"
          role="button"
          tabindex="0"
          @keydown.enter="openDetail(alumni)"
          @keydown.space.prevent="openDetail(alumni)"
        >
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-sm border border-slate-200 dark:border-slate-700 shrink-0">
              {{ alumni.name.charAt(0) }}
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {{ alumni.name }}
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                <span>{{ alumni.institution }}</span>
                <span class="mx-1.5 text-slate-300 dark:text-slate-600">&bull;</span>
                <span>{{ alumni.major }}</span>
                <span class="mx-1.5 text-slate-300 dark:text-slate-600">&bull;</span>
                <span>Angkatan {{ alumni.cohort }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <span
              class="px-2.5 py-0.5 rounded text-[11px] font-medium border"
              :class="CATEGORY_COLORS[alumni.category]?.badge || 'bg-slate-100 text-slate-700 border-slate-200'"
            >
              {{ alumni.category }}
            </span>
            <i class="fa-solid fa-chevron-right text-slate-300 text-xs hidden sm:block" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <div v-else class="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
        <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada data alumni terdaftar di sistem.</p>
        <p class="mt-1">Silakan mengisi formulir lapor diri untuk memulai pencatatan data lulusan.</p>
      </div>
    </section>

    <!-- Modal Detail Alumni -->
    <DetailModal
      :is-open="isModalOpen"
      :alumni="selectedAlumni"
      @close="isModalOpen = false"
    />

  </div>
</template>
