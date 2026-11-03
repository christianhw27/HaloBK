<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAlumniStore } from '@/stores/alumni'

const router = useRouter()
const alumniStore = useAlumniStore()

const form = reactive({
  name: '',
  classRoom: 'XII-1',
  cohort: '2026',
  phone: '',
  category: 'PTN',
  pathway: 'SNBP',
  institution: '',
  major: '',
  message: ''
})

const isSubmitted = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')

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
    
    <!-- Header Halaman Institusional -->
    <section class="p-6 sm:p-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
        <span>Bimbingan Konseling</span>
        <span>&bull;</span>
        <span>SMA Negeri 2 Ngawi</span>
      </div>
      <h1 class="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
        Formulir Lapor Diri Alumni & Tracer Study
      </h1>
      <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
        Laporan ini membantu Tim Guru BK mendokumentasikan pemetaan karir dan kelulusan siswa, serta memberikan referensi nyata bagi adik-adik kelasmu.
      </p>
    </section>

    <!-- Notifikasi Kesalahan -->
    <div
      v-if="errorMessage"
      class="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-medium flex items-center gap-3"
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
      <h2 class="font-bold text-base sm:text-lg">Data Berhasil Terkirim</h2>
      <p class="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 max-w-md mx-auto">
        Laporan Anda telah berhasil dicatat dan masuk ke antrean verifikasi Guru BK. Mengalihkan ke halaman ringkasan...
      </p>
    </div>

    <!-- Formulir Utama -->
    <form
      v-else
      @submit.prevent="handleSubmit"
      class="p-6 sm:p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
    >
      <!-- Bagian 1: Identitas Alumni -->
      <fieldset class="space-y-4">
        <legend class="font-display font-semibold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 w-full flex items-center gap-2">
          <span class="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs flex items-center justify-center font-bold">1</span>
          <span>Identitas Alumni</span>
        </legend>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label for="input-name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Lengkap Alumni <span class="text-rose-500">*</span>
            </label>
            <input
              id="input-name"
              v-model="form.name"
              type="text"
              required
              placeholder="Masukkan nama lengkap sesuai ijazah"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          <div>
            <label for="input-class" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kelas Terakhir di SMADA <span class="text-rose-500">*</span>
            </label>
            <select
              id="input-class"
              v-model="form.classRoom"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option v-for="i in 10" :key="i" :value="`XII-${i}`">XII-{{ i }}</option>
            </select>
          </div>

          <div>
            <label for="input-cohort" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tahun Angkatan Lulus <span class="text-rose-500">*</span>
            </label>
            <select
              id="input-cohort"
              v-model="form.cohort"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
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
            <label for="input-phone" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nomor WhatsApp Aktif (Opsional)
            </label>
            <input
              id="input-phone"
              v-model="form.phone"
              type="tel"
              placeholder="Contoh: 081234567890 (Untuk wadah konsultasi adik kelas)"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Nomor ini akan digunakan adik kelas untuk bertanya seputar tips seleksi di kampus Anda.
            </p>
          </div>
        </div>
      </fieldset>

      <!-- Bagian 2: Karir & Studi Lanjut -->
      <fieldset class="space-y-4 pt-2">
        <legend class="font-display font-semibold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 w-full flex items-center gap-2">
          <span class="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs flex items-center justify-center font-bold">2</span>
          <span>Studi Lanjut / Karir Saat Ini</span>
        </legend>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="input-category" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kategori Karir / Pendidikan <span class="text-rose-500">*</span>
            </label>
            <select
              id="input-category"
              v-model="form.category"
              @change="onCategoryChange"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option value="PTN">PTN (Perguruan Tinggi Negeri)</option>
              <option value="PTS">PTS (Perguruan Tinggi Swasta)</option>
              <option value="Kedinasan">Sekolah Kedinasan</option>
              <option value="TNI/Polri">TNI / Polri</option>
              <option value="Bekerja">Dunia Kerja / Karyawan</option>
              <option value="Wirausaha">Wirausaha / UMKM / Bisnis</option>
              <option value="Pelatihan / LPK">Pelatihan / LPK / Luar Negeri</option>
              <option value="Masa Tunggu">Masa Tunggu / Persiapan Ulang (Gap Year)</option>
            </select>
          </div>

          <div>
            <label for="input-pathway" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jalur Masuk / Seleksi <span class="text-rose-500">*</span>
            </label>
            <select
              id="input-pathway"
              v-model="form.pathway"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            >
              <option v-for="p in pathwaysByCategory[form.category]" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>

          <div class="sm:col-span-2">
            <label for="input-institution" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Kampus / Perusahaan / Instansi <span class="text-rose-500">*</span>
            </label>
            <input
              id="input-institution"
              v-model="form.institution"
              type="text"
              required
              placeholder="Contoh: Universitas Gadjah Mada (UGM) atau PT Telkom Indonesia"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="input-major" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jurusan / Program Studi / Posisi Pekerjaan <span class="text-rose-500">*</span>
            </label>
            <input
              id="input-major"
              v-model="form.major"
              type="text"
              required
              placeholder="Contoh: S1 Teknik Informatika atau Staf Operasional"
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
          </div>

          <div class="sm:col-span-2">
            <label for="input-message" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Pesan, Tips & Motivasi untuk Siswa SMADA
            </label>
            <textarea
              id="input-message"
              v-model="form.message"
              rows="3"
              placeholder="Bagikan tips belajar UTBK, persiapan fisik/mental, atau pengalaman berharga Anda..."
              class="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
            ></textarea>
          </div>
        </div>
      </fieldset>

      <!-- Tombol Aksi Pengiriman -->
      <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
        <button
          type="button"
          @click="router.push('/dashboard')"
          class="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Batal
        </button>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <i v-if="isSubmitting" class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <span>{{ isSubmitting ? 'Mengirim Data...' : 'Kirim Laporan' }}</span>
        </button>
      </div>
    </form>

  </div>
</template>
