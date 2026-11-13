<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { getProdiListForCampus, isSnpmbPtn, findSnpmbPtn } from '@/lib/snpmbService'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  campus: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Pilih atau cari Program Studi resmi...'
  },
  required: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: 'prodi-input'
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

const query = ref(props.modelValue || '')
const isOpen = ref(false)
const highlightedIndex = ref(-1)
const comboboxRef = ref(null)
const selectedJenjang = ref('ALL') // ALL, S1, D4, D3

// Pantau perubahan modelValue dari luar
watch(() => props.modelValue, (newVal) => {
  if (newVal !== query.value) {
    query.value = newVal || ''
  }
})

// Kampus PTN SNPMB aktif
const currentPtn = computed(() => {
  return findSnpmbPtn(props.campus)
})

const isPtn = computed(() => {
  return currentPtn.value !== null
})

// Daftar seluruh prodi untuk kampus yang dipilih
const allProdiList = computed(() => {
  return getProdiListForCampus(props.campus)
})

// Daftar jenjang yang tersedia di kampus ini
const availableJenjang = computed(() => {
  const set = new Set(allProdiList.value.map(p => p.jenjang))
  return ['ALL', ...Array.from(set).sort()]
})

// Filter prodi berdasarkan teks pencarian dan jenjang
const filteredOptions = computed(() => {
  if (!allProdiList.value.length) return []

  const q = query.value.trim().toLowerCase()
  return allProdiList.value.filter(p => {
    // Filter Jenjang
    if (selectedJenjang.value !== 'ALL' && p.jenjang !== selectedJenjang.value) {
      return false
    }

    // Filter teks pencarian
    if (!q) return true
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.nama.toLowerCase().includes(q) ||
      p.jenjang.toLowerCase().includes(q)
    )
  }).slice(0, 30) // Tampilkan maksimal 30 prodi agar render super ringan
})

function onInput(e) {
  query.value = e.target.value
  emit('update:modelValue', query.value)
  isOpen.value = true
  highlightedIndex.value = 0
}

function selectProdi(prodi) {
  query.value = prodi.fullName
  emit('update:modelValue', prodi.fullName)
  emit('select', prodi)
  isOpen.value = false
}

function selectCustomText() {
  emit('update:modelValue', query.value)
  isOpen.value = false
}

function onFocus() {
  isOpen.value = true
}

function setJenjang(jenjang) {
  selectedJenjang.value = jenjang
  highlightedIndex.value = 0
}

function handleKeydown(e) {
  if (!isOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      isOpen.value = true
      return
    }
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (highlightedIndex.value < filteredOptions.value.length - 1) {
      highlightedIndex.value++
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (highlightedIndex.value > 0) {
      highlightedIndex.value--
    }
  } else if (e.key === 'Enter') {
    if (isOpen.value) {
      e.preventDefault()
      if (highlightedIndex.value >= 0 && highlightedIndex.value < filteredOptions.value.length) {
        selectProdi(filteredOptions.value[highlightedIndex.value])
      } else {
        selectCustomText()
      }
    }
  } else if (e.key === 'Escape') {
    isOpen.value = false
  }
}

function handleClickOutside(e) {
  if (comboboxRef.value && !comboboxRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="comboboxRef" class="relative w-full">
    
    <!-- Input Box -->
    <div class="relative flex items-center">
      
      <!-- Icon Penanda di Kiri Input -->
      <div class="absolute left-3 flex items-center pointer-events-none text-slate-400">
        <i v-if="isPtn" class="fa-solid fa-graduation-cap text-[#0284C7] dark:text-sky-400 text-sm" aria-hidden="true"></i>
        <i v-else class="fa-solid fa-book-open text-slate-400 text-sm" aria-hidden="true"></i>
      </div>

      <input
        :id="id"
        type="text"
        :value="query"
        @input="onInput"
        @focus="onFocus"
        @keydown="handleKeydown"
        :placeholder="isPtn ? (placeholder || 'Pilih atau cari Program Studi resmi...') : 'Contoh: S1 Teknik Informatika atau Staf Operasional'"
        :required="required"
        autocomplete="off"
        class="w-full pl-9 pr-10 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:border-transparent transition-all shadow-2xs"
      />

      <!-- Clear / Chevron Action di Kanan Input -->
      <div class="absolute right-2.5 flex items-center gap-1">
        <button
          v-if="query"
          type="button"
          @click="query = ''; emit('update:modelValue', '')"
          class="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          title="Hapus teks prodi"
          tabindex="-1"
        >
          <i class="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
        </button>
        <button
          v-if="isPtn"
          type="button"
          @click="isOpen = !isOpen"
          class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          tabindex="-1"
        >
          <i
            class="fa-solid fa-chevron-down text-xs transition-transform duration-200"
            :class="{ 'rotate-180': isOpen }"
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </div>

    <!-- Info Sub-label Resmi SNPMB -->
    <div v-if="isPtn" class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 px-1">
      <span class="inline-flex items-center gap-1 text-[#0284C7] dark:text-sky-400 font-medium">
        <i class="fa-solid fa-circle-check text-xs"></i>
        Data Resmi SNPMB Kemendikbud &bull; {{ allProdiList.length }} Prodi di {{ currentPtn.name }}
      </span>
      <span v-if="query && allProdiList.some(p => p.fullName.toLowerCase() === query.toLowerCase())" class="text-emerald-600 dark:text-emerald-400 font-medium">
        Terverifikasi SNPMB
      </span>
    </div>

    <!-- Dropdown Menu Pilihan Prodi -->
    <div
      v-if="isOpen && isPtn && allProdiList.length > 0"
      class="absolute z-50 left-0 right-0 mt-1.5 max-h-80 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden focus:outline-none animate-in fade-in slide-in-from-top-2 duration-150"
    >
      <!-- Filter Cepat Jenjang (Semua, S1, D4, D3) -->
      <div v-if="availableJenjang.length > 2" class="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center gap-1.5 overflow-x-auto text-xs">
        <span class="text-slate-400 text-[11px] font-medium mr-1 shrink-0">Jenjang:</span>
        <button
          v-for="j in availableJenjang"
          :key="j"
          type="button"
          @click.prevent="setJenjang(j)"
          class="px-2 py-0.5 rounded-md font-semibold shrink-0 transition-colors"
          :class="selectedJenjang === j 
            ? 'bg-[#0284C7] text-white shadow-xs' 
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'"
        >
          {{ j === 'ALL' ? 'Semua' : j }}
        </button>
      </div>

      <!-- Header Jumlah Ditemukan -->
      <div class="px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/40 dark:bg-slate-800/30 flex items-center justify-between">
        <span>Pilihan Program Studi ({{ filteredOptions.length }})</span>
        <span v-if="filteredOptions.length === 30" class="text-[10px] text-amber-500 font-normal">Ketik untuk mencari lebih spesifik</span>
      </div>

      <!-- List Hasil Filter -->
      <div v-if="filteredOptions.length > 0" class="divide-y divide-slate-100 dark:divide-slate-800/60">
        <div
          v-for="(prodi, idx) in filteredOptions"
          :key="prodi.id_prodi"
          @click="selectProdi(prodi)"
          @mouseenter="highlightedIndex = idx"
          class="px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-3 text-left transition-colors"
          :class="{
            'bg-sky-50 dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-300': highlightedIndex === idx || query.toLowerCase() === prodi.fullName.toLowerCase(),
            'hover:bg-slate-50 dark:hover:bg-slate-800/60': highlightedIndex !== idx
          }"
          role="option"
          :aria-selected="highlightedIndex === idx"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0"
                :class="{
                  'bg-sky-100 text-[#0369A1] border-sky-200 dark:bg-sky-900/60 dark:text-sky-300': prodi.jenjang === 'S1',
                  'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300': prodi.jenjang === 'D4',
                  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/60 dark:text-amber-300': prodi.jenjang === 'D3'
                }"
              >
                {{ prodi.jenjang }}
              </span>
              <span class="font-medium text-sm text-slate-900 dark:text-white truncate">
                {{ prodi.nama }}
              </span>
            </div>
            
            <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span v-if="prodi.dayaTampung" class="inline-flex items-center gap-1">
                <i class="fa-solid fa-users text-[10px] text-slate-400"></i>
                Daya Tampung: <strong class="text-slate-700 dark:text-slate-300">{{ prodi.dayaTampung }}</strong>
              </span>
              <span v-if="prodi.portofolio" class="text-amber-600 dark:text-amber-400 font-medium">
                &bull; Porto: {{ prodi.portofolio }}
              </span>
            </div>
          </div>

          <i
            v-if="query.toLowerCase() === prodi.fullName.toLowerCase()"
            class="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"
            aria-hidden="true"
          ></i>
        </div>
      </div>

      <!-- Jika Hasil Pencarian Kosong -->
      <div v-else class="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
        <p class="font-medium text-slate-700 dark:text-slate-300">Tidak ada prodi yang cocok dengan "{{ query }}"</p>
        <p class="text-xs text-slate-400 mt-0.5">Jurusan baru atau tidak ada di daftar SNPMB?</p>
        <button
          type="button"
          @click="selectCustomText"
          class="mt-2.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-semibold hover:bg-sky-100 transition-colors"
        >
          Gunakan teks manual: "{{ query }}"
        </button>
      </div>

      <!-- Footer Opsi Manual Selalu Tersedia -->
      <div v-if="query && !filteredOptions.some(p => p.fullName.toLowerCase() === query.toLowerCase())" class="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
        <button
          type="button"
          @click="selectCustomText"
          class="w-full text-left px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between transition-colors"
        >
          <span>Gunakan teks manual: <strong class="text-slate-900 dark:text-white">"{{ query }}"</strong></span>
          <i class="fa-solid fa-arrow-turn-down-left text-slate-400 text-[10px]"></i>
        </button>
      </div>

    </div>

  </div>
</template>

