# Software Requirement Specification (SRS): Fitur Siswa Eligible

Dokumen ini berisi spesifikasi kebutuhan sistem, alur logika bisnis, serta rancangan skema database untuk modul **Siswa Eligible** pada sistem informasi Bimbingan Konseling (BK).

---

## 1. Hak Akses & Proteksi Rute (RBAC)

* **Admin (Guru BK):**
  * Mengelola master data mata pelajaran (nama mapel & kategori rumpun: Wajib, IPA, IPS, Bahasa).
  * Menjalankan tombol **"Sync Data SNPMB"** untuk melakukan *scraping* data Perguruan Tinggi, Program Studi, dan Daya Tampung terbaru.
  * Menambahkan/menghapus siswa dari daftar eligible melalui menu/tab **Daftar Siswa** (pencarian berdasarkan nama).
  * Melakukan validasi/ACC ganda: **ACC Pilihan Kampus/Jurusan** dan **ACC Tabel Nilai**.
  * Memantau matriks nilai keseluruhan, filter rumpun mapel, dan tabel auto-ranking beserta indikator bentrok pilihan.
* **Siswa Eligible:**
  * Mendapatkan akses menu Eligible dan menerima **Pop-up Eligible** saat login pertama kali setelah ditetapkan.
  * Menginput **Pilihan 1 dan Pilihan 2** (Kampus & Jurusan) dengan deteksi *warning* bentrok lintas pilihan.
  * Menginput **Tabel Nilai (Semester 1–5)** menggunakan dropdown mata pelajaran yang disiapkan admin.
  * Mengunggah foto sertifikat beserta judul prestasinya.
  * Melihat rincian nilai miliknya sendiri serta melihat daftar publik sesama siswa eligible (tanpa nominal nilai).
* **Siswa Non-Eligible:**
  * **Tidak memiliki akses** sama sekali (menu disembunyikan dan seluruh endpoint/halaman modul Eligible diblokir di tingkat middleware/guard).

---

## 2. Spesifikasi Alur & Logika Fitur

### A. Manajemen Daftar Siswa & Pop-Up Notifikasi
* **Add Siswa Eligible:** Guru BK membuka tab **Daftar Siswa**, mencari nama siswa dari tabel master siswa, lalu menekan tombol **Add Eligible**.
* **Trigger Pop-Up:** Sistem menyimpan flag `is_eligible = true` dan `has_seen_popup = false`. Saat siswa tersebut login, sistem menampilkan modal ucapan selamat dan tombol *"Isi Data Eligible Sekarang"*, lalu memperbarui `has_seen_popup = true`.

### B. Sync Data SNPMB & Pemilihan Jurusan (2 Pilihan + Warning Lintas Pilihan)
* **Tombol Sync Data SNPMB:** Admin menekan tombol sinkronisasi untuk menjalankan *scraper* ke portal `snpmb.id`, lalu melakukan *upsert* (insert/update) ke tabel `universities` dan `majors`.
* **Form Pilihan (SNBP Style):** Siswa memilih **Pilihan 1** dan **Pilihan 2** (masing-masing terdiri dari Kampus dan Program Studi).
* **Logika Warning Lintas Pilihan:**
  * Setiap kali siswa memilih kombinasi `(university_id, major_id)` pada Pilihan 1 maupun Pilihan 2, sistem mengecek apakah kombinasi tersebut sudah diambil oleh siswa eligible lain **baik di Pilihan 1 maupun Pilihan 2**.
  * Jika ditemukan kecocokan, muncul *alert warning* secara langsung (contoh: *"Perhatian: Prodi ini juga dipilih oleh 2 siswa eligible lainnya"*).
  * Badge/indikator peringatan yang sama juga ditampilkan pada baris siswa terkait di tabel **Ranking Admin**.

### C. Tabel Input & Kalkulasi Nilai Dinamis (Semester 1–5)
* **Struktur Input:** Siswa menambahkan baris mata pelajaran dan memilih mapel lewat **dropdown** (bersumber dari master mapel Admin). Satu mapel hanya bisa dipilih satu kali per siswa.
* **Rumus Kalkulasi Otomatis:**
  1. **Rata-rata per Mapel (Kanan):**
     $$\text{Rata-rata Mapel} = \frac{\text{S1} + \text{S2} + \text{S3} + \text{S4} + \text{S5}}{5}$$
  2. **Rata-rata per Semester (Bawah):**
     $$\text{Rata-rata Semester } n = \frac{\sum \text{Nilai Mapel di Semester } n}{\text{Total Mapel yang Diinput}}$$
  3. **Rata-rata Keseluruhan:** Rata-rata dari seluruh nilai semester 1 hingga 5 (atau rata-rata dari kelima nilai rata-rata semester).

### D. Validasi / ACC Ganda oleh Admin BK
* Terdapat dua status persetujuan terpisah pada profil eligible siswa:
  1. `choice_status` (`pending` | `approved` | `rejected`): Validasi pilihan kampus & jurusan. Data siswa baru tampil di halaman **List Siswa Eligible** jika status ini sudah `approved` (ACC).
  2. `grade_status` (`pending` | `approved` | `rejected`): Validasi kebenaran input tabel nilai. Jika sudah `approved`, form input nilai siswa terkunci agar tidak diubah sepihak.

### E. Upload Sertifikat & Integrasi Data Alumni
* **Input Siswa:** Siswa mengunggah **file gambar sertifikat** (`JPG`/`PNG`/`WebP`) dan mengisi kolom **Judul Sertifikat/Prestasi**. Foto disimpan di storage untuk diperiksa oleh Guru BK.
* **Tampilan di Data Alumni:** Saat data siswa masuk/ditampilkan di halaman **Data Alumni**, sistem hanya menarik kolom `title` (judul sertifikat) dalam format **daftar teks**, tanpa merender file gambar sertifikatnya.

### F. Dashboard Matriks Nilai & Auto-Ranking (Khusus Admin BK)
* **Tampilan Lengkap:** Menampilkan seluruh siswa eligible beserta rincian semua mapel, nilai tiap semester, rata-rata per semester, dan rata-rata keseluruhan.
* **Status Label di Ranking:** Siswa yang sudah menginput nilai tetap langsung masuk ke daftar ranking meskipun status nilainya belum divalidasi, dengan menampilkan badge status **"Belum ACC"** atau **"Sudah ACC"**.
* **Filter Dinamis:** Admin dapat memfilter kalkulasi matriks dan urutan ranking berdasarkan kategori mapel (misal: **Semua Mapel**, **IPA saja**, **IPS saja**, atau mapel spesifik). Saat filter aktif, rata-rata dan peringkat dihitung ulang secara dinamis hanya dari mapel yang terpilih.

---

## 3. Rancangan Skema Database (Relasional)

Struktur tabel berikut kompatibel untuk PostgreSQL (Supabase) maupun MySQL:

| Nama Tabel | Kolom Utama | Keterangan |
| :--- | :--- | :--- |
| **`subjects`** | `id`, `name`, `category` (`Wajib`, `IPA`, `IPS`, `Bahasa`) | Master mata pelajaran untuk dropdown siswa & filter ranking admin. |
| **`universities`** | `id`, `code`, `name`, `region` | Master kampus hasil tombol *Sync Data SNPMB*. |
| **`majors`** | `id`, `university_id` (FK), `code`, `name`, `degree`, `quota` | Master prodi & daya tampung hasil *Sync Data SNPMB*. |
| **`eligible_students`** | `id`, `student_id` (FK), `academic_year`, `has_seen_popup`, `choice_status`, `grade_status`, `overall_average` | Menyimpan daftar siswa yang di-add BK beserta status ACC pilihan dan ACC nilai. |
| **`eligible_choices`** | `id`, `eligible_student_id` (FK), `priority` (`1` atau `2`), `university_id` (FK), `major_id` (FK) | Menyimpan Pilihan 1 dan Pilihan 2 siswa (memudahkan query deteksi bentrok lintas pilihan). |
| **`eligible_grades`** | `id`, `eligible_student_id` (FK), `subject_id` (FK), `sem_1`, `sem_2`, `sem_3`, `sem_4`, `sem_5`, `subject_average` | Menyimpan nilai per mapel untuk semester 1–5 beserta rata-rata ke kanannya. |
| **`student_certificates`** | `id`, `student_id` (FK), `title`, `image_url`, `created_at` | Menyimpan file foto untuk verifikasi BK dan `title` teks untuk ditampilkan di Data Alumni. |