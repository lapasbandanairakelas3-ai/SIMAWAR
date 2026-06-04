-- ============================================================
-- SUPABASE SCHEMA — SiHadir Lapas Bandanaira
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ---- SITE CONFIG ----
create table if not exists site_config (
  id uuid default gen_random_uuid() primary key,
  site_name text default 'SIMAWAR',
  site_desc text default 'Sistem Informasi Monitoring Warga Binaan',
  logo_url text,
  favicon_url text,
  gas_url text,
  instansi text default 'Lapas Kelas III Bandanaira',
  alamat text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insert default config
insert into site_config (site_name, site_desc, instansi)
values ('SIMAWAR', 'Sistem Informasi Monitoring Warga Binaan
Lapas Bandanaira', 'Lapas Kelas III Bandanaira')
on conflict do nothing;

-- Jika tabel sudah ada, tambah kolom baru:
-- alter table site_config add column if not exists instansi text;
-- alter table site_config add column if not exists alamat text;

-- ---- BLOK / KAMAR ----
create table if not exists blok (
  id uuid default gen_random_uuid() primary key,
  nama text not null,
  kapasitas int,
  jk text default 'L' check (jk in ('L', 'P', 'Campur')),
  keterangan text,
  created_at timestamptz default now()
);

-- ---- WBP ----
create table if not exists wbp (
  id uuid default gen_random_uuid() primary key,
  nama text not null,
  foto_url text,
  jk text default 'L' check (jk in ('L', 'P')),
  no_registrasi text unique,
  blok_id uuid references blok(id) on delete set null,
  tgl_masuk date,
  tgl_bebas date,
  masa_pidana text,
  kasus text,
  asal text,
  catatan text,
  status text default 'aktif' check (status in ('aktif', 'bebas', 'pindah')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---- PEGAWAI ----
create table if not exists pegawai (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  nama text not null,
  jabatan text,
  pangkat text,
  nip text,
  username text unique not null,
  email text unique not null,
  role text default 'user' check (role in ('admin', 'user')),
  status text default 'aktif' check (status in ('aktif', 'nonaktif')),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table site_config enable row level security;
alter table blok enable row level security;
alter table wbp enable row level security;
alter table pegawai enable row level security;

-- site_config: semua bisa baca, hanya admin bisa ubah
create policy "Public read site_config" on site_config for select using (true);
create policy "Admin manage site_config" on site_config for all
  using (exists (select 1 from pegawai where user_id = auth.uid() and role = 'admin'));

-- blok: semua user login bisa baca, admin bisa CRUD
create policy "Auth read blok" on blok for select using (auth.uid() is not null);
create policy "Admin manage blok" on blok for all
  using (exists (select 1 from pegawai where user_id = auth.uid() and role = 'admin'));

-- wbp: semua user login bisa baca, admin bisa CRUD
create policy "Auth read wbp" on wbp for select using (auth.uid() is not null);
create policy "Admin manage wbp" on wbp for all
  using (exists (select 1 from pegawai where user_id = auth.uid() and role = 'admin'));

-- pegawai: semua bisa baca data sendiri, admin bisa semua
create policy "Own read pegawai" on pegawai for select using (auth.uid() is not null);
create policy "Own update pegawai" on pegawai for update using (user_id = auth.uid());
create policy "Admin manage pegawai" on pegawai for all
  using (exists (select 1 from pegawai where user_id = auth.uid() and role = 'admin'));
create policy "Insert own pegawai" on pegawai for insert with check (true);

-- ============================================================
-- STORAGE BUCKETS
-- (Buat di Supabase Dashboard > Storage > New Bucket)
-- ============================================================
-- Bucket: wbp-photos (Public)
-- Bucket: assets (Public) — untuk logo dan favicon

-- ============================================================
-- TRIGGER: updated_at otomatis
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger wbp_updated_at before update on wbp
  for each row execute function update_updated_at();

create trigger site_config_updated_at before update on site_config
  for each row execute function update_updated_at();

-- ============================================================
-- ADMIN DEFAULT (Ubah email/password sesuai kebutuhan)
-- ============================================================
-- 1. Buat user di Supabase Auth Dashboard > Users > Create User
--    Email: admin@lapas-bandanaira.go.id | Password: Admin@12345
-- 2. Jalankan query ini dengan mengganti UUID dari user yang baru dibuat:
--
-- insert into pegawai (user_id, nama, jabatan, pangkat, username, email, role, status)
-- values (
--   'UUID-DARI-AUTH-USER-ADMIN',
--   'Administrator',
--   'Administrator Sistem',
--   'Penata / III-c',
--   'admin',
--   'admin@lapas-bandanaira.go.id',
--   'admin',
--   'aktif'
-- );
