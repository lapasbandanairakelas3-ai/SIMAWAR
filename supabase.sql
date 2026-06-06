-- ============================================================
-- SIMAWAR v6 — Schema Final
-- ============================================================

-- SITE CONFIG
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

-- BLOK / KAMAR
create table if not exists blok (
  id         uuid default gen_random_uuid() primary key,
  nama       text not null,
  kapasitas  int,
  jk         text default 'L' check (jk in ('L','P','Campur')),
  keterangan text,
  created_at timestamptz default now()
);

-- PEGAWAI (tanpa status, email, NIP, pangkat, jabatan)
create table if not exists pegawai (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid,
  nama           text not null,
  username       text unique not null,
  password_plain text,
  role           text default 'user' check (role in ('admin','user')),
  created_at     timestamptz default now()
);

-- WBP (tanpa status, asal, catatan, foto)
create table if not exists wbp (
  id            uuid default gen_random_uuid() primary key,
  nama          text not null,
  jk            text default 'L' check (jk in ('L','P')),
  no_registrasi text unique,
  blok_id       uuid references blok(id) on delete set null,
  tgl_bebas     date,
  masa_pidana   text,
  kasus         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ABSEN SESSION (kunci kamar per hari)
-- Gunakan constraint partial agar hanya 1 sesi aktif per blok per hari
create table if not exists absen_session (
  id          uuid default gen_random_uuid() primary key,
  pegawai_id  uuid references pegawai(id) on delete cascade,
  blok_id     uuid references blok(id) on delete cascade,
  tanggal     date not null default (current_date at time zone 'Asia/Jayapura')::date,
  waktu_mulai timestamptz default now(),
  selesai     boolean default false,
  created_at  timestamptz default now()
);
-- Index agar cepat query sesi aktif
create unique index if not exists idx_sesi_aktif
  on absen_session(blok_id, tanggal) where selesai = false;

-- ABSEN DETAIL (tiap WBP)
create table if not exists absen_detail (
  id          uuid default gen_random_uuid() primary key,
  session_id  uuid references absen_session(id) on delete cascade,
  pegawai_id  uuid references pegawai(id) on delete set null,
  blok_id     uuid references blok(id) on delete set null,
  wbp_id      uuid references wbp(id) on delete cascade,
  tanggal     date not null default (current_date at time zone 'Asia/Jayapura')::date,
  waktu       timestamptz default now(),
  status      text not null check (status in ('Hadir','Tidak Hadir')),
  keterangan  text,
  created_at  timestamptz default now()
);
-- Cegah absen WBP yang sama di hari yang sama
create unique index if not exists idx_absen_wbp_hari
  on absen_detail(wbp_id, tanggal);

-- RLS permissive
alter table site_config   enable row level security;
alter table blok          enable row level security;
alter table pegawai       enable row level security;
alter table wbp           enable row level security;
alter table absen_session enable row level security;
alter table absen_detail  enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "p_site_config"   on site_config   for all using (true) with check (true);
create policy "p_blok"          on blok          for all using (true) with check (true);
create policy "p_pegawai"       on pegawai       for all using (true) with check (true);
create policy "p_wbp"           on wbp           for all using (true) with check (true);
create policy "p_absen_session" on absen_session for all using (true) with check (true);
create policy "p_absen_detail"  on absen_detail  for all using (true) with check (true);

-- STORAGE
insert into storage.buckets (id,name,public) values ('assets','assets',true) on conflict do nothing;
insert into storage.buckets (id,name,public) values ('wbp-photos','wbp-photos',true) on conflict do nothing;
drop policy if exists "Public assets"     on storage.objects;
drop policy if exists "Public wbp-photos" on storage.objects;
create policy "Public assets"     on storage.objects for all using (bucket_id='assets')     with check (bucket_id='assets');
create policy "Public wbp-photos" on storage.objects for all using (bucket_id='wbp-photos') with check (bucket_id='wbp-photos');

-- ============================================================
-- JIKA TABEL SUDAH ADA, jalankan ini untuk migrasi:
-- ============================================================
-- alter table pegawai drop column if exists status;
-- alter table wbp drop column if exists status;
-- alter table wbp drop column if exists asal;
-- alter table wbp drop column if exists catatan;
-- alter table wbp drop column if exists foto_url;
-- alter table wbp drop column if exists tgl_masuk;
-- drop index if exists idx_sesi_aktif;
-- create unique index idx_sesi_aktif on absen_session(blok_id,tanggal) where selesai=false;
-- drop index if exists idx_absen_wbp_hari;
-- create unique index idx_absen_wbp_hari on absen_detail(wbp_id,tanggal);
-- update pegawai set password_plain='ADMIN_PASSWORD' where username='admin';
