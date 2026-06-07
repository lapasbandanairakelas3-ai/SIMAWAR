-- ============================================================
-- FIX DATABASE v8 — Jalankan satu per satu di SQL Editor
-- ============================================================

-- STEP 1: Tambah kolom shift ke absen_detail
ALTER TABLE absen_detail ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Pagi';
UPDATE absen_detail SET shift = 'Pagi' WHERE shift IS NULL;
ALTER TABLE absen_detail DROP CONSTRAINT IF EXISTS absen_detail_shift_check;
ALTER TABLE absen_detail ADD CONSTRAINT absen_detail_shift_check CHECK (shift IN ('Pagi','Siang','Sore'));

-- STEP 2: Tambah kolom shift ke absen_session
ALTER TABLE absen_session ADD COLUMN IF NOT EXISTS shift text DEFAULT 'Pagi';
UPDATE absen_session SET shift = 'Pagi' WHERE shift IS NULL;

-- STEP 3: Rebuild index — unique per WBP per shift per hari
DROP INDEX IF EXISTS idx_absen_wbp_hari;
DROP INDEX IF EXISTS idx_absen_wbp_hari_shift;
CREATE UNIQUE INDEX idx_absen_wbp_hari_shift ON absen_detail(wbp_id, tanggal, shift);

-- STEP 4: Rebuild index sesi
DROP INDEX IF EXISTS idx_sesi_aktif;
DROP INDEX IF EXISTS idx_sesi_aktif_shift;
CREATE UNIQUE INDEX idx_sesi_aktif_shift ON absen_session(blok_id, tanggal, shift) WHERE selesai = false;

-- STEP 5: Fix kolom is_admin jika belum ada
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
UPDATE pegawai SET is_admin = (role = 'admin') WHERE role IS NOT NULL AND is_admin IS NOT TRUE;

-- STEP 6: Verifikasi
SELECT 'absen_detail kolom' as cek, column_name FROM information_schema.columns WHERE table_name='absen_detail' AND column_name='shift';
SELECT 'absen_session kolom' as cek, column_name FROM information_schema.columns WHERE table_name='absen_session' AND column_name='shift';
SELECT 'total absen' as cek, count(*) FROM absen_detail;
