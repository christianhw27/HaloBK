-- ========================================================
-- SKEMA DATABASE SUPABASE: HALLO ALUMNI SMA NEGERI 2 NGAWI
-- (Mode Langsung Tanpa Wajib Login / Public Anon Access)
-- Jalankan skrip ini di menu SQL Editor pada dashboard Supabase
-- ========================================================

-- 1. TABEL DATA ALUMNI (ALUMNI)
create table if not exists public.alumni (
  id uuid primary key default gen_random_uuid(),
  nama_lengkap text not null,
  kelas_terakhir text default 'XII-1',
  tahun_lulus integer not null default 2026,
  no_wa text,
  kategori text not null,        -- 'PTN', 'PTS', 'Kedinasan', 'TNI/Polri', 'Bekerja', 'Wirausaha', dll
  jalur_masuk text not null,     -- 'SNBP', 'SNBT', 'Mandiri', 'Ikatan Dinas', dll
  instansi text not null,        -- Nama Perguruan Tinggi / Perusahaan / Lembaga
  jurusan_posisi text,           -- Jurusan kuliah atau Posisi pekerjaan
  pesan text,                    -- Tips dan pesan untuk adik kelas SMADA
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
