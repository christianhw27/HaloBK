<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useNewsStore } from '@/stores/news'
import { NEWS_CATEGORIES } from '@/lib/starterNews'
import { compressImage } from '@/lib/imageHelper'
import { processAndUploadPhoto, isCloudinaryConfigured } from '@/lib/cloudinary'

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

const emit = defineEmits(['close', 'saved'])
const newsStore = useNewsStore()

const form = ref({
  title: '',
  category: 'Pengumuman BK',
  author: 'Tim BK SMADA Ngawi',
  imageUrl: '',
  summary: '',
  content: '',
  isFeatured: false,
  isPublished: true
})

const isSaving = ref(false)
const isUploadingImage = ref(false)
const uploadWarning = ref('')
const errorMessage = ref('')

watch(
  () => [props.isOpen, props.article],
  ([open, item]) => {
    if (!open) return
    errorMessage.value = ''
    uploadWarning.value = ''

    if (item) {
      form.value = {
        title: item.title || '',
        category: item.category || 'Pengumuman BK',
        author: item.author || 'Tim BK SMADA Ngawi',
        imageUrl: item.imageUrl || '',
        summary: item.summary || '',
        content: item.content || '',
        isFeatured: Boolean(item.isFeatured),
        isPublished: item.isPublished !== undefined ? Boolean(item.isPublished) : true
      }
    } else {
      form.value = {
        title: '',
        category: 'Pengumuman BK',
        author: 'Tim BK SMADA Ngawi',
        imageUrl: '',
        summary: '',
        content: '',
        isFeatured: false,
        isPublished: true
      }
    }
  },
  { immediate: true }
)

async function handleImageUpload(e) {
  const file = e.target.files[0]
  if (!file) return

  uploadWarning.value = ''

  if (isCloudinaryConfigured()) {
    isUploadingImage.value = true
    try {
      const url = await processAndUploadPhoto(file)
      form.value.imageUrl = url
    } catch (err) {
      uploadWarning.value = err.message
    } finally {
      isUploadingImage.value = false
    }
  } else {
    try {
      const compressed = await compressImage(file, 720, 0.78)
      form.value.imageUrl = compressed
      uploadWarning.value = 'Cloudinary belum diatur di .env. Gambar disimpan dalam format terkompresi lokal.'
    } catch (err) {
      uploadWarning.value = err.message
    }
  }
}

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

async function handleSubmit() {
  if (!form.value.title.trim()) {
    errorMessage.value = 'Judul berita wajib diisi.'
    return
  }
  if (!form.value.summary.trim()) {
    errorMessage.value = 'Ringkasan singkat berita wajib diisi.'
    return
  }
  if (!form.value.content.trim()) {
    errorMessage.value = 'Isi berita lengkap wajib diisi.'
    return
  }

  isSaving.value = true
  errorMessage.value = ''

  let res
  if (props.article?.id) {
    res = await newsStore.updateNews(props.article.id, form.value)
  } else {
    res = await newsStore.createNews(form.value)
  }

  isSaving.value = false

  if (res.success) {
    emit('saved', props.article?.id ? 'Berita berhasil diperbarui.' : 'Berita baru berhasil ditambahkan.')
    emit('close')
  } else {
    errorMessage.value = res.message || 'Gagal menyimpan berita.'
  }
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
      v-if="isOpen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-form-title"
      class="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      @click.self="emit('close')"
    >
      <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        <!-- Header Form Modal -->
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 id="news-form-title" class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
              {{ article?.id ? 'Edit Berita & Pengumuman' : 'Tulis Berita Baru' }}
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Informasi ini tampil pada halaman awal Portal Berita sebelum masuk Tracer Study.
            </p>
          </div>

          <button
            type="button"
            @click="emit('close')"
            class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0"
            aria-label="Tutup formulir berita"
          >
            <i class="fa-solid fa-xmark text-base" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Body Form -->
        <form @submit.prevent="handleSubmit" class="overflow-y-auto flex-1 p-6 space-y-4">
          <div
            v-if="errorMessage"
            role="alert"
            class="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold flex items-center gap-2"
          >
            <i class="fa-solid fa-circle-exclamation text-rose-600" aria-hidden="true"></i>
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Judul Berita -->
          <div>
            <label for="news-title-input" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Judul Berita <span class="text-rose-600">*</span>
            </label>
            <input
              id="news-title-input"
              v-model="form.title"
              type="text"
              required
              placeholder="Contoh: Jadwal Konsultasi Rasionalisasi SNBP Kelas XII"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          <!-- Kategori & Penulis -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="news-category-select" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kategori <span class="text-rose-600">*</span>
              </label>
              <select
                id="news-category-select"
                v-model="form.category"
                class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white"
              >
                <option v-for="cat in NEWS_CATEGORIES" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
            </div>

            <div>
              <label for="news-author-input" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Penulis / Bidang
              </label>
              <input
                id="news-author-input"
                v-model="form.author"
                type="text"
                placeholder="Tim BK SMADA Ngawi"
                class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <!-- Gambar Cover Berita -->
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
            <div class="flex items-center justify-between">
              <label for="news-image-url" class="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Gambar Sampul Berita (Opsional)
              </label>
              <span class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Unggah foto atau tempel URL
              </span>
            </div>

            <div v-if="form.imageUrl" class="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
              <img :src="form.imageUrl" alt="Pratinjau gambar sampul berita" class="w-full h-full object-cover" />
              <button
                type="button"
                @click="form.imageUrl = ''"
                class="absolute top-2 right-2 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm transition-colors flex items-center gap-1"
              >
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                <span>Hapus Gambar</span>
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="news-image-file" class="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Unggah dari Perangkat
                </label>
                <input
                  id="news-image-file"
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  :disabled="isUploadingImage"
                  @change="handleImageUpload"
                  class="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#E0F2FE] dark:file:bg-sky-950 file:text-[#0369A1] dark:file:text-sky-300 hover:file:bg-sky-200/70 cursor-pointer disabled:opacity-50"
                />
              </div>

              <div>
                <label for="news-image-url" class="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Atau Masukkan URL Gambar
                </label>
                <input
                  id="news-image-url"
                  v-model="form.imageUrl"
                  type="url"
                  placeholder="https://..."
                  class="w-full px-3 py-2 rounded-[10px] bg-white dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20"
                />
              </div>
            </div>

            <p v-if="isUploadingImage" class="text-sm text-[#0369A1] dark:text-sky-400 font-semibold flex items-center gap-2">
              <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
              <span>Mengunggah gambar ke Cloudinary...</span>
            </p>
            <p v-else-if="uploadWarning" class="text-sm text-amber-700 dark:text-amber-300 font-medium">
              {{ uploadWarning }}
            </p>
          </div>

          <!-- Ringkasan Singkat -->
          <div>
            <label for="news-summary-input" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Ringkasan Singkat (Lead) <span class="text-rose-600">*</span>
            </label>
            <textarea
              id="news-summary-input"
              v-model="form.summary"
              rows="2"
              required
              placeholder="Tuliskan inti berita dalam 1-2 kalimat yang tampil pada kartu pratinjau..."
              class="w-full px-3.5 py-2.5 rounded-[10px] bg-slate-50 dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20"
            ></textarea>
          </div>

          <!-- Isi Berita Lengkap -->
          <div>
            <label for="news-content-input" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Isi Berita Lengkap <span class="text-rose-600">*</span>
            </label>
            <textarea
              id="news-content-input"
              v-model="form.content"
              rows="6"
              required
              placeholder="Tuliskan isi berita secara lengkap. Pisahkan antar paragraf dengan tombol Enter dua kali."
              class="w-full px-3.5 py-2.5 rounded-[10px] bg-slate-50 dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-[#0284C7] focus:ring-4 focus:ring-sky-600/20 leading-relaxed"
            ></textarea>
          </div>

          <!-- Pengaturan Penayangan -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label for="news-featured-check" class="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors">
              <input
                id="news-featured-check"
                v-model="form.isFeatured"
                type="checkbox"
                class="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
              />
              <span class="text-sm">
                <strong class="block text-slate-900 dark:text-white">Berita Utama (Headline)</strong>
                <span class="text-slate-500 dark:text-slate-400">Tampilkan paling besar di bagian atas portal</span>
              </span>
            </label>

            <label for="news-published-check" class="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors">
              <input
                id="news-published-check"
                v-model="form.isPublished"
                type="checkbox"
                class="mt-0.5 w-4 h-4 rounded text-[#0284C7] focus:ring-sky-500"
              />
              <span class="text-sm">
                <strong class="block text-slate-900 dark:text-white">Tayangkan Sekarang</strong>
                <span class="text-slate-500 dark:text-slate-400">Jika dimatikan, berita disimpan sebagai Draft</span>
              </span>
            </label>
          </div>

          <!-- Tombol Aksi Modal -->
          <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-sm sm:text-base font-semibold transition-colors min-h-[44px]"
            >
              Batal
            </button>

            <button
              type="submit"
              :disabled="isSaving || isUploadingImage"
              class="px-5 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm sm:text-base font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 min-h-[44px]"
            >
              <i v-if="isSaving" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
              <i v-else class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
              <span>{{ isSaving ? 'Menyimpan...' : (article?.id ? 'Simpan Perubahan' : 'Terbitkan Berita') }}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  </Transition>
</template>

