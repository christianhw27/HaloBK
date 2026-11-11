# 📘 Design System & Brand Guidelines — Portal BK Sekolah

Panduan identitas visual, sistem warna, tipografi, dan komponen antarmuka (UI) untuk portal Bimbingan dan Konseling (BK) sekolah.

---

## 1. Filosofi & Esensi Desain

Portal BK dirancang sebagai ruang digital yang aman, hangat, dan suportif bagi seluruh warga sekolah. 

* **Logo & Simbolisme:** Empat figur manusia abstrak saling merangkul membentuk kelopak semanggi/bunga. Logo ini melambangkan empat pilar bimbingan konseling: **Pribadi, Sosial, Belajar, dan Karier**, yang bersatu dalam lingkaran perlindungan dan kepedulian.
* **Nada Visual (Tone & Manner):**
  * *Empathetic & Safe:* Menghilangkan stigma ruang BK yang kaku atau menghakimi.
  * *Accessible & Clean:* Memudahkan siswa mencari bantuan tanpa distraksi berlebih.
  * *Uplifting & Optimistic:* Menggunakan warna cerah dengan proporsi seimbang untuk memberi harapan dan rasa tenang.

---

## 2. Palet Warna (Color System)

Palet warna diekstraksi dari gradasi logo utama dan disesuaikan untuk standar kontras WCAG AA.

### 2.1 Brand & Categorical Colors

| Peran / Kategori | Hex Code | RGB | Tailwind Class | Representasi / Makna |
| :--- | :--- | :--- | :--- | :--- |
| **Trust Blue** (Primary) | `#0284C7` | `rgb(2, 132, 199)` | `sky-600` | Keamanan, profesionalisme, stabilitas, pilar Konseling Pribadi |
| **Warm Magenta** (Secondary) | `#E11D48` | `rgb(225, 29, 72)` | `rose-600` | Empati, kehangatan, kepedulian emosional, pilar Konseling Sosial |
| **Hope Amber** (Accent 1) | `#F59E0B` | `rgb(245, 158, 11)` | `amber-500` | Harapan, energi positif, optimisme masa depan, pilar Bimbingan Karier |
| **Growth Emerald** (Accent 2) | `#10B981` | `rgb(16, 185, 129)` | `emerald-500` | Pertumbuhan, pemulihan, ketenangan pikiran, pilar Bimbingan Belajar |

### 2.2 Neutral & Surface Colors

| Peran | Hex Code | RGB | Tailwind Class | Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| **Dark Neutral (Heading)** | `#0F172A` | `rgb(15, 23, 42)` | `slate-900` | Judul, heading utama, kontras tinggi |
| **Text Neutral (Body)** | `#334155` | `rgb(51, 65, 85)` | `slate-700` | Teks bacaan, formulir, instruksi |
| **Muted / Subtitle** | `#64748B` | `rgb(100, 116, 139)` | `slate-500` | Timestamp, caption, placeholder |
| **Border / Divider** | `#E2E8F0` | `rgb(226, 232, 240)` | `slate-200` | Garis pemisah, border kartu |
| **Surface Alt / Card** | `#FFFFFF` | `rgb(255, 255, 255)` | `white` | Kartu konten, modul chat, modal |
| **Background (Light)** | `#F8FAFC` | `rgb(248, 250, 252)` | `slate-50` | Latar belakang halaman aplikasi |

### 2.3 Aturan Rasio 60-30-10
* **60% Latar & Ruang Kosong:** Menggunakan `#F8FAFC` dan `#FFFFFF` untuk memberikan kesan lega dan rileks.
* **30% Struktur & Teks:** Menggunakan `#0F172A` dan `#334155` untuk kejelasan informasi.
* **10% Aksi & Aksen:** Menggunakan `Trust Blue` untuk CTA utama, serta magenta/amber/emerald sebagai label status atau pilar layanan.

---

## 3. Sistem Tipografi (Typography)

Menggunakan keluarga font yang ramah (*friendly*), modern, serta memiliki kurva lembut yang selaras dengan bentuk organik logo.

### 3.1 Pilihan Font Family
* **Primary Font:** `Plus Jakarta Sans` (Google Fonts)
  * *Alternatif:* `Inter` (untuk keterbacaan teknis) atau `Nunito` (jika ingin nuansa lebih santai untuk jenjang SMP/SD).
* **Font Fallback:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

### 3.2 Skala & Hierarki Teks

```css
/* Token Tipografi */
--font-display: 'Plus Jakarta Sans', sans-serif;

/* Skala Teks */
--text-hero: 2.25rem;   /* 36px | Bold (700) | Line-height: 1.25 */
--text-h1:   1.75rem;   /* 28px | SemiBold (600) | Line-height: 1.3 */
--text-h2:   1.375rem;  /* 22px | SemiBold (600) | Line-height: 1.35 */
--text-h3:   1.125rem;  /* 18px | Medium (500) | Line-height: 1.4 */
--text-body: 1rem;      /* 16px | Regular (400) | Line-height: 1.6 */
--text-sm:   0.875rem;  /* 14px | Regular (400) / Medium (500) | Line-height: 1.5 */
--text-xs:   0.75rem;   /* 12px | Medium (500) | Line-height: 1.4 */
```

---

## 4. Variabel Desain (Design Tokens)

### 4.1 CSS Variables (`tokens.css`)

```css
:root {
  /* Brand Tokens */
  --color-primary: #0284C7;
  --color-primary-hover: #0369A1;
  --color-secondary: #E11D48;
  --color-accent-amber: #F59E0B;
  --color-accent-emerald: #10B981;

  /* Surfaces & Text */
  --color-bg: #F8FAFC;
  --color-card: #FFFFFF;
  --color-border: #E2E8F0;
  --color-text-main: #0F172A;
  --color-text-muted: #64748B;

  /* Elevation / Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --shadow-float: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04);

  /* Corner Radius (Membulat lembut selaras dengan logo) */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
}
```

---

## 5. Pedoman Komponen Antarmuka (UI Guidelines)

### 5.1 Tombol (Button Styles)
* **Primary Action ("Ajukan Konseling", "Kirim Pesan"):**
  * Latar: `#0284C7` (Sky-600)
  * Teks: `#FFFFFF` (Semi-bold)
  * Radius: `12px` (Soft rounded)
  * Hover: `#0369A1` (Transisi 150ms)
* **Secondary Action ("Batal", "Pelajari Selengkapnya"):**
  * Latar: Transparan atau `#F1F5F9`
  * Teks: `#334155`
  * Border: `1px solid #E2E8F0`

### 5.2 Badge Kategori Konseling
Gunakan badge lembut (pastel background + saturated text) untuk kategori layanan:
* **Konseling Pribadi:** Background `#E0F2FE` / Text `#0369A1`
* **Konseling Sosial:** Background `#FFE4E6` / Text `#BE123C`
* **Bimbingan Karier:** Background `#FEF3C7` / Text `#B45309`
* **Bimbingan Belajar:** Background `#D1FAE5` / Text `#047857`

### 5.3 Formulir & Ruang Curhat/Konseling
* **Field Input:** Border halus (`#CBD5E1`), radius `10px`, fokus ring berwarna biru lembut (`#0284C7` dengan opacity 20%).
* **Fitur Anonim:** Berikan toggle switch yang jelas dengan status visual (hijau emerald) saat mode anonim aktif untuk meningkatkan rasa aman siswa.

---

## 6. Prinsip Aksesibilitas (A11y) & Inklusivitas

1. **Rasio Kontras:** Teks utama di atas latar putih/abu muda wajib memiliki rasio kontras minimal 4.5:1 (WCAG AA).
2. **Keterbacaan Bahasa:** Gunakan kalimat yang ramah, tidak intimidatif, dan bebas dari jargon psikologis yang membingungkan siswa.
3. **Privasi Visual:** Sediakan tombol "Quick Exit" (Keluar Cepat) pada portal jika siswa mengakses di lab komputer sekolah dan membutuhkan privasi mendadak.