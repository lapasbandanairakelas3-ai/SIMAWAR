-- ============================================================
-- SIMAWAR v8 — Schema dengan 3x absen per hari
-- ============================================================

-- Tabel absen_detail: tambah kolom shift (Pagi/Siang/Sore)
-- dan unique index berdasarkan wbp_id + tanggal + shift

-- Jika tabel sudah ada, jalankan MIGRATION saja (di bawah)
-- Jika fresh install, jalankan CREATE TABLE di bawah

CREATE TABLE IF NOT EXISTS absen_detail (
  id          uuid default gen_random_uuid() primary key,
  session_id  uuid references absen_session(id) on delete cascade,
  pegawai_id  uuid references pegawai(id) on delete set null,
  blok_id     uuid references blok(id) on delete set null,
  wbp_id      uuid references wbp(id) on delete cascade,
  tanggal     date not null default (current_date at time zone 'Asia/Jayapura')::date,
  shift       text not null default 'Pagi' check (shift in ('Pagi','Siang','Sore')),
  waktu       timestamptz default now(),
  status      text not null check (status in ('Di Kamar','Di Bengkel','Di Kebun','Di Rumah Sakit','Lainnya')),
  keterangan  text,
  created_at  timestamptz default now()
);

-- Unique: 1 WBP per shift per hari
DROP INDEX IF EXISTS idx_absen_wbp_hari;
CREATE UNIQUE INDEX IF NOT EXISTS idx_absen_wbp_hari_shift
  ON absen_detail(wbp_id, tanggal, shift);

-- absen_session: tambah shift juga
DROP INDEX IF EXISTS idx_sesi_aktif;
ALTER TABLE absen_session ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Pagi' CHECK (shift IN ('Pagi','Siang','Sore'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_sesi_aktif_shift
  ON absen_session(blok_id, tanggal, shift) WHERE selesai = false;

-- RLS
ALTER TABLE absen_detail  ENABLE ROW LEVEL SECURITY;
ALTER TABLE absen_session ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_ad" ON absen_detail;
DROP POLICY IF EXISTS "p_as" ON absen_session;
CREATE POLICY "p_ad" ON absen_detail  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "p_as" ON absen_session FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- MIGRATION jika tabel sudah ada:
-- ============================================================
-- ALTER TABLE absen_detail ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Pagi' CHECK (shift IN ('Pagi','Siang','Sore'));
-- UPDATE absen_detail SET shift='Pagi' WHERE shift IS NULL;
-- DROP INDEX IF EXISTS idx_absen_wbp_hari;
-- CREATE UNIQUE INDEX idx_absen_wbp_hari_shift ON absen_detail(wbp_id, tanggal, shift);
-- ALTER TABLE absen_session ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Pagi' CHECK (shift IN ('Pagi','Siang','Sore'));
-- DROP INDEX IF EXISTS idx_sesi_aktif;
-- CREATE UNIQUE INDEX idx_sesi_aktif_shift ON absen_session(blok_id, tanggal, shift) WHERE selesai = false;
