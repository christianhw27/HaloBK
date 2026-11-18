<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { searchCampuses, findCampus, getInstitutionLogo } from '@/lib/campusList'
import { getAllSnpmbPtn, findSnpmbPtn } from '@/lib/snpmbService'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Ketik nama kampus (contoh: UNESA, UGM, ITS)...'
  },
  required: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  onlyPtn: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: 'campus-input'
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

const query = ref(props.modelValue || '')
const isOpen = ref(false)
const highlightedIndex = ref(-1)
const comboboxRef = ref(null)

watch(() => props.modelValue, (newVal) => {
  if (newVal !== query.value) {
    query.value = newVal || ''
  }
})

const currentLogo = computed(() => {
  return getInstitutionLogo(query.value)
})

function buildPtnOption(ptn, campusInfo = null) {
  const info = campusInfo || findCampus(ptn.name)
  let fallbackDomain = info?.domain || null
  if (!fallbackDomain && ptn.web) {
    try {
      const u = new URL(ptn.web)
      fallbackDomain = u.hostname.replace(/^pmb\./, '').replace(/^admisi\./, '').replace(/^spmb\./, '')
    } catch (e) {}
  }

  const resolvedLogo =
    info?.logoUrl ||
    getInstitutionLogo(info?.name || ptn.name) ||
    (fallbackDomain
      ? `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${fallbackDomain}&size=128`
      : null)

  return {
    name: ptn.name,
    shortName: info?.shortName && info.shortName !== ptn.name ? info.shortName : '',
    city: info?.city || 'Indonesia',
    category: ptn.category || info?.category || 'PTN',
    domain: fallbackDomain,
    logoUrl: resolvedLogo,
    snpmbId: String(ptn.id)
  }
}

const filteredOptions = computed(() => {
  if (!props.onlyPtn) {
    return searchCampuses(query.value, 8)
  }

  // Mode khusus PTN SNPMB: pakai searchCampuses (dengan alias UGM/ITS/UNESA/UB) + seluruh 145 PTN resmi SNPMB
  const q = query.value.trim().toLowerCase()
  const allPtn = getAllSnpmbPtn()
  const matchedPtnMap = new Map()

  if (!q) {
    // Tampilkan kampus populer dari searchCampuses yang merupakan PTN SNPMB
    const popular = searchCampuses('', 20)
    for (const c of popular) {
      const ptn = findSnpmbPtn(c.name)
      if (ptn && !matchedPtnMap.has(ptn.id)) {
        matchedPtnMap.set(ptn.id, buildPtnOption(ptn, c))
      }
      if (matchedPtnMap.size >= 10) break
    }
    return Array.from(matchedPtnMap.values())
  }

  // 1. Cek kecocokan alias/singkatan via findSnpmbPtn
  const directAlias = findSnpmbPtn(q)
  if (directAlias) {
    matchedPtnMap.set(directAlias.id, buildPtnOption(directAlias))
  }

  // 2. Cek kecocokan dari searchCampuses (mendukung singkatan lokal & kota)
  for (const c of searchCampuses(q, 20)) {
    const ptn = findSnpmbPtn(c.name)
    if (ptn && !matchedPtnMap.has(ptn.id)) {
      matchedPtnMap.set(ptn.id, buildPtnOption(ptn, c))
    }
  }

  // 3. Cek substring langsung dari 145 PTN SNPMB
  for (const ptn of allPtn) {
    if (matchedPtnMap.size >= 12) break
    if (
      !matchedPtnMap.has(ptn.id) &&
      (ptn.name.toLowerCase().includes(q) || (ptn.rawName || '').toLowerCase().includes(q))
    ) {
      matchedPtnMap.set(ptn.id, buildPtnOption(ptn))
    }
  }

  return Array.from(matchedPtnMap.values()).slice(0, 12)
})

function onInput(e) {
  query.value = e.target.value
  emit('update:modelValue', query.value)
  isOpen.value = true
  highlightedIndex.value = 0
}

function selectCampus(campus) {
  query.value = campus.name
  emit('update:modelValue', campus.name)
  emit('select', campus)
  isOpen.value = false
}

function selectCustomText() {
  emit('update:modelValue', query.value)
  isOpen.value = false
}

function onFocus() {
  isOpen.value = true
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
    if (isOpen.value && highlightedIndex.value >= 0 && highlightedIndex.value < filteredOptions.value.length) {
      e.preventDefault()
      selectCampus(filteredOptions.value[highlightedIndex.value])
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
    
    <!-- Input Field dengan Pratinjau Logo Kampus -->
    <div class="relative flex items-center">
      
      <!-- Pratinjau Logo di Sisi Kiri Input -->
      <div class="absolute left-3 flex items-center pointer-events-none">
        <img
          v-if="currentLogo"
          :key="currentLogo"
          :src="currentLogo"
          alt="Logo"
          class="w-5 h-5 rounded-md object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs"
          loading="lazy"
          @error="(e) => e.target.style.display = 'none'"
        />
        <i
          v-else
          class="fa-solid fa-building-columns text-slate-400 text-sm"
          aria-hidden="true"
        ></i>
      </div>

      <input
        :id="id"
        type="text"
        :value="query"
        @input="onInput"
        @focus="onFocus"
        @keydown="handleKeydown"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        autocomplete="off"
        class="w-full pl-10 pr-9 py-2.5 rounded-[10px] bg-slate-50 dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm sm:text-base text-[#0F172A] dark:text-white placeholder:text-[#64748B] focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      />

      <!-- Tombol Bersihkan -->
      <button
        v-if="query && !disabled"
        @click="query = ''; emit('update:modelValue', ''); isOpen = true"
        type="button"
        class="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
        aria-label="Bersihkan input instansi"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <!-- Dropdown Menu Saran Kampus -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="isOpen && (filteredOptions.length > 0 || query.trim())"
        class="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800/60"
      >
        <!-- Daftar Rekomendasi Kampus -->
        <ul role="listbox" class="py-1">
          <li
            v-for="(campus, idx) in filteredOptions"
            :key="campus.name"
            @click="selectCampus(campus)"
            @mouseenter="highlightedIndex = idx"
            role="option"
            :aria-selected="highlightedIndex === idx"
            class="px-3.5 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-3 text-sm"
            :class="highlightedIndex === idx
              ? 'bg-[#E0F2FE] dark:bg-sky-950/40 text-[#0369A1] dark:text-sky-100'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-[#0F172A] dark:text-slate-200'"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <img
                v-if="campus.logoUrl || campus.domain"
                :key="campus.logoUrl || campus.domain"
                :src="campus.logoUrl || `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${campus.domain}&size=128`"
                :alt="campus.shortName || campus.name"
                class="w-6 h-6 rounded-md object-contain bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
                loading="lazy"
                @error="(e) => e.target.style.display = 'none'"
              />
              <span
                v-else
                class="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-xs"
              >
                <i class="fa-solid fa-building-columns" aria-hidden="true"></i>
              </span>
              <div class="min-w-0">
                <div class="font-semibold truncate">
                  {{ campus.name }}
                </div>
                <div v-if="campus.shortName || campus.city" class="text-xs text-slate-500 dark:text-slate-400 truncate">
                  <span v-if="campus.shortName">{{ campus.shortName }}</span>
                  <span v-if="campus.shortName && campus.city" class="mx-1">&bull;</span>
                  <span v-if="campus.city">{{ campus.city }}</span>
                </div>
              </div>
            </div>

            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-slate-700">
              {{ campus.category }}
            </span>
          </li>
        </ul>

        <!-- Pesan kosong khusus mode PTN SNPMB -->
        <div
          v-if="onlyPtn && filteredOptions.length === 0 && query.trim()"
          class="p-3.5 text-xs text-slate-500 dark:text-slate-400 text-center"
        >
          PTN "<strong>{{ query }}</strong>" tidak ditemukan di katalog resmi SNPMB.
        </div>

        <!-- Opsi Gunakan Teks Kustom (Hanya untuk mode non-PTN / Tracer Study) -->
        <div
          v-if="query.trim() && !onlyPtn"
          @click="selectCustomText"
          class="p-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-sm flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium transition-colors"
        >
          <i class="fa-solid fa-pen-nib text-slate-400 text-sm"></i>
          <span>Gunakan teks kustom: <strong>"{{ query }}"</strong></span>
        </div>
      </div>
    </Transition>

  </div>
</template>

