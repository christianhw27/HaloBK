<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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

// State filter angkatan khusus untuk diagram tracer study & ringkasan alumni
const selectedChartCohort = ref('ALL')

const donutCanvas = ref(null)
const barCanvas = ref(null)
let donutChart = null
let barChart = null

// Daftar angkatan kelulusan yang tersedia dari data alumni (eksklusif alumni lulusan)
const availableCohorts = computed(() => {
  const set = new Set()
  alumniStore.alumniList.forEach(a => {
    if (a.category === 'Siswa Aktif' || a.isSiswa || String(a.cohort) === '2027') return
    const inst = String(a.institution || '').toLowerCase()
    if (inst.includes('sma negeri 2 ngawi') || inst.includes('sman 2 ngawi')) return
    const c = String(a.cohort || '').trim()
    if (c && c !== '-' && c !== 'undefined' && c !== 'null') {
      set.add(c)
    }
  })

  const sorted = Array.from(set).sort((a, b) => {
    const numA = parseInt(a, 10)
    const numB = parseInt(b, 10)
    if (!isNaN(numA) && !isNaN(numB)) return numB - numA
    return b.localeCompare(a)
  })

  if (sorted.length > 0) return sorted
  return ['2026', '2025', '2024', '2023', '2022', '2021', '2020']
})

// Hitungan jumlah alumni per angkatan untuk label dropdown
const cohortCounts = computed(() => {
  const counts = {}
  alumniStore.alumniList.forEach(a => {
    if (a.category === 'Siswa Aktif' || a.isSiswa || String(a.cohort) === '2027') return
    const inst = String(a.institution || '').toLowerCase()
    if (inst.includes('sma negeri 2 ngawi') || inst.includes('sman 2 ngawi')) return
    const c = String(a.cohort || '').trim()
    if (c) {
      counts[c] = (counts[c] || 0) + 1
    }
  })
  return counts
})

// Total seluruh alumni lulusan (selain siswa aktif)
const totalAlumniLulusanCount = computed(() => {
  return alumniStore.alumniList.filter(a => {
    if (a.category === 'Siswa Aktif' || a.isSiswa || String(a.cohort) === '2027') return false
    const inst = String(a.institution || '').toLowerCase()
    if (inst.includes('sma negeri 2 ngawi') || inst.includes('sman 2 ngawi')) return false
    return true
  }).length
})

// Statistik tersaring berdasarkan angkatan yang dipilih
const filteredChartStats = computed(() => {
  const onlyAlumni = alumniStore.alumniList.filter(a => {
    if (a.category === 'Siswa Aktif' || a.isSiswa || String(a.cohort) === '2027') return false
    const inst = String(a.institution || '').toLowerCase()
    if (inst.includes('sma negeri 2 ngawi') || inst.includes('sman 2 ngawi')) return false
    if (selectedChartCohort.value !== 'ALL' && String(a.cohort) !== String(selectedChartCohort.value)) {
      return false
    }
    return true
  })

  const total = onlyAlumni.length
  const ptnCount = onlyAlumni.filter(a => a.category === 'PTN').length
  const ptsCount = onlyAlumni.filter(a => a.category === 'PTS').length
  const kedinasanCount = onlyAlumni.filter(a => a.category === 'Kedinasan').length
  const tniPolriCount = onlyAlumni.filter(a => a.category === 'TNI/Polri').length
  const kerjaCount = onlyAlumni.filter(a => a.category === 'Bekerja').length
  const wirausahaCount = onlyAlumni.filter(a => a.category === 'Wirausaha').length
  const pelatihanCount = onlyAlumni.filter(a => a.category === 'Pelatihan / LPK').length
  const belumLaporCount = onlyAlumni.filter(a => a.category === 'Masa Tunggu' || a.category === 'Belum Lapor Diri').length
  const sudahLaporCount = ptnCount + ptsCount + kedinasanCount + tniPolriCount + kerjaCount + wirausahaCount + pelatihanCount

  return {
    total,
    ptnCount,
    ptsCount,
    kedinasanCount,
    tniPolriCount,
    kerjaCount,
    wirausahaCount,
    pelatihanCount,
    belumLaporCount,
    sudahLaporCount
  }
})

// Data Top 5 Kampus tersaring berdasarkan angkatan yang dipilih
const topCampusData = computed(() => {
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
    if (a.category === 'Siswa Aktif' || a.isSiswa || String(a.cohort) === '2027') return
    if (a.category === 'Masa Tunggu' || a.category === 'Belum Lapor Diri') return
    if (selectedChartCohort.value !== 'ALL' && String(a.cohort) !== String(selectedChartCohort.value)) return

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
  const labels = sorted.map(s => {
    const name = s[0]
    if (name.length > 18) {
      const words = name.split(' ')
      if (words.length > 1) {
        const mid = Math.ceil(words.length / 2)
        return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
      }
    }
    return name
  })
  const dataValues = sorted.map(s => s[1])

  return {
    sorted,
    totalTopCampus,
    labels,
    dataValues,
    count: sorted.length
  }
})

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

  const stats = filteredChartStats.value
  const hasDonutData = stats && stats.sudahLaporCount > 0

  // Donut Chart: Komposisi Kategori (Hanya Menampilkan Yang Sudah Lapor Pilihan Jalur)
  if (donutCanvas.value && hasDonutData) {
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

              ctx.font = '600 11px Poppins, sans-serif'
              ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#94a3b8' : '#64748b'
              ctx.fillText('Sudah Lapor', centerX, centerY - 10)

              ctx.font = 'bold 22px Poppins, sans-serif'
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
          padding: 4
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 10,
              padding: typeof window !== 'undefined' && window.innerWidth < 640 ? 6 : 8,
              font: {
                size: typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 11,
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
        cutout: '62%'
      }
    })
  }

  // Bar Chart: Top 5 Kampus Pilihan Alumni (Khusus Kampus Saja, Abaikan Belum Lapor Diri & Persiapan Ulang)
  const campus = topCampusData.value
  if (barCanvas.value && campus.count > 0) {
    barChart = new Chart(barCanvas.value, {
      type: 'bar',
      data: {
        labels: campus.labels,
        datasets: [{
          label: 'Jumlah Alumni',
          data: campus.dataValues,
          backgroundColor: ['#0284C7', '#10B981', '#F59E0B', '#E11D48', '#38BDF8'],
          borderRadius: 8,
          maxBarThickness: 38
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
              ctx.font = 'bold 11px Poppins, sans-serif'
              ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a'

              meta.data.forEach((bar, index) => {
                const val = dataset.data[index]
                if (val > 0 && bar && typeof bar.x === 'number') {
                  const pct = campus.totalTopCampus > 0 ? ((val / campus.totalTopCampus) * 100).toFixed(1) + '%' : ''
                  ctx.fillText(`${val} (${pct})`, bar.x, bar.y - 4)
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
          padding: { top: 16 }
        },
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grace: '18%',
            ticks: { precision: 0, font: { size: 11, family: 'Poppins' } },
            grid: { color: 'rgba(148, 163, 184, 0.15)' }
          },
          x: {
            ticks: {
              font: {
                size: typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 11,
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

onUnmounted(() => {
  if (donutChart) {
    donutChart.destroy()
    donutChart = null
  }
  if (barChart) {
    barChart.destroy()
    barChart = null
  }
})

watch(() => alumniStore.alumniList.length, async () => {
  await nextTick()
  initCharts()
})

watch(selectedChartCohort, async () => {
  await nextTick()
  initCharts()
})
</script>

<template>
  <div class="space-y-4 sm:space-y-5 w-full">
    
    <!-- Hero Banner Utama Cerah & Ramah (Ringkas & Proporsional) -->
    <section class="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#E0F2FE]/85 via-[#FFFBEB]/70 to-[#FFE4E6]/50 dark:from-slate-900 dark:via-sky-950/35 dark:to-amber-950/20 border border-sky-200/80 dark:border-slate-800 shadow-sm overflow-hidden" aria-labelledby="banner-heading">
      <div class="h-1 w-full bg-gradient-to-r from-[#0284C7] via-[#E11D48] via-[#F59E0B] to-[#10B981]" aria-hidden="true"></div>

      <div class="p-4 sm:p-5 lg:py-3.5 lg:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-[#0369A1] dark:text-sky-300 mb-1">
            <span class="px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800">
              SMA Negeri 2 Ngawi
            </span>
            <span class="text-amber-600 dark:text-amber-300">&bull;</span>
            <span class="text-[#92400E] dark:text-amber-300">Ruang BK SMADA</span>
          </div>

          <h1 id="banner-heading" class="font-display font-bold text-lg sm:text-xl lg:text-2xl tracking-tight text-[#0F172A] dark:text-white leading-tight">
            Cerita &amp; Sebaran Jejak Alumni SMADA
          </h1>
          <p class="text-xs sm:text-sm text-[#334155] dark:text-slate-300 mt-1 line-clamp-1 sm:line-clamp-none max-w-2xl">
            Intip kampus tujuan, sekolah kedinasan, dan karir lulusan SMADA sebagai referensi hangat buat adik kelas.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <router-link
            v-if="authStore.userRole !== 'siswa'"
            to="/lapor"
            class="px-4 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white font-semibold text-xs sm:text-sm transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm min-h-[38px]"
          >
            <i class="fa-solid fa-user-plus text-xs" aria-hidden="true"></i>
            <span>Formulir Lapor Diri</span>
          </router-link>

          <router-link
            to="/data"
            class="px-4 py-2 rounded-xl bg-white hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0369A1] dark:text-sky-200 font-semibold text-xs sm:text-sm border border-sky-200 dark:border-slate-700 transition-colors duration-150 flex items-center justify-center gap-2 min-h-[38px] shadow-2xs"
          >
            <i class="fa-solid fa-magnifying-glass text-xs" aria-hidden="true"></i>
            <span>Direktori Alumni</span>
          </router-link>

          <router-link
            v-if="authStore.userRole === 'admin' && alumniStore.totalPendingCount > 0"
            to="/verifikasi"
            class="px-3.5 py-2 rounded-xl bg-[#FEF3C7] text-[#92400E] hover:bg-amber-200/80 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300/80 dark:border-amber-500/40 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 min-h-[38px]"
          >
            <i class="fa-solid fa-bell text-xs" aria-hidden="true"></i>
            <span>{{ alumniStore.totalPendingCount }} Perlu Verifikasi</span>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Ringkasan Statistik Utama (4 Pilar Warna BK - Proporsional & Elegan) -->
    <section aria-labelledby="metrics-title">
      <h2 id="metrics-title" class="sr-only">Statistik Utama Alumni</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <!-- Total Data Terverifikasi (Trust Blue) -->
        <div class="p-4 lg:p-4.5 rounded-2xl bg-gradient-to-br from-sky-50/90 to-white dark:from-sky-950/40 dark:to-slate-900 border border-sky-200/80 dark:border-sky-800/60 shadow-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs sm:text-sm font-semibold text-[#0369A1] dark:text-sky-300">Total Terdata</span>
            <span class="w-8 h-8 rounded-xl bg-[#0369A1] text-white flex items-center justify-center text-xs shadow-xs">
              <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white leading-tight">
            {{ filteredChartStats.total }}
          </div>
          <div class="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
            {{ selectedChartCohort === 'ALL' ? 'Alumni sudah berbagi kabar' : `Alumni Lulusan ${selectedChartCohort}` }}
          </div>
        </div>

        <!-- Kuliah PTN & PTS (Growth Emerald) -->
        <div class="p-4 lg:p-4.5 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-950/40 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs sm:text-sm font-semibold text-[#047857] dark:text-emerald-300">Perguruan Tinggi</span>
            <span class="w-8 h-8 rounded-xl bg-[#047857] text-white flex items-center justify-center text-xs shadow-xs">
              <i class="fa-solid fa-building-columns" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white leading-tight">
            {{ filteredChartStats.ptnCount + filteredChartStats.ptsCount }}
          </div>
          <div class="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
            {{ filteredChartStats.ptnCount }} PTN &bull; {{ filteredChartStats.ptsCount }} PTS
          </div>
        </div>

        <!-- Kedinasan & Militer (Warm Magenta) -->
        <div class="p-4 lg:p-4.5 rounded-2xl bg-gradient-to-br from-rose-50/90 to-white dark:from-rose-950/40 dark:to-slate-900 border border-rose-200/80 dark:border-rose-800/60 shadow-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs sm:text-sm font-semibold text-[#BE123C] dark:text-rose-300">Kedinasan &amp; Militer</span>
            <span class="w-8 h-8 rounded-xl bg-[#BE123C] text-white flex items-center justify-center text-xs shadow-xs">
              <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white leading-tight">
            {{ filteredChartStats.kedinasanCount + filteredChartStats.tniPolriCount }}
          </div>
          <div class="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
            {{ filteredChartStats.kedinasanCount }} Dinas &bull; {{ filteredChartStats.tniPolriCount }} TNI/Polri
          </div>
        </div>

        <!-- Karir & Wirausaha (Hope Amber) -->
        <div class="p-4 lg:p-4.5 rounded-2xl bg-gradient-to-br from-amber-50/90 to-white dark:from-amber-950/40 dark:to-slate-900 border border-amber-200/80 dark:border-amber-800/60 shadow-xs">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs sm:text-sm font-semibold text-[#92400E] dark:text-amber-300">Karir &amp; Wirausaha</span>
            <span class="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center text-xs shadow-xs">
              <i class="fa-solid fa-briefcase" aria-hidden="true"></i>
            </span>
          </div>
          <div class="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white leading-tight">
            {{ filteredChartStats.kerjaCount + filteredChartStats.wirausahaCount }}
          </div>
          <div class="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
            {{ filteredChartStats.kerjaCount }} Kerja &bull; {{ filteredChartStats.wirausahaCount }} Bisnis
          </div>
        </div>

      </div>
    </section>

    <!-- Visualisasi Grafik & Filter Angkatan Tracer Study (Seimbang & Proporsional) -->
    <section class="space-y-3 sm:space-y-4" aria-labelledby="charts-heading">
      
      <!-- Toolbar Header Diagram & Filter Angkatan Terpadu -->
      <div class="rounded-2xl bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 shadow-2xs p-3 sm:px-5 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] text-white shadow-xs flex items-center justify-center shrink-0 text-sm">
            <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 id="charts-heading" class="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                Diagram Tracer Study Lulusan
              </h2>
              <span class="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-[#0369A1] dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                Statistik Resmi
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {{ selectedChartCohort === 'ALL' 
                ? `Akumulasi seluruh ${totalAlumniLulusanCount} data alumni lintas angkatan yang terdata` 
                : `Menampilkan ${filteredChartStats.total} data alumni khusus Lulusan Angkatan ${selectedChartCohort}` }}
            </p>
          </div>
        </div>

        <!-- Segmented Filter Pills Angkatan -->
        <div class="flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 self-start md:self-auto">
          <!-- Reset button jika filter aktif -->
          <button
            v-if="selectedChartCohort !== 'ALL'"
            @click="selectedChartCohort = 'ALL'"
            type="button"
            class="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
            title="Kembali ke Semua Angkatan"
          >
            <i class="fa-solid fa-rotate-left text-xs" aria-hidden="true"></i>
            <span>Semua</span>
          </button>

          <!-- Pill Button Semua Angkatan -->
          <button
            @click="selectedChartCohort = 'ALL'"
            type="button"
            class="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center gap-2 shrink-0 border"
            :class="selectedChartCohort === 'ALL'
              ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-sm shadow-sky-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-750 hover:text-[#0284C7]'"
          >
            <span>Semua Angkatan</span>
            <span
              class="px-2 py-0.5 rounded-full text-[11px] font-bold"
              :class="selectedChartCohort === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'"
            >
              {{ totalAlumniLulusanCount }}
            </span>
          </button>

          <!-- Pill Buttons Tiap Angkatan -->
          <button
            v-for="c in availableCohorts"
            :key="c"
            @click="selectedChartCohort = c"
            type="button"
            class="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center gap-2 shrink-0 border"
            :class="selectedChartCohort === c
              ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-sm shadow-sky-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-750 hover:text-[#0284C7]'"
          >
            <i class="fa-solid fa-graduation-cap text-xs" :class="selectedChartCohort === c ? 'text-white/90' : 'text-slate-400'" aria-hidden="true"></i>
            <span>Angkatan {{ c }}</span>
            <span
              class="px-2 py-0.5 rounded-full text-[11px] font-bold"
              :class="selectedChartCohort === c ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'"
            >
              {{ cohortCounts[c] || 0 }}
            </span>
          </button>
        </div>
      </div>

      <!-- Grid 2 Diagram Utama (Rapi, Seimbang & Padat Tanpa Ruang Kosong Aneh) -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        
        <!-- Donut Chart: Komposisi Kategori -->
        <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 shadow-sm flex flex-col">
          <div class="border-b border-sky-100/80 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="w-9 h-9 rounded-xl bg-[#E0F2FE] text-[#0369A1] dark:bg-sky-950/60 dark:text-sky-300 flex items-center justify-center shrink-0 text-sm">
                <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
              </span>
              <div>
                <h3 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Sebaran Pilihan Lulusan
                </h3>
                <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Jalur kuliah, kedinasan, dan karir pilihan alumni SMADA Ngawi
                  <span v-if="selectedChartCohort !== 'ALL'" class="font-semibold text-[#0284C7] dark:text-sky-400"> (Angkatan {{ selectedChartCohort }})</span>
                </p>
              </div>
            </div>

            <span
              v-if="filteredChartStats.belumLaporCount > 0"
              class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-[#BE123C] border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900 shrink-0"
              title="Siswa yang belum lapor diri / mengisi jalur pilihan"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true"></span>
              <span>{{ filteredChartStats.belumLaporCount }} Belum Lapor</span>
            </span>
          </div>
          
          <div class="relative h-72 sm:h-80 lg:h-[320px] xl:h-[340px] w-full">
            <canvas ref="donutCanvas" aria-label="Grafik donat sebaran kategori"></canvas>
            <div
              v-if="filteredChartStats.sudahLaporCount <= 0"
              class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-white/95 dark:bg-slate-900/95 z-10"
            >
              <i class="fa-solid fa-chart-pie text-3xl text-slate-300 dark:text-slate-700 mb-2" aria-hidden="true"></i>
              <p class="text-sm">Belum ada data grafik pilihan alumni{{ selectedChartCohort !== 'ALL' ? ` untuk Angkatan ${selectedChartCohort}` : '' }}. Silakan isi formulir lapor diri.</p>
            </div>
          </div>
        </div>

        <!-- Bar Chart: Top 5 Kampus Pilihan Alumni -->
        <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 shadow-sm flex flex-col">
          <div class="border-b border-emerald-100/80 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="w-9 h-9 rounded-xl bg-[#D1FAE5] text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0 text-sm">
                <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
              </span>
              <div>
                <h3 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Top 5 Kampus Pilihan Alumni
                </h3>
                <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Perguruan tinggi yang paling banyak dipilih alumni SMADA Ngawi
                  <span v-if="selectedChartCohort !== 'ALL'" class="font-semibold text-[#047857] dark:text-emerald-400"> (Angkatan {{ selectedChartCohort }})</span>
                </p>
              </div>
            </div>
          </div>
          
          <div class="relative h-72 sm:h-80 lg:h-[320px] xl:h-[340px] w-full">
            <canvas ref="barCanvas" aria-label="Grafik batang kampus favorit"></canvas>
            <div
              v-if="topCampusData.count <= 0"
              class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400 bg-white/95 dark:bg-slate-900/95 z-10"
            >
              <i class="fa-solid fa-graduation-cap text-3xl text-slate-300 dark:text-slate-700 mb-2" aria-hidden="true"></i>
              <p class="text-sm">Data kampus belum tersedia{{ selectedChartCohort !== 'ALL' ? ` untuk Angkatan ${selectedChartCohort}` : '' }}.</p>
            </div>
          </div>
        </div>

      </div>

      <!-- Petunjuk Gulir Lembut ke Kabar Alumni Terbaru -->
      <div class="hidden lg:flex items-center justify-center gap-2 pt-1 text-xs text-slate-400 dark:text-slate-500 font-medium select-none">
        <i class="fa-solid fa-angles-down text-sky-500 animate-bounce text-[10px]" aria-hidden="true"></i>
        <span>Gulir ke bawah untuk melihat Kabar Alumni Terbaru</span>
      </div>
    </section>

    <!-- Bagian Kabar Alumni Terbaru (Berada di Bawah Layar Utama) -->
    <section class="mt-8 lg:mt-12 pt-6 border-t border-sky-100/80 dark:border-slate-800" aria-labelledby="recent-heading">
      <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 shadow-sm space-y-4">
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
                class="w-11 h-11 rounded-xl border flex items-center justify-center text-sm font-bold shrink-0"
                :class="CATEGORY_COLORS[alumni.category]?.avatar || 'bg-slate-100 text-slate-600 border-slate-200'"
              >
                {{ alumni.name ? alumni.name.charAt(0).toUpperCase() : 'A' }}
              </div>

              <div class="min-w-0">
                <div class="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  {{ alumni.name }}
                </div>
                <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                  {{ alumni.institution || '-' }} &bull; {{ alumni.major || '-' }}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2.5 shrink-0">
              <span
                class="px-2.5 py-1 rounded-full text-xs font-semibold border"
                :class="CATEGORY_COLORS[alumni.category]?.badge || 'bg-slate-100 text-slate-700 border-slate-200'"
              >
                {{ alumni.category === 'Masa Tunggu' ? 'Belum Lapor' : alumni.category }}
              </span>
              <span class="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                Angkatan {{ alumni.cohort }}
              </span>
              <i class="fa-solid fa-chevron-right text-xs text-slate-400" aria-hidden="true"></i>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8 text-slate-400">
          <i class="fa-solid fa-user-graduate text-3xl mb-2 text-slate-300 dark:text-slate-700" aria-hidden="true"></i>
          <p class="text-sm">Belum ada cerita alumni terbaru.</p>
        </div>
      </div>
    </section>

    <!-- Detail Modal -->
    <DetailModal
      v-if="selectedAlumni"
      :is-open="isModalOpen"
      :alumni="selectedAlumni"
      @close="isModalOpen = false"
    />
  </div>
</template>
