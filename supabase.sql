-- ============================================================
-- SIMAWAR — Schema Lengkap (Tanpa GAS/Spreadsheet)
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- ---- SITE CONFIG ----
create table if not exists site_config (
  id          uuid default gen_random_uuid() primary key,
  site_name   text default 'SiMawar Lapas Bandanaira',
  site_desc   text default 'Sistem Informasi Monitoring Warga Binaan',
  logo_url    text,
  favicon_url text,
  instansi    text default 'Lapas Kelas III Bandanaira',
  alamat      text,
  created_at  timestamptz default now()
);
insert into site_config (site_name, site_desc, instansi)
values ('SiMawar Lapas Bandanaira','Sistem Informasi Monitoring Warga Binaan','Lapas Kelas III Bandanaira')
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

-- ---- PEGAWAI (tanpa email/NIP/pangkat/jabatan) ----
create table if not exists pegawai (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid,
  nama           text not null,
  username       text unique not null,
  password_plain text,
  role           text default 'user' check (role in ('admin','user')),
  status         text default 'aktif' check (status in ('aktif','nonaktif')),
  created_at     timestamptz default now()
);

-- ---- WBP ----
create table if not exists wbp (
  id            uuid default gen_random_uuid() primary key,
  nama          text not null,
  foto_url      text,
  jk            text default 'L' check (jk in ('L','P')),
  no_registrasi text unique,
  blok_id       uuid references blok(id) on delete set null,
  tgl_masuk     date,
  tgl_bebas     date,
  masa_pidana   text,
  kasus         text,
  asal          text,
  catatan       text,
  status        text default 'aktif' check (status in ('aktif','bebas','pindah')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ---- ABSEN SESSION (siapa pegang kamar mana hari ini) ----
create table if not exists absen_session (
  id          uuid default gen_random_uuid() primary key,
  pegawai_id  uuid references pegawai(id) on delete cascade,
  blok_id     uuid references blok(id) on delete cascade,
  tanggal     date not null default current_date,
  waktu_mulai timestamptz default now(),
  status      text default 'aktif' check (status in ('aktif','selesai')),
  created_at  timestamptz default now(),
  unique(blok_id, tanggal, status) -- hanya 1 sesi aktif per blok per hari
);

-- ---- ABSEN DETAIL (hasil absen tiap WBP) ----
create table if not exists absen_detail (
  id          uuid default gen_random_uuid() primary key,
  session_id  uuid references absen_session(id) on delete cascade,
  pegawai_id  uuid references pegawai(id) on delete cascade,
  blok_id     uuid references blok(id) on delete cascade,
  wbp_id      uuid references wbp(id) on delete cascade,
  tanggal     date not null default current_date,
  waktu       timestamptz default now(),
  status      text not null check (status in ('Hadir','Tidak Hadir')),
  keterangan  text,
  created_at  timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — Permissive (app handles auth)
-- ============================================================
alter table site_config  enable row level security;
alter table blok         enable row level security;
alter table pegawai      enable row level security;
alter table wbp          enable row level security;
alter table absen_session enable row level security;
alter table absen_detail  enable row level security;

-- Drop semua policy lama
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Buat policy permissive untuk semua tabel
create policy "allow_all_site_config"   on site_config   for all using (true) with check (true);
create policy "allow_all_blok"          on blok          for all using (true) with check (true);
create policy "allow_all_pegawai"       on pegawai       for all using (true) with check (true);
create policy "allow_all_wbp"           on wbp           for all using (true) with check (true);
create policy "allow_all_absen_session" on absen_session for all using (true) with check (true);
create policy "allow_all_absen_detail"  on absen_detail  for all using (true) with check (true);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public) values ('assets','assets',true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('wbp-photos','wbp-photos',true) on conflict do nothing;
drop policy if exists "Public assets"     on storage.objects;
drop policy if exists "Public wbp-photos" on storage.objects;
create policy "Public assets"     on storage.objects for all using (bucket_id='assets')     with check (bucket_id='assets');
create policy "Public wbp-photos" on storage.objects for all using (bucket_id='wbp-photos') with check (bucket_id='wbp-photos');

-- ============================================================
-- UPDATE JIKA TABEL SUDAH ADA (jalankan manual jika perlu)
-- ============================================================
-- alter table pegawai add column if not exists password_plain text;
-- alter table pegawai alter column user_id drop not null;
-- alter table pegawai drop column if exists email;
-- alter table pegawai drop column if exists jabatan;
-- alter table pegawai drop column if exists pangkat;
-- alter table pegawai drop column if exists nip;
-- alter table site_config drop column if exists gas_url;

-- Set password admin:
-- update pegawai set password_plain='PASSWORD_ANDA' where username='admin';
