<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNewsStore } from '@/stores/news'
import { NEWS_CATEGORY_STYLES } from '@/lib/starterNews'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  article: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])
const router = useRouter()
const newsStore = useNewsStore()
const copiedNotice = ref(false)

const categoryStyle = computed(() => {
  if (!props.article?.category) return NEWS_CATEGORY_STYLES['Pengumuman BK']
  return NEWS_CATEGORY_STYLES[props.article.category] || NEWS_CATEGORY_STYLES['Pengumuman BK']
})

const paragraphs = computed(() => {
  if (!props.article?.content) return []
  return props.article.content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
})

function handleKeydown(e) {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

async function copyArticleInfo() {
  if (!props.article) return
  const text = `${props.article.title}\n\n${props.article.summary}\n\nPortal Berita Halo Alumni - SMA Negeri 2 Ngawi`
  try {
    await navigator.clipboard.writeText(text)
    copiedNotice.value = true
    setTimeout(() => {
      copiedNotice.value = false
    }, 2500)
  } catch {
    copiedNotice.value = false
  }
}

function goToTracerStudy() {
  emit('close')
  router.push('/dashboard')
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen && article"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-article-title"
      class="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      @click.self="emit('close')"
    >
      <article class="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        <!-- Header Bar Modal -->
        <div class="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="px-2.5 py-0.5 rounded-md text-xs font-semibold border shrink-0"
              :class="categoryStyle.badge"
            >
              {{ article.category }}
            </span>
            <span class="text-sm text-slate-500 dark:text-slate-400 truncate">
              {{ newsStore.formatNewsDate(article.createdAt) }}
            </span>
          </div>

          <button
            type="button"
            @click="emit('close')"
            class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0"
            aria-label="Tutup jendela baca berita"
          >
            <i class="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Scrollable Article Body -->
        <div class="overflow-y-auto flex-1">
          <!-- Cover Gambar Artikel (Jika ada) -->
          <div v-if="article.imageUrl" class="w-full aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-slate-200 dark:border-slate-800">
            <img
              :src="article.imageUrl"
              :alt="article.title"
              width="960"
              height="540"
              class="w-full h-full object-cover"
            />
          </div>

          <!-- Header Visual Cerah Institusional (Jika tanpa gambar unggahan) -->
          <div
            v-else
            class="w-full px-6 sm:px-8 py-7 bg-gradient-to-br border-b border-[#E2E8F0] dark:border-slate-800"
            :class="categoryStyle.surface"
          >
            <div class="flex items-center gap-2 text-sm font-semibold" :class="categoryStyle.accentText">
              <i :class="categoryStyle.icon" aria-hidden="true"></i>
              <span>Buletin Resmi Bimbingan Konseling SMADA Ngawi</span>
            </div>
          </div>

          <div class="p-5 sm:p-8 space-y-5">
            <!-- Judul Utama -->
            <header class="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-5">
              <h2
                id="reader-article-title"
                class="font-display font-bold text-2xl sm:text-3xl text-[#0F172A] dark:text-white leading-snug tracking-tight"
              >
                {{ article.title }}
              </h2>

              <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#64748B] dark:text-slate-400">
                <span class="flex items-center gap-1.5 font-medium text-[#0F172A] dark:text-slate-200">
                  <i class="fa-regular fa-user text-[#0284C7] dark:text-sky-400" aria-hidden="true"></i>
                  {{ article.author }}
                </span>
                <span class="flex items-center gap-1.5">
                  <i class="fa-regular fa-clock" aria-hidden="true"></i>
                  {{ newsStore.estimateReadTime(article.content) }}
                </span>
                <span class="flex items-center gap-1.5">
                  <i class="fa-regular fa-eye" aria-hidden="true"></i>
                  {{ article.views }} kali dibaca
                </span>
              </div>
            </header>

            <!-- Ringkasan Lead -->
            <p class="text-base sm:text-lg font-medium text-[#334155] dark:text-slate-200 leading-relaxed bg-[#F8FAFC] dark:bg-slate-800/60 p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-700/70">
              {{ article.summary }}
            </p>

            <!-- Paragraf Isi Berita -->
            <div class="space-y-4 text-base sm:text-[17px] text-[#334155] dark:text-slate-300 leading-[1.7]">
              <p v-for="(para, index) in paragraphs" :key="index">
                {{ para }}
              </p>
            </div>
          </div>
        </div>

        <!-- Footer Modal -->
        <div class="px-5 py-4 bg-[#F8FAFC] dark:bg-slate-800/60 border-t border-[#E2E8F0] dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            @click="copyArticleInfo"
            class="px-4 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-[#334155] dark:text-slate-200 text-sm font-semibold transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            <i :class="copiedNotice ? 'fa-solid fa-check text-emerald-600' : 'fa-regular fa-copy'" aria-hidden="true"></i>
            <span>{{ copiedNotice ? 'Ringkasan berita disalin' : 'Salin Ringkasan Berita' }}</span>
          </button>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              @click="goToTracerStudy"
              class="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 min-h-[44px]"
            >
              <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
              <span>Masuk Tracer Study</span>
            </button>

            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-sm font-semibold transition-colors min-h-[44px]"
            >
              Tutup
            </button>
          </div>
        </div>

      </article>
    </div>
  </Transition>
</template>

