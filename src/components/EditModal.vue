<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAlumniStore } from '@/stores/alumni'
import { compressImage } from '@/lib/imageHelper'
import { processAndUploadPhoto, isCloudinaryConfigured } from '@/lib/cloudinary'
import CampusCombobox from '@/components/CampusCombobox.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  alumni: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'saved'])

const alumniStore = useAlumniStore()

const form = ref({
  name: '',
  nis: '',
  classRoom: 'XII-1',
  cohort: '2026',
  phone: '',
  category: 'PTN',
  pathway: 'SNBP',
  institution: '',
  major: '',
  message: '',
  photo: ''
})

const isSubmitting = ref(false)
const isUploadingPhoto = ref(false)
const photoUploadError = ref('')
const errorMessage = ref('')

async function handlePhotoUpload(e) {
  const file = e.target.files[0]
  if (!file) return

  photoUploadError.value = ''

  if (isCloudinaryConfigured()) {
    isUploadingPhoto.value = true
    try {
      const url = await processAndUploadPhoto(file)
      form.value.photo = url
    } catch (err) {
      photoUploadError.value = err.message
      alert(err.message)
    } finally {
      isUploadingPhoto.value = false
    }
  } else {
    try {
      const compressed = await compressImage(file, 400, 0.75)
      form.value.photo = compressed
      photoUploadError.value = 'Perhatian: Kredensial Cloudinary belum diatur di .env (foto disimpan sementara di memori).'
    } catch (err) {
      photoUploadError.value = err.message
      alert(err.message)
    }
  }
}

const pathwaysByCategory = {
  'PTN': ['SNBP', 'SNBT', 'Mandiri PTN', 'Beasiswa KIP-Kuliah', 'Jalur Prestasi'],
  'PTS': ['Jalur Prestasi Rapor', 'Beasiswa Yayasan', 'Mandiri PTS', 'Tes Masuk PTS'],
  'Kedinasan': ['Ikatan Dinas', 'Politeknik Kedinasan', 'Beasiswa Ikatan Kerja'],
  'TNI/Polri': ['Seleksi Akmil / Akpol', 'Bintara Polri', 'Bintara TNI AD/AL/AU', 'Tamtama'],
  'Bekerja': ['Rekrutmen Kerja Perusahaan', 'BUMN / BUMD', 'Freelance / Remote Work'],
  'Wirausaha': ['Wirausaha Mandiri', 'Bisnis Kuliner / UMKM', 'Digital Creator / Agensi'],
  'Pelatihan / LPK': ['Program Pelatihan / LPK', 'Magang Luar Negeri / Jepang', 'Balai Latihan Kerja (BLK)'],
  'Masa Tunggu': ['Persiapan UTBK / Kedinasan Tahun Depan (Gap Year)', 'Kursus / Les Intensif']
}

watch(() => props.alumni, (newVal) => {
  if (newVal) {
    form.value = {
      name: newVal.name || '',
      nis: newVal.nis === '-' ? '' : (newVal.nis || ''),
      classRoom: newVal.classRoom || 'XII-1',
      cohort: String(newVal.cohort || '2026'),
      phone: newVal.phone === '-' ? '' : (newVal.phone || ''),
      category: newVal.category || 'PTN',
      pathway: newVal.pathway || 'SNBP',
      institution: newVal.institution || '',
      major: newVal.major === '-' ? '' : (newVal.major || ''),
      message: newVal.message || '',
      photo: newVal.photo || ''
    }
  }
}, { immediate: true })

function onCategoryChange() {
  const options = pathwaysByCategory[form.value.category] || ['Lainnya']
  form.value.pathway = options[0]
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

async function handleSave() {
  if (!form.value.name.trim() || !form.value.institution.trim()) {
    errorMessage.value = 'Nama lengkap dan nama instansi/kampus wajib diisi.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  const res = await alumniStore.updateAlumni(props.alumni.id, form.value)
  isSubmitting.value = false

  if (res.success) {
    emit('saved')
    emit('close')
  } else {
    errorMessage.value = res.message || 'Gagal menyimpan pembaruan data.'
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen && alumni"
      class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      @click.self="emit('close')"
      role="dialog"
      aria-modal="true"
      :aria-label="'Edit Data Alumni ' + alumni.name"
    >
      <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-auto">
        
        <!-- Header Modal -->
        <div class="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <h2 class="font-display font-bold text-lg sm:text-xl text-white">
              Edit Data Alumni
            </h2>
            <p class="text-sm text-slate-400 mt-0.5">
              Pembaruan data resmi lulusan SMA Negeri 2 Ngawi
            </p>
          </div>
          <button
            @click="emit('close')"
            type="button"
            class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors text-sm"
            aria-label="Tutup jendela edit"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Body Form -->
        <form @submit.prevent="handleSave" class="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-sm sm:text-base">
          
          <div v-if="errorMessage" class="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm">
            {{ errorMessage }}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div class="sm:col-span-2">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Lengkap Alumni <span class="text-rose-500">*</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                NIS (Nomor Induk Siswa)
              </label>
              <input
                v-model="form.nis"
                type="text"
                placeholder="Contoh: 12345"
                class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kelas Terakhir di SMADA
              </label>
              <select
                v-model="form.classRoom"
                class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
              >
                <option v-for="i in 10" :key="i" :value="`XII-${i}`">XII-{{ i }}</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tahun Angkatan Lulus
              </label>
              <select
                v-model="form.cohort"
                class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
                <option value="2020">2020</option>
              </select>
            </div>

            <div class="sm:col-span-2">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nomor WhatsApp
              </label>
              <input
                v-model="form.phone"
                type="tel"
                placeholder="081234567890"
                class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kategori Karir / Pendidikan <span class="text-rose-500">*</span>
              </label>
              <select
                v-model="form.category"
                @change="onCategoryChange"
                class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
              >
                <option value="PTN">PTN (Perguruan Tinggi Negeri)</option>
                <option value="PTS">PTS (Perguruan Tinggi Swasta)</option>
                <option value="Kedinasan">Sekolah Kedinasan</option>
                <option value="TNI/Polri">TNI / Polri</option>
                <option value="Bekerja">Dunia Kerja / Karyawan</option>
                <option value="Wirausaha">Wirausaha / UMKM / Bisnis</option>
                <option value="Pelatihan / LPK">Pelatihan / LPK / Luar Negeri</option>
                <option value="Masa Tunggu">Masa Tunggu / Persiapan Ulang</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Jalur Masuk / Seleksi <span class="text-rose-500">*</span>
              </label>
              <select
                v-model="form.pathway"
                class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
              >
                <option v-for="p in pathwaysByCategory[form.category]" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>

            <div class="sm:col-span-2">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Kampus / Perusahaan / Instansi <span class="text-rose-500">*</span>
              </label>
              <CampusCombobox
                id="edit-institution"
                v-model="form.institution"
                placeholder="Cari atau ketik nama kampus..."
                required
                @select="(campus) => {
                  if (['PTN', 'PTS', 'Kedinasan', 'TNI/Polri'].includes(campus.category)) {
                    form.category = campus.category
                    form.pathway = pathwaysByCategory[campus.category]?.[0] || form.pathway
                  }
                }"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Jurusan / Program Studi / Posisi Pekerjaan
              </label>
              <input
                v-model="form.major"
                type="text"
                class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pesan / Tips untuk Siswa SMADA
              </label>
              <textarea
                v-model="form.message"
                rows="2"
                class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
              ></textarea>
            </div>

            <!-- Foto Profil / Almamater (Opsional) -->
            <div class="sm:col-span-2">
              <div class="flex items-center justify-between mb-1">
                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Foto Profil / Almamater (Opsional)
                </label>
                <span class="text-xs text-slate-400">
                  Cloudinary Storage
                </span>
              </div>

              <div class="flex items-center gap-3">
                <!-- Pratinjau Foto -->
                <div
                  v-if="form.photo"
                  class="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800"
                >
                  <img :src="form.photo" alt="Foto Profil" class="w-full h-full object-cover" />
                  <button
                    type="button"
                    @click="form.photo = ''"
                    class="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] hover:bg-rose-700 transition-colors"
                    title="Hapus foto"
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                  <div v-if="form.photo.includes('cloudinary.com')" class="absolute bottom-0 inset-x-0 bg-[#0369A1]/90 text-white text-[8px] text-center py-0.5 font-medium tracking-tight">
                    Cloudinary
                  </div>
                </div>

                <!-- Indikator Loading Upload -->
                <div
                  v-else-if="isUploadingPhoto"
                  class="w-14 h-14 rounded-lg border border-dashed border-[#0284C7] bg-[#E0F2FE] dark:bg-sky-950/40 shrink-0 flex flex-col items-center justify-center text-[#0369A1] dark:text-sky-400"
                >
                  <i class="fa-solid fa-spinner fa-spin text-sm" aria-hidden="true"></i>
                  <span class="text-[8px] font-semibold mt-1">Unggah...</span>
                </div>

                <div class="flex-1">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    :disabled="isUploadingPhoto"
                    @change="handlePhotoUpload"
                    class="block w-full text-sm text-slate-500 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 cursor-pointer disabled:opacity-50"
                  />
                  <p v-if="!photoUploadError" class="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Ganti atau unggah foto baru (Otomatis dioptimasi dan disimpan ke Cloudinary CDN).
                  </p>
                  <p v-else class="text-xs sm:text-sm text-amber-500 mt-0.5 font-medium">
                    {{ photoUploadError }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              @click="emit('close')"
              type="button"
              class="px-4 py-2 rounded-xl bg-[#F1F5F9] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-300 text-sm sm:text-base font-semibold hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              :disabled="isSubmitting || isUploadingPhoto"
              class="px-5 py-2 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm sm:text-base font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <i v-if="isSubmitting || isUploadingPhoto" class="fa-solid fa-spinner fa-spin text-sm" aria-hidden="true"></i>
              <span>{{ isUploadingPhoto ? 'Mengunggah Foto...' : (isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan') }}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  </Transition>
</template>

