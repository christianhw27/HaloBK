# Hallo Alumni - SMA Negeri 2 Ngawi (Vue 3 + Vite + Tailwind + Supabase)

Portal Penelusuran Karir & Pemetaan Studi Lanjut Lulusan SMA Negeri 2 Ngawi.

## 🚀 Fitur Unggulan
- **Multi-Role Authentication**:
  - **Siswa / Alumni**: Lapor diri jalur masuk (PTN, PTS, Kedinasan, Militer, Kerja, Wirausaha).
  - **Guru BK (Admin)**: Verifikasi persetujuan (ACC), tolak pengajuan, & ekspor/impor massal data.
- **Visualisasi Statistik & Grafik (Chart.js)**:
  - Donut Chart sebaran karir alumni SMADA.
  - Bar Chart top 5 kampus & instansi terpopuler.
- **Import & Export Microsoft Excel (.xlsx)**:
  - Ekspor seluruh data alumni dengan SheetJS.
  - Impor massal ratusan data via file Excel/CSV dengan preview sebelum simpan.
- **WhatsApp Direct Connect**: Siswa dapat langsung menghubungi kakak alumni untuk konsultasi.
- **Dark Mode**: Dukungan tema gelap & terang otomatis / manual.
- **Supabase Ready**: Sudah dilengkapi driver `@supabase/supabase-js` dan skema database SQL.

---

## 🛠️ Cara Menjalankan di Komputer Lokal

1. Buka terminal di folder project ini:
   ```bash
   npm run dev
   ```
2. Buka browser di URL yang muncul (biasanya `http://localhost:5173`).

---

## 🔑 Akun Uji Coba (Demo Mode)

- **Akun Alumni**:
  - Username: `alumnismada`
  - Password: `SmadaHebat`
- **Akun Guru BK (Admin)**:
  - Username: `adminbk`
  - Password: `smada2026`

---

## 🌐 Cara Deploy Gratis ke Vercel

1. Buat repository baru di [GitHub](https://github.com) dan push project ini:
   ```bash
   git init
   git add .
   git commit -m "Initial commit Hallo Alumni Vue 3"
   git branch -M main
   git remote add origin <URL_GITHUB_KAMU>
   git push -u origin main
   ```
2. Buka [Vercel](https://vercel.com) dan login dengan akun GitHub kamu.
3. Klik **"Add New Project"** dan pilih repository GitHub tersebut.
4. Framework Preset akan otomatis terdeteksi sebagai **Vite**.
5. Klik **Deploy**! Web kamu akan langsung online dalam waktu 1 menit dengan URL gratis `*.vercel.app`.

