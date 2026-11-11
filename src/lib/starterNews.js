export const NEWS_CATEGORIES = [
  'Pengumuman BK',
  'Info Kampus & PTN',
  'Beasiswa',
  'Kedinasan & Karir',
  'Prestasi Alumni'
]

// Palet Portal BK: Trust Blue (#0284C7), Warm Magenta (#E11D48), Hope Amber (#F59E0B), Growth Emerald (#10B981)
export const NEWS_CATEGORY_STYLES = {
  'Pengumuman BK': {
    badge: 'bg-[#E0F2FE] text-[#0369A1] border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800',
    surface: 'from-sky-100/80 via-[#E0F2FE]/80 to-amber-50/40 dark:from-slate-900 dark:via-sky-950/60 dark:to-slate-900',
    accentText: 'text-[#0369A1] dark:text-sky-300',
    iconBg: 'bg-white/95 dark:bg-sky-900/60 border-sky-200/80 dark:border-sky-800',
    activeTab: 'bg-[#0369A1] text-white shadow-sm',
    cardTop: 'border-t-4 border-t-[#0284C7]',
    dot: 'bg-[#0284C7]',
    icon: 'fa-solid fa-bullhorn'
  },
  'Info Kampus & PTN': {
    badge: 'bg-[#D1FAE5] text-[#047857] border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800',
    surface: 'from-emerald-100/80 via-[#D1FAE5]/80 to-sky-50/40 dark:from-slate-900 dark:via-emerald-950/60 dark:to-slate-900',
    accentText: 'text-[#047857] dark:text-emerald-300',
    iconBg: 'bg-white/95 dark:bg-emerald-900/60 border-emerald-200/80 dark:border-emerald-800',
    activeTab: 'bg-[#047857] text-white shadow-sm',
    cardTop: 'border-t-4 border-t-[#10B981]',
    dot: 'bg-[#10B981]',
    icon: 'fa-solid fa-building-columns'
  },
  'Beasiswa': {
    badge: 'bg-[#FEF3C7] text-[#92400E] border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
    surface: 'from-amber-100/80 via-[#FEF3C7]/80 to-rose-50/40 dark:from-slate-900 dark:via-amber-950/60 dark:to-slate-900',
    accentText: 'text-[#B45309] dark:text-amber-300',
    iconBg: 'bg-white/95 dark:bg-amber-900/60 border-amber-200/80 dark:border-amber-800',
    activeTab: 'bg-[#F59E0B] text-slate-950 shadow-sm',
    cardTop: 'border-t-4 border-t-[#F59E0B]',
    dot: 'bg-[#F59E0B]',
    icon: 'fa-solid fa-award'
  },
  'Kedinasan & Karir': {
    badge: 'bg-[#E0F2FE] text-[#0369A1] border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800',
    surface: 'from-sky-100/75 via-amber-50/80 to-emerald-50/50 dark:from-slate-900 dark:via-sky-950/50 dark:to-slate-900',
    accentText: 'text-[#0369A1] dark:text-sky-300',
    iconBg: 'bg-white/95 dark:bg-sky-900/60 border-sky-200/80 dark:border-sky-800',
    activeTab: 'bg-[#0369A1] text-white shadow-sm',
    cardTop: 'border-t-4 border-t-sky-500',
    dot: 'bg-sky-500',
    icon: 'fa-solid fa-briefcase'
  },
  'Prestasi Alumni': {
    badge: 'bg-[#FFE4E6] text-[#BE123C] border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800',
    surface: 'from-rose-100/80 via-[#FFE4E6]/80 to-amber-50/40 dark:from-slate-900 dark:via-rose-950/60 dark:to-slate-900',
    accentText: 'text-[#BE123C] dark:text-rose-300',
    iconBg: 'bg-white/95 dark:bg-rose-900/60 border-rose-200/80 dark:border-rose-800',
    activeTab: 'bg-[#BE123C] text-white shadow-sm',
    cardTop: 'border-t-4 border-t-[#E11D48]',
    dot: 'bg-[#E11D48]',
    icon: 'fa-solid fa-graduation-cap'
  }
}

export const NEWS_TABLE_SQL = `create table if not exists public.berita (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  kategori text not null default 'Pengumuman BK',
  ringkasan text not null,
  isi text not null,
  gambar_url text,
  penulis text default 'Tim BK SMADA Ngawi',
  is_featured boolean default false,
  is_published boolean default true,
  views integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.berita enable row level security;

create policy "Akses publik baca berita" on public.berita for select using (true);
create policy "Akses publik tambah berita" on public.berita for insert with check (true);
create policy "Akses publik update berita" on public.berita for update using (true);
create policy "Akses publik hapus berita" on public.berita for delete using (true);`

export const STARTER_NEWS = [
  {
    id: 'BERITA-001',
    title: 'Pendataan Tracer Study Alumni SMA Negeri 2 Ngawi Resmi Dibuka',
    category: 'Pengumuman BK',
    summary: 'Bimbingan Konseling SMADA Ngawi mengundang lulusan untuk melaporkan studi lanjut maupun aktivitas karir sebagai bahan pemetaan sekolah dan referensi adik kelas.',
    content: `Tim Bimbingan Konseling (BK) SMA Negeri 2 Ngawi secara resmi membuka pendataan Tracer Study alumni melalui portal Halo Alumni. Program ini bertujuan merekam jejak lulusan yang melanjutkan studi ke Perguruan Tinggi Negeri (PTN), Perguruan Tinggi Swasta (PTS), Sekolah Kedinasan, TNI/Polri, dunia kerja, hingga wirausaha mandiri.

Data yang terkumpul sangat membantu sekolah dalam memetakan tren penerimaan jalur SNBP, SNBT, dan seleksi kedinasan dari tahun ke tahun. Selain itu, catatan pengalaman dan kontak alumni yang bersedia dihubungi akan menjadi referensi langsung bagi siswa kelas XII yang sedang menentukan pilihan jurusan.

Untuk berpartisipasi, alumni cukup menekan tombol "Masuk Tracer Study" pada bagian atas halaman ini, lalu memilih menu "Formulir Lapor Diri". Setiap laporan akan diverifikasi oleh Guru BK sebelum tampil di direktori resmi sekolah.`,
    imageUrl: '',
    author: 'Tim Guru BK SMADA Ngawi',
    isFeatured: true,
    isPublished: true,
    views: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
  },
  {
    id: 'BERITA-002',
    title: 'Panduan Konsultasi Pemilihan Program Studi SNBP dan SNBT Kelas XII',
    category: 'Info Kampus & PTN',
    summary: 'Siswa kelas XII dapat menjadwalkan sesi konsultasi rasionalisasi nilai rapor dan pemilihan program studi di ruang BK dengan meninjau data sebaran alumni.',
    content: `Memilih program studi dan perguruan tinggi membutuhkan perhitungan yang matang, baik berdasarkan minat pribadi, kemampuan akademik, maupun data historis penerimaan sekolah.

Sebelum mengunci pilihan pada portal seleksi nasional, siswa kelas XII SMA Negeri 2 Ngawi disarankan untuk membuka halaman Direktori Alumni pada menu Tracer Study. Di sana tersedia daftar kampus tujuan lulusan angkatan sebelumnya beserta jalur masuk yang berhasil ditempuh.

Layanan konsultasi individu dan kelompok dibuka setiap hari kerja di Ruang Bimbingan Konseling SMADA. Bawalah rekap nilai rapor semester 1 hingga 5 serta daftar maksimal tiga alternatif jurusan yang diminati agar diskusi bersama Guru BK berjalan lebih terarah.`,
    imageUrl: '',
    author: 'Koordinator BK Kelas XII',
    isFeatured: false,
    isPublished: true,
    views: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  },
  {
    id: 'BERITA-003',
    title: 'Daftar Jalur Beasiswa Pendidikan Tinggi yang Perlu Dipersiapkan Lulusan',
    category: 'Beasiswa',
    summary: 'Rangkuman program bantuan biaya kuliah seperti KIP-Kuliah, Beasiswa Unggulan, dan skema prestasi yayasan kampus beserta dokumen awal yang wajib disiapkan.',
    content: `Keterbatasan biaya seharusnya tidak menghalangi siswa berprestasi untuk melanjutkan pendidikan ke jenjang perguruan tinggi. Terdapat berbagai skema pendanaan yang terbuka bagi lulusan SMA Negeri 2 Ngawi setiap tahunnya.

Program utama yang perlu dipantau antara lain Kartu Indonesia Pintar Kuliah (KIP-Kuliah) dari pemerintah, Beasiswa Unggulan Kemendikbudristek, serta potongan dana pengembangan dan beasiswa jalur rapor yang ditawarkan oleh berbagai PTS unggulan.

Langkah awal yang bisa dilakukan sejak awal semester genap adalah memastikan kelengkapan Nomor Induk Siswa Nasional (NISN), kesesuaian data kependudukan pada Kartu Keluarga, serta mengumpulkan piagam prestasi akademik maupun non-akademik tingkat kabupaten hingga nasional.`,
    imageUrl: '',
    author: 'Tim Informasi Studi Lanjut',
    isFeatured: false,
    isPublished: true,
    views: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
  },
  {
    id: 'BERITA-004',
    title: 'Persiapan Dini Seleksi Sekolah Kedinasan dan Jalur TNI/Polri',
    category: 'Kedinasan & Karir',
    summary: 'Tahapan Seleksi Kompetensi Dasar (SKD) CAT BKN, pemeriksaan kesehatan, dan tes kesamaptaan memerlukan persiapan konsisten sejak bangku kelas XI dan XII.',
    content: `Minat siswa SMA Negeri 2 Ngawi terhadap Sekolah Kedinasan (seperti PKN STAN, IPDN, STIS, STMKG, dan sekolah ikatan dinas kementerian lainnya) serta seleksi TNI dan Polri terus menunjukkan tren positif.

Berbeda dengan seleksi UTBK yang berfokus pada penalaran skolastik dan literasi, seleksi kedinasan menuntut kesiapan pada tiga materi utama Seleksi Kompetensi Dasar (SKD): Tes Wawasan Kebangsaan (TWK), Tes Intelegensia Umum (TIU), dan Tes Karakteristik Pribadi (TKP).

Di samping persiapan akademik, calon pendaftar disarankan menjaga kebugaran jasmani melalui latihan lari rutin, menjaga kesehatan mata dan gigi, serta berkonsultasi dengan alumni SMADA yang telah lebih dahulu menempuh pendidikan di instansi terkait melalui daftar kontak pada Direktori Alumni.`,
    imageUrl: '',
    author: 'Tim BK SMADA Ngawi',
    isFeatured: false,
    isPublished: true,
    views: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
  },
  {
    id: 'BERITA-005',
    title: 'Ruang Jejaring: Bertanya Langsung kepada Kakak Tingkat Lewat Direktori',
    category: 'Prestasi Alumni',
    summary: 'Siswa dapat membaca pesan motivasi sekaligus menghubungi alumni yang mencantumkan kontak WhatsApp untuk berdiskusi mengenai kehidupan kampus dan dunia kerja.',
    content: `Salah satu hambatan terbesar siswa kelas akhir adalah minimnya gambaran nyata mengenai suasana perkuliahan, sistem magang, maupun tantangan awal di dunia kerja pada jurusan tertentu.

Melalui fitur Direktori Alumni di dalam portal Tracer Study Halo Alumni, setiap kakak tingkat yang telah terverifikasi oleh Guru BK dapat membagikan pesan, strategi belajar, serta informasi jurusan atau posisi pekerjaan mereka saat ini.

Siswa diharapkan tetap menjaga etika komunikasi saat menghubungi alumni melalui tautan WhatsApp yang tersedia: perkenalkan nama dan kelas dengan sopan, sampaikan maksud pertanyaan secara ringkas, dan hormati waktu luang kakak tingkat.`,
    imageUrl: '',
    author: 'Redaksi HaloBK SMADA',
    isFeatured: false,
    isPublished: true,
    views: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString()
  }
]

