-- ============================================================
-- FIX DATABASE SIMAWAR v7
-- Jalankan SATU PER SATU di Supabase SQL Editor
-- ============================================================

-- STEP 1: Tambah kolom is_admin, selesai jika belum ada
ALTER TABLE pegawai ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE absen_session ADD COLUMN IF NOT EXISTS selesai boolean DEFAULT false;

-- STEP 2: Migrasi kolom role ke is_admin
UPDATE pegawai SET is_admin = (role = 'admin') WHERE role IS NOT NULL;

-- STEP 3: Hapus kolom yang tidak dipakai
ALTER TABLE pegawai DROP COLUMN IF EXISTS role;
ALTER TABLE pegawai DROP COLUMN IF EXISTS status;
ALTER TABLE wbp DROP COLUMN IF EXISTS status;
ALTER TABLE wbp DROP COLUMN IF EXISTS asal;
ALTER TABLE wbp DROP COLUMN IF EXISTS catatan;
ALTER TABLE wbp DROP COLUMN IF EXISTS foto_url;
ALTER TABLE wbp DROP COLUMN IF EXISTS tgl_masuk;
ALTER TABLE site_config DROP COLUMN IF EXISTS gas_url;

-- STEP 4: Hapus duplikat absen_detail (simpan yang terbaru per WBP per hari)
DELETE FROM absen_detail a
USING absen_detail b
WHERE a.wbp_id = b.wbp_id
  AND a.tanggal = b.tanggal
  AND a.created_at < b.created_at;

-- STEP 5: Migrasi status absen_detail ke format baru
-- Hapus constraint lama dulu
ALTER TABLE absen_detail DROP CONSTRAINT IF EXISTS absen_detail_status_check;

-- Update status lama ke format baru
UPDATE absen_detail SET
  status = CASE
    WHEN status = 'Hadir'        THEN 'Di Kamar'
    WHEN keterangan ILIKE '%bengkel%' OR keterangan ILIKE '%bangkel%' THEN 'Di Bengkel'
    WHEN keterangan ILIKE '%kebun%'   THEN 'Di Kebun'
    WHEN keterangan ILIKE '%rumah sakit%' OR keterangan ILIKE '% rs %' THEN 'Di Rumah Sakit'
    WHEN status = 'Tidak Hadir'  THEN 'Lainnya'
    ELSE status
  END
WHERE status IN ('Hadir','Tidak Hadir');

-- Tambah constraint baru
ALTER TABLE absen_detail ADD CONSTRAINT absen_detail_status_check
  CHECK (status IN ('Di Kamar','Di Bengkel','Di Kebun','Di Rumah Sakit','Lainnya'));

-- STEP 6: Rebuild unique indexes
DROP INDEX IF EXISTS idx_absen_wbp_hari;
DROP INDEX IF EXISTS idx_sesi_aktif;
CREATE UNIQUE INDEX idx_absen_wbp_hari ON absen_detail(wbp_id, tanggal);
CREATE UNIQUE INDEX idx_sesi_aktif ON absen_session(blok_id, tanggal) WHERE selesai = false;

-- STEP 7: Tutup sesi lama yang tidak selesai
UPDATE absen_session SET selesai = true WHERE tanggal < CURRENT_DATE;

-- STEP 8: Verifikasi
SELECT 'pegawai kolom' as info, column_name FROM information_schema.columns WHERE table_name='pegawai' ORDER BY ordinal_position;
SELECT 'absen_detail status' as info, status, count(*) FROM absen_detail GROUP BY status;
