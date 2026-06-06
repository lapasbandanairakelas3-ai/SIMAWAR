-- ============================================================
-- FIX DATABASE SIMAWAR — Jalankan SATU PER SATU di SQL Editor
-- ============================================================

-- STEP 1: Cek struktur absen_session yang ada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'absen_session' ORDER BY ordinal_position;

-- ============================================================
-- STEP 2: Tambah kolom selesai jika belum ada
-- ============================================================
ALTER TABLE absen_session ADD COLUMN IF NOT EXISTS selesai boolean DEFAULT false;

-- Jika ada kolom status lama, migrasikan ke selesai
UPDATE absen_session SET selesai = (status = 'selesai') WHERE selesai IS NULL;

-- Hapus kolom status lama jika ada
ALTER TABLE absen_session DROP COLUMN IF EXISTS status;

-- ============================================================
-- STEP 3: Hapus duplikat di absen_detail
-- Simpan hanya 1 record per WBP per hari (yang paling baru)
-- ============================================================
DELETE FROM absen_detail a
USING absen_detail b
WHERE a.wbp_id = b.wbp_id 
  AND a.tanggal = b.tanggal 
  AND a.created_at < b.created_at;

-- ============================================================
-- STEP 4: Hapus index lama lalu buat baru
-- ============================================================
DROP INDEX IF EXISTS idx_absen_wbp_hari;
DROP INDEX IF EXISTS idx_sesi_aktif;

CREATE UNIQUE INDEX idx_absen_wbp_hari ON absen_detail(wbp_id, tanggal);
CREATE UNIQUE INDEX idx_sesi_aktif ON absen_session(blok_id, tanggal) WHERE selesai = false;

-- ============================================================
-- STEP 5: Tutup semua sesi lama yang mungkin masih terbuka
-- ============================================================
UPDATE absen_session SET selesai = true
WHERE tanggal < CURRENT_DATE;

-- ============================================================
-- STEP 6: Verifikasi
-- ============================================================
SELECT 'absen_session' as tabel, count(*) FROM absen_session
UNION ALL
SELECT 'absen_detail', count(*) FROM absen_detail;

-- Cek masih ada duplikat?
SELECT wbp_id, tanggal, count(*) as jumlah
FROM absen_detail
GROUP BY wbp_id, tanggal
HAVING count(*) > 1;
