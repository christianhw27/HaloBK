<script setup>
import { ref } from 'vue'
import { useAlumniStore } from '@/stores/alumni'
import * as XLSX from 'xlsx'

const alumniStore = useAlumniStore()

const fileInput = ref(null)
const previewRows = ref([])
const fileName = ref('')
const importSuccessMsg = ref('')

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return

  fileName.value = file.name
  importSuccessMsg.value = ''

  const reader = new FileReader()
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

      // Standarisasi nama kolom
      const normalized = json.map(row => {
        return {
          name: row['Nama Lengkap'] || row['Nama'] || row['name'] || '',
          classRoom: row['Kelas XII'] || row['Kelas'] || row['classRoom'] || 'XII-1',
          cohort: String(row['Angkatan'] || row['Tahun'] || row['cohort'] || '2026'),
          phone: String(row['No. WhatsApp'] || row['WhatsApp'] || row['No WA'] || row['phone'] || '-'),
          category: row['Kategori'] || row['category'] || 'PTN',
          pathway: row['Jalur Masuk'] || row['Jalur'] || row['pathway'] || 'SNBP',
          institution: row['Kampus / Instansi / Perusahaan'] || row['Instansi'] || row['Kampus'] || row['institution'] || '',
          major: row['Jurusan / Posisi Pekerjaan'] || row['Jurusan'] || row['major'] || '-',
          message: row['Pesan & Tips Alumni'] || row['Pesan'] || row['message'] || 'Semoga sukses selalu untuk SMADA Ngawi.'
        }
      }).filter(r => r.name && r.institution)

      previewRows.value = normalized
    } catch (err) {
      alert('Gagal membaca file Excel/CSV: ' + err.message)
    }
  }
  reader.readAsArrayBuffer(file)
}

function commitImport() {
  if (previewRows.value.length === 0) return
  const count = alumniStore.importData(previewRows.value)
  importSuccessMsg.value = `Berhasil mengimpor ${count} data alumni ke database.`
  previewRows.value = []
  fileName.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

function downloadTemplate() {
  const templateData = [
    {
      'Nama Lengkap': 'Ahmad Fauzi',
      'Kelas XII': 'XII-1',
      'Angkatan': 2026,
      'No. WhatsApp': '081234567890',
      'Kategori': 'PTN',
      'Jalur Masuk': 'SNBP',
      'Kampus / Instansi / Perusahaan': 'Universitas Indonesia (UI)',
      'Jurusan / Posisi Pekerjaan': 'S1 Ilmu Komputer',
      'Pesan & Tips Alumni': 'Perbanyak latihan soal dan minta restu orang tua.'
    },
    {
      'Nama Lengkap': 'Siti Nurhaliza',
      'Kelas XII': 'XII-3',
      'Angkatan': 2026,
      'No. WhatsApp': '081234567891',
      'Kategori': 'Kedinasan',
      'Jalur Masuk': 'Ikatan Dinas',
      'Kampus / Instansi / Perusahaan': 'IPDN',
      'Jurusan / Posisi Pekerjaan': 'D4 Politik Pemerintahan',
      'Pesan & Tips Alumni': 'Jaga kebugaran dan persiapan tes CAT sejak dini.'
    }
  ]

  const ws = XLSX.utils.json_to_sheet(templateData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template Import Alumni')
  XLSX.writeFile(wb, 'Template_Import_Alumni_SMADA.xlsx')
}
</script>

<template>
  <div class="space-y-6 w-full">
    
    <!-- Header Halaman Import & Export -->
    <section class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" aria-labelledby="impexp-title">
      <div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
          <span>Manajemen Data</span>
          <span>&bull;</span>
          <span>Microsoft Excel & CSV</span>
        </div>
        <h1 id="impexp-title" class="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
          Import & Export Rekapitulasi Data Alumni
        </h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Gunakan fitur ini untuk mencadangkan database atau mengunggah data rekapan angkatan sekaligus
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto">
        <button
          @click="downloadTemplate"
          type="button"
          class="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <i class="fa-solid fa-download text-xs text-slate-400" aria-hidden="true"></i>
          <span>Unduh Template</span>
        </button>

        <button
          @click="alumniStore.exportExcel"
          type="button"
          class="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <i class="fa-solid fa-file-excel text-xs" aria-hidden="true"></i>
          <span>Export Semua (.xlsx)</span>
        </button>
      </div>
    </section>

    <!-- Notifikasi Berhasil -->
    <div
      v-if="importSuccessMsg"
      class="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-medium flex items-center gap-2"
      role="status"
    >
      <i class="fa-solid fa-circle-check text-emerald-600 text-base" aria-hidden="true"></i>
      <span>{{ importSuccessMsg }}</span>
    </div>

    <!-- Area Unggah Berkas Excel -->
    <section class="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4" aria-labelledby="upload-section-title">
      <div>
        <h2 id="upload-section-title" class="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
          Unggah File Rekapan Alumni
        </h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Pilih file spreadsheet berformat .xlsx, .xls, atau .csv sesuai struktur kolom template resmi
        </p>
      </div>

      <div class="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer relative bg-slate-50/60 dark:bg-slate-800/30">
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx, .xls, .csv"
          @change="handleFileSelect"
          class="absolute inset-0 opacity-0 cursor-pointer"
          aria-label="Pilih file spreadsheet untuk diimpor"
        />

        <div class="space-y-2 pointer-events-none">
          <div class="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto text-base">
            <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
          </div>
          <div>
            <span class="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
              {{ fileName ? fileName : 'Klik atau seret file spreadsheet ke area ini' }}
            </span>
            <p class="text-[11px] text-slate-400 mt-0.5">Ekstensi yang didukung: .xlsx, .xls, .csv</p>
          </div>
        </div>
      </div>

      <!-- Tabel Pratinjau Data yang Terbaca -->
      <div v-if="previewRows.length > 0" class="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
              Pratinjau Berkas ({{ previewRows.length }} Baris Terbaca)
            </h3>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Periksa kecocokan data sebelum menyimpan ke database
            </p>
          </div>

          <button
            @click="commitImport"
            type="button"
            class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5"
          >
            <i class="fa-solid fa-check text-xs" aria-hidden="true"></i>
            <span>Simpan ke Database</span>
          </button>
        </div>

        <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th class="p-2.5">Nama</th>
                <th class="p-2.5">Kelas</th>
                <th class="p-2.5">Angkatan</th>
                <th class="p-2.5">Kategori</th>
                <th class="p-2.5">Instansi</th>
                <th class="p-2.5">Jurusan / Posisi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="(row, idx) in previewRows.slice(0, 10)" :key="idx" class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td class="p-2.5 font-semibold text-slate-900 dark:text-white">{{ row.name }}</td>
                <td class="p-2.5 text-slate-600 dark:text-slate-300">{{ row.classRoom }}</td>
                <td class="p-2.5 text-slate-600 dark:text-slate-300">{{ row.cohort }}</td>
                <td class="p-2.5 text-slate-700 dark:text-slate-200">{{ row.category }}</td>
                <td class="p-2.5 text-slate-800 dark:text-slate-200">{{ row.institution }}</td>
                <td class="p-2.5 text-slate-500">{{ row.major }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="previewRows.length > 10" class="p-2 text-center text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
            Menampilkan 10 dari total {{ previewRows.length }} data yang akan diimpor.
          </div>
        </div>
      </div>
    </section>

  </div>
</template>
