-- ========================================================
-- SKEMA DATABASE SUPABASE: HALLO ALUMNI SMA NEGERI 2 NGAWI
-- (Mode Langsung Tanpa Wajib Login / Public Anon Access)
-- Jalankan skrip ini di menu SQL Editor pada dashboard Supabase
-- ========================================================

-- PERBARUI TABEL YANG SUDAH ADA (Tambahkan kolom foto & NIS jika belum ada):
alter table public.alumni add column if not exists foto_url text;
alter table public.alumni add column if not exists nis text;

-- 1. TABEL DATA ALUMNI (ALUMNI)
create table if not exists public.alumni (
  id uuid primary key default gen_random_uuid(),
  nama_lengkap text not null,
  nis text,                      -- Nomor Induk Siswa (NIS)
  kelas_terakhir text default 'XII-1',
  tahun_lulus integer not null default 2026,
  no_wa text,
  kategori text not null,        -- 'PTN', 'PTS', 'Kedinasan', 'TNI/Polri', 'Bekerja', 'Wirausaha', dll
  jalur_masuk text not null,     -- 'SNBP', 'SNBT', 'Mandiri', 'Ikatan Dinas', dll
  instansi text not null,        -- Nama Perguruan Tinggi / Perusahaan / Lembaga
  jurusan_posisi text,           -- Jurusan kuliah atau Posisi pekerjaan
  pesan text,                    -- Tips dan pesan untuk adik kelas SMADA
  foto_url text,                 -- Foto profil atau almamater alumni (opsional)
  is_verified boolean default false, -- Status ACC dari Guru BK (false = pending, true = verified)
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. AKTIFKAN ROW LEVEL SECURITY (RLS)
alter table public.alumni enable row level security;

-- 3. HAPUS POLICIES LAMA JIKA ADA
drop policy if exists "Akses publik baca alumni" on public.alumni;
drop policy if exists "Akses publik tambah alumni" on public.alumni;
drop policy if exists "Akses publik update alumni" on public.alumni;
drop policy if exists "Akses publik hapus alumni" on public.alumni;

-- 4. KEBIJAKAN KEAMANAN (RLS) TERBUKA UNTUK TESTING FITUR
-- Memungkinkan aplikasi langsung membaca & menulis data menggunakan Anon Key tanpa perlu login email
create policy "Akses publik baca alumni" 
  on public.alumni for select 
  using (true);

create policy "Akses publik tambah alumni" 
  on public.alumni for insert 
  with check (true);

create policy "Akses publik update alumni" 
  on public.alumni for update 
  using (true);

create policy "Akses publik hapus alumni" 
  on public.alumni for delete 
  using (true);

-- ========================================================
-- 5. TABEL BERITA & PENGUMUMAN BK (BERITA)
-- ========================================================
create table if not exists public.berita (
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

drop policy if exists "Akses publik baca berita" on public.berita;
drop policy if exists "Akses publik tambah berita" on public.berita;
drop policy if exists "Akses publik update berita" on public.berita;
drop policy if exists "Akses publik hapus berita" on public.berita;

create policy "Akses publik baca berita" 
  on public.berita for select 
  using (true);

create policy "Akses publik tambah berita" 
  on public.berita for insert 
  with check (true);

create policy "Akses publik update berita" 
  on public.berita for update 
  using (true);

create policy "Akses publik hapus berita" 
  on public.berita for delete 
  using (true);
