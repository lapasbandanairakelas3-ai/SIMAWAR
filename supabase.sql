-- ============================================================
-- SIMAWAR — Supabase Schema Lengkap (Versi Bersih)
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ---- SITE CONFIG ----
create table if not exists site_config (
  id         uuid default gen_random_uuid() primary key,
  site_name  text default 'SIMAWAR',
  site_desc  text default 'Sistem Informasi Monitoring Warga Binaan',
  logo_url   text,
  favicon_url text,
  gas_url    text,
  instansi   text default 'Lapas Kelas III Bandanaira',
  alamat     text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
insert into site_config (site_name, site_desc, instansi)
values ('SiMawar Lapas Bandanaira', 'Sistem Informasi Monitoring Warga Binaan', 'Lapas Kelas III Bandanaira')
on conflict do nothing;

-- ---- BLOK / KAMAR ----
create table if not exists blok (
  id         uuid default gen_random_uuid() primary key,
  nama       text not null,
  kapasitas  int,
  jk         text default 'L' check (jk in ('L','P','Campur')),
  keterangan text,
  created_at timestamptz default now()
);

-- ---- WBP ----
create table if not exists wbp (
  id             uuid default gen_random_uuid() primary key,
  nama           text not null,
  foto_url       text,
  jk             text default 'L' check (jk in ('L','P')),
  no_registrasi  text unique,
  blok_id        uuid references blok(id) on delete set null,
  tgl_masuk      date,
  tgl_bebas      date,
  masa_pidana    text,
  kasus          text,
  asal           text,
  catatan        text,
  status         text default 'aktif' check (status in ('aktif','bebas','pindah')),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ---- PEGAWAI (DISEDERHANAKAN — tanpa email, NIP, pangkat, jabatan) ----
create table if not exists pegawai (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid,  -- boleh null untuk Karupam baru
  nama           text not null,       -- cth: Rupam 1, Rupam 2
  username       text unique not null,-- cth: rupam1, rupam2
  password_plain text,                -- password tersimpan agar admin bisa lihat
  role           text default 'user' check (role in ('admin','user')),
  status         text default 'aktif' check (status in ('aktif','nonaktif')),
  created_at     timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table site_config enable row level security;
alter table blok         enable row level security;
alter table wbp          enable row level security;
alter table pegawai      enable row level security;

-- Hapus policy lama (jika ada) sebelum buat baru
drop policy if exists "Public read site_config"    on site_config;
drop policy if exists "Admin manage site_config"   on site_config;
drop policy if exists "Auth read blok"             on blok;
drop policy if exists "Admin manage blok"          on blok;
drop policy if exists "Auth read wbp"              on wbp;
drop policy if exists "Admin manage wbp"           on wbp;
drop policy if exists "Own read pegawai"           on pegawai;
drop policy if exists "Own update pegawai"         on pegawai;
drop policy if exists "Admin manage pegawai"       on pegawai;
drop policy if exists "Insert own pegawai"         on pegawai;
drop policy if exists "Allow all site_config"      on site_config;
drop policy if exists "Allow all blok"             on blok;
drop policy if exists "Allow all wbp"              on wbp;
drop policy if exists "Allow all pegawai"          on pegawai;
drop policy if exists "Public access assets"       on storage.objects;
drop policy if exists "Public access wbp-photos"   on storage.objects;

-- Policy sederhana: semua operasi diizinkan (app-level security)
create policy "Allow all site_config" on site_config for all using (true) with check (true);
create policy "Allow all blok"        on blok        for all using (true) with check (true);
create policy "Allow all wbp"         on wbp         for all using (true) with check (true);
create policy "Allow all pegawai"     on pegawai     for all using (true) with check (true);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public) values ('assets',     'assets',     true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('wbp-photos', 'wbp-photos', true) on conflict do nothing;

create policy "Public assets"     on storage.objects for all using (bucket_id = 'assets')     with check (bucket_id = 'assets');
create policy "Public wbp-photos" on storage.objects for all using (bucket_id = 'wbp-photos') with check (bucket_id = 'wbp-photos');

-- ============================================================
-- JIKA TABEL PEGAWAI SUDAH ADA (JALANKAN INI SAJA)
-- Hapus kolom lama yang tidak dipakai:
-- ============================================================
-- alter table pegawai drop column if exists jabatan;
-- alter table pegawai drop column if exists pangkat;
-- alter table pegawai drop column if exists nip;
-- alter table pegawai drop column if exists email;
-- alter table pegawai add column if not exists password_plain text;
-- alter table pegawai alter column user_id drop not null;

-- ============================================================
-- SETUP ADMIN PERTAMA
-- Setelah jalankan SQL di atas, insert admin:
-- ============================================================
-- insert into pegawai (nama, username, password_plain, role, status)
-- values ('Administrator', 'admin', 'password_admin_anda', 'admin', 'aktif');
--
-- Lalu buka Supabase > Authentication > Users > Add User:
--   Email: admin@simawar.lapas   Password: (sama dengan password_plain di atas)
--   CENTANG "Auto Confirm User"
--
-- Salin UUID user baru, lalu:
-- update pegawai set user_id = 'UUID-ADMIN' where username = 'admin';

-- ============================================================
-- CARA TAMBAH KARUPAM (RUPAM 1, 2, dst)
-- Admin tambah via web > Data Pegawai > Tambah Pegawai
-- Isi nama "Rupam 1", username "rupam1", password bebas
-- Login otomatis berhasil tanpa perlu buat akun Supabase Auth dulu
-- ============================================================
