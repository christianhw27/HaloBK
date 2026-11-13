<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAlumniStore } from '@/stores/alumni'
import DetailModal from '@/components/DetailModal.vue'
import { CATEGORY_COLORS } from '@/lib/initialData'
import { getInstitutionLogo } from '@/lib/campusList'
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
  return alumniStore.alumniList
    .filter(a => a.category !== 'Siswa Aktif' && !a.isSiswa && String(a.cohort) !== '2027')
    .slice(0, 8)
})

function openDetail(alumni) {
  selectedAlumni.value = alumni
  isModalOpen.value = true
}

function initCharts() {
  if (donutChart) {
    donutChart.destroy()
    donutChart = null
  }
  if (barChart) {
    barChart.destroy()
    barChart = null
  }

  const stats = alumniStore.statistics
  if (!stats || stats.total === 0) return

  // Donut Chart: Komposisi Kategori (Hanya Menampilkan Yang Sudah Lapor Pilihan Jalur)
  if (donutCanvas.value) {
    const isDark = document.documentElement.classList.contains('dark')

    donutChart = new Chart(donutCanvas.value, {
      type: 'doughnut',
      data: {
        labels: ['PTN', 'PTS', 'Kedinasan', 'TNI/Polri', 'Bekerja', 'Wirausaha', 'Pelatihan'],
        datasets: [{
          data: [
            stats.ptnCount || 0,
            stats.ptsCount || 0,
            stats.kedinasanCount || 0,
            stats.tniPolriCount || 0,
            stats.kerjaCount || 0,
            stats.wirausahaCount || 0,
            stats.pelatihanCount || 0
          ],
          backgroundColor: [
            '#0284C7', // PTN - Trust Blue
            '#38BDF8', // PTS - Light Sky
            '#10B981', // Kedinasan - Growth Emerald
            '#047857', // TNI/Polri - Deep Emerald
            '#F59E0B', // Bekerja - Hope Amber
            '#FBBF24', // Wirausaha - Warm Gold
            '#E11D48'  // Pelatihan - Warm Magenta
          ],
          borderWidth: 2,
          borderColor: isDark ? '#0f172a' : '#ffffff'
        }]
      },
      plugins: [
        {
          id: 'donutSliceLabelsPlugin',
          afterDatasetsDraw(chart) {
            try {
              const { ctx, data } = chart
              const dataset = data.datasets[0]
              const meta = chart.getDatasetMeta(0)
              if (!meta || !meta.data) return

              const total = dataset.data.reduce((sum, v) => sum + (Number(v) || 0), 0)
              if (total === 0) return

              ctx.save()
              ctx.font = 'bold 11px Poppins, sans-serif'
              ctx.fillStyle = '#ffffff'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'

              meta.data.forEach((element, i) => {
                const val = Number(dataset.data[i]) || 0
                const pct = (val / total) * 100
                if (pct >= 5 && element && typeof element.tooltipPosition === 'function') {
                  const pos = element.tooltipPosition()
                  if (pos && typeof pos.x === 'number' && !isNaN(pos.x)) {
                    ctx.save()
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
                    ctx.shadowBlur = 4
                    ctx.fillText(`${pct.toFixed(1)}%`, pos.x, pos.y)
                    ctx.restore()
                  }
                }
              })
              ctx.restore()
            } catch (e) {
              console.warn('donutSliceLabelsPlugin error:', e)
            }
          }
        },
        {
          id: 'centerTextPlugin',
          beforeDraw(chart) {
            try {
              const { width, height, ctx } = chart
              const meta = chart.getDatasetMeta(0)
              const centerX = (meta && meta.data && meta.data[0]) ? meta.data[0].x : width / 2
              const centerY = (meta && meta.data && meta.data[0]) ? meta.data[0].y : height / 2

              const total = chart.data.datasets[0].data.reduce((sum, v) => sum + (Number(v) || 0), 0)

              ctx.save()
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'

              ctx.font = '500 11px Poppins, sans-serif'
              ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b'
              ctx.fillText('Sudah Lapor', centerX, centerY - 10)

              ctx.font = 'bold 20px Poppins, sans-serif'
              ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#f8fafc' : '#0f172a'
              ctx.fillText(total.toString(), centerX, centerY + 12)

              ctx.restore()
            } catch (e) {
              console.warn('centerTextPlugin error:', e)
            }
          }
        }
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: 8
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 12,
              padding: typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 12,
              font: {
                size: typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 12,
                family: 'Poppins',
                weight: 500
              },
              generateLabels(chart) {
                const data = chart.data
                if (!data.labels.length || !data.datasets.length) return []
                const dataset = data.datasets[0]
                const total = dataset.data.reduce((sum, v) => sum + (Number(v) || 0), 0)

                return data.labels.map((label, i) => {
                  const val = Number(dataset.data[i]) || 0
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0%'
                  const fillStyle = dataset.backgroundColor[i]
                  return {
                    text: `${label}: ${val} (${pct})`,
                    fillStyle: fillStyle,
                    strokeStyle: fillStyle,
                    lineWidth: 0,
                    hidden: isNaN(val) || val === 0,
                    index: i
                  }
                }).filter(item => !item.hidden)
              }
            }
          }
        },
        cutout: '66%'
      }
    })
  }

  // Bar Chart: Top 5 Kampus Pilihan Alumni (Khusus Kampus Saja, Abaikan Belum Lapor Diri & Persiapan Ulang)
  if (barCanvas.value) {
    const counts = {}
    const ignoredValues = [
      'persiapan ulang',
      'masa tunggu',
      'belum lapor diri',
      'gap year',
      'tidak ada',
      '-',
      'belum ada',
      'lainnya',
      'sma negeri 2 ngawi',
      'sman 2 ngawi',
      'smada'
    ]

    alumniStore.alumniList.forEach(a => {
      // Abaikan data siswa aktif (hanya alumni lulusan)
      if (a.category === 'Siswa Aktif' || a.isSiswa || String(a.cohort) === '2027') return
      // Abaikan kategori Belum Lapor Diri / Masa Tunggu
      if (a.category === 'Masa Tunggu' || a.category === 'Belum Lapor Diri') return

      const rawInst = a.institution ? a.institution.split('(')[0].trim() : ''
      if (!rawInst) return

      const lower = rawInst.toLowerCase()
      if (ignoredValues.some(ign => lower.includes(ign))) return

      counts[rawInst] = (counts[rawInst] || 0) + 1
    })

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const totalTopCampus = sorted.reduce((sum, s) => sum + s[1], 0)
    const labels = sorted.map(s => s[0].length > 22 ? s[0].slice(0, 22) + '...' : s[0])
    const dataValues = sorted.map(s => s[1])

    barChart = new Chart(barCanvas.value, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Jumlah Alumni',
          data: dataValues,
          backgroundColor: ['#0284C7', '#10B981', '#F59E0B', '#E11D48', '#38BDF8'],
          borderRadius: 10,
          maxBarThickness: 44
        }]
      },
      plugins: [
        {
          id: 'barLabelsPlugin',
          afterDatasetsDraw(chart) {
            try {
              const { ctx, data } = chart
              const dataset = data.datasets[0]
              const meta = chart.getDatasetMeta(0)
              if (!meta || !meta.data) return

              ctx.save()
              ctx.textAlign = 'center'
              ctx.textBaseline = 'bottom'
              ctx.font = 'bold 12px Poppins, sans-serif'
              ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a'

              meta.data.forEach((bar, index) => {
                const val = dataset.data[index]
                if (val > 0 && bar && typeof bar.x === 'number') {
                  const pct = totalTopCampus > 0 ? ((val / totalTopCampus) * 100).toFixed(1) + '%' : ''
                  ctx.fillText(`${val} (${pct})`, bar.x, bar.y - 6)
                }
              })
              ctx.restore()
            } catch (e) {
              console.warn('barLabelsPlugin error:', e)
            }
          }
        }
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 22 }
        },
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grace: '18%',
            ticks: { precision: 0, font: { size: 12, family: 'Poppins' } },
            grid: { color: 'rgba(148, 163, 184, 0.15)' }
          },
          x: {
            ticks: {
              font: {
                size: typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 12,
                family: 'Poppins',
                weight: 500
              },
              maxRotation: typeof window !== 'undefined' && window.innerWidth < 640 ? 30 : 0,
              minRotation: typeof window !== 'undefined' && window.innerWidth < 640 ? 20 : 0,
              autoSkip: false
            },
            grid: { display: false }
          }
        }
      }
    })
  }
}

onMounted(async () => {
  await alumniStore.fetchData()
  await nextTick()
  initCharts()
})

watch(() => alumniStore.alumniList.length, async () => {
  await nextTick()
  initCharts()
})
</script>

<template>
  <div class="space-y-6 sm:space-y-8 w-full">
    
    <!-- Hero Banner Utama Cerah & Ramah (Full Width) -->
    <section class="rounded-3xl bg-gradient-to-br from-[#E0F2FE]/85 via-[#FFFBEB]/70 to-[#FFE4E6]/50 dark:from-slate-900 dark:via-sky-950/35 dark:to-amber-950/20 border border-sky-200/80 dark:border-slate-800 shadow-[var(--shadow-card)] overflow-hidden" aria-labelledby="banner-heading">
      <div class="h-1.5 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981]" aria-hidden="true"></div>

      <div class="p-5 sm:p-8 lg:p-10 max-w-4xl">
        <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-[#0369A1] dark:text-sky-300 mb-2">
          <span class="px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800">
            SMA Negeri 2 Ngawi
          </span>
          <span class="text-amber-600 dark:text-amber-300">&bull;</span>
          <span class="text-[#92400E] dark:text-amber-300">Ruang BK SMADA</span>
        </div>

        <h1 id="banner-heading" class="font-display font-bold text-xl sm:text-[1.75rem] lg:text-[2.25rem] tracking-tight text-[#0F172A] dark:text-white leading-[1.25]">
          Cerita &amp; Sebaran Jejak Alumni SMADA
        </h1>
        <p class="text-xs sm:text-base lg:text-lg text-[#334155] dark:text-slate-300 mt-2 sm:mt-3 leading-relaxed max-w-3xl">
          Intip kampus tujuan, sekolah kedinasan, hingga perjalanan karir seru dari lulusan SMA Negeri 2 Ngawi sebagai referensi hangat buat adik kelas.
        </p>

        <div class="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
          <router-link
            v-if="authStore.userRole !== 'siswa'"
            to="/lapor"
            class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-sm sm:text-base transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
          >
            <i class="fa-solid fa-user-plus text-sm" aria-hidden="true"></i>
            <span>Formulir Lapor Diri</span>
          </router-link>

          <router-link
            to="/data"
            class="px-5 py-2.5 rounded-xl bg-white hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0369A1] dark:text-sky-200 font-semibold text-sm sm:text-base border border-sky-200 dark:border-slate-700 transition-colors duration-150 flex items-center justify-center gap-2 min-h-[44px] shadow-2xs"
          >
            <i class="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
            <span>Kenalan di Direktori Alumni</span>
          </router-link>

          <router-link
            v-if="authStore.userRole === 'admin' && alumniStore.totalPendingCount > 0"
            to="/verifikasi"
            class="px-5 py-2.5 rounded-xl bg-[#FEF3C7] text-[#92400E] hover:bg-amber-200/80 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300/80 dark:border-amber-500/40 font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            <i class="fa-solid fa-bell text-sm" aria-hidden="true"></i>
            <span>{{ alumniStore.totalPendingCount }} Kabar Perlu Verifikasi</span>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Ringkasan Statistik Utama (4 Pilar Warna BK) -->
    <section aria-labelledby="metrics-title">
      <h2 id="metrics-title" class="sr-only">Statistik Utama Alumni</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        
        <!-- Total Data Terverifikasi (Trust Blue) -->
        <div class="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-sky-50/90 to-white dark:from-sky-950/40 dark:to-slate-900 border border-sky-200/80 dark:border-sky-800/60 shadow-[var(--shadow-sm)]">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs sm:text-sm font-semibold text-[#0369A1] dark:text-sky-300">Total Terdata</span>
            <span class="w-9 h-9 rounded-xl bg-[#0369A1] text-white flex items-center justify-center text-sm shadow-xs">
              <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white">
            {{ alumniStore.statistics.total }}
          </div>
          <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">Alumni sudah berbagi kabar</div>
        </div>

        <!-- Kuliah PTN & PTS (Growth Emerald) -->
        <div class="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-950/40 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 shadow-[var(--shadow-sm)]">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs sm:text-sm font-semibold text-[#047857] dark:text-emerald-300">Perguruan Tinggi</span>
            <span class="w-9 h-9 rounded-xl bg-[#047857] text-white flex items-center justify-center text-sm shadow-xs">
              <i class="fa-solid fa-building-columns" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white">
            {{ alumniStore.statistics.ptnCount + alumniStore.statistics.ptsCount }}
          </div>
          <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {{ alumniStore.statistics.ptnCount }} PTN &bull; {{ alumniStore.statistics.ptsCount }} PTS
          </div>
        </div>

        <!-- Kedinasan & Militer (Warm Magenta) -->
        <div class="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-rose-50/90 to-white dark:from-rose-950/40 dark:to-slate-900 border border-rose-200/80 dark:border-rose-800/60 shadow-[var(--shadow-sm)]">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs sm:text-sm font-semibold text-[#BE123C] dark:text-rose-300">Kedinasan &amp; Militer</span>
            <span class="w-9 h-9 rounded-xl bg-[#BE123C] text-white flex items-center justify-center text-sm shadow-xs">
              <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white">
            {{ alumniStore.statistics.kedinasanCount + alumniStore.statistics.tniPolriCount }}
          </div>
          <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {{ alumniStore.statistics.kedinasanCount }} Dinas &bull; {{ alumniStore.statistics.tniPolriCount }} TNI/Polri
          </div>
        </div>

        <!-- Karir & Wirausaha (Hope Amber) -->
        <div class="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-50/90 to-white dark:from-amber-950/40 dark:to-slate-900 border border-amber-200/80 dark:border-amber-800/60 shadow-[var(--shadow-sm)]">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs sm:text-sm font-semibold text-[#92400E] dark:text-amber-300">Karir &amp; Wirausaha</span>
            <span class="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center text-sm shadow-xs">
              <i class="fa-solid fa-briefcase" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white">
            {{ alumniStore.statistics.kerjaCount + alumniStore.statistics.wirausahaCount }}
          </div>
          <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {{ alumniStore.statistics.kerjaCount }} Kerja &bull; {{ alumniStore.statistics.wirausahaCount }} Bisnis
          </div>
        </div>

      </div>
    </section>

    <!-- Visualisasi Grafik Cerah & Mudah Dibaca -->
    <section class="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6" aria-labelledby="charts-heading">
      <h2 id="charts-heading" class="sr-only">Grafik Sebaran Alumni</h2>
      
      <!-- Donut Chart: Komposisi Kategori -->
      <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 shadow-sm flex flex-col">
        <div class="border-b border-sky-100/80 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-xl bg-[#E0F2FE] text-[#0369A1] dark:bg-sky-950/60 dark:text-sky-300 flex items-center justify-center shrink-0">
              <i class="fa-solid fa-chart-pie text-sm" aria-hidden="true"></i>
            </span>
            <div>
              <h3 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Sebaran Pilihan Lulusan
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Jalur kuliah, kedinasan, dan karir pilihan alumni SMADA Ngawi
              </p>
            </div>
          </div>

          <span
            v-if="alumniStore.statistics.belumLaporCount > 0"
            class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-[#BE123C] border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900 shrink-0"
            title="Siswa yang belum lapor diri / mengisi jalur pilihan"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true"></span>
            <span>{{ alumniStore.statistics.belumLaporCount }} Belum Lapor</span>
          </span>
        </div>
        
        <div class="relative h-80 sm:h-96 w-full mt-auto">
          <canvas ref="donutCanvas" aria-label="Grafik donat sebaran kategori"></canvas>
          <div
            v-if="(alumniStore.statistics.total - alumniStore.statistics.belumLaporCount) <= 0"
            class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-white/95 dark:bg-slate-900/95 z-10"
          >
            <i class="fa-solid fa-chart-pie text-3xl text-slate-300 dark:text-slate-700 mb-2" aria-hidden="true"></i>
            <p class="text-sm">Belum ada data grafik pilihan alumni. Silakan isi formulir lapor diri.</p>
          </div>
        </div>
      </div>

      <!-- Bar Chart: Top 5 Kampus Pilihan Alumni -->
      <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 shadow-sm flex flex-col">
        <div class="border-b border-emerald-100/80 dark:border-slate-800 pb-3 mb-4 flex items-center gap-3">
          <span class="w-9 h-9 rounded-xl bg-[#D1FAE5] text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <i class="fa-solid fa-graduation-cap text-sm" aria-hidden="true"></i>
          </span>
          <div>
            <h3 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
              Top 5 Kampus Pilihan Alumni
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Perguruan tinggi yang paling banyak dipilih alumni SMADA Ngawi
            </p>
          </div>
        </div>
        
        <div class="relative h-80 sm:h-96 w-full mt-auto">
          <canvas ref="barCanvas" aria-label="Grafik batang kampus favorit"></canvas>
          <div
            v-if="alumniStore.statistics.total <= 0"
            class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-white/95 dark:bg-slate-900/95 z-10"
          >
            <i class="fa-solid fa-graduation-cap text-3xl text-slate-300 dark:text-slate-700 mb-2" aria-hidden="true"></i>
            <p class="text-sm">Data kampus belum tersedia.</p>
          </div>
        </div>
      </div>

    </section>

    <!-- Daftar Kabar Alumni Terbaru -->
    <section class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 shadow-sm space-y-4" aria-labelledby="recent-heading">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-100/80 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-xl bg-[#FEF3C7] text-[#92400E] dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center shrink-0">
            <i class="fa-solid fa-sparkles text-sm" aria-hidden="true"></i>
          </span>
          <div>
            <h2 id="recent-heading" class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
              Kabar Alumni Terbaru
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Cerita studi lanjut &amp; karir alumni yang baru saja masuk
            </p>
          </div>
        </div>
        <router-link
          to="/data"
          class="px-3.5 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 border border-sky-200/80 dark:border-sky-800 text-sm font-semibold text-[#0369A1] dark:text-sky-300 self-start sm:self-auto transition-colors"
        >
          Lihat Semua ({{ alumniStore.alumniList.length }})
        </router-link>
      </div>

      <div v-if="recentAlumni.length > 0" class="divide-y divide-slate-100 dark:divide-slate-800">
        <div
          v-for="alumni in recentAlumni"
          :key="alumni.id"
          @click="openDetail(alumni)"
          class="py-3.5 px-3 rounded-xl hover:bg-sky-50/70 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-4"
          role="button"
          tabindex="0"
          @keydown.enter="openDetail(alumni)"
          @keydown.space.prevent="openDetail(alumni)"
        >
          <div class="flex items-center gap-3.5 min-w-0">
            <img
              v-if="alumni.photo"
              :src="alumni.photo"
              :alt="`Foto ${alumni.name}`"
              class="w-11 h-11 rounded-xl object-cover border border-sky-200 dark:border-slate-700 shrink-0"
              loading="lazy"
            />
            <div
              v-else
              class="w-11 h-11 rounded-xl font-bold flex items-center justify-center text-base border shrink-0 shadow-2xs"
              :class="CATEGORY_COLORS[alumni.category]?.avatar || 'bg-sky-100 text-[#0369A1] border-sky-200 dark:bg-slate-800 dark:text-sky-300'"
            >
              {{ alumni.name.charAt(0) }}
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                {{ alumni.name }}
              </div>
              <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center">
                <img
                  v-if="getInstitutionLogo(alumni.institution)"
                  :src="getInstitutionLogo(alumni.institution)"
                  :alt="alumni.institution"
                  class="w-4 h-4 rounded object-contain inline-block mr-1.5 bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
                  loading="lazy"
                  @error="(e) => e.target.style.display = 'none'"
                />
                <span class="truncate">{{ alumni.institution }}</span>
                <span class="mx-1.5 text-slate-300 dark:text-slate-600 shrink-0">&bull;</span>
                <span class="truncate">{{ alumni.major }}</span>
                <span class="mx-1.5 text-slate-300 dark:text-slate-600 shrink-0">&bull;</span>
                <span class="shrink-0">Angkatan {{ alumni.cohort }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <span
              class="px-2.5 py-0.5 rounded text-xs font-medium border whitespace-nowrap inline-block shrink-0"
              :class="CATEGORY_COLORS[alumni.category]?.badge || 'bg-slate-100 text-slate-700 border-slate-200'"
            >
              {{ alumni.category }}
            </span>
            <i class="fa-solid fa-chevron-right text-slate-300 text-xs hidden sm:block" aria-hidden="true"></i>
          </div>
        </div>
      </div>

      <div v-else class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
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
