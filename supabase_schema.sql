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

-- ========================================================
-- 6. TABEL AKUN PENGGUNA (USERS) - ADMIN & ALUMNI/SISWA
-- ========================================================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  email text unique,
  nis text unique,                   -- Nomor Induk Siswa (untuk login alternatif siswa)
  password text not null,            -- Kata sandi akun
  role text not null default 'user', -- 'admin' (Guru BK) atau 'user' (Alumni / Siswa / Pengunjung)
  kelas text default 'XII-1',
  tahun_lulus integer default 2026,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.users enable row level security;

drop policy if exists "Akses publik baca users" on public.users;
drop policy if exists "Akses publik tambah users" on public.users;
drop policy if exists "Akses publik update users" on public.users;
drop policy if exists "Akses publik hapus users" on public.users;

create policy "Akses publik baca users" 
  on public.users for select 
  using (true);

create policy "Akses publik tambah users" 
  on public.users for insert 
  with check (true);

create policy "Akses publik update users" 
  on public.users for update 
  using (true);

create policy "Akses publik hapus users" 
  on public.users for delete 
  using (true);

-- ========================================================
-- 7. SEED DATA AKUN RESMI (ADMIN GURU BK & PENGUNJUNG)
-- ========================================================
insert into public.users (nama, email, nis, password, role, kelas, tahun_lulus)
values 
  ('Guru BK SMADA', 'halobksmada@gmail.com', 'ADMIN01', 'smadahebat', 'admin', 'BK', 2026),
  ('Pengunjung SMADA', 'pengunjung@smadangawi.sch.id', 'GUEST01', 'pengunjung123', 'user', 'Umum', 2026)
on conflict (email) do update 
set password = excluded.password, role = excluded.role, nama = excluded.nama;

-- ========================================================
-- 8. TABEL PENGATURAN APLIKASI (PENGATURAN / RUNNING TEXT)
-- ========================================================
create table if not exists public.pengaturan (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.pengaturan enable row level security;

drop policy if exists "Akses publik baca pengaturan" on public.pengaturan;
drop policy if exists "Akses publik simpan pengaturan" on public.pengaturan;

create policy "Akses publik baca pengaturan" 
  on public.pengaturan for select 
  using (true);

create policy "Akses publik simpan pengaturan" 
  on public.pengaturan for all 
  using (true)
  with check (true);

-- Data Awal Running Text Info Terkini
insert into public.pengaturan (key, value)
values (
  'ticker_text', 
  '📢 Selamat datang di Portal Ruang BK SMA Negeri 2 Ngawi • Pendataan Tracer Study Alumni Angkatan 60 Resmi Dibuka • Kunjungi ruang Bimbingan Konseling untuk layanan konsultasi karir & perguruan tinggi • Maju Bersama, Hebat Semua!'
)
on conflict (key) do nothing;
