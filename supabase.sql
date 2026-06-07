-- ============================================================
-- SIMAWAR v7 — Schema Final (tanpa kolom role, status WBP diganti)
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

-- PEGAWAI (tanpa kolom role — admin hanya 1, sisanya Rupam)
create table if not exists pegawai (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid,
  nama           text not null,
  username       text unique not null,
  password_plain text,
  is_admin       boolean default false,  -- true hanya untuk 1 admin
  created_at     timestamptz default now()
);

-- WBP (tanpa foto, asal, catatan, status, tgl_masuk)
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

-- ABSEN SESSION (kunci kamar — 1 sesi per blok per hari)
create table if not exists absen_session (
  id          uuid default gen_random_uuid() primary key,
  pegawai_id  uuid references pegawai(id) on delete cascade,
  blok_id     uuid references blok(id) on delete cascade,
  tanggal     date not null default (current_date at time zone 'Asia/Jayapura')::date,
  waktu_mulai timestamptz default now(),
  selesai     boolean default false,
  created_at  timestamptz default now()
);
create unique index if not exists idx_sesi_aktif
  on absen_session(blok_id, tanggal) where selesai = false;

-- ABSEN DETAIL
-- Status baru: Di Kamar | Di Bengkel | Di Kebun | Di Rumah Sakit | Lainnya
create table if not exists absen_detail (
  id          uuid default gen_random_uuid() primary key,
  session_id  uuid references absen_session(id) on delete cascade,
  pegawai_id  uuid references pegawai(id) on delete set null,
  blok_id     uuid references blok(id) on delete set null,
  wbp_id      uuid references wbp(id) on delete cascade,
  tanggal     date not null default (current_date at time zone 'Asia/Jayapura')::date,
  waktu       timestamptz default now(),
  status      text not null check (status in ('Di Kamar','Di Bengkel','Di Kebun','Di Rumah Sakit','Lainnya')),
  keterangan  text,
  created_at  timestamptz default now()
);
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

create policy "p_sc"  on site_config   for all using (true) with check (true);
create policy "p_bl"  on blok          for all using (true) with check (true);
create policy "p_pg"  on pegawai       for all using (true) with check (true);
create policy "p_wb"  on wbp           for all using (true) with check (true);
create policy "p_as"  on absen_session for all using (true) with check (true);
create policy "p_ad"  on absen_detail  for all using (true) with check (true);

-- STORAGE
insert into storage.buckets (id,name,public) values ('assets','assets',true) on conflict do nothing;
insert into storage.buckets (id,name,public) values ('wbp-photos','wbp-photos',true) on conflict do nothing;
drop policy if exists "Public assets"     on storage.objects;
drop policy if exists "Public wbp-photos" on storage.objects;
create policy "Public assets"     on storage.objects for all using (bucket_id='assets')     with check (bucket_id='assets');
create policy "Public wbp-photos" on storage.objects for all using (bucket_id='wbp-photos') with check (bucket_id='wbp-photos');

-- ============================================================
-- MIGRASI JIKA SUDAH ADA TABEL (jalankan manual)
-- ============================================================
-- Ganti kolom role dengan is_admin:
-- alter table pegawai add column if not exists is_admin boolean default false;
-- update pegawai set is_admin = (role = 'admin');
-- alter table pegawai drop column if exists role;
-- alter table pegawai drop column if exists status;

-- Ganti status absen_detail ke format baru:
-- alter table absen_detail drop constraint if exists absen_detail_status_check;
-- update absen_detail set status='Di Kamar' where status='Hadir';
-- update absen_detail set
--   status = case
--     when keterangan ilike '%bengkel%' or keterangan ilike '%bangkel%' then 'Di Bengkel'
--     when keterangan ilike '%kebun%' then 'Di Kebun'
--     when keterangan ilike '%rumah sakit%' or keterangan ilike '%rs%' then 'Di Rumah Sakit'
--     when status = 'Tidak Hadir' then 'Lainnya'
--     else status
--   end
-- where status = 'Tidak Hadir' or status = 'Lainnya';
-- alter table absen_detail add constraint absen_detail_status_check
--   check (status in ('Di Kamar','Di Bengkel','Di Kebun','Di Rumah Sakit','Lainnya'));

-- Pastikan kolom selesai ada:
-- alter table absen_session add column if not exists selesai boolean default false;
-- Rebuild index:
-- drop index if exists idx_absen_wbp_hari; drop index if exists idx_sesi_aktif;
-- create unique index idx_absen_wbp_hari on absen_detail(wbp_id, tanggal);
-- create unique index idx_sesi_aktif on absen_session(blok_id, tanggal) where selesai=false;
