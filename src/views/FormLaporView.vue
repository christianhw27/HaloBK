<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAlumniStore } from '@/stores/alumni'
import { processAndUploadPhoto, isCloudinaryConfigured } from '@/lib/cloudinary'
import { compressImage } from '@/lib/imageHelper'
import CampusCombobox from '@/components/CampusCombobox.vue'

const router = useRouter()
const alumniStore = useAlumniStore()

const form = reactive({
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

const isSubmitted = ref(false)
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
      form.photo = url
    } catch (err) {
      photoUploadError.value = err.message
      alert(err.message)
    } finally {
      isUploadingPhoto.value = false
    }
  } else {
    // Fallback lokal sementara jika konfigurasi Cloudinary belum diisi di .env
    try {
      const compressed = await compressImage(file, 400, 0.75)
      form.photo = compressed
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
  'Belum Lapor Diri': ['Belum Menentukan Pilihan', 'Persiapan UTBK / Kedinasan Tahun Depan (Gap Year)', 'Kursus / Les Intensif'],
  'Masa Tunggu': ['Belum Menentukan Pilihan', 'Persiapan UTBK / Kedinasan Tahun Depan (Gap Year)', 'Kursus / Les Intensif']
}

function onCategoryChange() {
  const options = pathwaysByCategory[form.category] || ['Lainnya']
  form.pathway = options[0]
}

async function handleSubmit() {
  isSubmitting.value = true
  errorMessage.value = ''

  const res = await alumniStore.submitLaporDiri(form)
  isSubmitting.value = false

  if (res.success) {
    isSubmitted.value = true
    setTimeout(() => {
      router.push('/dashboard')
    }, 2200)
  } else {
    errorMessage.value = res.message || 'Gagal mengirim formulir lapor diri. Silakan coba kembali.'
  }
}
</script>

<template>
  <div class="max-w-5xl space-y-6">
    
    <!-- Header Halaman Hangat & Ramah -->
    <section class="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#FFFBEB]/90 via-white to-[#E0F2FE]/85 dark:from-amber-950/25 dark:via-slate-900 dark:to-sky-950/35 border border-amber-200/70 dark:border-slate-800 shadow-[var(--shadow-card)]">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 text-xs font-bold mb-2">
        <i class="fa-solid fa-paper-plane text-[11px]" aria-hidden="true"></i>
        <span>Cerita &amp; Jejak Alumni &bull; SMAN 2 Ngawi</span>
      </div>
      <h1 class="font-display font-bold text-2xl sm:text-[1.75rem] text-slate-900 dark:text-white tracking-tight">
        Yuk, Bagikan Kabar Terbaru Kamu!
      </h1>
      <p class="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed max-w-3xl">
        Cerita studi lanjut atau karir yang kamu isi akan menjadi panduan seru sekaligus penyemangat buat adik-adik kelas di SMADA Ngawi.
      </p>
    </section>

    <!-- Notifikasi Kesalahan -->
    <div
      v-if="errorMessage"
      class="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm sm:text-base font-medium flex items-center gap-3"
      role="alert"
    >
      <i class="fa-solid fa-circle-exclamation text-rose-600 text-base" aria-hidden="true"></i>
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Tampilan Sukses Pengiriman -->
    <div
      v-if="isSubmitted"
      class="p-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-center space-y-3"
      role="status"
    >
      <div class="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto text-xl shadow-sm">
        <i class="fa-solid fa-check" aria-hidden="true"></i>
      </div>
      <h2 class="font-bold text-lg sm:text-xl">Data Berhasil Terkirim</h2>
      <p class="text-sm sm:text-base text-emerald-700 dark:text-emerald-300 max-w-md mx-auto">
        Laporan Anda telah berhasil dicatat dan masuk ke antrean verifikasi Guru BK. Mengalihkan ke halaman ringkasan...
      </p>
    </div>

    <!-- Formulir Utama -->
    <form
      v-else
      @submit.prevent="handleSubmit"
      class="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-slate-800 shadow-[var(--shadow-card)] space-y-6"
    >
      <!-- Bagian 1: Identitas Alumni -->
      <fieldset class="space-y-4">
        <legend class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white pb-2.5 border-b border-sky-100/80 dark:border-slate-800 w-full flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-[#E0F2FE] dark:bg-sky-900/60 text-[#0369A1] dark:text-sky-200 border border-sky-200 dark:border-sky-800 text-xs sm:text-sm flex items-center justify-center font-bold">1</span>
          <span>Kenalan Singkat (Identitas Kamu)</span>
        </legend>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="input-name" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Lengkap Alumni <span class="text-rose-500">*</span>
            </label>
            <input
              id="input-name"
              v-model="form.name"
              type="text"
              required
              placeholder="Masukkan nama lengkap sesuai ijazah"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          <div>
            <label for="input-nis" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              NIS (Nomor Induk Siswa)
            </label>
            <input
              id="input-nis"
              v-model="form.nis"
              type="text"
              placeholder="Contoh: 12345 (Opsional alumni lama)"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          <div>
            <label for="input-class" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kelas Terakhir di SMADA <span class="text-rose-500">*</span>
            </label>
            <select
              id="input-class"
              v-model="form.classRoom"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option v-for="i in 10" :key="i" :value="`XII-${i}`">XII-{{ i }}</option>
            </select>
          </div>

          <div>
            <label for="input-cohort" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tahun Angkatan Lulus <span class="text-rose-500">*</span>
            </label>
            <select
              id="input-cohort"
              v-model="form.cohort"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
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
            <label for="input-phone" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nomor WhatsApp Aktif (Opsional)
            </label>
            <input
              id="input-phone"
              v-model="form.phone"
              type="tel"
              placeholder="Contoh: 081234567890 (Untuk wadah konsultasi adik kelas)"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Nomor ini akan digunakan adik kelas untuk bertanya seputar tips seleksi di kampus Anda.
            </p>
          </div>

          <!-- Foto Profil / Almamater (Opsional) -->
          <div class="sm:col-span-2">
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Foto Profil / Almamater (Opsional)
              </label>
              <span class="text-xs text-slate-500 dark:text-slate-400">
                Cloudinary Storage
              </span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-3">
              <!-- Pratinjau Foto -->
              <div
                v-if="form.photo"
                class="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800"
              >
                <img :src="form.photo" alt="Pratinjau Foto" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="form.photo = ''"
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] hover:bg-rose-700 transition-colors"
                  title="Hapus foto"
                >
                  <i class="fa-solid fa-xmark"></i>
                </button>
                <div v-if="form.photo.includes('cloudinary.com')" class="absolute bottom-0 inset-x-0 bg-[#0369A1]/90 text-white text-[9px] text-center py-0.5 font-medium tracking-tight">
                  Cloudinary
                </div>
              </div>

              <!-- Indikator Loading Upload -->
              <div
                v-else-if="isUploadingPhoto"
                class="w-16 h-16 rounded-xl border border-dashed border-[#0284C7] bg-[#E0F2FE] dark:bg-sky-950/40 shrink-0 flex flex-col items-center justify-center text-[#0369A1] dark:text-sky-400"
              >
                <i class="fa-solid fa-spinner fa-spin text-sm" aria-hidden="true"></i>
                <span class="text-[10px] font-semibold mt-1">Unggah...</span>
              </div>

              <div class="flex-1">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  :disabled="isUploadingPhoto"
                  @change="handlePhotoUpload"
                  class="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#E0F2FE] dark:file:bg-sky-950/70 file:text-[#0369A1] dark:file:text-sky-200 hover:file:bg-sky-200/70 dark:hover:file:bg-sky-900 cursor-pointer disabled:opacity-50"
                />
                <p v-if="!photoUploadError" class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Format gambar .jpg, .png, .webp (Otomatis dioptimasi dan disimpan ke Cloudinary CDN).
                </p>
                <p v-else class="text-xs sm:text-sm text-amber-600 dark:text-amber-400 mt-1 font-medium">
                  {{ photoUploadError }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      <!-- Bagian 2: Karir & Studi Lanjut -->
      <fieldset class="space-y-4 pt-2">
        <legend class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white pb-2.5 border-b border-emerald-100/80 dark:border-slate-800 w-full flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-[#D1FAE5] dark:bg-emerald-900/60 text-[#047857] dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm flex items-center justify-center font-bold">2</span>
          <span>Kesibukan Kuliah / Karir Saat Ini</span>
        </legend>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="input-category" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kategori Karir / Pendidikan <span class="text-rose-500">*</span>
            </label>
            <select
              id="input-category"
              v-model="form.category"
              @change="onCategoryChange"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option value="PTN">PTN (Perguruan Tinggi Negeri)</option>
              <option value="PTS">PTS (Perguruan Tinggi Swasta)</option>
              <option value="Kedinasan">Sekolah Kedinasan</option>
              <option value="TNI/Polri">TNI / Polri</option>
              <option value="Bekerja">Dunia Kerja / Karyawan</option>
              <option value="Wirausaha">Wirausaha / UMKM / Bisnis</option>
              <option value="Pelatihan / LPK">Pelatihan / LPK / Luar Negeri</option>
              <option value="Belum Lapor Diri">Belum Lapor Diri / Persiapan Ulang</option>
            </select>
          </div>

          <div>
            <label for="input-pathway" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jalur Masuk / Seleksi <span class="text-rose-500">*</span>
            </label>
            <select
              id="input-pathway"
              v-model="form.pathway"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option v-for="p in pathwaysByCategory[form.category]" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>

          <div class="sm:col-span-2">
            <label for="input-institution" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Kampus / Perusahaan / Instansi <span class="text-rose-500">*</span>
            </label>
            <CampusCombobox
              id="input-institution"
              v-model="form.institution"
              placeholder="Cari atau ketik nama kampus (contoh: UNESA, UGM, ITS, UI)..."
              required
              @select="(campus) => {
                if (['PTN', 'PTS', 'Kedinasan', 'TNI/Polri'].includes(campus.category)) {
                  form.category = campus.category
                  onCategoryChange()
                }
              }"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="input-major" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jurusan / Program Studi / Posisi Pekerjaan <span class="text-rose-500">*</span>
            </label>
            <input
              id="input-major"
              v-model="form.major"
              type="text"
              required
              placeholder="Contoh: S1 Teknik Informatika atau Staf Operasional"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="input-message" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Pesan, Tips & Motivasi untuk Siswa SMADA
            </label>
            <textarea
              id="input-message"
              v-model="form.message"
              rows="3"
              placeholder="Bagikan tips belajar UTBK, persiapan fisik/mental, atau pengalaman berharga Anda..."
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            ></textarea>
          </div>
        </div>
      </fieldset>

      <!-- Tombol Aksi Pengiriman -->
      <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
        <button
          type="button"
          @click="router.push('/dashboard')"
          class="px-5 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-[#334155] dark:text-slate-300 text-sm sm:text-base font-semibold hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors"
        >
          Batal
        </button>

        <button
          type="submit"
          :disabled="isSubmitting || isUploadingPhoto"
          class="px-6 py-2.5 rounded-xl bg-[#0369A1] hover:bg-[#075985] text-white text-sm sm:text-base font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <i v-if="isSubmitting || isUploadingPhoto" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <span>{{ isUploadingPhoto ? 'Mengunggah Foto...' : (isSubmitting ? 'Mengirim Data...' : 'Kirim Laporan') }}</span>
        </button>
      </div>
    </form>

  </div>
</template>
